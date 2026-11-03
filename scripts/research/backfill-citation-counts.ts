/**
 * PLAN.md 4.4 — citation counts from OpenAlex (free, no key).
 *
 * DRY-RUN BY DEFAULT: looks up every live study (is_excluded = false) that has
 * a DOI or PMID, in batches of 50, and writes
 * reports/research/citation-counts-<date>.csv
 * (id, slug, doi, pmid, openalex_id, old_count, old_source, new_count, status)
 * with status ∈ matched | no_match | error. Nothing is written to the DB.
 *
 *   railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/research/backfill-citation-counts.ts'
 *   railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/research/backfill-citation-counts.ts --apply --csv reports/research/citation-counts-<date>.csv'
 *
 * --apply writes reports/backups/citation-counts-<ts>.json ({id, old_count,
 * old_source, old_updated_at, old_openalex_id}) BEFORE the first write, then
 * for every `matched` row: citation_count = new_count, citation_source =
 * 'openalex', citation_count_updated_at = now(), openalex_id = id. Additive
 * metadata (not a content-destructive op); revert from the backup. Afterwards
 * it asks the Next front door to drop its cached study page data.
 *
 * Re-run monthly: the plan always compares with the current count, so a
 * re-apply only touches rows whose count changed.
 */
import fs from "fs";
import pg from "pg";
import { fetchOpenAlexWorks } from "../../server/services/openalex";
import { normalizeDoi } from "../../shared/seo-markup";

const args = process.argv.slice(2);
const opt = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const APPLY = args.includes("--apply");
const CSV_IN = opt("--csv");
const LIMIT = opt("--limit") ? Number(opt("--limit")) : undefined;
const TODAY = new Date().toISOString().slice(0, 10);
const STAMP = Date.now();
const WEB_PUBLIC_ORIGIN = process.env.WEB_PUBLIC_ORIGIN || "https://web-production-6fb716d.up.railway.app";

type Status = "matched" | "no_match" | "error";
interface Row {
  id: number;
  slug: string;
  doi: string;
  pmid: string;
  openalex_id: string;
  old_count: string;
  old_source: string;
  new_count: string;
  status: Status;
}
const COLS: (keyof Row)[] = ["id", "slug", "doi", "pmid", "openalex_id", "old_count", "old_source", "new_count", "status"];
const csvEscape = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function parseCsv(text: string): Row[] {
  const out: Row[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("id,") || line.startsWith("#")) continue;
    const cells: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    const r = Object.fromEntries(COLS.map((c, i) => [c, cells[i] ?? ""])) as unknown as Row;
    r.id = Number(r.id);
    out.push(r);
  }
  return out;
}

async function plan(db: pg.Pool): Promise<void> {
  const { rows: studies } = await db.query<{
    id: number; slug: string; doi: string | null; pmid: string | null; citation_count: number | null; citation_source: string | null;
  }>(
    // citation_source arrives with migration 029; read it via jsonb so the plan
    // also runs against a database that has not deployed the column yet.
    `SELECT id, slug, doi, pmid, citation_count, to_jsonb(studies)->>'citation_source' AS citation_source FROM studies
      WHERE is_excluded = false AND (NULLIF(TRIM(doi), '') IS NOT NULL OR NULLIF(TRIM(pmid), '') IS NOT NULL)
      ORDER BY id ${LIMIT ? `LIMIT ${Number(LIMIT)}` : ""}`,
  );
  console.log(`${studies.length} live studies with a DOI or PMID`);
  const dois = studies.map((s) => normalizeDoi(s.doi)).filter(Boolean);
  const pmids = studies.map((s) => String(s.pmid ?? "").trim()).filter((p) => /^\d{4,9}$/.test(p));

  let byDoi = new Map(), byPmid = new Map(), requests = 0;
  let lookupError: string | null = null;
  try {
    ({ byDoi, byPmid, requests } = await fetchOpenAlexWorks({ dois, pmids }));
  } catch (err) {
    lookupError = err instanceof Error ? err.message : String(err);
  }
  console.log(`OpenAlex requests: ${requests}${lookupError ? ` — ERROR: ${lookupError}` : ""}`);

  const rows: Row[] = studies.map((s) => {
    const doi = normalizeDoi(s.doi).toLowerCase();
    const pmid = String(s.pmid ?? "").trim();
    const w = (doi && byDoi.get(doi)) || (pmid && byPmid.get(pmid)) || null;
    return {
      id: s.id,
      slug: s.slug,
      doi: normalizeDoi(s.doi),
      pmid,
      openalex_id: w ? w.id : "",
      old_count: s.citation_count == null ? "" : String(s.citation_count),
      old_source: s.citation_source ?? "",
      new_count: w ? String(w.citedByCount) : "",
      status: lookupError ? "error" : w ? "matched" : "no_match",
    };
  });
  fs.mkdirSync("reports/research", { recursive: true });
  const file = `reports/research/citation-counts-${TODAY}.csv`;
  fs.writeFileSync(file, [COLS.join(","), ...rows.map((r) => COLS.map((c) => csvEscape(r[c])).join(","))].join("\n") + "\n");
  const n = (st: Status) => rows.filter((r) => r.status === st).length;
  const changed = rows.filter((r) => r.status === "matched" && r.new_count !== r.old_count).length;
  const total = rows.filter((r) => r.status === "matched").reduce((a, r) => a + Number(r.new_count), 0);
  console.log(`matched ${n("matched")}, no_match ${n("no_match")}, error ${n("error")}; ${changed} counts would change; ${total.toLocaleString()} citations in total`);
  console.log(`wrote ${file}\nDRY RUN — nothing changed. Apply with: --apply --csv ${file}`);
}

async function apply(db: pg.Pool): Promise<void> {
  if (!CSV_IN) throw new Error("--apply needs --csv <plan file>");
  const rows = parseCsv(fs.readFileSync(CSV_IN, "utf8")).filter((r) => r.status === "matched" && r.new_count !== "");
  const ids = rows.map((r) => r.id);
  const { rows: before } = await db.query(
    `SELECT id, citation_count AS old_count, citation_source AS old_source, citation_count_updated_at AS old_updated_at, openalex_id AS old_openalex_id
       FROM studies WHERE id = ANY($1::int[])`,
    [ids],
  );
  fs.mkdirSync("reports/backups", { recursive: true });
  const backup = `reports/backups/citation-counts-${STAMP}.json`;
  fs.writeFileSync(backup, JSON.stringify({ ranAt: new Date().toISOString(), source: CSV_IN, rows: before }, null, 2));
  console.log(`backup: ${backup} (${before.length} rows)`);

  let updated = 0;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    for (const r of rows) {
      const res = await client.query(
        `UPDATE studies SET citation_count = $1, citation_source = 'openalex', citation_count_updated_at = NOW(), openalex_id = $2
          WHERE id = $3 AND is_excluded = false`,
        [Number(r.new_count), r.openalex_id || null, r.id],
      );
      updated += res.rowCount ?? 0;
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  console.log(`updated ${updated} studies`);

  // Study page data is cached for a day on the Next front door — drop it.
  const key = process.env.PAGE_DATA_KEY;
  if (key) {
    const res = await fetch(`${WEB_PUBLIC_ORIGIN}/web_revalidate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-page-data-key": key },
      body: JSON.stringify({ paths: [] }),
    }).catch((e) => ({ status: `failed: ${e instanceof Error ? e.message : e}` }));
    console.log(`web_revalidate → ${res.status}`);
  } else {
    console.log("PAGE_DATA_KEY not set — POST /web_revalidate manually so study pages refresh before their 1-day TTL");
  }
}

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2, ssl: process.env.DATABASE_URL?.includes("railway") ? { rejectUnauthorized: false } : undefined });
(APPLY ? apply(db) : plan(db))
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => db.end());
