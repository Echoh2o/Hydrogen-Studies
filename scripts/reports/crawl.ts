/**
 * PLAN.md 1.3 — Full crawl of hydrogenstudies.com (plain browser UA).
 *
 * Sitemap-driven: fetches every URL in the sitemap index, plain UA, records
 * status, redirect location, canonical, title, meta description, robots meta,
 * and whether the ownership disclosure is present. Flags duplicate
 * titles/descriptions and canonical mismatches at the end.
 *
 * READ-ONLY over HTTP. No DB needed — runs from any machine.
 *   npx tsx scripts/reports/crawl.ts [maxUrls] [baseUrl]
 * Default maxUrls=6500 (covers the full current sitemap set), concurrency 8.
 * echowater.com can be crawled with:
 *   npx tsx scripts/reports/crawl.ts 3000 https://echowater.com
 */
import fs from "fs";

const BASE = process.argv[3] || "https://hydrogenstudies.com";
const MAX_URLS = parseInt(process.argv[2] || "6500", 10);
const CONCURRENCY = 8;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

function extract(re: RegExp, html: string): string {
  const m = html.match(re);
  return m ? m[1].trim().replace(/\s+/g, " ").slice(0, 300) : "";
}

async function fetchText(url: string): Promise<{ status: number; location: string; body: string }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    const location = res.headers.get("location") ?? "";
    const body = res.status === 200 ? await res.text() : "";
    return { status: res.status, location, body };
  } catch {
    return { status: -1, location: "", body: "" };
  }
}

async function collectSitemapUrls(): Promise<string[]> {
  const urls: string[] = [];
  const seen = new Set<string>();
  const index = await fetchText(`${BASE}/sitemap.xml`);
  const sitemaps = [...index.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const leaves = sitemaps.length > 0 && index.body.includes("<sitemapindex") ? sitemaps : [`${BASE}/sitemap.xml`];
  for (const sm of leaves) {
    const leaf = await fetchText(sm);
    for (const m of leaf.body.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const u = m[1];
      if (!seen.has(u) && !u.endsWith(".xml") && !/\.(png|jpe?g|webp|gif)$/i.test(u)) {
        seen.add(u);
        urls.push(u);
      }
      if (urls.length >= MAX_URLS) return urls;
    }
  }
  return urls;
}

async function main() {
  console.log(`Collecting sitemap URLs from ${BASE} (cap ${MAX_URLS})…`);
  const urls = await collectSitemapUrls();
  console.log(`URLs to crawl: ${urls.length}`);

  type Row = {
    url: string; status: number; location: string; canonical: string;
    title: string; description: string; robots: string; hasDisclosure: boolean;
  };
  const rows: Row[] = [];
  let i = 0;

  async function worker() {
    while (i < urls.length) {
      const idx = i++;
      const url = urls[idx];
      const r = await fetchText(url);
      rows.push({
        url,
        status: r.status,
        location: r.location,
        canonical: extract(/<link rel="canonical" href="([^"]+)"/i, r.body),
        title: extract(/<title>([\s\S]*?)<\/title>/i, r.body),
        description: extract(/name="description" content="([^"]*)"/i, r.body),
        robots: extract(/name="robots" content="([^"]*)"/i, r.body),
        hasDisclosure: r.body.includes("Echo Technologies LLC"),
      });
      if (rows.length % 250 === 0) console.log(`  crawled ${rows.length}/${urls.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // Summaries
  const byStatus = new Map<number, number>();
  const titleCount = new Map<string, number>();
  const descCount = new Map<string, number>();
  let canonicalMismatch = 0;
  let noindexCount = 0;
  let missingDisclosure = 0;
  for (const r of rows) {
    byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
    if (r.status === 200) {
      if (r.title) titleCount.set(r.title, (titleCount.get(r.title) ?? 0) + 1);
      if (r.description) descCount.set(r.description, (descCount.get(r.description) ?? 0) + 1);
      if (r.canonical && r.canonical !== r.url) canonicalMismatch++;
      if (/noindex/i.test(r.robots)) noindexCount++;
      if (!r.hasDisclosure) missingDisclosure++;
    }
  }
  const dupTitles = [...titleCount.values()].filter((n) => n > 1).length;
  const dupDescs = [...descCount.values()].filter((n) => n > 1).length;

  fs.mkdirSync("reports", { recursive: true });
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = ["url,status,redirect_to,canonical,robots,has_disclosure,title,description"]
    .concat(rows.map((r) => [r.url, r.status, r.location, r.canonical, r.robots, r.hasDisclosure, r.title, r.description].map(esc).join(",")))
    .join("\n");
  const out = BASE.includes("echowater") ? "reports/crawl-echowater-2026-09.csv" : "reports/crawl-2026-09.csv";
  fs.writeFileSync(out, csv);

  console.log("\n=== crawl summary ===");
  for (const [status, n] of [...byStatus.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  HTTP ${status}: ${n}`);
  }
  console.log(`canonical != self on 200s: ${canonicalMismatch}`);
  console.log(`noindex on sitemap'd 200s: ${noindexCount} (should be ~0 — noindexed pages don't belong in the sitemap)`);
  console.log(`duplicate titles: ${dupTitles} · duplicate descriptions: ${dupDescs}`);
  console.log(`200s missing disclosure: ${missingDisclosure}`);
  console.log(`Wrote ${out}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("crawl failed:", e);
  process.exit(1);
});
