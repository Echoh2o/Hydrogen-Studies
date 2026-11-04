/**
 * PLAN.md 4.7 follow-up — researcher identities (ORCID, institution) from
 * OpenAlex authorships, for the works we have already matched to OpenAlex
 * (studies.openalex_id, set by backfill-citation-counts.ts).
 *
 * DRY-RUN BY DEFAULT: fetches authorships in batches of 50 works, keys each
 * raw author name with shared/profiles.ts authorKey, decides one identity per
 * key (shared/author-identity.ts: one OpenAlex author id with ≥60% of the
 * key's occurrences and ≥2 occurrences) and writes
 * reports/research/author-identities-<date>.csv. Nothing is written to the DB.
 *
 *   railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/research/backfill-author-identities.ts'
 *   railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/research/backfill-author-identities.ts --apply --csv reports/research/author-identities-<date>.csv'
 *
 * --apply upserts researcher_identities (migration 030) from the CSV after a
 * JSON backup of the current table. Re-run monthly after the citation refresh.
 */
import fs from "fs";
import pg from "pg";
import { authorKey } from "../../shared/profiles";
import { decideIdentities, normalizeOrcid, type AuthorshipOccurrence, type ResolvedIdentity } from "../../shared/author-identity";
import { OPENALEX_API, OPENALEX_MAILTO, OPENALEX_BATCH, openAlexId } from "../../server/services/openalex";

const args = process.argv.slice(2);
const opt = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const APPLY = args.includes("--apply");
const CSV_IN = opt("--csv");
const LIMIT = opt("--limit") ? Number(opt("--limit")) : undefined;
const TODAY = new Date().toISOString().slice(0, 10);
const STAMP = Date.now();

const COLS = ["author_key", "openalex_author_id", "display_name", "orcid", "institution", "institution_country", "institution_ror", "occurrences", "share"] as const;
const csvEscape = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function parseCsv(text: string): Record<(typeof COLS)[number], string>[] {
  const out: Record<string, string>[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("author_key,") || line.startsWith("#")) continue;
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
    out.push(Object.fromEntries(COLS.map((c, i) => [c, cells[i] ?? ""])));
  }
  return out as Record<(typeof COLS)[number], string>[];
}

interface RawAuthorship {
  author?: { id?: string | null; display_name?: string | null; orcid?: string | null };
  institutions?: { display_name?: string | null; country_code?: string | null; ror?: string | null }[];
  raw_author_name?: string | null;
}

async function fetchAuthorships(workIds: string[]): Promise<Map<string, RawAuthorship[]>> {
  const out = new Map<string, RawAuthorship[]>();
  for (let i = 0; i < workIds.length; i += OPENALEX_BATCH) {
    const batch = workIds.slice(i, i + OPENALEX_BATCH);
    const url = `${OPENALEX_API}/works?filter=openalex:${batch.join("|")}&select=id,authorships&per-page=${OPENALEX_BATCH}&mailto=${encodeURIComponent(OPENALEX_MAILTO)}`;
    let attempt = 0;
    for (;;) {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (res.ok) {
        const json = (await res.json()) as { results?: { id: string; authorships?: RawAuthorship[] }[] };
        for (const w of json.results ?? []) {
          const id = openAlexId(w.id);
          if (id) out.set(id, w.authorships ?? []);
        }
        break;
      }
      if (++attempt > 3) throw new Error(`OpenAlex ${res.status} for batch starting ${batch[0]}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
    await new Promise((r) => setTimeout(r, 150));
    if ((i / OPENALEX_BATCH) % 10 === 0) console.log(`  fetched ${Math.min(i + OPENALEX_BATCH, workIds.length)}/${workIds.length} works`);
  }
  return out;
}

async function plan(db: pg.Pool): Promise<void> {
  const { rows } = await db.query<{ openalex_id: string }>(
    `SELECT openalex_id FROM studies WHERE is_excluded = false AND openalex_id ~ '^W[0-9]+$' ORDER BY id ${LIMIT ? `LIMIT ${Number(LIMIT)}` : ""}`,
  );
  const workIds = rows.map((r) => r.openalex_id);
  console.log(`${workIds.length} matched works`);
  const authorships = await fetchAuthorships(workIds);
  const occurrences: AuthorshipOccurrence[] = [];
  let noName = 0;
  for (const list of authorships.values()) {
    for (const a of list) {
      const raw = (a.raw_author_name || a.author?.display_name || "").trim();
      const key = authorKey(raw);
      if (!key) { noName++; continue; }
      const inst = a.institutions?.[0];
      occurrences.push({
        authorKey: key,
        rawName: raw,
        openalexAuthorId: openAlexAuthor(a.author?.id),
        displayName: a.author?.display_name ?? null,
        orcid: normalizeOrcid(a.author?.orcid),
        institution: inst?.display_name ?? null,
        institutionCountry: inst?.country_code ?? null,
        institutionRor: inst?.ror ?? null,
      });
    }
  }
  const identities = decideIdentities(occurrences);
  const keys = new Set(occurrences.map((o) => o.authorKey));
  const withOrcid = identities.filter((i) => i.orcid).length;
  const withInst = identities.filter((i) => i.institution).length;
  fs.mkdirSync("reports/research", { recursive: true });
  const file = `reports/research/author-identities-${TODAY}.csv`;
  fs.writeFileSync(
    file,
    [COLS.join(","), ...identities.map((i) => [i.authorKey, i.openalexAuthorId, i.displayName, i.orcid ?? "", i.institution ?? "", i.institutionCountry ?? "", i.institutionRor ?? "", i.occurrences, i.share].map(csvEscape).join(","))].join("\n") + "\n",
  );
  console.log(`authorships: ${occurrences.length} on ${authorships.size} works; ${keys.size} distinct name keys (${noName} nameless skipped)`);
  console.log(`identities resolved: ${identities.length} (${withOrcid} with ORCID, ${withInst} with an institution); ambiguous/too few: ${keys.size - identities.length}`);
  console.log(`wrote ${file}\nDRY RUN — nothing changed. Apply with: --apply --csv ${file}`);
}

function openAlexAuthor(id: string | null | undefined): string | null {
  const m = String(id ?? "").match(/A\d+$/);
  return m ? m[0] : null;
}

async function apply(db: pg.Pool): Promise<void> {
  if (!CSV_IN) throw new Error("--apply needs --csv <plan file>");
  const rows = parseCsv(fs.readFileSync(CSV_IN, "utf8"));
  const { rows: before } = await db.query(`SELECT * FROM researcher_identities`);
  fs.mkdirSync("reports/backups", { recursive: true });
  const backup = `reports/backups/researcher-identities-${STAMP}.json`;
  fs.writeFileSync(backup, JSON.stringify({ ranAt: new Date().toISOString(), source: CSV_IN, rows: before }, null, 2));
  console.log(`backup: ${backup} (${before.length} rows)`);
  const client = await db.connect();
  let n = 0;
  try {
    await client.query("BEGIN");
    for (const r of rows) {
      await client.query(
        `INSERT INTO researcher_identities (author_key, openalex_author_id, display_name, orcid, institution, institution_country, institution_ror, occurrences, share, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
         ON CONFLICT (author_key) DO UPDATE SET openalex_author_id = EXCLUDED.openalex_author_id, display_name = EXCLUDED.display_name, orcid = EXCLUDED.orcid,
           institution = EXCLUDED.institution, institution_country = EXCLUDED.institution_country, institution_ror = EXCLUDED.institution_ror,
           occurrences = EXCLUDED.occurrences, share = EXCLUDED.share, updated_at = NOW()`,
        [r.author_key, r.openalex_author_id, r.display_name, r.orcid || null, r.institution || null, r.institution_country || null, r.institution_ror || null, Number(r.occurrences), Number(r.share)],
      );
      n++;
    }
    // Keys no longer resolved (e.g. a name became ambiguous) are removed so the page returns to name-only.
    const keep = rows.map((r) => r.author_key);
    const del = await client.query(`DELETE FROM researcher_identities WHERE NOT (author_key = ANY($1::text[]))`, [keep]);
    await client.query("COMMIT");
    console.log(`upserted ${n}, removed ${del.rowCount ?? 0}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  const key = process.env.PAGE_DATA_KEY;
  const origin = process.env.WEB_PUBLIC_ORIGIN || "https://web-production-6fb716d.up.railway.app";
  if (key) {
    const res = await fetch(`${origin}/web_revalidate`, { method: "POST", headers: { "content-type": "application/json", "x-page-data-key": key }, body: "{}" }).catch((e) => ({ status: `failed: ${e}` }));
    console.log(`web_revalidate → ${res.status}`);
  }
}

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2, ssl: process.env.DATABASE_URL?.includes("railway") ? { rejectUnauthorized: false } : undefined });
(APPLY ? apply(db) : plan(db))
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => db.end());
