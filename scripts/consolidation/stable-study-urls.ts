/**
 * PLAN.md 3.3 — stable study URLs. REPORT-FIRST. DRY-RUN BY DEFAULT.
 *
 * Every live study slug is `<title>-<13-digit import epoch>`; the stable form
 * is `<title>-pmid-N`, else `<title>-doi-<slugified DOI>`, else `<title>-hs-<id>`
 * (shared/study-slug.ts). The suffix resolves the page; the title is cosmetic.
 *
 *   --plan (default)
 *       Reads every live study, computes its stable slug and writes
 *       reports/consolidation/stable-study-urls-<date>.csv (the 301 map Josh
 *       approves) and .md (counts, collisions, what else references the old
 *       URLs). Read-only — nothing changes.
 *
 *   --apply --csv reports/consolidation/stable-study-urls-<date>.csv
 *       Refuses unless the CSV starts with the line "approved-by: josh"
 *       (PLAN.md §2; same marker as the Phase 2 executor). Then, 200 rows per
 *       transaction: UPDATE studies.slug; INSERT 301 rows /study/<old> and
 *       /studies/<old> → /study/<new>; re-point active redirects that targeted
 *       the old URL (no chains); deactivate any row that would shadow the new
 *       URL. Writes reports/backups/stable-study-urls-<ts>.json BEFORE the
 *       first write and reports/consolidation/stable-study-urls-applied-<ts>.csv
 *       after. Asks the Next front door to drop its cached page data.
 *
 *   --rollback --backup reports/backups/stable-study-urls-<ts>.json
 *       Restores the old slugs and deactivates the 301 rows that run created.
 *
 *   --rewrite-sources --csv <approved plan>
 *       No database. Rewrites hardcoded /study/<old> links in source files
 *       (shared/condition-hub-intros.ts sources + markdown) to /study/<new>,
 *       so internal links are canonical rather than 301s. Ship with --apply.
 *
 * Run (dry):  railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/consolidation/stable-study-urls.ts --plan'
 * Run (real): … --apply --csv reports/consolidation/stable-study-urls-2026-11-03.csv
 *
 * Never regenerates a slug from a title (CLAUDE.md): the title portion is
 * copied from the current slug verbatim.
 */
import fs from "fs";
import path from "path";
import { pool } from "../../server/db";
import { stableStudySlug } from "../../shared/study-slug";

type Kind = "pmid" | "doi" | "id";
interface PlanRow {
  id: number;
  kind: Kind;
  old_slug: string;
  new_slug: string;
  pmid: string;
  doi: string;
  title: string;
}

const args = process.argv.slice(2);
const MODE = args.includes("--apply")
  ? "apply"
  : args.includes("--rollback")
    ? "rollback"
    : args.includes("--rewrite-sources")
      ? "rewrite-sources"
      : "plan";
const argValue = (flag: string): string | undefined => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const BATCH = 200;
const TODAY = new Date().toISOString().slice(0, 10);
const STAMP = Date.now();
const REPORT_DIR = "reports/consolidation";
const BACKUP_DIR = "reports/backups";
const RUN_NOTE = `stable-study-urls ${TODAY}`;

// ── CSV ──────────────────────────────────────────────────────────
const COLUMNS: (keyof PlanRow)[] = ["id", "kind", "old_slug", "new_slug", "pmid", "doi", "title"];

function csvField(v: unknown): string {
  const s = String(v ?? "").replace(/\r?\n/g, " ");
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function writePlanCsv(file: string, rows: PlanRow[]): void {
  const lines = [
    `# ${RUN_NOTE} — PLAN.md 3.3 stable study URLs. To authorize --apply, add a first line: approved-by: josh`,
    COLUMNS.join(","),
    ...rows.map((r) => COLUMNS.map((c) => csvField(r[c])).join(",")),
  ];
  fs.writeFileSync(file, lines.join("\n") + "\n");
}

function readPlanCsv(file: string): { rows: PlanRow[]; approved: boolean } {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  // The marker must precede the header (top of the file), like the Phase 2 executor.
  const headerAt = lines.findIndex((l) => l === COLUMNS.join(","));
  if (headerAt < 0) throw new Error(`${file}: header row not found`);
  const approved = lines.slice(0, headerAt).some((l) => /^approved-by:\s*josh\s*$/i.test(l));
  const rows: PlanRow[] = [];
  for (const line of lines.slice(headerAt + 1)) {
    if (line.startsWith("#")) continue;
    const cols = parseCsvLine(line);
    const get = (c: keyof PlanRow) => cols[COLUMNS.indexOf(c)] ?? "";
    rows.push({
      id: Number(get("id")),
      kind: get("kind") as Kind,
      old_slug: get("old_slug"),
      new_slug: get("new_slug"),
      pmid: get("pmid"),
      doi: get("doi"),
      title: get("title"),
    });
  }
  return { rows, approved };
}

// ── shared queries ───────────────────────────────────────────────
const studyPaths = (slug: string) => [`/study/${slug.toLowerCase()}`, `/studies/${slug.toLowerCase()}`];

async function slugsTakenByOthers(rows: PlanRow[]): Promise<{ id: number; slug: string; wantedBy: number }[]> {
  const out: { id: number; slug: string; wantedBy: number }[] = [];
  const bySlug = new Map(rows.map((r) => [r.new_slug, r.id]));
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((r) => r.new_slug);
    const r = await pool.query<{ id: number; slug: string }>(`SELECT id, slug FROM studies WHERE slug = ANY($1::text[])`, [chunk]);
    for (const row of r.rows) {
      const wantedBy = bySlug.get(row.slug)!;
      if (wantedBy !== row.id) out.push({ id: row.id, slug: row.slug, wantedBy });
    }
  }
  return out;
}

function duplicateNewSlugs(rows: PlanRow[]): Map<string, number[]> {
  const seen = new Map<string, number[]>();
  for (const r of rows) seen.set(r.new_slug, [...(seen.get(r.new_slug) ?? []), r.id]);
  return new Map([...seen].filter(([, ids]) => ids.length > 1));
}

// ── --plan ───────────────────────────────────────────────────────
interface StudyRow {
  id: number;
  slug: string;
  pmid: string | null;
  doi: string | null;
  title: string | null;
  plain_language_title: string | null;
}

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist" || entry.name.startsWith(".")) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) listSourceFiles(p, out);
    else if (/\.(ts|tsx|md|json)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

async function plan(): Promise<void> {
  const live = await pool.query<StudyRow>(
    `SELECT id, slug, pmid, doi, title, plain_language_title
       FROM studies WHERE is_excluded = false AND slug IS NOT NULL ORDER BY id`,
  );
  const rows: PlanRow[] = [];
  let unchanged = 0;
  for (const s of live.rows) {
    const stable = stableStudySlug(s);
    if (stable.slug === s.slug) {
      unchanged++;
      continue;
    }
    rows.push({
      id: s.id,
      kind: stable.kind,
      old_slug: s.slug,
      new_slug: stable.slug,
      pmid: s.pmid ?? "",
      doi: s.doi ?? "",
      title: (s.plain_language_title || s.title || "").slice(0, 120),
    });
  }

  const byKind = { pmid: 0, doi: 0, id: 0 } as Record<Kind, number>;
  for (const r of rows) byKind[r.kind]++;
  const dups = duplicateNewSlugs(rows);
  const taken = await slugsTakenByOthers(rows);
  const upper = rows.filter((r) => r.old_slug !== r.old_slug.toLowerCase()).length;
  const longest = rows.reduce((m, r) => Math.max(m, r.new_slug.length), 0);
  const longSlugs = rows.filter((r) => r.new_slug.length > 300);
  // A doi value that isn't a DOI (e.g. "99233") can't make a URL — those rows use the row id.
  const malformedDoi = rows.filter((r) => r.kind === "id" && r.doi.trim());
  const sharedPmids = await pool.query<{ pmid: string; n: number }>(
    `SELECT pmid, count(*)::int n FROM studies WHERE is_excluded = false AND coalesce(pmid,'') <> '' GROUP BY pmid HAVING count(*) > 1`,
  );
  const sharedDois = await pool.query<{ doi: string; n: number }>(
    `SELECT lower(doi) doi, count(*)::int n FROM studies WHERE is_excluded = false AND coalesce(doi,'') <> '' GROUP BY lower(doi) HAVING count(*) > 1`,
  );

  // Existing redirect rows touching the old URLs.
  const oldPaths = rows.flatMap((r) => studyPaths(r.old_slug));
  const oldPathSet = new Set(oldPaths);
  const pointingAtOld = await pool.query<{ from_path: string; to_path: string; status_code: number }>(
    `SELECT from_path, to_path, status_code FROM redirects WHERE is_active AND to_path = ANY($1::text[])`,
    [oldPaths],
  );
  const shadowingLive = await pool.query<{ from_path: string; to_path: string; status_code: number }>(
    `SELECT from_path, to_path, status_code FROM redirects WHERE is_active AND from_path = ANY($1::text[])`,
    [oldPaths],
  );

  // Blog bodies that link to an old study URL (covered by the 301s; listed so
  // a later content pass can point them at the canonical URL).
  const oldSlugSet = new Set(rows.map((r) => r.old_slug.toLowerCase()));
  const blogs = await pool.query<{ id: number; slug: string; content: string }>(
    `SELECT id, slug, content FROM blog_articles WHERE is_published AND NOT is_archived AND content LIKE '%/study/%'`,
  );
  let blogPosts = 0;
  let blogLinks = 0;
  for (const b of blogs.rows) {
    const hits = [...b.content.matchAll(/\/study\/([a-z0-9-]+)/gi)].filter((m) => oldSlugSet.has(m[1].toLowerCase()));
    if (hits.length) {
      blogPosts++;
      blogLinks += hits.length;
    }
  }

  // Source files that hardcode an old study URL (hub intros' sources and
  // markdown): these need a code change in the same release as --apply, or
  // they become working-but-non-canonical 301 links.
  const sourceHits: { file: string; links: number }[] = [];
  for (const file of listSourceFiles("shared").concat(listSourceFiles("client/src"), listSourceFiles("web"))) {
    const text = fs.readFileSync(file, "utf8");
    if (!text.includes("/study/")) continue;
    const n = [...text.matchAll(/\/study\/([a-z0-9-]+)/gi)].filter((m) => oldSlugSet.has(m[1].toLowerCase())).length;
    if (n) sourceHits.push({ file, links: n });
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const csvFile = `${REPORT_DIR}/stable-study-urls-${TODAY}.csv`;
  const mdFile = `${REPORT_DIR}/stable-study-urls-${TODAY}.md`;
  writePlanCsv(csvFile, rows);

  const sample = (kind: Kind) =>
    rows
      .filter((r) => r.kind === kind)
      .slice(0, 4)
      .map((r) => `| ${r.id} | \`/study/${r.old_slug}\` | \`/study/${r.new_slug}\` |`)
      .join("\n");

  const md = `# Stable study URLs — plan ${TODAY} (PLAN.md 3.3)

**Status: REPORT ONLY. Nothing has changed.** Approve by adding the line \`approved-by: josh\` to the top of
\`${csvFile}\`, then run
\`railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/consolidation/stable-study-urls.ts --apply --csv ${csvFile}'\`.

## What changes

Every live study slug today ends in a 13-digit import-batch timestamp (${live.rows.length} live studies, 92 distinct
timestamps — a batch marker, not an ID). The stable slug keeps the title words exactly as they are and ends in the
study's permanent identifier. The suffix is what resolves the page from now on (\`studyService.getStudyBySlug\`), and the
Next study page 301s any other spelling to the canonical slug, so a changed title can never break a link.

| Kind | Form | Studies |
|---|---|---|
| PMID | \`<title>-pmid-<PMID>\` | ${byKind.pmid} |
| DOI (no PMID) | \`<title>-doi-<DOI, lowercase, punctuation → dashes>\` | ${byKind.doi} |
| Row id (neither) | \`<title>-hs-<id>\` | ${byKind.id} |
| **Total URLs that move** | | **${rows.length}** |
| Already stable (unchanged) | | ${unchanged} |

Longest new slug: ${longest} characters (${longSlugs.length} new slugs exceed 300 — their title portions are already that long today and are copied verbatim, never regenerated). Old slugs with uppercase letters: ${upper}.

${malformedDoi.length ? `Rows whose \`doi\` column holds something that isn't a DOI, so they take the row-id form: ${malformedDoi.map((r) => `${r.id} (doi "${r.doi}")`).join(", ")}. Worth a data fix, not a blocker.` : "Every DOI-form row has a well-formed DOI."}

### Samples

| id | old | new |
|---|---|---|
${sample("pmid")}
${sample("doi")}
${sample("id")}

## Safety checks

- Duplicate new slugs within the plan: **${dups.size}**${dups.size ? " — ‼ apply will refuse until resolved:\n" + [...dups].map(([slug, ids]) => `  - \`${slug}\` ← ids ${ids.join(", ")}`).join("\n") : ""}
- New slugs already used by a different study row (incl. excluded): **${taken.length}**${taken.length ? "\n" + taken.map((t) => `  - \`${t.slug}\` is row ${t.id}; wanted by ${t.wantedBy}`).join("\n") : ""}
- PMIDs shared by two or more live studies: **${sharedPmids.rowCount}**${sharedPmids.rowCount ? " — " + sharedPmids.rows.map((r) => `${r.pmid} (${r.n})`).join(", ") : ""}; DOIs shared: **${sharedDois.rowCount}**${sharedDois.rowCount ? " — " + sharedDois.rows.map((r) => `${r.doi} (${r.n})`).join(", ") : ""}. (A shared identifier would surface above as a duplicate new slug.)

## What --apply does, per study (200 per transaction)

1. \`UPDATE studies SET slug = <new> WHERE id = ? AND slug = <old>\` (a row whose slug changed since this plan is skipped and logged).
2. Insert 301 rows \`/study/<old>\` and \`/studies/<old>\` → \`/study/<new>\` (note \`${RUN_NOTE}\`; an existing row for that path is overwritten).
3. Re-point active redirects whose target was \`/study/<old>\` or \`/studies/<old>\` to \`/study/<new>\` — **${pointingAtOld.rowCount} rows today**, so no redirect chains are created.
4. Deactivate any redirect row whose \`from_path\` equals the new URL (none expected).

Before the first write a backup \`${BACKUP_DIR}/stable-study-urls-<ts>.json\` ({id, old_slug, new_slug}) is saved;
\`--rollback --backup <file>\` restores the old slugs and deactivates this run's 301 rows.

## Other references to the old URLs

- **Active redirect rows that already point FROM a live study URL (shadowing the live page): ${shadowingLive.rowCount}.**${shadowingLive.rowCount ? " They are overwritten by the new 301 (which is the correct behaviour — the live page moved):\n" + shadowingLive.rows.slice(0, 20).map((r) => `  - \`${r.from_path}\` → \`${r.to_path}\` (${r.status_code})`).join("\n") : ""}
- Published blog posts linking to an old study URL: **${blogPosts} posts, ${blogLinks} links** — keep working via the 301; a later content pass can rewrite them to the canonical URL (CTR/consolidation scripts already have the pattern).
- Source files that hardcode an old study URL (hub-intro sources + markdown): **${sourceHits.reduce((n, h) => n + h.links, 0)} links in ${sourceHits.length} files** — run \`npx tsx scripts/consolidation/stable-study-urls.ts --rewrite-sources --csv ${csvFile}\` (no database) and ship that code change in the same release as the apply, so internal links are canonical rather than 301s:
${sourceHits.map((h) => `  - \`${h.file}\` (${h.links})`).join("\n") || "  - none"}
- Sitemaps, hub study lists, related-study links and the homepage read \`studies.slug\` from the database — they update on their own (sitemap cache ≤ 1 h; Express redirect cache ≤ 5 min; Next page data is revalidated by the script).

## After apply

- Resubmit \`sitemap-studies.xml\` in Google Search Console; expect a temporary dip while 2,276 URLs are re-crawled (studies currently average position ~30 with ~0 non-branded clicks, so the downside is small).
- Watch GSC Coverage for "Page with redirect" rising and the new URLs becoming indexed over 2–4 weeks.
`;
  fs.writeFileSync(mdFile, md);

  console.log(`=== stable study URLs — plan ===`);
  console.log(`live studies: ${live.rows.length}; moving: ${rows.length} (pmid ${byKind.pmid}, doi ${byKind.doi}, id ${byKind.id}); unchanged: ${unchanged}`);
  console.log(`duplicate new slugs: ${dups.size}; taken by other rows: ${taken.length}`);
  console.log(`redirect rows pointing at old URLs (to re-point): ${pointingAtOld.rowCount}; rows shadowing live URLs: ${shadowingLive.rowCount}`);
  console.log(`blog posts linking old URLs: ${blogPosts} (${blogLinks} links); source files: ${sourceHits.length}`);
  console.log(`wrote ${csvFile} and ${mdFile}`);
  console.log(`\nDRY RUN — nothing changed. Add "approved-by: josh" as the first line of the CSV, then --apply --csv ${csvFile}.`);
}

// ── --apply ──────────────────────────────────────────────────────
async function apply(): Promise<void> {
  const csvFile = argValue("--csv");
  if (!csvFile) throw new Error("--apply needs --csv <plan file>");
  const { rows, approved } = readPlanCsv(csvFile);
  if (!approved) {
    console.error(`\nREFUSING --apply: ${csvFile} has no leading "approved-by: josh" line (PLAN.md §2).`);
    process.exit(1);
  }
  const dups = duplicateNewSlugs(rows);
  if (dups.size) {
    console.error(`REFUSING --apply: ${dups.size} duplicate new slugs in the plan.`);
    process.exit(1);
  }
  const taken = await slugsTakenByOthers(rows);
  if (taken.length) {
    console.error(`REFUSING --apply: ${taken.length} new slugs already belong to other study rows.`);
    for (const t of taken) console.error(`  ${t.slug} is row ${t.id}, wanted by ${t.wantedBy}`);
    process.exit(1);
  }

  // Backup BEFORE the first write.
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const backupFile = `${BACKUP_DIR}/stable-study-urls-${STAMP}.json`;
  fs.writeFileSync(
    backupFile,
    JSON.stringify({ ranAt: new Date().toISOString(), note: RUN_NOTE, rows: rows.map(({ id, old_slug, new_slug }) => ({ id, old_slug, new_slug })) }, null, 2),
  );
  const log = fs.createWriteStream(`${REPORT_DIR}/stable-study-urls-applied-${STAMP}.csv`);
  log.write(`# ${RUN_NOTE} applied ${new Date().toISOString()}\nid,result,old_slug,new_slug\n`);

  let applied = 0;
  let skipped = 0;
  let repointed = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const r of batch) {
        const upd = await client.query(`UPDATE studies SET slug = $1 WHERE id = $2 AND slug = $3`, [r.new_slug, r.id, r.old_slug]);
        if (upd.rowCount !== 1) {
          skipped++;
          log.write(`${r.id},skipped-slug-changed,${csvField(r.old_slug)},${csvField(r.new_slug)}\n`);
          continue;
        }
        const newPath = `/study/${r.new_slug.toLowerCase()}`;
        const olds = studyPaths(r.old_slug);
        for (const from of olds) {
          await client.query(
            `INSERT INTO redirects (from_path, to_path, status_code, note, is_active)
             VALUES ($1, $2, 301, $3, true)
             ON CONFLICT (from_path) DO UPDATE
               SET to_path = EXCLUDED.to_path, status_code = 301, note = EXCLUDED.note, is_active = true`,
            [from, newPath, RUN_NOTE],
          );
        }
        // No chains: anything that pointed at the old URL now points at the new one.
        const rp = await client.query(
          `UPDATE redirects SET to_path = $1 WHERE is_active AND to_path = ANY($2::text[]) AND from_path <> $1`,
          [newPath, olds],
        );
        repointed += rp.rowCount ?? 0;
        // Nothing may shadow the new URL.
        await client.query(`UPDATE redirects SET is_active = false WHERE from_path = $1`, [newPath]);
        applied++;
        log.write(`${r.id},moved,${csvField(r.old_slug)},${csvField(r.new_slug)}\n`);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    console.log(`  ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  log.end();

  console.log(`\nAPPLY complete: ${applied} slugs moved, ${skipped} skipped (slug changed since plan), ${repointed} existing redirects re-pointed.`);
  console.log(`Backup: ${backupFile}`);
  await revalidateWeb();
  console.log(
    "Next: Express redirect cache refreshes within 5 min; sitemap cache within 1 h (or redeploy);\n" +
      "resubmit sitemap-studies.xml in GSC; ship the source-file link updates listed in the plan .md.",
  );
}

// ── --rewrite-sources ────────────────────────────────────────────
/** Point hardcoded /study/<old> links in source files at the new slugs. No database. */
async function rewriteSources(): Promise<void> {
  const csvFile = argValue("--csv");
  if (!csvFile) throw new Error("--rewrite-sources needs --csv <plan file>");
  const { rows } = readPlanCsv(csvFile);
  const map = new Map(rows.map((r) => [r.old_slug.toLowerCase(), r.new_slug]));
  let files = 0;
  let links = 0;
  for (const file of listSourceFiles("shared").concat(listSourceFiles("client/src"), listSourceFiles("web"))) {
    const text = fs.readFileSync(file, "utf8");
    if (!text.includes("/study/")) continue;
    let n = 0;
    const next = text.replace(/\/study\/([a-z0-9-]+)/gi, (whole, slug: string) => {
      const to = map.get(slug.toLowerCase());
      if (!to) return whole;
      n++;
      return `/study/${to}`;
    });
    if (n) {
      fs.writeFileSync(file, next);
      files++;
      links += n;
      console.log(`  ${file}: ${n} links`);
    }
  }
  console.log(`rewrote ${links} links in ${files} files — review the diff and ship it with --apply.`);
}

// ── --rollback ───────────────────────────────────────────────────
async function rollback(): Promise<void> {
  const file = argValue("--backup");
  if (!file) throw new Error("--rollback needs --backup <json>");
  const backup = JSON.parse(fs.readFileSync(file, "utf8")) as { note: string; rows: { id: number; old_slug: string; new_slug: string }[] };
  let restored = 0;
  for (let i = 0; i < backup.rows.length; i += BATCH) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const r of backup.rows.slice(i, i + BATCH)) {
        const upd = await client.query(`UPDATE studies SET slug = $1 WHERE id = $2 AND slug = $3`, [r.old_slug, r.id, r.new_slug]);
        restored += upd.rowCount ?? 0;
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  const off = await pool.query(`UPDATE redirects SET is_active = false WHERE note = $1`, [backup.note]);
  console.log(`ROLLBACK: ${restored} slugs restored, ${off.rowCount} redirect rows deactivated (note "${backup.note}").`);
  await revalidateWeb();
}

/** Drop the Next front door's cached page data (all paths). */
async function revalidateWeb(): Promise<void> {
  const origin = process.env.WEB_REVALIDATE_ORIGIN || "https://web-production-6fb716d.up.railway.app";
  const key = process.env.PAGE_DATA_KEY;
  if (!key) {
    console.log("PAGE_DATA_KEY not set — POST /web_revalidate manually so Next drops its cached page data.");
    return;
  }
  try {
    const res = await fetch(`${origin}/web_revalidate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-page-data-key": key },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(10_000),
    });
    console.log(`web revalidate: HTTP ${res.status}`);
  } catch (err) {
    console.log(`web revalidate failed (${err instanceof Error ? err.message : String(err)}) — POST /web_revalidate manually.`);
  }
}

(MODE === "apply" ? apply() : MODE === "rollback" ? rollback() : MODE === "rewrite-sources" ? rewriteSources() : plan())
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(`stable-study-urls ${MODE} failed:`, e);
    await pool.end().catch(() => {});
    process.exit(1);
  });
