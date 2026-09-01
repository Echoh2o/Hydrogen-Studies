/**
 * PLAN.md 1.1 — Keep-list report (the gate for Phase 2 consolidation).
 *
 * Joins every PUBLISHED blog URL with:
 *   - GSC clicks/impressions/avg position (all synced history, per page URL)
 *   - Ahrefs backlinks from data/ahrefs-backlinks.csv (placeholder col if absent)
 *   - word count, title-template match, consolidation cluster key
 * and proposes an action per URL:
 *   keep   — clicks > 0 OR impressions >= 200 OR backlinks >= 1
 *   merge  — same-topic duplicate (shares a cluster with a keep)
 *   retire — everything else (410 in Phase 2)
 *
 * READ-ONLY. Writes reports/keep-list.csv + prints summary stats and stops.
 * Run with prod env: `railway run -- npx tsx scripts/reports/keep-list.ts`
 */
import fs from "fs";
import path from "path";
import { db } from "../../server/db";
import { sql } from "drizzle-orm";
import { topicKeyFor } from "../../server/services/content-consolidation";

const SITE_URL = process.env.SITE_URL || "https://hydrogenstudies.com";

const TITLE_TEMPLATES: Array<[string, RegExp]> = [
  ["hydrogen-water-general", /^Hydrogen Water General:/i],
  ["what-20xx-research-shows", /What 20\d\d Research Shows$/i],
  ["how-to-use", /^How to Use Hydrogen Water for/i],
];

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  // 1. Published blog articles
  const blogs = (
    await db.execute(sql`
      SELECT id, slug, title, COALESCE(LENGTH(content), 0) AS content_len,
             created_at
      FROM blog_articles
      WHERE is_published = true AND is_archived = false
      ORDER BY id
    `)
  ).rows as Array<{ id: number; slug: string; title: string; content_len: number; created_at: string }>;
  console.log(`Published blog articles: ${blogs.length}`);

  // 2. GSC metrics aggregated per blog page URL (all synced history)
  const gsc = (
    await db.execute(sql`
      SELECT page,
             SUM(clicks)::int AS clicks,
             SUM(impressions)::int AS impressions,
             CASE WHEN SUM(impressions) > 0
               THEN SUM(position::numeric * impressions) / SUM(impressions)
               ELSE NULL END AS avg_position
      FROM gsc_query_metrics
      WHERE page LIKE ${SITE_URL + "/blog/%"}
      GROUP BY page
    `)
  ).rows as Array<{ page: string; clicks: number; impressions: number; avg_position: string | null }>;
  const gscByPage = new Map(gsc.map((r) => [r.page, r]));
  console.log(`Blog pages with any GSC data: ${gsc.length}`);

  // 3. Ahrefs backlinks (optional input)
  const backlinksBySlugOrUrl = new Map<string, number>();
  const ahrefsPath = path.resolve("data/ahrefs-backlinks.csv");
  let ahrefsLoaded = false;
  if (fs.existsSync(ahrefsPath)) {
    const lines = fs.readFileSync(ahrefsPath, "utf8").split("\n").slice(1);
    for (const line of lines) {
      const cols = line.split(",");
      const url = cols[0]?.replace(/^"|"$/g, "").trim();
      const n = parseInt(cols[1] ?? "1", 10) || 1;
      if (url) backlinksBySlugOrUrl.set(url, (backlinksBySlugOrUrl.get(url) ?? 0) + n);
    }
    ahrefsLoaded = true;
    console.log(`Ahrefs backlink rows loaded: ${backlinksBySlugOrUrl.size}`);
  } else {
    console.log(
      "NOTE: data/ahrefs-backlinks.csv missing — export Ahrefs 'Best by links' " +
        "for hydrogenstudies.com/blog/ and re-run; backlinks column is 0/placeholder.",
    );
  }

  // 4. Build rows: cluster, template, metrics, proposed action (pass 1)
  type Row = {
    url: string; id: number; title: string; cluster: string;
    clicks: number; impressions: number; avgPosition: string;
    backlinks: number; wordCount: number; template: string;
    action: "keep" | "merge" | "retire";
  };
  const rows: Row[] = [];
  const clusterMembers = new Map<string, Row[]>();

  for (const b of blogs) {
    const url = `${SITE_URL}/blog/${b.slug}`;
    const g = gscByPage.get(url);
    const template = TITLE_TEMPLATES.find(([, re]) => re.test(b.title ?? ""))?.[0] ?? "";
    const backlinks = backlinksBySlugOrUrl.get(url) ?? 0;
    const row: Row = {
      url, id: b.id, title: b.title ?? "",
      cluster: topicKeyFor({ title: b.title, slug: b.slug }),
      clicks: g?.clicks ?? 0,
      impressions: g?.impressions ?? 0,
      avgPosition: g?.avg_position ? Number(g.avg_position).toFixed(1) : "",
      backlinks,
      wordCount: Math.round(Number(b.content_len) / 6), // chars→words approximation
      template,
      action: "retire",
    };
    if (row.clicks > 0 || row.impressions >= 200 || row.backlinks >= 1) row.action = "keep";
    rows.push(row);
    const members = clusterMembers.get(row.cluster) ?? [];
    members.push(row);
    clusterMembers.set(row.cluster, members);
  }

  // Pass 2: same-cluster duplicates of a keep become "merge" (into that keep)
  for (const members of clusterMembers.values()) {
    const keeps = members.filter((m) => m.action === "keep");
    if (keeps.length === 0) continue;
    // best keep = most clicks, then impressions
    keeps.sort((a, b2) => b2.clicks - a.clicks || b2.impressions - a.impressions);
    for (const m of members) {
      if (m.action === "retire") m.action = "merge";
    }
    // the survivors stay "keep"
    for (const k of keeps) k.action = "keep";
  }

  // 5. Write CSV
  fs.mkdirSync("reports", { recursive: true });
  const header =
    "url,id,action,clicks,impressions,avg_position,backlinks,word_count,title_template,cluster,title";
  const csv = [header]
    .concat(
      rows.map((r) =>
        [r.url, r.id, r.action, r.clicks, r.impressions, r.avgPosition, r.backlinks,
         r.wordCount, r.template, r.cluster, r.title].map(csvEscape).join(","),
      ),
    )
    .join("\n");
  fs.writeFileSync("reports/keep-list.csv", csv);

  // 6. Summary
  const counts = { keep: 0, merge: 0, retire: 0 } as Record<string, number>;
  for (const r of rows) counts[r.action]++;
  const bigClusters = [...clusterMembers.entries()]
    .filter(([, m]) => m.length > 10)
    .sort((a, b2) => b2[1].length - a[1].length);
  console.log("\n=== keep-list summary ===");
  console.log(`keep:   ${counts.keep}`);
  console.log(`merge:  ${counts.merge}`);
  console.log(`retire: ${counts.retire}`);
  console.log(`ahrefs backlinks loaded: ${ahrefsLoaded}`);
  console.log(`clusters with >10 URLs: ${bigClusters.length}`);
  for (const [key, m] of bigClusters.slice(0, 15)) {
    console.log(`  ${m.length}× ${key}`);
  }
  console.log("\nWrote reports/keep-list.csv — awaiting Josh's approval before ANY Phase 2 action.");
  process.exit(0);
}

main().catch((e) => {
  console.error("keep-list failed:", e);
  process.exit(1);
});
