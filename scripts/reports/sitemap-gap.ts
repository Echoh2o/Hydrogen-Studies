/**
 * PLAN.md 1.2 — Sitemap-blog gap report.
 *
 * The blog sitemap includes exactly `is_published = true AND is_archived = false`
 * (see /sitemap-blog.xml in seo-routes.ts) — this report quantifies the gap
 * between total DB articles and sitemap URLs, and VERIFIES that excluded
 * articles are not silently 200 + indexable (they should 404 for crawlers).
 *
 * READ-ONLY. Writes reports/sitemap-gap.csv.
 * Run: `railway run -- npx tsx scripts/reports/sitemap-gap.ts`
 */
import fs from "fs";
import { db } from "../../server/db";
import { sql } from "drizzle-orm";

const SITE_URL = process.env.SITE_URL || "https://hydrogenstudies.com";

async function statusOf(url: string, ua: string): Promise<number> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": ua },
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    return res.status;
  } catch {
    return -1;
  }
}

async function main() {
  const counts = (
    await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE is_published = true AND is_archived = false)::int AS in_sitemap,
        COUNT(*) FILTER (WHERE is_published = false)::int AS drafts,
        COUNT(*) FILTER (WHERE is_archived = true)::int AS archived
      FROM blog_articles
    `)
  ).rows[0] as any;

  console.log("=== sitemap-blog gap ===");
  console.log(`total articles:        ${counts.total}`);
  console.log(`in sitemap (published+not archived): ${counts.in_sitemap}`);
  console.log(`drafts (unpublished):  ${counts.drafts}`);
  console.log(`archived:              ${counts.archived}`);
  console.log(`RULE: sitemap-blog.xml = is_published AND NOT is_archived (quality gate, not a bug)`);

  // Sample 10 excluded articles and verify they are NOT crawlable (bot UA
  // should get a hard 404; a 200 would be an index leak).
  const excluded = (
    await db.execute(sql`
      SELECT id, slug FROM blog_articles
      WHERE is_published = false OR is_archived = true
      ORDER BY random() LIMIT 10
    `)
  ).rows as Array<{ id: number; slug: string }>;

  const lines = ["id,slug,bot_status,browser_status,leak"];
  let leaks = 0;
  for (const b of excluded) {
    const url = `${SITE_URL}/blog/${encodeURIComponent(b.slug)}`;
    const botStatus = await statusOf(url, "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)");
    const browserStatus = await statusOf(url, "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/128 Safari/537.36");
    const leak = botStatus === 200;
    if (leak) leaks++;
    lines.push(`${b.id},${b.slug},${botStatus},${browserStatus},${leak}`);
    console.log(`  ${b.id} bot=${botStatus} browser=${browserStatus}${leak ? "  ← LEAK" : ""}`);
  }

  fs.mkdirSync("reports", { recursive: true });
  fs.writeFileSync(
    "reports/sitemap-gap.csv",
    `# totals: total=${counts.total} in_sitemap=${counts.in_sitemap} drafts=${counts.drafts} archived=${counts.archived}\n` +
      `# rule: sitemap = is_published AND NOT is_archived\n` +
      lines.join("\n"),
  );
  console.log(`\nSampled ${excluded.length} excluded articles — ${leaks} leak(s) (bot 200s).`);
  console.log("Wrote reports/sitemap-gap.csv");
  process.exit(0);
}

main().catch((e) => {
  console.error("sitemap-gap failed:", e);
  process.exit(1);
});
