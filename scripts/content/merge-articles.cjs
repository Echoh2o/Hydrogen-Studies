// Merge duplicate posts into a survivor: unpublish loser + 301 loser → survivor.
// Dry-run by default; --apply writes. Merges are content-destructive (CLAUDE.md):
// run --apply only after Josh approves the exact survivor/loser list.
//   railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" NODE_PATH=$PWD/node_modules \
//     node scripts/content/merge-articles.cjs --survivor <slug> <loser-slug>... [--apply] [--approval "<quote>"]'
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const APPLY = process.argv.includes("--apply");
const argv = process.argv.slice(2);
const flagValue = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const SURVIVOR = flagValue("--survivor");
const APPROVAL = flagValue("--approval") || "unspecified";
const LOSERS = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--survivor" && argv[i - 1] !== "--approval");
const STAMP = new Date().toISOString().slice(0, 10);
const ACTOR = `claude-code (approved: josh ${STAMP} '${APPROVAL}')`;
if (!SURVIVOR || !LOSERS.length) { console.error("usage: --survivor <slug> <loser>... [--apply]"); process.exit(1); }

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const survivor = (await db.query(`select id, is_published from blog_articles where slug = $1`, [SURVIVOR])).rows[0];
  if (!survivor || !survivor.is_published) throw new Error("survivor missing or unpublished");

  for (const slug of LOSERS) {
    const row = (await db.query(`select * from blog_articles where slug = $1`, [slug])).rows[0];
    const from = `/blog/${slug}`;
    const existing = (await db.query(`select * from redirects where from_path = $1`, [from])).rows[0];
    console.log(`${slug}: id=${row?.id} published=${row?.is_published} existing redirect=${existing ? existing.status_code + "→" + existing.to_path : "none"}`);
    if (!APPLY || !row) continue;
    fs.writeFileSync(path.join(process.env.BACKUP_DIR || __dirname, `backup-${slug}-${Date.now()}.json`), JSON.stringify(row, null, 2));
    await db.query("begin");
    try {
      await db.query(
        `update blog_articles set is_published = false, updated_at = now(), editor_notes = coalesce(editor_notes || E'\n', '') || $1 where id = $2`,
        [`[${STAMP}] Merged into /blog/${SURVIVOR} (301). Approved: ${APPROVAL}`, row.id],
      );
      if (existing) {
        await db.query(`update redirects set to_path = $1, status_code = 301, is_active = true, note = coalesce(note,'') || $3 where id = $2`, [`/blog/${SURVIVOR}`, existing.id, ` | merge ${STAMP}`]);
      } else {
        await db.query(
          `insert into redirects (from_path, to_path, status_code, is_active, note) values ($1, $2, 301, true, $3)`,
          [from, `/blog/${SURVIVOR}`, `merge ${STAMP}: duplicate of /blog/${SURVIVOR}`],
        );
      }
      await db.query(
        `insert into redirect_actions_log (action, from_path, to_path, status_code, actor, note) values ('merge', $1, $2, 301, $3, $4)`,
        [from, `/blog/${SURVIVOR}`, ACTOR, "unpublished duplicate (fold any unique, verified substance into the survivor before merging)"],
      );
      await db.query("commit");
      console.log("  ✓ merged");
    } catch (e) {
      await db.query("rollback");
      throw e;
    }
  }
  await db.end();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
