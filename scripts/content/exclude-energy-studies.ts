/**
 * Exclude off-topic hydrogen-ENERGY studies (biohydrogen, fuel cells,
 * electrolyzers, ...) from Hydrogen Studies: flag them `is_excluded` and 410
 * every public URL. Owner approval: josh 2026-09-28 "Remove hydrogen energy
 * studies". CLAUDE.md: 410s are content-destructive — run --apply only after
 * Josh approves the EXACT id list.
 *
 * DRY-RUN BY DEFAULT. Nothing is written without --apply.
 *
 *   --scan [--out <csv>] [--near-out <csv>]
 *       Read-only. Runs shared/study-topic-filter.ts over every study and
 *       writes the candidate list (id, slug, title, journal, year, reason,
 *       confidence, 90-day GSC impressions/clicks) plus a near-miss file
 *       (energy vocabulary but vetoed/not flagged) for human review.
 *
 *   --ids <file.csv>                 (dry run: prints the exact plan)
 *   --ids <file.csv> --apply         (writes)
 *       The id list is authoritative (first CSV column = study id; header and
 *       #-comment lines ignored). For each study:
 *         • studies: is_excluded = true, excluded_reason, excluded_at = now()
 *         • redirects: a status_code=410 row for every public path —
 *             /study/<slug>, /studies/<slug>, /study/id/<id>
 *           UPSERT: from_path is UNIQUE, so a pre-existing row (e.g. #8929, a
 *           bogus auto-promoted 302 /study/<slug> → /studies/<slug>) is
 *           converted to 410 (to_path '-', is_active = true, note appended)
 *           after being backed up. Pre-existing rows are listed in the dry run.
 *         • redirect_actions_log: one row per path, action 'exclude_410'.
 *       Before any write, a JSON backup of the affected study rows and the
 *       pre-existing redirect rows is written to $BACKUP_DIR (default
 *       reports/backups/, git-ignored). One transaction per study.
 *       --apply REFUSES unless a line of the id file STARTS with
 *       "approved-by: josh" (optionally "# approved-by: josh 2026-..") — add it
 *       once Josh approves the exact list.
 *
 *   --ids <file.csv> --restore [--apply]
 *       Reverse: clears the flag and deactivates the 410 rows this script
 *       wrote (note contains "exclude-energy"). Restores nothing else.
 *
 * Effect timing after --apply: the 410 guard's excluded-set cache and the
 * redirects cache refresh within 5 minutes; sitemaps within 1 hour.
 *
 * Run (from the repo, after the migration-023 deploy):
 *   railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/content/exclude-energy-studies.ts --scan'
 *   railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/content/exclude-energy-studies.ts --ids reports/energy-studies-2026-09.csv'
 *   railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/content/exclude-energy-studies.ts --ids reports/energy-studies-2026-09.csv --apply'
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { isHydrogenEnergyStudy } from "../../shared/study-topic-filter";

const argv = process.argv.slice(2);
const has = (flag: string) => argv.includes(flag);
const flagValue = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

const APPLY = has("--apply");
const SCAN = has("--scan");
const RESTORE = has("--restore");
const IDS_FILE = flagValue("--ids");
const APPROVAL_DATE = "2026-09-28";
const APPROVAL_QUOTE = "Remove hydrogen energy studies";
const ACTOR = `claude-code (approved: josh ${APPROVAL_DATE} '${APPROVAL_QUOTE}')`;
const NOTE_TAG = `exclude-energy ${APPROVAL_DATE}`;
const LOG_ACTION = "exclude_410";
const GSC_DAYS = 90;

type StudyRow = {
  id: number;
  slug: string | null;
  title: string;
  journal: string | null;
  publish_year: number | null;
  category: string | null;
  keywords: string[] | null;
  abstract: string | null;
  is_excluded: boolean;
};

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function cleanTitle(t: string): string {
  return t.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/** Every public path of a study (lowercase — the redirect cache keys on it). */
function publicPaths(s: { id: number; slug: string | null }): string[] {
  const paths = [`/study/id/${s.id}`];
  if (s.slug && !s.slug.startsWith("id/")) {
    paths.unshift(`/study/${s.slug}`.toLowerCase(), `/studies/${s.slug}`.toLowerCase());
  }
  return paths;
}

function readIds(file: string): { ids: number[]; approved: boolean } {
  const text = fs.readFileSync(file, "utf8");
  const ids: number[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue;
    const m = line.match(/^\s*"?(\d+)"?\s*(,|$)/);
    if (m) ids.push(parseInt(m[1], 10));
  }
  // The approval marker must START a line (optionally after "#"), so prose
  // that merely mentions it (like the scan header) never counts.
  return { ids: Array.from(new Set(ids)), approved: /^\s*#?\s*approved-by:\s*josh\b/im.test(text) };
}

async function gscFor(db: pg.Client, slugs: string[]): Promise<Map<string, { impressions: number; clicks: number }>> {
  const out = new Map<string, { impressions: number; clicks: number }>();
  if (slugs.length === 0) return out;
  try {
    const r = await db.query(
      `SELECT s.slug, COALESCE(SUM(g.impressions), 0)::int AS impressions, COALESCE(SUM(g.clicks), 0)::int AS clicks
         FROM unnest($1::text[]) AS s(slug)
         LEFT JOIN gsc_query_metrics g
           ON g.page LIKE '%' || s.slug || '%'
          AND g.date >= TO_CHAR(CURRENT_DATE - $2::int, 'YYYY-MM-DD')
        GROUP BY s.slug`,
      [slugs, GSC_DAYS],
    );
    for (const row of r.rows) out.set(row.slug, { impressions: row.impressions, clicks: row.clicks });
  } catch (e: any) {
    console.warn(`GSC lookup skipped: ${e.message}`);
  }
  return out;
}

async function scan(db: pg.Client) {
  const outFile = flagValue("--out") || "reports/energy-studies-scan.csv";
  const nearFile = flagValue("--near-out") || outFile.replace(/\.csv$/, "-near-misses.csv");
  const { rows } = await db.query<StudyRow>(
    `SELECT id, slug, title, journal, publish_year, category, keywords, abstract, false AS is_excluded FROM studies ORDER BY id`,
  );
  const flagged: Array<{ s: StudyRow; confidence: string; reason: string }> = [];
  const near: Array<{ s: StudyRow; energy: string; health: string }> = [];
  for (const s of rows) {
    const v = isHydrogenEnergyStudy({ title: s.title, abstract: s.abstract, keywords: s.keywords, category: s.category, journal: s.journal });
    if (v.excluded) flagged.push({ s, confidence: v.confidence!, reason: v.reason! });
    else if (v.energySignals.length > 0) near.push({ s, energy: v.energySignals.join("; "), health: v.healthSignals.join("; ") });
  }
  const gsc = await gscFor(db, flagged.map((f) => f.s.slug).filter((x): x is string => !!x));
  const header =
    `# Hydrogen-energy exclusion candidates — scan ${new Date().toISOString().slice(0, 10)} (shared/study-topic-filter.ts; GSC = last ${GSC_DAYS} days).\n` +
    `# Review every row. To apply, once Josh approves this exact list add a line starting with the approved-by marker for josh (see script header), then run --apply.\n` +
    "id,slug,title,journal,year,reason,confidence,gsc_impressions_90d,gsc_clicks_90d";
  const lines = flagged
    .sort((a, b) => (a.confidence === b.confidence ? a.s.id - b.s.id : a.confidence === "high" ? -1 : 1))
    .map(({ s, confidence, reason }) => {
      const g = (s.slug && gsc.get(s.slug)) || { impressions: 0, clicks: 0 };
      return [s.id, s.slug, cleanTitle(s.title), s.journal, s.publish_year, reason, confidence, g.impressions, g.clicks]
        .map(csvCell)
        .join(",");
    });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, [header, ...lines].join("\n") + "\n");
  fs.writeFileSync(
    nearFile,
    ["id,slug,title,energy_signals,health_signals_that_vetoed", ...near.map(({ s, energy, health }) =>
      [s.id, s.slug, cleanTitle(s.title), energy, health].map(csvCell).join(","))].join("\n") + "\n",
  );
  console.log(`scanned ${rows.length} studies → ${flagged.length} flagged (${outFile}), ${near.length} near-misses (${nearFile})`);
  for (const { s, confidence } of flagged) console.log(`  [${confidence}] #${s.id} ${cleanTitle(s.title).slice(0, 110)}`);
}

async function planOrApply(db: pg.Client) {
  if (!IDS_FILE) throw new Error("--ids <file.csv> is required (or use --scan)");
  const { ids, approved } = readIds(IDS_FILE);
  if (ids.length === 0) throw new Error(`no study ids found in ${IDS_FILE}`);
  if (APPLY && !approved) {
    throw new Error(`refusing --apply: ${IDS_FILE} has no "approved-by: josh" line (CLAUDE.md: 410s need Josh's approval of the exact list)`);
  }

  const col = await db.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'studies' AND column_name = 'is_excluded'`);
  if (col.rowCount === 0) {
    if (APPLY) throw new Error("studies.is_excluded is missing — deploy migration 023_add_study_exclusion first");
    console.warn("NOTE: studies.is_excluded does not exist yet (migration 023 not deployed) — dry run only.\n");
  }

  const { rows: studyRows } = await db.query(`SELECT * FROM studies WHERE id = ANY($1::int[]) ORDER BY id`, [ids]);
  const found = new Map(studyRows.map((r: any) => [r.id, r]));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) console.warn(`WARNING: ids not found (skipped): ${missing.join(", ")}`);

  const allPaths = studyRows.flatMap((s: any) => publicPaths(s));
  const { rows: existingRedirects } = await db.query(`SELECT * FROM redirects WHERE from_path = ANY($1::text[])`, [allPaths]);
  const existingByPath = new Map(existingRedirects.map((r: any) => [r.from_path, r]));

  console.log(`${RESTORE ? "RESTORE" : "EXCLUDE"} ${APPLY ? "(APPLY)" : "(dry run — nothing written)"} — ${studyRows.length} studies from ${IDS_FILE}\n`);
  for (const s of studyRows as any[]) {
    const v = isHydrogenEnergyStudy({ title: s.title, abstract: s.abstract, keywords: s.keywords, category: s.category, journal: s.journal });
    console.log(`#${s.id} ${s.is_excluded ? "[already excluded] " : ""}${cleanTitle(s.title).slice(0, 100)}`);
    if (!v.excluded) console.log(`   note: NOT flagged by the classifier — included because it is on the approved list`);
    for (const p of publicPaths(s)) {
      const ex: any = existingByPath.get(p);
      if (!ex) console.log(`   ${p}  → new 410 row`);
      else if (ex.status_code === 410 && ex.is_active) console.log(`   ${p}  → already 410 (redirects #${ex.id})`);
      else console.log(`   ${p}  → PRE-EXISTING redirects #${ex.id} ${ex.status_code} → ${ex.to_path} (active=${ex.is_active}) — will be converted to 410`);
    }
  }
  const preExisting = existingRedirects.filter((r: any) => !(r.status_code === 410 && r.is_active));
  console.log(`\npre-existing redirect rows that will be converted: ${preExisting.length}`);
  for (const r of preExisting as any[]) console.log(`   #${r.id} ${r.from_path} ${r.status_code} → ${r.to_path} note=${JSON.stringify(r.note)}`);

  if (!APPLY) {
    console.log("\nDry run complete. Re-run with --apply (after Josh approves this exact list) to write.");
    return;
  }

  const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), "reports", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `exclude-energy-studies-${RESTORE ? "restore-" : ""}${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({ actor: ACTOR, idsFile: IDS_FILE, studies: studyRows, redirects: existingRedirects }, null, 2));
  console.log(`\nbackup written: ${backupFile}`);

  let done = 0;
  for (const s of studyRows as any[]) {
    await db.query("BEGIN");
    try {
      if (RESTORE) {
        await db.query(`UPDATE studies SET is_excluded = false, excluded_reason = NULL, excluded_at = NULL WHERE id = $1`, [s.id]);
        for (const p of publicPaths(s)) {
          const r = await db.query(
            `UPDATE redirects SET is_active = false, note = COALESCE(note, '') || $2 WHERE from_path = $1 AND status_code = 410 AND note LIKE '%exclude-energy%'`,
            [p, ` | restored ${new Date().toISOString().slice(0, 10)}`],
          );
          if (r.rowCount) {
            await db.query(
              `INSERT INTO redirect_actions_log (action, from_path, to_path, status_code, actor, note) VALUES ($1, $2, '-', 410, $3, $4)`,
              [`${LOG_ACTION}_restore`, p, ACTOR, `study #${s.id} restored; 410 row deactivated`],
            );
          }
        }
      } else {
        const v = isHydrogenEnergyStudy({ title: s.title, abstract: s.abstract, keywords: s.keywords, category: s.category, journal: s.journal });
        const reason = `Off-topic hydrogen-energy research (${v.reason ?? "approved list"}). Approved: josh ${APPROVAL_DATE} '${APPROVAL_QUOTE}'`;
        await db.query(
          `UPDATE studies SET is_excluded = true, excluded_reason = $2, excluded_at = COALESCE(excluded_at, now()) WHERE id = $1`,
          [s.id, reason],
        );
        for (const p of publicPaths(s)) {
          const ex: any = existingByPath.get(p);
          if (ex) {
            await db.query(
              `UPDATE redirects SET status_code = 410, to_path = '-', is_active = true, note = COALESCE(note, '') || $2 WHERE id = $1`,
              [ex.id, ` | ${NOTE_TAG}: study #${s.id} excluded (was ${ex.status_code} → ${ex.to_path}, active=${ex.is_active})`],
            );
          } else {
            await db.query(
              `INSERT INTO redirects (from_path, to_path, status_code, is_active, note) VALUES ($1, '-', 410, true, $2)
               ON CONFLICT (from_path) DO UPDATE SET status_code = 410, to_path = '-', is_active = true, note = COALESCE(redirects.note, '') || ' | ' || EXCLUDED.note`,
              [p, `${NOTE_TAG}: study #${s.id} off-topic hydrogen-energy research`],
            );
          }
          await db.query(
            `INSERT INTO redirect_actions_log (action, from_path, to_path, status_code, actor, note) VALUES ($1, $2, '-', 410, $3, $4)`,
            [LOG_ACTION, p, ACTOR, `study #${s.id} excluded: ${reason}${ex ? ` (converted redirects #${ex.id}, was ${ex.status_code} → ${ex.to_path})` : ""}`],
          );
        }
      }
      await db.query("COMMIT");
      done++;
      console.log(`  ✓ #${s.id}`);
    } catch (e) {
      await db.query("ROLLBACK");
      throw e;
    }
  }
  console.log(`\n${RESTORE ? "restored" : "excluded"} ${done}/${studyRows.length} studies. Caches refresh within 5 min (410 guard, redirects) / 1 h (sitemaps).`);
}

async function main() {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  try {
    if (SCAN) {
      await db.query("SET default_transaction_read_only = on");
      await scan(db);
    } else {
      if (!APPLY) await db.query("SET default_transaction_read_only = on");
      await planOrApply(db);
    }
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
