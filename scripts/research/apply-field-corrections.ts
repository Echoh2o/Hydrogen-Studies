/**
 * Apply reviewed corrections from the field backfill (reports/research/
 * backfill-corrections-*.csv) — is_human_trial and study_type only. Exclusions
 * (is_excluded) are NOT handled here: they 410 pages and go through
 * scripts/content/exclude-energy-studies.ts with an approved id file.
 *
 * Approved by Josh 2026-10-20 (reports/research/backfill-review-2026-10-20.md
 * D2 "fix human number", D4 "fix").
 *
 * DRY-RUN BY DEFAULT. Writes a JSON backup of prior values before --apply.
 *   railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/research/apply-field-corrections.ts \
 *     --csv reports/research/backfill-corrections-2026-10-20-21-30.csv,reports/research/backfill-corrections-2026-10-20-21-41.csv \
 *     --skip 2057,2233 [--apply]'
 */
import fs from "fs";
import path from "path";
import pg from "pg";

const args = process.argv.slice(2);
const opt = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const APPLY = args.includes("--apply");
const CSVS = (opt("--csv") ?? "").split(",").filter(Boolean);
const SKIP = new Set((opt("--skip") ?? "").split(",").filter(Boolean).map(Number));

/** Proposals that are not usable values. */
const JUNK_STUDY_TYPE = /^(not specified|unknown|n\/a|none|)$|animal models?\s*\(/i;

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

async function main() {
  if (!CSVS.length) throw new Error("--csv <file[,file]> is required");
  const proposals = new Map<string, { id: number; field: "is_human_trial" | "study_type"; value: string }>();
  for (const f of CSVS) {
    for (const [id, field, , proposed] of parseCsv(fs.readFileSync(f, "utf8"))) {
      if (field !== "is_human_trial" && field !== "study_type") continue;
      if (SKIP.has(Number(id))) continue;
      if (field === "study_type" && JUNK_STUDY_TYPE.test(proposed.trim())) continue;
      proposals.set(`${id}:${field}`, { id: Number(id), field, value: proposed.trim() });
    }
  }

  const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  try {
    const ids = [...new Set([...proposals.values()].map((p) => p.id))];
    const { rows } = await db.query(
      `SELECT id, is_excluded, is_human_trial, study_type FROM studies WHERE id = ANY($1::int[])`,
      [ids],
    );
    const byId = new Map(rows.map((r: any) => [r.id, r]));
    const plan = [...proposals.values()].filter((p) => {
      const r: any = byId.get(p.id);
      if (!r || r.is_excluded) return false; // excluded pages don't need fixing
      const current = p.field === "is_human_trial" ? String(r.is_human_trial) : String(r.study_type ?? "");
      return current !== p.value;
    });
    const count = (f: string) => plan.filter((p) => p.field === f).length;
    console.log(`${APPLY ? "APPLY" : "DRY RUN"}: is_human_trial ${count("is_human_trial")} rows, study_type ${count("study_type")} rows`);
    for (const p of plan) {
      const r: any = byId.get(p.id);
      console.log(`  #${p.id} ${p.field}: ${p.field === "is_human_trial" ? r.is_human_trial : r.study_type} → ${p.value}`);
    }
    if (!APPLY) return;

    const dir = path.join(process.cwd(), "reports", "research");
    fs.mkdirSync(dir, { recursive: true });
    const backup = path.join(dir, `backup-field-corrections-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`);
    fs.writeFileSync(backup, JSON.stringify(rows));
    console.log(`Backup of prior values: ${path.relative(process.cwd(), backup)}`);

    await db.query("BEGIN");
    for (const p of plan) {
      if (p.field === "is_human_trial") {
        await db.query(`UPDATE studies SET is_human_trial = $2 WHERE id = $1`, [p.id, p.value === "true"]);
      } else {
        await db.query(`UPDATE studies SET study_type = $2 WHERE id = $1`, [p.id, p.value]);
      }
    }
    await db.query("COMMIT");
    console.log(`Applied ${plan.length} corrections.`);
  } catch (err) {
    await db.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
