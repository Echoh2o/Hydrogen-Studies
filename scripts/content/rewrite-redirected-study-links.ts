/**
 * Rewrite /study/<old-slug> links inside published blog_articles.content to their final
 * permanent URL, using the redirects table (follows chains). Mechanical: the
 * link still goes to the same page, minus a 301 hop. Targets that end in a
 * 410 or a non-study path are left alone and reported.
 *
 *   DATABASE_URL=... npx tsx scripts/content/rewrite-redirected-study-links.ts          # dry run
 *   DATABASE_URL=... npx tsx scripts/content/rewrite-redirected-study-links.ts --apply  # backup + write
 */
import { writeFileSync, mkdirSync } from "fs";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const LINK = /(\]\(|href=["'])(?:https?:\/\/(?:www\.)?hydrogenstudies\.com)?(\/study\/[a-z0-9-]+)(?=[)"'#?])/gi;

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  client.on("error", (e) => console.error("pg error", e.message));
  await client.connect();
  const red = await client.query(`SELECT from_path, to_path, status_code FROM redirects WHERE is_active AND from_path LIKE '/study/%'`);
  const map = new Map<string, { to: string; code: number }>(red.rows.map((r) => [r.from_path, { to: r.to_path, code: r.status_code }]));
  const live = new Set((await client.query(`SELECT '/study/' || slug AS p FROM studies WHERE slug IS NOT NULL AND is_excluded = false`)).rows.map((r) => r.p));

  const finalOf = (p: string): string | null => {
    let cur = p;
    for (let i = 0; i < 6; i++) {
      const r = map.get(cur);
      if (!r) return cur;
      if (r.code === 410 || !r.to.startsWith("/study/")) return null;
      cur = r.to;
    }
    return null;
  };

  const posts = (await client.query(`SELECT id, slug, content FROM blog_articles WHERE content LIKE '%/study/%' AND is_archived = false AND is_published = true`)).rows;
  const changes: { id: number; slug: string; before: string; replaced: [string, string][] }[] = [];
  const skipped: [string, string][] = [];
  for (const p of posts) {
    const replaced: [string, string][] = [];
    const next = String(p.content).replace(LINK, (m, pre: string, path: string) => {
      if (!map.has(path)) return m;
      const fin = finalOf(path);
      if (!fin || !live.has(fin)) { skipped.push([p.slug, path]); return m; }
      replaced.push([path, fin]);
      return `${pre}${fin}`;
    });
    if (replaced.length) changes.push({ id: p.id, slug: p.slug, before: p.content, replaced });
    if (APPLY && replaced.length) await client.query(`UPDATE blog_articles SET content = $1 WHERE id = $2`, [next, p.id]);
  }
  const links = changes.reduce((n, c) => n + c.replaced.length, 0);
  console.log(`${APPLY ? "APPLIED" : "DRY RUN"}: ${changes.length} posts, ${links} links rewritten; ${skipped.length} left (410 / non-study / not live)`);
  for (const c of changes.slice(0, 15)) console.log(`  ${c.slug}: ${c.replaced.length}`);
  for (const s of skipped.slice(0, 10)) console.log(`  skipped ${s[0]} → ${s[1]}`);
  if (APPLY) {
    mkdirSync("reports/backups", { recursive: true });
    const f = `reports/backups/blog-study-links-${Date.now()}.json`;
    writeFileSync(f, JSON.stringify(changes.map(({ id, slug, before, replaced }) => ({ id, slug, before, replaced })), null, 1));
    console.log(`backup: ${f}`);
  }
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
