/**
 * Backfill studies.pmid from DOI via NCBI E-utilities — fill-empty-only.
 *
 * For every live study (is_excluded = false) with a DOI and an empty pmid:
 * esearch `"<doi>"[doi]`, then esummary-verify that the PubMed record's DOI
 * equals ours exactly (case-insensitive). Only `matched` rows are ever written,
 * and only while pmid is still empty. Slugs/URLs are untouched (they never
 * derive from pmid); the study page's source link and ScholarlyArticle
 * identifier start using the PMID once it is set.
 *
 * DRY-RUN BY DEFAULT — writes reports/research/pmid-backfill-<date>.csv
 * (id, doi, pmid, status, human, note, pubmed_dois). status ∈
 * matched | no_hit | mismatch | multiple | error.
 *
 *   DBURL=$(railway variables --service Postgres --kv | grep '^DATABASE_PUBLIC_URL=' | cut -d= -f2-)
 *   railway run --service Hydrogen-Studies -- env DATABASE_URL="$DBURL" npx tsx scripts/research/backfill-pmids.ts [--limit N]
 *   # apply the reviewed CSV (re-checks pmid empty + DOI unchanged per row; JSON backup first)
 *   railway run --service Hydrogen-Studies -- env DATABASE_URL="$DBURL" npx tsx scripts/research/backfill-pmids.ts \
 *     --apply --csv reports/research/pmid-backfill-<date>.csv
 *   # retry rows that errored (writes pmid-backfill-<date>-retry.csv)
 *   ... backfill-pmids.ts --ids 3446,3908 [--apply]
 *
 * Revert: UPDATE studies SET pmid = NULL WHERE id = ANY(<ids in the backup JSON>).
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import {
  classifyCandidates,
  esearchDoi,
  esummary,
  isLookupableDoi,
  normalizeDoi,
  type PmidStatus,
} from "../../server/services/pmid-lookup";

const args = process.argv.slice(2);
const opt = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const APPLY = args.includes("--apply");
const CSV_IN = opt("--csv");
const LIMIT = opt("--limit") ? Number(opt("--limit")) : undefined;
/** Retry specific rows (e.g. transient esearch errors); output goes to a -retry CSV. */
const IDS = opt("--ids")?.split(",").map(Number).filter(Number.isFinite);

interface Row {
  id: number;
  doi: string;
  pmid: string;
  status: PmidStatus | "error";
  human: boolean;
  note: string;
  pubmedDois: string;
}

const csvEscape = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("id,")) continue;
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
    rows.push(cells);
  }
  return rows;
}

async function coverage(db: pg.Pool) {
  const { rows } = await db.query(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE NULLIF(TRIM(pmid), '') IS NOT NULL)::int AS pmid,
           COUNT(*) FILTER (WHERE is_human_trial)::int AS human_total,
           COUNT(*) FILTER (WHERE is_human_trial AND NULLIF(TRIM(pmid), '') IS NOT NULL)::int AS human_pmid
      FROM studies WHERE is_excluded = false`);
  const r = rows[0];
  const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1) : "0.0");
  return `all ${r.pmid}/${r.total} (${pct(r.pmid, r.total)}%), human ${r.human_pmid}/${r.human_total} (${pct(r.human_pmid, r.human_total)}%)`;
}

async function lookup(db: pg.Pool): Promise<Row[]> {
  const { rows } = await db.query(
    `SELECT id, doi, url, source_url, COALESCE(is_human_trial, false) AS human
       FROM studies
      WHERE is_excluded = false AND NULLIF(TRIM(doi), '') IS NOT NULL AND NULLIF(TRIM(pmid), '') IS NULL
        ${IDS?.length ? "AND id = ANY($1::int[])" : ""}
      ORDER BY id ${LIMIT ? `LIMIT ${Number(LIMIT)}` : ""}`,
    IDS?.length ? [IDS] : [],
  );
  console.log(`${rows.length} studies with a DOI and no PMID`);

  const candidates = new Map<number, string[]>();
  const out: Row[] = [];
  let i = 0;
  let next = 0;
  for (const r of rows) {
    out.push({ id: r.id, doi: r.doi.trim(), pmid: "", status: "no_hit", human: r.human, note: "", pubmedDois: "" });
  }
  // A few requests in flight hide NCBI latency; the externalApi interceptor
  // still spaces dispatches ≥100ms apart, so the rate stays ≤10 req/s.
  async function worker() {
    while (next < out.length) {
      const row = out[next++];
      const doi = normalizeDoi(row.doi);
      if (!isLookupableDoi(doi)) {
        row.note = "not a valid DOI";
        continue;
      }
      try {
        candidates.set(row.id, await esearchDoi(doi));
      } catch (err: any) {
        row.status = "error";
        row.note = String(err?.message ?? err).slice(0, 200);
      }
      if (++i % 200 === 0) console.log(`  esearch ${i}/${rows.length}`);
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));

  const allPmids = [...new Set([...candidates.values()].flat())];
  const summaries: Record<string, any> = {};
  for (let k = 0; k < allPmids.length; k += 200) {
    Object.assign(summaries, await esummary(allPmids.slice(k, k + 200)));
  }

  const urlById = new Map(rows.map((r) => [r.id, `${r.url ?? ""} ${r.source_url ?? ""}`]));
  for (const row of out) {
    const c = candidates.get(row.id);
    if (!c) continue;
    const res = classifyCandidates(row.doi, c, summaries);
    Object.assign(row, { status: res.status, pmid: res.pmid, pubmedDois: res.pubmedDois });
    // A PubMed URL already on the row that names a different PMID is a conflict
    // to review, not something to paper over.
    const urlPmid = urlById.get(row.id)?.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/)?.[1];
    if (row.status === "matched" && urlPmid && urlPmid !== row.pmid) {
      row.status = "mismatch";
      row.note = `study url names PMID ${urlPmid}`;
    }
  }

  // One PMID must never land on two studies.
  const byPmid = new Map<string, Row[]>();
  for (const row of out.filter((r) => r.status === "matched")) {
    byPmid.set(row.pmid, [...(byPmid.get(row.pmid) ?? []), row]);
  }
  const { rows: taken } = await db.query(
    `SELECT pmid, id FROM studies WHERE pmid = ANY($1::text[])`,
    [[...byPmid.keys()]],
  );
  const takenBy = new Map(taken.map((t: any) => [t.pmid, t.id]));
  for (const [pmid, group] of byPmid) {
    if (group.length > 1 || takenBy.has(pmid)) {
      for (const row of group) {
        row.status = "multiple";
        row.note = group.length > 1
          ? `PMID shared by studies ${group.map((g) => g.id).join("/")}`
          : `PMID already on study ${takenBy.get(pmid)}`;
      }
    }
  }
  return out;
}

async function apply(db: pg.Pool, plan: Array<{ id: number; doi: string; pmid: string }>) {
  const { rows: current } = await db.query(
    `SELECT id, doi, pmid, is_excluded FROM studies WHERE id = ANY($1::int[])`,
    [plan.map((p) => p.id)],
  );
  const byId = new Map(current.map((r: any) => [r.id, r]));
  const todo = plan.filter((p) => {
    const r: any = byId.get(p.id);
    return r && !r.is_excluded && !String(r.pmid ?? "").trim() && normalizeDoi(r.doi) === normalizeDoi(p.doi) && /^\d+$/.test(p.pmid);
  });
  console.log(`APPLY: ${todo.length} of ${plan.length} matched rows still eligible (pmid empty, DOI unchanged)`);
  const dir = path.join(process.cwd(), "reports", "research");
  const backup = path.join(dir, `backup-pmid-backfill-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`);
  fs.writeFileSync(backup, JSON.stringify(todo.map((p) => ({ id: p.id, prior_pmid: (byId.get(p.id) as any)?.pmid ?? null, new_pmid: p.pmid }))));
  console.log(`Backup: ${path.relative(process.cwd(), backup)}`);
  const tx = await db.connect();
  try {
    await tx.query("BEGIN");
    let n = 0;
    for (const p of todo) {
      const r = await tx.query(
        `UPDATE studies SET pmid = $2 WHERE id = $1 AND NULLIF(TRIM(pmid), '') IS NULL`,
        [p.id, p.pmid],
      );
      n += r.rowCount ?? 0;
    }
    await tx.query("COMMIT");
    console.log(`Filled pmid on ${n} studies.`);
  } catch (err) {
    await tx.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    tx.release();
  }
}

async function main() {
  if (!process.env.PUBMED_API_KEY) console.warn("PUBMED_API_KEY not set — requests throttle to 3/s");
  // A pool, not a single client: the lookup phase runs for minutes with the DB
  // idle, and the public proxy drops idle connections.
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, idleTimeoutMillis: 10_000 });
  db.on("error", (err) => console.warn(`pg pool: ${err.message}`));
  try {
    console.log(`PMID coverage before: ${await coverage(db)}`);
    if (APPLY && CSV_IN) {
      const plan = parseCsv(fs.readFileSync(CSV_IN, "utf8"))
        .filter((c) => c[3] === "matched")
        .map(([id, doi, pmid]) => ({ id: Number(id), doi, pmid }));
      await apply(db, plan);
    } else {
      const rows = await lookup(db);
      const dir = path.join(process.cwd(), "reports", "research");
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `pmid-backfill-${new Date().toISOString().slice(0, 10)}${IDS?.length ? "-retry" : ""}.csv`);
      fs.writeFileSync(
        file,
        ["id,doi,pmid,status,human,note,pubmed_dois", ...rows.map((r) =>
          [r.id, r.doi, r.pmid, r.status, r.human, r.note, r.pubmedDois].map(csvEscape).join(","))].join("\n") + "\n",
      );
      const tally = (pred: (r: Row) => boolean) => {
        const t: Record<string, number> = {};
        for (const r of rows.filter(pred)) t[r.status] = (t[r.status] ?? 0) + 1;
        return t;
      };
      console.log("Status (all):", tally(() => true));
      console.log("Status (human):", tally((r) => r.human));
      console.log(`CSV: ${path.relative(process.cwd(), file)}`);
      if (APPLY) await apply(db, rows.filter((r) => r.status === "matched"));
    }
    console.log(`PMID coverage after: ${await coverage(db)}`);
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
