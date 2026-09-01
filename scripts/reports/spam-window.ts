/**
 * PLAN.md 0.11 — Spam-update impact: Aug 10–17 vs Aug 22–29 clicks/impressions
 * split by site section, from the synced GSC data. Report only.
 * Run: railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/reports/spam-window.ts'
 */
import { db } from "../../server/db";
import { sql } from "drizzle-orm";

async function main() {
  const r = await db.execute(sql`
    SELECT
      CASE
        WHEN page LIKE '%/blog/%' THEN '/blog/'
        WHEN page LIKE '%/study/%' THEN '/study/'
        WHEN page LIKE '%/explore-by-%' THEN '/explore-by-*'
        WHEN page LIKE '%/hydrogen-for/%' THEN '/hydrogen-for/'
        ELSE 'other'
      END AS section,
      CASE WHEN date BETWEEN '2026-08-10' AND '2026-08-17' THEN 'aug10-17' ELSE 'aug22-29' END AS win,
      SUM(clicks)::int AS clicks,
      SUM(impressions)::int AS impressions
    FROM gsc_query_metrics
    WHERE date BETWEEN '2026-08-10' AND '2026-08-17'
       OR date BETWEEN '2026-08-22' AND '2026-08-29'
    GROUP BY 1, 2
    ORDER BY 1, 2
  `);
  for (const row of r.rows as any[]) {
    console.log(
      `${String(row.section).padEnd(15)} ${row.win}  clicks=${row.clicks}  impressions=${row.impressions}`,
    );
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
