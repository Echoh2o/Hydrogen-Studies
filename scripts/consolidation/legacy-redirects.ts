/**
 * Legacy-URL 301 map (2026-09-23 URL-hygiene audit).
 *
 * Applies EXACTLY the rows of reports/redirects-legacy-2026-09.csv marked
 * `applied=yes` — the list Josh approved — to the `redirects` table.
 * Two kinds of row:
 *   insert  (previous_to_path empty)  new 301 legacy → current URL
 *   repoint (previous_to_path set)    an EXISTING row whose target is dead
 *                                     (410 retirement, or a 404 that this map
 *                                     now redirects) gets the live final
 *                                     target, so nothing chains; an optional
 *                                     status_code column also sets 301/302
 *                                     (previous_status_code is kept for --revert)
 *
 *   (default)            DRY RUN: re-validates every selected row against the
 *                        DB and the live site, prints the plan. Writes nothing.
 *   --apply              performs it: inserts (301, is_active=true, note
 *                        "legacy-url-map 2026-09-23"), then repoints (to_path
 *                        only; status/note untouched). One redirect_actions_log
 *                        row per change. Existing from_paths are never
 *                        overwritten by an insert.
 *   --include-deferred   also consider rows whose reason starts with
 *                        "DEFERRED" (target only resolves once the url-hygiene
 *                        PR is deployed). Same live checks, so they are refused
 *                        until the target really returns 200.
 *   --revert [--apply]   undo: deactivates every active row created with the
 *                        note above, and restores each repointed row to its
 *                        previous_to_path (only if it still points where this
 *                        script put it). Logged like everything else.
 *
 * SAFETY (checked per row at run time — the CSV is not trusted blindly):
 *  - refuses --apply unless the CSV carries "# approved-by: josh"
 *  - insert from_path: lowercase, no trailing slash, no query, not
 *    protocol-relative, not a live SPA/static route, not already a row, and
 *    currently returns 404 to Googlebot (never a 200 or 410 URL)
 *  - repoint: the row exists, is active, and still points at previous_to_path
 *  - to_path: same-site, != from_path, not itself a redirect source (no
 *    chains/loops, counting this run's inserts), and returns 200 to Googlebot
 *    AND a browser UA
 *  - 410 rows are never modified
 *
 * Run: railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/consolidation/legacy-redirects.ts [--apply]'
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sql } from "drizzle-orm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.resolve(__dirname, "../../reports/redirects-legacy-2026-09.csv");
const NOTE = "legacy-url-map 2026-09-23";
const ACTOR = "claude-code (approved: josh 2026-09-23)";
const SITE = process.env.LEGACY_REDIRECT_SITE || "https://hydrogenstudies.com";
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const APPLY = process.argv.includes("--apply");
const REVERT = process.argv.includes("--revert");
const INCLUDE_DEFERRED = process.argv.includes("--include-deferred");

/** Static SPA/server routes that must never become redirect sources. */
const LIVE_ROUTES = new Set([
  "/", "/about", "/advanced-search", "/benefits", "/blog", "/browse-by-tags", "/categories", "/contact",
  "/contact-us", "/cookies", "/disclaimer", "/editorial-policy", "/explore-by-benefit", "/explore-by-body-system",
  "/explore-by-condition", "/explore-by-delivery-method", "/explore-by-demographic", "/explore-by-life-stage",
  "/explore-by-mechanism", "/forgot-password", "/hub", "/improved-search", "/insights", "/learn", "/login",
  "/methodology", "/my-dashboard", "/privacy", "/products", "/recent-studies", "/recommendations", "/register",
  "/research-analytics", "/reset-password", "/resources", "/search", "/studies", "/study-explorer", "/terms",
  "/this-week", "/hydrogen-therapy-guide", "/proxy", "/health", "/healthz",
]);
/** Live non-content route prefixes — legacy paths under these are never newly redirected. */
const LIVE_PREFIXES = ["/admin", "/api/", "/assets/", "/proxy/", "/uploads/", "/images/", "/category/",
  "/blog/category/", "/hub/", "/learn/", "/studies/tags", "/search/", "/study/id/"];

export type CsvRow = Record<string, string>;

/** Minimal RFC 4180 parser (quoted fields, escaped quotes, commas/newlines in quotes). */
export function parseCsv(text: string): { header: string[]; rows: CsvRow[]; approved: boolean } {
  const approved = /^#\s*approved-by:\s*josh\b/im.test(text);
  const body = text.split("\n").filter((l) => !l.startsWith("#")).join("\n");
  const records: string[][] = [];
  let field = "", rec: string[] = [], q = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (q) {
      if (c === '"' && body[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { rec.push(field); field = ""; }
    else if (c === "\n") { rec.push(field); records.push(rec); rec = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || rec.length) { rec.push(field); records.push(rec); }
  const [header, ...data] = records.filter((r) => r.length > 1 || r[0]);
  const rows = data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
  return { header, rows, approved };
}

/** Why a path may not be a NEW redirect source, or null if it may. */
export function fromPathProblem(p: string): string | null {
  if (!p.startsWith("/") || p.startsWith("//")) return "not a site-relative path";
  if (p !== p.toLowerCase()) return "not lowercase";
  if (p.length > 1 && p.endsWith("/")) return "trailing slash";
  if (p.includes("?") || p.includes("#")) return "has query/fragment";
  if (LIVE_ROUTES.has(p)) return "is a live route";
  if (LIVE_PREFIXES.some((pre) => p === pre.replace(/\/$/, "") || p.startsWith(pre))) return "under a live route prefix";
  return null;
}

const pathKey = (p: string) => p.toLowerCase().split("?")[0].replace(/\/+$/, "") || "/";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function status(p: string, ua: string): Promise<{ code: number; location: string }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(SITE + p, { method: "GET", redirect: "manual", headers: { "User-Agent": ua } });
      await res.arrayBuffer().catch(() => undefined);
      if (res.status === 429) { await sleep(15_000 * (attempt + 1)); continue; }
      return { code: res.status, location: res.headers.get("location") || "" };
    } catch {
      await sleep(3000);
    }
  }
  return { code: 0, location: "fetch-error" };
}

async function log(db: any, action: string, from: string, to: string | null, code: number, score: string, note: string) {
  await db.execute(sql`
    INSERT INTO redirect_actions_log (action, from_path, to_path, status_code, score, actor, note)
    VALUES (${action}, ${from}, ${to}, ${code}, ${score}, ${ACTOR}, ${note})
  `);
}

async function main() {
  const { db } = await import("../../server/db");
  const { rows, approved } = parseCsv(fs.readFileSync(CSV, "utf8"));

  const existing = new Map<string, { to: string; status: number; active: boolean }>();
  for (const r of (await db.execute(sql`SELECT from_path, to_path, status_code, is_active FROM redirects`)).rows as any[]) {
    existing.set(String(r.from_path).toLowerCase(), { to: r.to_path, status: r.status_code, active: r.is_active });
  }

  if (REVERT) {
    const created = (await db.execute(sql`
      SELECT id, from_path, to_path FROM redirects WHERE note = ${NOTE} AND is_active = true
    `)).rows as any[];
    const repointed = rows.filter((r) => r.applied === "yes" && r.previous_to_path)
      .filter((r) => existing.get(r.from_path)?.to === r.to_path);
    console.log(`revert: deactivate ${created.length} inserted rows; restore ${repointed.length} repointed rows`);
    if (!APPLY) { console.log("DRY RUN — add --apply to perform the revert."); process.exit(0); }
    for (const r of created) {
      await db.execute(sql`UPDATE redirects SET is_active = false WHERE id = ${r.id}`);
      await log(db, "deactivated", r.from_path, r.to_path, 301, "", `${NOTE} (revert)`);
    }
    for (const r of repointed) {
      const restoreStatus = r.previous_status_code ? Number(r.previous_status_code) : existing.get(r.from_path)!.status;
      await db.execute(sql`
        UPDATE redirects SET to_path = ${r.previous_to_path}, status_code = ${restoreStatus}
        WHERE from_path = ${r.from_path} AND to_path = ${r.to_path}
      `);
      await log(db, "updated", r.from_path, r.previous_to_path, restoreStatus, "", `${NOTE} (revert repoint from ${r.to_path})`);
    }
    console.log("revert complete. Redirect cache TTL ≈5 min.");
    process.exit(0);
  }

  const wanted = rows.filter((r) =>
    r.applied === "yes" || (INCLUDE_DEFERRED && r.applied === "no" && /^DEFERRED/.test(r.reason)));
  console.log(`CSV rows: ${rows.length}; selected (applied=yes${INCLUDE_DEFERRED ? " + deferred" : ""}): ${wanted.length}`);

  const activeSources = new Set([...existing.entries()].filter(([, v]) => v.active).map(([k]) => k));
  const insertSources = new Set(wanted.filter((r) => !r.previous_to_path).map((r) => r.from_path));

  const inserts: CsvRow[] = [];
  const repoints: CsvRow[] = [];
  const skipped: CsvRow[] = [];
  const refused: Array<[CsvRow, string]> = [];
  const probeCache = new Map<string, { code: number; location: string }>();
  const probe = async (p: string, ua: string) => {
    const k = `${ua === GOOGLEBOT ? "gb" : "ch"} ${p}`;
    if (!probeCache.has(k)) { probeCache.set(k, await status(p, ua)); await sleep(300); }
    return probeCache.get(k)!;
  };

  for (const r of wanted) {
    const from = r.from_path, to = r.to_path, isRepoint = !!r.previous_to_path;
    if (!to.startsWith("/") || to.startsWith("//")) { refused.push([r, "to_path not same-site"]); continue; }
    const toKey = pathKey(to);
    if (toKey === from) { refused.push([r, "loop (to == from)"]); continue; }
    if (activeSources.has(toKey) || insertSources.has(toKey)) { refused.push([r, "chain (to_path is a redirect source)"]); continue; }

    if (isRepoint) {
      const cur = existing.get(from);
      if (!cur || !cur.active) { refused.push([r, "repoint: row missing or inactive"]); continue; }
      if (cur.status === 410) { refused.push([r, "repoint: 410 rows are never modified"]); continue; }
      const wantStatus = r.status_code ? Number(r.status_code) : cur.status;
      if (![301, 302].includes(wantStatus)) { refused.push([r, `repoint: status_code ${r.status_code} not 301/302`]); continue; }
      if (cur.to === to && cur.status === wantStatus) { skipped.push(r); continue; }
      if (cur.to !== to && cur.to !== r.previous_to_path) { refused.push([r, `repoint: row now points at ${cur.to}, not ${r.previous_to_path}`]); continue; }
    } else {
      const prob = fromPathProblem(from);
      if (prob) { refused.push([r, `from_path ${prob}`]); continue; }
      if (existing.has(from)) { skipped.push(r); continue; }
      const f = await probe(from, GOOGLEBOT);
      if (f.code !== 404) { refused.push([r, `from_path returns ${f.code} to Googlebot (need 404)`]); continue; }
    }
    const tg = await probe(to, GOOGLEBOT);
    const tc = await probe(to, CHROME);
    if (tg.code !== 200 || tc.code !== 200) {
      refused.push([r, `to_path returns ${tg.code}/${tc.code} (Googlebot/Chrome; need 200)`]); continue;
    }
    (isRepoint ? repoints : inserts).push(r);
  }

  console.log(`\n=== legacy redirect plan ===`);
  console.log(`insert:  ${inserts.length}`);
  console.log(`repoint: ${repoints.length}`);
  console.log(`skip (already done / from_path exists): ${skipped.length}`);
  console.log(`refused: ${refused.length}`);
  for (const r of inserts) console.log(`  + ${r.from_path} → ${r.to_path}  [${r.match_method}/${r.confidence}]`);
  for (const r of repoints) {
    const cur = existing.get(r.from_path)!;
    const st = r.status_code && Number(r.status_code) !== cur.status ? ` (status ${cur.status} → ${r.status_code})` : "";
    console.log(`  ~ ${r.from_path}: ${cur.to} → ${r.to_path}${st}  [${r.match_method}]`);
  }
  for (const r of skipped) console.log(`  = ${r.from_path} (exists → ${existing.get(r.from_path)?.to})`);
  for (const [r, why] of refused) console.log(`  ! ${r.from_path} → ${r.to_path}: ${why}`);

  if (!APPLY) { console.log("\nDRY RUN — nothing changed. Re-run with --apply."); process.exit(0); }
  if (!approved) {
    console.error(`\nREFUSING --apply: ${path.basename(CSV)} has no "# approved-by: josh" line (PLAN.md §2).`);
    process.exit(1);
  }

  let inserted = 0, updated = 0;
  for (const r of inserts) {
    const res = await db.execute(sql`
      INSERT INTO redirects (from_path, to_path, status_code, is_active, note)
      VALUES (${r.from_path}, ${r.to_path}, 301, true, ${NOTE})
      ON CONFLICT (from_path) DO NOTHING
      RETURNING id
    `);
    if (!res.rows?.length) { console.log(`  = ${r.from_path} (appeared concurrently; skipped)`); continue; }
    await log(db, "created", r.from_path, r.to_path, 301, r.confidence, `${NOTE} (${r.match_method})`);
    inserted++;
  }
  for (const r of repoints) {
    const cur = existing.get(r.from_path)!;
    const newStatus = r.status_code ? Number(r.status_code) : cur.status;
    const res = await db.execute(sql`
      UPDATE redirects SET to_path = ${r.to_path}, status_code = ${newStatus}
      WHERE from_path = ${r.from_path} AND to_path = ${cur.to} AND status_code = ${cur.status}
        AND is_active = true AND status_code <> 410
      RETURNING id
    `);
    if (!res.rows?.length) { console.log(`  = ${r.from_path} (changed concurrently; skipped)`); continue; }
    const was = `was ${cur.to}${newStatus !== cur.status ? ` (${cur.status})` : ""}`;
    await log(db, "updated", r.from_path, r.to_path, newStatus, r.confidence, `${NOTE} (${r.match_method}; ${was})`);
    updated++;
  }
  console.log(`\nAPPLY complete: inserted ${inserted}, repointed ${updated}. Redirect cache TTL ≈5 min before rows serve.`);
  process.exit(0);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((e) => {
    console.error("legacy-redirects failed:", e);
    process.exit(1);
  });
}
