/**
 * Structured-field extraction for HUMAN studies — sibling of
 * backfill-study-fields.ts (same Haiku tier, same fill-empty-only policy).
 *
 * Fields: h2_concentration, dosage_protocol, duration, sample_size,
 * funding_sources, conflict_of_interest. Source text: Europe PMC open-access
 * full text (JATS: methods + <funding-group>/acknowledgements + COI footnotes
 * and sections) when available, otherwise the abstract only. Every value needs
 * a verbatim evidence quote that is re-found in the source text; see
 * server/services/human-trial-field-extraction.ts for the checks.
 *
 * DRY-RUN BY DEFAULT (no DB writes). Writes:
 *   reports/research/field-extraction-dryrun-<date>.csv     (id, field, current, proposed, source, evidence)
 *   reports/research/field-extraction-spotcheck-<date>.csv  (5% random sample per field, min 3, for human review)
 *   reports/research/field-extraction-rejected-<date>.csv   (values dropped by the evidence checks)
 *
 *   DBURL=$(railway variables --service Postgres --kv | grep '^DATABASE_PUBLIC_URL=' | cut -d= -f2-)
 *   railway run --service Hydrogen-Studies -- env DATABASE_URL="$DBURL" npx tsx scripts/research/extract-human-trial-fields.ts [--limit N] [--ids 1,2]
 *
 * Applying (ONLY after Josh signs off on the spot-check): re-reads the reviewed
 * dry-run CSV, re-checks each column is still empty, JSON backup first:
 *   ... npx tsx scripts/research/extract-human-trial-fields.ts --apply --csv reports/research/field-extraction-dryrun-<date>.csv [--skip-fields f1,f2] [--skip-ids 1,2]
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { externalApi } from "../../server/utils/http";
import { logger } from "../../server/utils/logger";
import { getFullTextXML } from "../../server/services/europepmc-api";
import {
  HUMAN_FIELDS,
  extractHumanTrialFields,
  sectionJats,
  verifyExtraction,
  type CurrentValues,
  type HumanField,
  type Proposal,
  type Rejection,
  type SourceText,
} from "../../server/services/human-trial-field-extraction";

const args = process.argv.slice(2);
const opt = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const APPLY = args.includes("--apply");
const CSV_IN = opt("--csv");
const LIMIT = opt("--limit") ? Number(opt("--limit")) : undefined;
const IDS = opt("--ids")?.split(",").map(Number).filter(Number.isFinite);
const CONCURRENCY = Number(opt("--concurrency") ?? 4);
const SKIP_FIELDS = new Set((opt("--skip-fields") ?? "").split(",").filter(Boolean));
const SKIP_IDS = new Set((opt("--skip-ids") ?? "").split(",").filter(Boolean).map(Number));

/** Haiku 4.5 list price, USD per million tokens. */
const PRICE_IN = 1;
const PRICE_OUT = 5;

const csvEscape = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cells: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { cells.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      cells.push(cur); cur = "";
      if (cells.some((c) => c !== "")) rows.push(cells);
      cells = [];
    } else cur += ch;
  }
  if (cur || cells.length) { cells.push(cur); rows.push(cells); }
  return rows;
}

const COLUMN: Record<HumanField, string> = {
  h2_concentration: "h2_concentration",
  dosage_protocol: "dosage_protocol",
  duration: "duration",
  sample_size: "sample_size",
  funding_sources: "funding_sources",
  conflict_of_interest: "conflict_of_interest",
};

// --- token accounting: ai-provider logs usage through logger.info ----------
const usage = { calls: 0, inputTokens: 0, outputTokens: 0 };
const origInfo = logger.info.bind(logger);
logger.info = (message: string, context?: string, data?: Record<string, unknown>) => {
  if (message === "Anthropic usage" && data?.caller === "human-trial-field-extraction") {
    usage.calls++;
    usage.inputTokens += Number(data.inputTokens ?? 0);
    usage.outputTokens += Number(data.outputTokens ?? 0);
    return;
  }
  origInfo(message, context, data);
};

interface EpmcHit {
  pmcid: string | null;
  abstractText: string;
  isOpenAccess: boolean;
  inEPMC: boolean;
}

async function europePmcLookup(pmid: string | null, doi: string | null): Promise<EpmcHit | null> {
  const queries = [
    pmid ? `EXT_ID:${pmid} AND SRC:MED` : null,
    doi ? `DOI:"${doi.replace(/"/g, "")}"` : null,
  ].filter(Boolean) as string[];
  for (const query of queries) {
    const res = await externalApi.get("https://www.ebi.ac.uk/europepmc/webservices/rest/search", {
      params: { query, format: "json", resultType: "core", pageSize: 1 },
      timeout: 20_000,
    });
    const r = res.data?.resultList?.result?.[0];
    if (r) {
      return {
        pmcid: r.pmcid ?? null,
        abstractText: String(r.abstractText ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        isOpenAccess: r.isOpenAccess === "Y",
        inEPMC: r.inEPMC === "Y",
      };
    }
  }
  return null;
}

async function buildSource(row: any): Promise<{ src: SourceText; note: string }> {
  const dbAbstract = String(row.abstract ?? "").trim();
  let hit: EpmcHit | null = null;
  try {
    hit = await europePmcLookup(row.pmid, row.doi);
  } catch (err: any) {
    // fall through to abstract-only
  }
  const abstract = dbAbstract.length >= 200 || !hit?.abstractText ? dbAbstract : hit.abstractText;
  if (hit?.pmcid && (hit.isOpenAccess || hit.inEPMC)) {
    const xml = await getFullTextXML(hit.pmcid);
    const sec = xml ? sectionJats(xml) : null;
    if (sec && sec.methods.length > 500) {
      return { src: { kind: "fulltext", ...sec, abstract: sec.abstract || abstract }, note: hit.pmcid };
    }
  }
  return { src: { kind: "abstract", abstract, methods: "", funding: "", coi: "" }, note: hit ? "no OA full text" : "not in Europe PMC" };
}

async function dryRun(db: pg.Pool) {
  const where = ["is_excluded = false", "is_human_trial = true"];
  const params: unknown[] = [];
  if (IDS?.length) { params.push(IDS); where.push(`id = ANY($${params.length}::int[])`); }
  // At least one target column empty (sample_size/duration: NULL or <= 0).
  where.push(`(NULLIF(TRIM(h2_concentration), '') IS NULL OR NULLIF(TRIM(dosage_protocol), '') IS NULL
    OR COALESCE(duration, 0) <= 0 OR COALESCE(sample_size, 0) <= 0
    OR NULLIF(TRIM(funding_sources), '') IS NULL OR NULLIF(TRIM(conflict_of_interest), '') IS NULL)`);
  const { rows } = await db.query(
    `SELECT id, title, abstract, doi, pmid, ${HUMAN_FIELDS.map((f) => COLUMN[f]).join(", ")}
       FROM studies WHERE ${where.join(" AND ")} ORDER BY id ${LIMIT ? `LIMIT ${Number(LIMIT)}` : ""}`,
    params,
  );
  console.log(`[dry-run] ${rows.length} human studies with at least one empty target field`);

  const out: Array<Proposal & { id: number; current: string; title: string; link: string }> = [];
  const rejected: Array<Rejection & { id: number }> = [];
  const sourceKinds = { fulltext: 0, abstract: 0 };
  const failed: number[] = [];
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < rows.length) {
      const row = rows[next++];
      try {
        const { src } = await buildSource(row);
        sourceKinds[src.kind]++;
        if (!src.abstract && src.kind === "abstract") continue;
        const raw = await extractHumanTrialFields(row.title, src);
        const current: CurrentValues = {
          h2_concentration: row.h2_concentration,
          dosage_protocol: row.dosage_protocol,
          duration: row.duration,
          sample_size: row.sample_size,
          funding_sources: row.funding_sources,
          conflict_of_interest: row.conflict_of_interest,
        };
        const v = verifyExtraction(raw, row.title, src, current);
        const link = row.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${row.pmid}/` : row.doi ? `https://doi.org/${row.doi}` : "";
        for (const p of v.proposals) {
          out.push({ ...p, id: row.id, current: String(current[p.field] ?? ""), title: String(row.title ?? "").slice(0, 140), link });
        }
        for (const r of v.rejected) rejected.push({ ...r, id: row.id });
      } catch (err: any) {
        failed.push(row.id);
        console.warn(`  study ${row.id} failed: ${err?.message ?? err}`);
      }
      if (++done % 25 === 0) console.log(`  ${done}/${rows.length}`);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));
  out.sort((a, b) => a.id - b.id || HUMAN_FIELDS.indexOf(a.field) - HUMAN_FIELDS.indexOf(b.field));

  const dir = path.join(process.cwd(), "reports", "research");
  fs.mkdirSync(dir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const dryFile = path.join(dir, `field-extraction-dryrun-${date}.csv`);
  fs.writeFileSync(dryFile, ["id,field,current,proposed,source,evidence", ...out.map((p) =>
    [p.id, p.field, p.current, p.value, p.source, p.evidence].map(csvEscape).join(","))].join("\n") + "\n");

  // Spot-check: 5% per field (min 3), random, with title + link for the reviewer.
  const sample: typeof out = [];
  for (const f of HUMAN_FIELDS) {
    const pool = out.filter((p) => p.field === f).sort(() => Math.random() - 0.5);
    sample.push(...pool.slice(0, Math.min(pool.length, Math.max(3, Math.ceil(pool.length * 0.05)))));
  }
  sample.sort((a, b) => a.id - b.id);
  const spotFile = path.join(dir, `field-extraction-spotcheck-${date}.csv`);
  fs.writeFileSync(spotFile, ["id,field,proposed,source,evidence,title,link,verdict (ok/wrong),reviewer_note", ...sample.map((p) =>
    [p.id, p.field, p.value, p.source, p.evidence, p.title, p.link, "", ""].map(csvEscape).join(","))].join("\n") + "\n");

  const rejFile = path.join(dir, `field-extraction-rejected-${date}.csv`);
  fs.writeFileSync(rejFile, ["id,field,value,reason,evidence", ...rejected.sort((a, b) => a.id - b.id).map((r) =>
    [r.id, r.field, typeof r.value === "object" ? JSON.stringify(r.value) : r.value, r.reason, r.evidence].map(csvEscape).join(","))].join("\n") + "\n");

  // Projected coverage on human studies.
  const { rows: [cov] } = await db.query(`
    SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE NULLIF(TRIM(h2_concentration), '') IS NOT NULL)::int AS h2_concentration,
      COUNT(*) FILTER (WHERE NULLIF(TRIM(dosage_protocol), '') IS NOT NULL)::int AS dosage_protocol,
      COUNT(*) FILTER (WHERE duration > 0)::int AS duration,
      COUNT(*) FILTER (WHERE sample_size > 0)::int AS sample_size,
      COUNT(*) FILTER (WHERE NULLIF(TRIM(funding_sources), '') IS NOT NULL)::int AS funding_sources,
      COUNT(*) FILTER (WHERE NULLIF(TRIM(conflict_of_interest), '') IS NOT NULL)::int AS conflict_of_interest
    FROM studies WHERE is_excluded = false AND is_human_trial = true`);
  const pct = (n: number) => `${((n / cov.total) * 100).toFixed(1)}%`;
  console.log(`\nHuman studies: ${cov.total} | source: fulltext ${sourceKinds.fulltext}, abstract-only ${sourceKinds.abstract} | failed ${failed.length}${failed.length ? ` (${failed.join(",")})` : ""}`);
  console.log("| Field | Now | Proposed | Projected | Rejected by checks | from fulltext / abstract |");
  console.log("| --- | ---: | ---: | ---: | ---: | --- |");
  for (const f of HUMAN_FIELDS) {
    const prop = out.filter((p) => p.field === f);
    const now = Number(cov[f]);
    console.log(`| ${f} | ${now} (${pct(now)}) | +${prop.length} | ${now + prop.length} (${pct(now + prop.length)}) | ${rejected.filter((r) => r.field === f).length} | ${prop.filter((p) => p.source === "fulltext").length} / ${prop.filter((p) => p.source === "abstract").length} |`);
  }
  const cost = (usage.inputTokens / 1e6) * PRICE_IN + (usage.outputTokens / 1e6) * PRICE_OUT;
  console.log(`\nHaiku usage: ${usage.calls} calls, ${usage.inputTokens} input + ${usage.outputTokens} output tokens ≈ $${cost.toFixed(2)} (at $${PRICE_IN}/$${PRICE_OUT} per MTok)`);
  console.log(`Dry run: ${path.relative(process.cwd(), dryFile)} (${out.length} proposals)`);
  console.log(`Spot-check: ${path.relative(process.cwd(), spotFile)} (${sample.length} rows)`);
  console.log(`Rejected: ${path.relative(process.cwd(), rejFile)} (${rejected.length} rows)`);
}

async function apply(db: pg.Pool) {
  if (!CSV_IN) throw new Error("--apply requires --csv <reviewed field-extraction-dryrun CSV>");
  const plan = parseCsv(fs.readFileSync(CSV_IN, "utf8"))
    .filter((c) => c[0] !== "id")
    .map(([id, field, , proposed]) => ({ id: Number(id), field: field as HumanField, value: proposed }))
    .filter((p) => (HUMAN_FIELDS as readonly string[]).includes(p.field) && !SKIP_FIELDS.has(p.field) && !SKIP_IDS.has(p.id) && p.value.trim());
  const ids = [...new Set(plan.map((p) => p.id))];
  const { rows } = await db.query(
    `SELECT id, is_excluded, is_human_trial, ${HUMAN_FIELDS.map((f) => COLUMN[f]).join(", ")} FROM studies WHERE id = ANY($1::int[])`,
    [ids],
  );
  const byId = new Map(rows.map((r: any) => [r.id, r]));
  const empty = (v: unknown) => v === null || v === undefined || (typeof v === "string" && !v.trim()) || (typeof v === "number" && v <= 0);
  const todo = plan.filter((p) => {
    const r: any = byId.get(p.id);
    return r && !r.is_excluded && r.is_human_trial && empty(r[COLUMN[p.field]]);
  });
  console.log(`APPLY: ${todo.length} of ${plan.length} proposals still target an empty column`);
  const dir = path.join(process.cwd(), "reports", "research");
  const backup = path.join(dir, `backup-field-extraction-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`);
  fs.writeFileSync(backup, JSON.stringify(rows));
  console.log(`Backup of prior values: ${path.relative(process.cwd(), backup)}`);
  const tx = await db.connect();
  try {
    await tx.query("BEGIN");
    for (const p of todo) {
      const col = COLUMN[p.field];
      const numeric = p.field === "duration" || p.field === "sample_size";
      await tx.query(
        `UPDATE studies SET ${col} = $2 WHERE id = $1 AND (${col} IS NULL OR ${numeric ? `${col} <= 0` : `TRIM(${col}) = ''`})`,
        [p.id, numeric ? Number(p.value) : p.value],
      );
    }
    await tx.query("COMMIT");
    console.log(`Applied ${todo.length} field values.`);
  } catch (err) {
    await tx.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    tx.release();
  }
}

async function main() {
  // A pool, not a single client: the extraction phase runs for many minutes
  // with the DB idle, and the public proxy drops idle connections.
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, idleTimeoutMillis: 10_000 });
  db.on("error", (err) => console.warn(`pg pool: ${err.message}`));
  try {
    if (APPLY) await apply(db);
    else await dryRun(db);
  } finally {
    await db.end();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
