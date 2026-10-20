/**
 * MCP plan Phase 0 — backfill structured study fields with Haiku.
 *
 * Write policy lives in server/services/study-field-extraction.ts (planUpdates):
 * new columns always, everything else ONLY when empty. Disagreements with
 * stored values and off-topic papers go to a corrections CSV for Josh — this
 * script never changes is_human_trial / study_type values that exist, and
 * never excludes a study.
 *
 *   # preview 25 rows, no DB writes (works before migration 026 is deployed)
 *   railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/research/backfill-study-fields.ts --dry-run --limit 25'
 *   # full run (resumable: skips rows with fields_extracted_at set)
 *   railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/research/backfill-study-fields.ts'
 *
 * Flags: --dry-run, --limit N, --concurrency N (default 6), --ids 1,2,3
 */
import fs from "fs";
import path from "path";
import { sql, eq } from "drizzle-orm";
import { db } from "../../server/db";
import { studies } from "../../shared/schema";
import {
  extractStudyFields,
  planUpdates,
  type Correction,
  type ExtractionInput,
} from "../../server/services/study-field-extraction";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const DRY_RUN = flag("--dry-run");
const LIMIT = opt("--limit") ? Number(opt("--limit")) : undefined;
const CONCURRENCY = Number(opt("--concurrency") ?? 6);
const IDS = opt("--ids")?.split(",").map(Number).filter(Number.isFinite);

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const hasColumns =
    ((await db.execute(sql`SELECT 1 FROM information_schema.columns
       WHERE table_name = 'studies' AND column_name = 'fields_extracted_at'`)).rows?.length ?? 0) > 0;
  if (!hasColumns && !DRY_RUN) {
    throw new Error("studies.fields_extracted_at missing — deploy migration 026 first (or use --dry-run).");
  }

  const where = [sql`is_excluded = false`];
  if (hasColumns && !IDS) where.push(sql`fields_extracted_at IS NULL`);
  if (IDS?.length) where.push(sql`id IN (${sql.join(IDS.map((id) => sql`${id}`), sql`, `)})`);
  const rows = (
    await db.execute(sql`
      SELECT id, title, abstract, conclusion, study_type, is_human_trial, outcome, sample_size, duration,
             h2_delivery_method, h2_concentration, dosage_protocol
        FROM studies WHERE ${sql.join(where, sql` AND `)}
       ORDER BY id ${LIMIT ? sql`LIMIT ${LIMIT}` : sql``}`)
  ).rows as any[];

  const candidates: ExtractionInput[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    abstract: r.abstract,
    conclusion: r.conclusion,
    studyType: r.study_type,
    isHumanTrial: r.is_human_trial,
    outcome: r.outcome,
    sampleSize: r.sample_size,
    duration: r.duration,
    h2DeliveryMethod: r.h2_delivery_method,
    h2Concentration: r.h2_concentration,
    dosageProtocol: r.dosage_protocol,
  }));
  console.log(`${DRY_RUN ? "[dry-run] " : ""}${candidates.length} studies to process (concurrency ${CONCURRENCY})`);

  const dir = path.join(process.cwd(), "reports", "research");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  if (!DRY_RUN && candidates.length) {
    // Original values of every column this run may fill — restoring them (and
    // NULLing study_design / fields_extracted_at) fully reverts the run.
    const f = path.join(dir, `backup-pre-backfill-${stamp}.json`);
    fs.writeFileSync(f, JSON.stringify(candidates.map(({ title, abstract, conclusion, ...cols }) => cols)));
    console.log(`Backup of original values: ${path.relative(process.cwd(), f)}`);
  }

  const preview: unknown[] = [];
  const corrections: Correction[] = [];
  const failed: number[] = [];
  const fieldCounts: Record<string, number> = {};
  let done = 0;

  let next = 0;
  async function worker() {
    while (next < candidates.length) {
      const s = candidates[next++];
      try {
        const extracted = await extractStudyFields(s);
        const plan = planUpdates(s, extracted);
        corrections.push(...plan.corrections);
        for (const k of Object.keys(plan.updates)) fieldCounts[k] = (fieldCounts[k] ?? 0) + 1;
        if (DRY_RUN) {
          preview.push({ id: s.id, title: s.title, extracted, updates: plan.updates, corrections: plan.corrections });
        } else {
          await db.update(studies).set(plan.updates as any).where(eq(studies.id, s.id));
        }
      } catch (err: any) {
        failed.push(s.id);
        console.warn(`  study ${s.id} failed: ${err?.message ?? err}`);
      }
      if (++done % 50 === 0) console.log(`  ${done}/${candidates.length}`);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));

  if (DRY_RUN) {
    const f = path.join(dir, `backfill-dryrun-${stamp}.json`);
    fs.writeFileSync(f, JSON.stringify(preview, null, 2));
    console.log(`Preview: ${path.relative(process.cwd(), f)}`);
  }
  if (corrections.length) {
    const f = path.join(dir, `backfill-corrections-${stamp}${DRY_RUN ? "-dryrun" : ""}.csv`);
    const lines = ["id,field,current,proposed,title", ...corrections.map((c) =>
      [c.id, c.field, c.current, c.proposed, c.title].map(csvEscape).join(","))];
    fs.writeFileSync(f, lines.join("\n") + "\n");
    console.log(`Corrections for review: ${path.relative(process.cwd(), f)}`);
  }
  console.log("Fields written (rows):", fieldCounts);
  console.log(`Done: ${done - failed.length} ok, ${failed.length} failed${failed.length ? ` (${failed.join(",")})` : ""}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
