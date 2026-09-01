/**
 * PLAN.md 3.2 — SSR side-by-side diff.
 *
 * Compares two renderings of the same logical page (e.g. current prod vs the
 * new Next.js route) with a PLAIN UA: visible text similarity + JSON-LD
 * schema types present on each side. Used to verify each migrated route
 * before its flag flips.
 *
 *   npx tsx scripts/reports/ssr-diff.ts <oldUrl> <newUrl>
 */
const [oldUrl, newUrl] = process.argv.slice(2);
if (!oldUrl || !newUrl) {
  console.error("usage: ssr-diff.ts <oldUrl> <newUrl>");
  process.exit(1);
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0 Safari/537.36";

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function jsonLdTypes(html: string): string[] {
  const types = new Set<string>();
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    for (const t of m[1].matchAll(/"@type":\s*"(\w+)"/g)) types.add(t[1]);
  }
  return [...types].sort();
}

/** Token-set Jaccard similarity of visible text. */
function similarity(a: string, b: string): number {
  const ta = new Set(a.split(" ").filter((w) => w.length > 3));
  const tb = new Set(b.split(" ").filter((w) => w.length > 3));
  if (ta.size === 0 && tb.size === 0) return 1;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / (ta.size + tb.size - inter);
}

async function grab(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
  const html = await res.text();
  return { status: res.status, html, text: visibleText(html), ld: jsonLdTypes(html) };
}

const [a, b] = await Promise.all([grab(oldUrl), grab(newUrl)]);
const sim = similarity(a.text, b.text);
console.log(`OLD ${oldUrl} → ${a.status}, ${a.text.length} visible chars, JSON-LD: [${a.ld.join(", ")}]`);
console.log(`NEW ${newUrl} → ${b.status}, ${b.text.length} visible chars, JSON-LD: [${b.ld.join(", ")}]`);
console.log(`visible-text similarity (Jaccard, >3-char tokens): ${(sim * 100).toFixed(1)}%`);
const missingLd = a.ld.filter((t) => !b.ld.includes(t));
if (missingLd.length) console.log(`⚠️ JSON-LD types missing on NEW: ${missingLd.join(", ")}`);
const verdict = b.status === 200 && sim >= 0.85 && missingLd.length === 0 ? "PASS" : "FAIL";
console.log(`verdict: ${verdict} (need: 200, ≥85% similarity, no missing schema types)`);
process.exit(verdict === "PASS" ? 0 : 1);
