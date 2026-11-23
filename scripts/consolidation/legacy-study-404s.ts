/**
 * Old /study/<slug> URLs that 404 today, matched to the study they meant.
 * REPORT-FIRST. DRY-RUN BY DEFAULT (CLAUDE.md: 301s need Josh's approval of
 * the exact URL list).
 *
 * The stable-URL migration (#134) 301'd every slug that was live on 11-03.
 * Older variants were never in that map — pre-normalization slugs
 * (`…-stim1-orai1` vs `…-stim1orai1-…`), slugs cut off by whoever linked
 * them (`…-chlorhexidine-mouth`), epoch slugs from earlier imports — and
 * still 404 (~2,700 hits/day, 2026-11-16..22).
 *
 *   --plan --hits <file.jsonl>
 *       <file.jsonl>: one {"p": "/study/…", "t": ISO, "ua": "…"} per 404 hit
 *       (railway logs --http --json --filter '@httpStatus:404', /study/ only).
 *       Reads studies + active redirects (read-only) and writes
 *       reports/consolidation/legacy-study-404s-<date>.csv (the map to
 *       approve) and -unmatched.csv. Nothing changes.
 *
 *   --apply --csv reports/consolidation/legacy-study-404s-<date>.csv
 *       Refuses unless the CSV's first line is "approved-by: josh". Inserts
 *       one redirects row per line (301 → the study, or 410 for an excluded
 *       study) unless an active row for that path already exists. Writes
 *       reports/backups/legacy-study-404s-<ts>.json first (ids it created) so
 *       --rollback can deactivate exactly those rows.
 *
 *   --rollback --backup reports/backups/legacy-study-404s-<ts>.json
 *
 * Matching (only unambiguous matches are proposed; everything else is listed
 * as unmatched for a human):
 *   id-suffix   the old slug carries a PMID / DOI / hs-id of a study
 *   same-title  same title words once punctuation and dashes are ignored
 *   truncated   the old slug is a ≥40-char prefix of exactly one study's title
 *   extended    exactly one study's ≥40-char title is a prefix of the old slug
 * Never regenerates a slug: the target is the study's current slug verbatim.
 */
import fs from "fs";
import path from "path";
import { pool } from "../../server/db";
import { titlePortion, parseStableSuffix, doiSlug, cleanPmid } from "../../shared/study-slug";

const RUN_NOTE = "legacy study 404s (approved list)";
const MIN_PREFIX = 40;

type Study = { id: number; slug: string; title: string | null; pmid: string | null; doi: string | null; is_excluded: boolean };
type Hit = { p: string; t: string; ua?: string };
export type Proposal = {
  from_path: string;
  to_path: string;
  status: 301 | 410;
  match: "id-suffix" | "same-title" | "truncated" | "extended";
  study_id: number;
  hits_7d: number;
  googlebot_hits: number;
  last_seen: string;
};

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const csvField = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** Title words only, punctuation and dashes dropped: `…-stim1-orai1` and `…-stim1orai1` agree. */
export const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function normalizePath(p: string): string | null {
  let s = p.split(/[?#]/)[0];
  try {
    s = decodeURIComponent(s);
  } catch {
    /* keep raw */
  }
  s = s.toLowerCase().replace(/\/+$/, "");
  return /^\/study\/[^/]+$/.test(s) ? s : null;
}

/** The one study an old slug meant, or null when there is no unambiguous match. */
export function matchStudy(oldSlug: string, studies: Study[]): { study: Study; match: Proposal["match"] } | null {
  const suffix = parseStableSuffix(oldSlug);
  if (suffix) {
    const hit = studies.find((s) =>
      suffix.kind === "pmid" ? cleanPmid(s.pmid) === suffix.pmid : suffix.kind === "doi" ? doiSlug(s.doi) === suffix.doiSlug : s.id === suffix.id,
    );
    if (hit) return { study: hit, match: "id-suffix" };
  }
  const k = key(titlePortion(oldSlug));
  if (!k) return null;
  const keysOf = (s: Study) => [...new Set([key(titlePortion(s.slug)), key(slugify(s.title ?? ""))].filter(Boolean))];
  const unique = (pred: (sk: string) => boolean) => {
    const found = studies.filter((s) => keysOf(s).some(pred));
    return found.length === 1 ? found[0] : null;
  };
  const same = unique((sk) => sk === k);
  if (same) return { study: same, match: "same-title" };
  if (k.length >= MIN_PREFIX) {
    const trunc = unique((sk) => sk.startsWith(k));
    if (trunc) return { study: trunc, match: "truncated" };
  }
  const ext = unique((sk) => sk.length >= MIN_PREFIX && k.startsWith(sk));
  if (ext) return { study: ext, match: "extended" };
  return null;
}

async function plan() {
  const hitsFile = arg("--hits");
  if (!hitsFile) throw new Error("--plan needs --hits <file.jsonl>");
  const hits: Hit[] = fs.readFileSync(hitsFile, "utf8").trim().split("\n").map((l) => JSON.parse(l));

  const studies = (await pool.query<Study>(`SELECT id, slug, title, pmid, doi, is_excluded FROM studies`)).rows;
  const live = new Set(studies.map((s) => `/study/${s.slug.toLowerCase()}`));
  const redirected = new Set(
    (await pool.query<{ from_path: string }>(`SELECT from_path FROM redirects WHERE is_active`)).rows.map((r) => r.from_path),
  );

  const byPath = new Map<string, { hits: number; bot: number; last: string }>();
  for (const h of hits) {
    const p = normalizePath(h.p);
    if (!p) continue;
    const e = byPath.get(p) ?? { hits: 0, bot: 0, last: "" };
    e.hits++;
    if (/googlebot/i.test(h.ua ?? "")) e.bot++;
    if (h.t > e.last) e.last = h.t;
    byPath.set(p, e);
  }

  const proposals: Proposal[] = [];
  const unmatched: Array<{ from_path: string; hits_7d: number; googlebot_hits: number; last_seen: string; note: string }> = [];
  for (const [p, e] of [...byPath].sort((a, b) => b[1].hits - a[1].hits)) {
    if (live.has(p) || redirected.has(p)) continue; // resolves today (e.g. a since-fixed 404)
    const m = matchStudy(p.slice("/study/".length), studies);
    const base = { hits_7d: e.hits, googlebot_hits: e.bot, last_seen: e.last.slice(0, 10) };
    if (!m) {
      unmatched.push({ from_path: p, ...base, note: "" });
      continue;
    }
    const to = `/study/${m.study.slug}`;
    if (to.toLowerCase() === p) continue;
    proposals.push({
      from_path: p,
      to_path: m.study.is_excluded ? "-" : to,
      status: m.study.is_excluded ? 410 : 301,
      match: m.match,
      study_id: m.study.id,
      ...base,
    });
  }

  const date = new Date().toISOString().slice(0, 10);
  const dir = path.join("reports", "consolidation");
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `legacy-study-404s-${date}.csv`);
  const cols = ["from_path", "to_path", "status", "match", "study_id", "hits_7d", "googlebot_hits", "last_seen"] as const;
  fs.writeFileSync(
    out,
    [`# ${RUN_NOTE} — DRY RUN. To authorize --apply, add a first line: approved-by: josh`, cols.join(","), ...proposals.map((r) => cols.map((c) => csvField(r[c])).join(","))].join("\n") + "\n",
  );
  const uout = path.join(dir, `legacy-study-404s-${date}-unmatched.csv`);
  fs.writeFileSync(uout, ["from_path,hits_7d,googlebot_hits,last_seen", ...unmatched.map((u) => [u.from_path, u.hits_7d, u.googlebot_hits, u.last_seen].map(csvField).join(","))].join("\n") + "\n");

  const sum = (rows: { hits_7d: number }[]) => rows.reduce((a, r) => a + r.hits_7d, 0);
  const byMatch = Object.groupBy(proposals, (r) => r.match);
  console.log(`404 hits read: ${hits.length}; distinct /study/ paths: ${byPath.size}`);
  console.log(`proposed: ${proposals.length} paths (${sum(proposals)} hits) → ${out}`);
  for (const [m, rows] of Object.entries(byMatch)) console.log(`  ${m.padEnd(10)} ${String(rows!.length).padStart(5)} paths ${String(sum(rows!)).padStart(6)} hits`);
  console.log(`  of which 410 (excluded study): ${proposals.filter((r) => r.status === 410).length}`);
  console.log(`unmatched: ${unmatched.length} paths (${sum(unmatched)} hits) → ${uout}`);
}

async function apply() {
  const csvFile = arg("--csv");
  if (!csvFile) throw new Error("--apply needs --csv <approved plan>");
  const lines = fs.readFileSync(csvFile, "utf8").split("\n");
  if (!/^approved-by:\s*josh\s*$/i.test(lines[0].trim())) {
    console.error(`REFUSING --apply: ${csvFile} has no leading "approved-by: josh" line (CLAUDE.md / PLAN.md §2).`);
    process.exit(1);
  }
  const headerAt = lines.findIndex((l) => l.startsWith("from_path,"));
  const rows = lines.slice(headerAt + 1).filter(Boolean).map((l) => {
    const [from_path, to_path, status] = l.split(",");
    return { from_path, to_path, status: Number(status) };
  });
  const created: number[] = [];
  const ts = Date.now();
  const backup = path.join("reports", "backups", `legacy-study-404s-${ts}.json`);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.writeFileSync(backup, JSON.stringify({ csv: csvFile, created }, null, 2)); // before the first write
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const r of rows) {
      if (!normalizePath(r.from_path) || ![301, 410].includes(r.status) || (r.status === 301 && !r.to_path.startsWith("/study/"))) {
        throw new Error(`bad row: ${JSON.stringify(r)}`);
      }
      const res = await client.query<{ id: number }>(
        `INSERT INTO redirects (from_path, to_path, status_code, note, is_active)
         SELECT $1, $2, $3, $4, true
          WHERE NOT EXISTS (SELECT 1 FROM redirects WHERE from_path = $1 AND is_active)
         ON CONFLICT (from_path) DO NOTHING
         RETURNING id`,
        [r.from_path, r.status === 410 ? "-" : r.to_path, r.status, RUN_NOTE],
      );
      if (res.rows[0]) created.push(res.rows[0].id);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  fs.writeFileSync(backup, JSON.stringify({ csv: csvFile, created }, null, 2));
  console.log(`created ${created.length} redirect rows (of ${rows.length}); backup ${backup}`);
}

async function rollback() {
  const file = arg("--backup");
  if (!file) throw new Error("--rollback needs --backup <file.json>");
  const { created } = JSON.parse(fs.readFileSync(file, "utf8")) as { created: number[] };
  const res = await pool.query(`UPDATE redirects SET is_active = false WHERE id = ANY($1::int[]) AND note = $2`, [created, RUN_NOTE]);
  console.log(`deactivated ${res.rowCount} rows`);
}

const isMain = process.argv[1]?.endsWith("legacy-study-404s.ts");
if (isMain) {
  const run = process.argv.includes("--apply") ? apply : process.argv.includes("--rollback") ? rollback : plan;
  run()
    .then(() => pool.end())
    .catch(async (err) => {
      console.error(err);
      await pool.end();
      process.exit(1);
    });
}
