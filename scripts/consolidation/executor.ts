/**
 * PLAN.md Phase 2 — supervised consolidation executor.
 *
 * DRY-RUN BY DEFAULT. Reads reports/keep-list.csv (the report Josh approves)
 * and:
 *   --plan   (default) prints exactly what would happen: totals + 20 sample
 *            rows per action. Writes nothing. Touches nothing.
 *   --apply  performs it in batches of 500 with a log:
 *            merge  → 301 loser → cluster survivor via the redirect system
 *            retire → unpublish (isPublished=false) so the URL returns the
 *                     bot-SSR hard 404/410 path; recorded for the 410 map
 *            keep   → byline/reviewed-date upgrades happen in 2.4, not here
 *            Sitemaps regenerate automatically (DB-driven) — cache clears on
 *            deploy/1h TTL. Log: reports/redirects-applied.csv.
 *
 * SAFETY:
 *  - refuses to --apply unless reports/keep-list.csv contains the marker line
 *    "approved-by: josh" (add it to the top of the file when approving).
 *  - never touches studies, only blog_articles.
 *  - reversible: retired articles are unpublished, not deleted; republishing
 *    restores them.
 *
 * Run (dry):   railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/consolidation/executor.ts --plan'
 * Run (real):  … --apply
 */
import fs from "fs";
import { db } from "../../server/db";
import { sql } from "drizzle-orm";

const APPLY = process.argv.includes("--apply");
const BATCH = 500;

type Row = {
  url: string; id: number; action: "keep" | "merge" | "retire";
  cluster: string; clicks: number; impressions: number;
};

function parseCsv(path: string): { rows: Row[]; approved: boolean } {
  const text = fs.readFileSync(path, "utf8");
  const approved = /approved-by:\s*josh/i.test(text);
  const lines = text.split("\n").filter((l) => l && !l.startsWith("#") && !l.startsWith("approved-by"));
  const header = lines[0].split(",");
  const idx = (name: string) => header.indexOf(name);
  const rows: Row[] = [];
  for (const line of lines.slice(1)) {
    // naive CSV parse is fine: url/id/action/cluster columns never contain commas
    const cols = line.split(",");
    rows.push({
      url: cols[idx("url")],
      id: parseInt(cols[idx("id")], 10),
      action: cols[idx("action")] as Row["action"],
      cluster: cols[idx("cluster")],
      clicks: parseInt(cols[idx("clicks")], 10) || 0,
      impressions: parseInt(cols[idx("impressions")], 10) || 0,
    });
  }
  return { rows, approved };
}

async function main() {
  const { rows, approved } = parseCsv("reports/keep-list.csv");
  const byAction = { keep: [] as Row[], merge: [] as Row[], retire: [] as Row[] };
  for (const r of rows) byAction[r.action]?.push(r);

  // survivor per cluster = the keep with most clicks
  const survivors = new Map<string, Row>();
  for (const k of byAction.keep) {
    const cur = survivors.get(k.cluster);
    if (!cur || k.clicks > cur.clicks || (k.clicks === cur.clicks && k.impressions > cur.impressions)) {
      survivors.set(k.cluster, k);
    }
  }

  console.log("=== consolidation plan ===");
  console.log(`keep:   ${byAction.keep.length}`);
  console.log(`merge:  ${byAction.merge.length} (301 → cluster survivor)`);
  console.log(`retire: ${byAction.retire.length} (unpublish → crawler 404/410)`);
  for (const action of ["merge", "retire"] as const) {
    console.log(`\n-- sample ${action} (20):`);
    for (const r of byAction[action].slice(0, 20)) {
      const target = action === "merge" ? survivors.get(r.cluster)?.url ?? "(no survivor?)" : "410";
      console.log(`   ${r.url} → ${target}`);
    }
  }

  if (!APPLY) {
    console.log("\nDRY RUN — nothing changed. Re-run with --apply after approval.");
    process.exit(0);
  }
  if (!approved) {
    console.error(
      "\nREFUSING --apply: reports/keep-list.csv has no 'approved-by: josh' marker.\n" +
        "Add that line to the top of the file to authorize execution (PLAN.md §2).",
    );
    process.exit(1);
  }

  fs.mkdirSync("reports", { recursive: true });
  const log = fs.createWriteStream("reports/redirects-applied.csv", { flags: "a" });
  log.write(`# apply run ${new Date().toISOString()}\naction,id,url,target\n`);

  // merges: 301 via the redirect system, then unpublish the loser
  let done = 0;
  for (const r of byAction.merge) {
    const survivor = survivors.get(r.cluster);
    if (!survivor || survivor.id === r.id) continue;
    const fromPath = new URL(r.url).pathname;
    const toPath = new URL(survivor.url).pathname;
    await db.execute(sql`
      INSERT INTO redirects (from_path, to_path, status_code, note, is_active)
      VALUES (${fromPath}, ${toPath}, 301, 'phase2-consolidation-merge', true)
      ON CONFLICT (from_path) DO UPDATE
        SET to_path = EXCLUDED.to_path, status_code = 301, is_active = true
    `);
    await db.execute(sql`UPDATE blog_articles SET is_published = false WHERE id = ${r.id}`);
    log.write(`merge,${r.id},${r.url},${survivor.url}\n`);
    if (++done % BATCH === 0) console.log(`  merged ${done}/${byAction.merge.length}`);
  }

  // retires: unpublish (bot middleware serves hard 404; sitemap regenerates without them)
  done = 0;
  for (let i = 0; i < byAction.retire.length; i += BATCH) {
    const batch = byAction.retire.slice(i, i + BATCH);
    // Per-row updates: drizzle's sql template expands JS arrays into a
    // parenthesized param list, which breaks an ANY(...)::int[] cast.
    // 410 rows in the redirect system (middleware serves a real 410 Gone).
    for (const r of batch) {
      await db.execute(sql`UPDATE blog_articles SET is_published = false WHERE id = ${r.id}`);
      const fromPath = new URL(r.url).pathname;
      await db.execute(sql`
        INSERT INTO redirects (from_path, to_path, status_code, note, is_active)
        VALUES (${fromPath}, '-', 410, 'phase2-consolidation-retire', true)
        ON CONFLICT (from_path) DO UPDATE SET status_code = 410, is_active = true
      `);
      log.write(`retire,${r.id},${r.url},410\n`);
    }
    done += batch.length;
    console.log(`  retired ${done}/${byAction.retire.length}`);
  }

  log.end();
  console.log("\nAPPLY complete. Log: reports/redirects-applied.csv");
  console.log("Next: resubmit sitemaps in GSC (plan 2.3) and start the weekly GSC watch (2.6).");
  process.exit(0);
}

main().catch((e) => {
  console.error("executor failed:", e);
  process.exit(1);
});
