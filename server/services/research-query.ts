/**
 * Research query layer for the MCP server (and anything else that needs to
 * filter, compare or aggregate the study corpus).
 *
 * The live corpus is small (~2.3k studies), so a lightweight projection of it
 * is cached in memory and all filtering / aggregation happens here in TS,
 * through the same shared/research-vocab.ts normalizers the field backfill
 * uses — one definition of "human trial", "inhalation", etc. Postgres is used
 * only for full-text ranking (search_vector) and the condition-hub matcher
 * the hub pages use (seo-body-renderer conditionHubWhere).
 *
 * Never reads the study_outcomes / study_delivery_methods / study_benefits
 * join tables: they were filled round-robin by server/seed.ts, not extracted.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import { abstractExcerpt } from "@shared/seo-markup";
import { exploreHubPath } from "@shared/explore-hubs";
import { getConditionHubIntro } from "@shared/condition-hub-intros";
import {
  classifySubject,
  isStudyDesign,
  normalizeDeliveryMethod,
  normalizeOutcome,
  type DeliveryMethod,
  type Outcome,
  type StudyDesign,
  type Subject,
} from "@shared/research-vocab";
import { conditionHubWhere, getConditionRows, type ConditionRow } from "../middleware/seo-body-renderer";
import { semanticScores } from "./study-embeddings";

export const SITE_URL = process.env.SITE_URL || "https://hydrogenstudies.com";

export interface CorpusStudy {
  id: number;
  slug: string;
  title: string;
  year: number | null;
  journal: string | null;
  country: string | null;
  design: StudyDesign | null;
  species: string | null;
  subject: Subject;
  deliveryMethod: DeliveryMethod | null;
  outcome: Outcome | null;
  sampleSize: number | null;
  durationDays: number | null;
  conditions: string[];
  keyFinding: string | null;
  doi: string | null;
  qualityScore: number | null;
  /** First author's surname ("Ohta") — distinguishes studies whose plain-language titles collide. */
  firstAuthor: string | null;
  /** Every listed author's surname, lowercased — for "Ohta 2007" / "Ohsawa et al." queries. */
  authorSurnames: string[];
}

export interface ResearchFilters {
  query?: string;
  condition?: string;
  subject?: Subject;
  design?: StudyDesign;
  deliveryMethod?: DeliveryMethod;
  outcome?: Outcome;
  yearFrom?: number;
  yearTo?: number;
  minSampleSize?: number;
}

export type SortOrder = "relevance" | "evidence" | "newest" | "quality";

const CACHE_TTL_MS = 5 * 60 * 1000;

// ── corpus ───────────────────────────────────────────────────

/** Map a raw studies row onto the normalized corpus shape. */
/** Surname from one author entry: "Shigeo Ohta" or "Ohta S" / "Ohta SH" (surname first, initials last). */
function surnameOf(entry: string): string | null {
  const name = entry.replace(/\s+/g, " ").trim();
  if (!name) return null;
  const parts = name.split(" ");
  const last = parts[parts.length - 1];
  return parts.length > 1 && /^[A-Z]{1,3}\.?$/.test(last) ? parts[0] : last;
}

const splitAuthors = (authors: string) => authors.split(/[,;]| and /);

/** Surname of the first author from "Shigeo Ohta, Ikuroh Ohsawa, …" (or "Ohta S, …"). */
export function firstAuthorSurname(authors: unknown): string | null {
  if (typeof authors !== "string") return null;
  return surnameOf(splitAuthors(authors)[0] ?? "");
}

/** Every author's surname, lowercased, in listed order. */
export function authorSurnames(authors: unknown): string[] {
  if (typeof authors !== "string") return [];
  return splitAuthors(authors)
    .map((a) => surnameOf(a)?.toLowerCase())
    .filter((a): a is string => !!a);
}

const normText = (t: string) => ` ${t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;

/**
 * Studies an author-style query points at — "Ohta 2007 Nature Medicine",
 * "Ohsawa et al.", "trials by Ohta" — as id → weight (0.8–1). A surname only
 * counts with an author signal: a year, "et al.", or a capitalized word that
 * isn't the query's first word, so "Can hydrogen help…" never matches an
 * author named Can. A year limits matches to that year; "et al." to first
 * authors. First authors and papers in a journal the query names weigh more.
 */
export function authorMatches(
  query: string,
  rows: ReadonlyArray<Pick<CorpusStudy, "id" | "year" | "journal" | "authorSurnames">>,
): Map<number, number> {
  const years = [...query.matchAll(/\b(?:19|20)\d{2}\b/g)].map((m) => Number(m[0]));
  const etAl = /\bet\.?\s+al\b/i.test(query);
  const words = [...query.matchAll(/[A-Za-z][A-Za-z'-]{2,}/g)];
  const names = new Set(
    words
      .filter((m, i) => years.length > 0 || etAl || (i > 0 && /^[A-Z]/.test(m[0])))
      .map((m) => m[0].toLowerCase())
      .filter((w) => w !== "al"),
  );
  const out = new Map<number, number>();
  if (!names.size) return out;
  const q = normText(query);
  for (const r of rows) {
    const first = names.has(r.authorSurnames[0] ?? "");
    if (etAl ? !first : !r.authorSurnames.some((a) => names.has(a))) continue;
    if (years.length && (r.year === null || !years.includes(r.year))) continue;
    const journal = r.journal ? normText(r.journal) : "";
    const journalNamed = journal.trim().length >= 5 && q.includes(journal);
    out.set(r.id, 0.8 + (first ? 0.1 : 0) + (journalNamed ? 0.1 : 0));
  }
  return out;
}

export function toCorpusStudy(r: Record<string, any>): CorpusStudy {
  const design = isStudyDesign(r.study_design) ? r.study_design : null;
  const species = typeof r.study_type === "string" && r.study_type.trim() && !/^clinical$/i.test(r.study_type.trim())
    ? r.study_type.trim()
    : null;
  const posNum = (v: unknown) => (typeof v === "number" && v > 0 ? v : null);
  return {
    id: Number(r.id),
    slug: r.slug,
    title: r.title,
    year: r.publish_year ?? null,
    journal: r.journal ?? null,
    country: r.country?.trim() || null,
    design,
    species,
    subject: classifySubject({ studyDesign: design, studyType: r.study_type, isHumanTrial: r.is_human_trial }),
    deliveryMethod: normalizeDeliveryMethod(r.h2_delivery_method),
    outcome: normalizeOutcome(r.outcome),
    sampleSize: posNum(r.sample_size),
    durationDays: posNum(r.duration),
    conditions: Array.isArray(r.health_conditions) ? r.health_conditions.filter(Boolean) : [],
    keyFinding: r.key_finding?.trim() || null,
    doi: r.doi?.trim() || null,
    qualityScore: r.quality_score === null || r.quality_score === undefined ? null : Number(r.quality_score),
    firstAuthor: firstAuthorSurname(r.authors),
    authorSurnames: authorSurnames(r.authors),
  };
}

type Corpus = { rows: CorpusStudy[]; byId: Map<number, CorpusStudy> };
let corpusCache: ({ at: number } & Corpus) | null = null;
let corpusLoading: Promise<Corpus> | null = null;

/**
 * The cached corpus. Single-flight: concurrent callers on a cold or expired
 * cache share one load instead of each re-running the full query.
 */
export async function getCorpus(): Promise<Corpus> {
  if (corpusCache && Date.now() - corpusCache.at < CACHE_TTL_MS) return corpusCache;
  if (!corpusLoading) {
    corpusLoading = loadCorpus().finally(() => {
      corpusLoading = null;
    });
  }
  return corpusLoading;
}

async function loadCorpus(): Promise<Corpus> {
  const r = await db.execute(sql`
    SELECT s.id, s.slug, COALESCE(NULLIF(s.plain_language_title, ''), s.title) AS title, s.publish_year,
           s.journal, s.country, s.study_design, s.study_type, s.is_human_trial, s.h2_delivery_method,
           s.outcome, s.sample_size, s.duration, s.health_conditions, s.key_finding, s.doi,
           LEFT(s.authors, 1000) AS authors,
           (SELECT q.overall_score FROM study_quality_scores q WHERE q.study_id = s.id
             ORDER BY q.id DESC LIMIT 1) AS quality_score
      FROM studies s
     WHERE s.is_excluded = false AND s.slug IS NOT NULL
  `);
  const rows = ((r.rows ?? []) as any[]).map(toCorpusStudy);
  corpusCache = { at: rows.length ? Date.now() : 0, rows, byId: new Map(rows.map((s) => [s.id, s])) };
  return corpusCache;
}

// ── conditions ───────────────────────────────────────────────

const slugify = (v: string) => v.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Resolve free text ("blood pressure", "Blood Pressure", "blood-pressure") to a condition hub row. */
export function matchConditionRow(rows: ConditionRow[], input: string): ConditionRow | null {
  const want = slugify(input);
  if (!want) return null;
  return (
    rows.find((r) => r.slug === want) ??
    rows.find((r) => slugify(r.name) === want) ??
    rows.find((r) => r.slug.includes(want) || want.includes(r.slug)) ??
    null
  );
}

const conditionIdCache = new Map<string, { at: number; ids: Promise<Set<number>> }>();

/** Study ids on a condition hub; cached and single-flight like getCorpus. */
async function conditionStudyIds(row: ConditionRow): Promise<Set<number>> {
  const hit = conditionIdCache.get(row.slug);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.ids;
  const ids = db
    .execute(sql`SELECT id FROM studies WHERE ${conditionHubWhere(row)}`)
    .then((r) => new Set(((r.rows ?? []) as any[]).map((x) => Number(x.id))));
  conditionIdCache.set(row.slug, { at: Date.now(), ids });
  ids.catch(() => conditionIdCache.delete(row.slug)); // never cache a failure
  return ids;
}

export interface ConditionHub {
  slug: string;
  name: string;
  url: string;
  evidenceGrade: string | null;
}

function hubOf(row: ConditionRow): ConditionHub {
  return {
    slug: row.slug,
    name: row.name,
    url: `${SITE_URL}${exploreHubPath("condition", row.slug)}`,
    evidenceGrade: getConditionHubIntro(row.slug)?.evidenceGrade ?? null,
  };
}

export async function listConditions(): Promise<Array<ConditionHub & { studies: number }>> {
  const rows = await getConditionRows();
  const counted = await Promise.all(rows.map(async (row) => ({ ...hubOf(row), studies: (await conditionStudyIds(row)).size })));
  return counted.filter((c) => c.studies > 0).sort((a, b) => b.studies - a.studies);
}

// ── text search ──────────────────────────────────────────────

// Words that match (nearly) the whole corpus or only carry question syntax.
// They would make every study a "match" and drown the terms that matter.
const GENERIC_TERMS = new Set([
  "hydrogen", "h2", "molecular", "rich", "enriched", "hrw", "does", "do", "did", "can", "could", "would", "is", "are",
  "was", "were", "what", "which", "how", "why", "when", "who", "the", "and", "or", "of", "in", "on", "for", "to",
  "with", "about", "any", "there", "help", "helps", "effect", "effects", "study", "studies", "research", "evidence",
  "show", "shows", "tell", "me", "us", "it", "its", "be", "by", "an", "as", "at", "from", "that", "this", "have", "has",
]);

/** Distinct content words of a query (generic corpus-wide words removed, unless nothing else is left). */
export function queryTerms(query: string): string[] {
  const words = [...new Set((query.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 1))];
  const content = words.filter((w) => !GENERIC_TERMS.has(w));
  return (content.length ? content : words).slice(0, 12);
}

/** IDF weight: rare terms ("pressure") count far more than common ones ("water", "improve"). */
export function idfWeights(dfs: number[], total: number): number[] {
  return dfs.map((df) => (df > 0 ? Math.log(1 + total / df) : 0));
}

/**
 * Relevance per matching study: the IDF-weighted share of the query's
 * distinct terms it matches (dominant), with ts_rank as the tie-breaker. A
 * study must cover at least half the query's total term weight. Without the
 * weighting, "does hydrogen water improve blood pressure in humans" matched
 * 254–362 studies and ranked any "hydrogen water improves …" paper as highly
 * as a blood-pressure trial.
 */
export async function textRanks(query: string): Promise<Map<number, number>> {
  const terms = queryTerms(query);
  if (!terms.length) return new Map();
  const tsq = (t: string) => sql`to_tsquery('english', ${t})`;
  const dfRow = (
    await db.execute(sql`
      SELECT COUNT(*) AS total,
             ${sql.join(terms.map((t, i) => sql`COUNT(*) FILTER (WHERE search_vector @@ ${tsq(t)}) AS ${sql.raw(`df${i}`)}`), sql`, `)}
        FROM studies WHERE is_excluded = false`)
  ).rows?.[0] as Record<string, unknown> | undefined;
  const total = Number(dfRow?.total ?? 0);
  const weights = idfWeights(terms.map((_, i) => Number(dfRow?.[`df${i}`] ?? 0)), total);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (!totalWeight) return new Map();

  const live = terms.filter((_, i) => weights[i] > 0);
  const anyTerm = live.join(" | ");
  const score = sql.join(
    terms.flatMap((t, i) => (weights[i] > 0 ? [sql`(search_vector @@ ${tsq(t)})::int * ${weights[i]}::float8`] : [])),
    sql` + `,
  );
  const r = await db.execute(sql`
    SELECT id, score, rank FROM (
      SELECT id, (${score}) AS score, ts_rank(search_vector, ${tsq(anyTerm)}) AS rank
        FROM studies
       WHERE is_excluded = false AND search_vector @@ ${tsq(anyTerm)}
    ) m
    WHERE score >= ${totalWeight / 2}::float8
  `);
  return new Map(
    ((r.rows ?? []) as any[]).map((x) => [Number(x.id), Number(x.score) / totalWeight + Math.min(Number(x.rank), 0.99) / 100]),
  );
}

/**
 * Hybrid relevance: keyword score (IDF-weighted term coverage, 0..1) blended
 * with meaning-based similarity (cosine, from study-embeddings). Semantic-only
 * matches are admitted when they sit near the best match AND above an absolute
 * floor (so nonsense queries don't return the "least-unrelated" studies).
 * Studies on a condition hub the query names, and stronger designs, get a small
 * boost. With no semantic scores this reduces to the keyword ranking.
 */
export const BLEND = {
  /** Semantic candidates: within WINDOW of the best cosine… */
  WINDOW: 0.08,
  /** …and at least this similar (bge-small cosines for unrelated text sit ~0.5–0.6). */
  MIN_COSINE: 0.66,
  MAX_SEMANTIC_ONLY: 120,
  W_SEMANTIC: 0.55,
  W_KEYWORD: 0.45,
  HUB_BOOST: 0.15,
  EVIDENCE_BOOST: 0.05,
  /** Human trials and meta-analyses ahead of animal/cell work of similar relevance. */
  HUMAN_BOOST: 0.35,
  /** Papers by an author the query names ("Ohta 2007") rank first, ordered by match weight. */
  AUTHOR_BOOST: 10,
  /** Within author matches, ordinary relevance only breaks ties. */
  AUTHOR_TIEBREAK: 0.01,
};

/** Put author matches (id → weight from authorMatches) above everything else, in weight order. */
export function applyAuthorMatches(ranks: Map<number, number>, matches: Map<number, number>): void {
  for (const [id, w] of matches) ranks.set(id, BLEND.AUTHOR_BOOST * w + BLEND.AUTHOR_TIEBREAK * (ranks.get(id) ?? 0));
}

/** Queries explicitly about animal or cell work don't get the human-evidence boost. */
const NON_HUMAN_QUERY = /\b(rats?|mice|mouse|murine|rodents?|animals?|dogs?|pigs?|rabbits?|zebrafish|cells?|in vitro|culture)\b/i;

/** Human primary studies and meta-analyses count as human evidence (unless the query is about animals/cells). */
export function isHumanEvidence(s: Pick<CorpusStudy, "subject" | "design">, query: string): boolean {
  return (s.subject === "human" || s.design === "meta_analysis") && !NON_HUMAN_QUERY.test(query);
}

export function blendScores(
  keyword: Map<number, number>,
  semantic: Map<number, number>,
  opts: { hubIds?: Set<number> | null; evidence?: (id: number) => number; human?: (id: number) => boolean } = {},
): Map<number, number> {
  const hub = (id: number) => (opts.hubIds?.has(id) ? 1 : 0);
  const ev = (id: number) => Math.max(0, Math.min(1, opts.evidence?.(id) ?? 0));
  const human = (id: number) => (opts.human?.(id) ? BLEND.HUMAN_BOOST : 0);
  const out = new Map<number, number>();
  if (!semantic.size) {
    for (const [id, k] of keyword) out.set(id, k + hub(id) + BLEND.EVIDENCE_BOOST * ev(id) + human(id));
    return out;
  }
  let top = -1;
  for (const v of semantic.values()) if (v > top) top = v;
  const floor = Math.max(BLEND.MIN_COSINE, top - BLEND.WINDOW);
  const span = Math.max(top - floor, 1e-6);
  const semNorm = (id: number) => {
    const c = semantic.get(id) ?? 0;
    return c >= floor ? Math.min(1, (c - floor) / span) : 0;
  };
  const semanticOnly = [...semantic]
    .filter(([id, c]) => c >= floor && !keyword.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, BLEND.MAX_SEMANTIC_ONLY)
    .map(([id]) => id);
  for (const id of [...keyword.keys(), ...semanticOnly]) {
    out.set(
      id,
      BLEND.W_SEMANTIC * semNorm(id) +
        BLEND.W_KEYWORD * Math.min(1, keyword.get(id) ?? 0) +
        BLEND.HUB_BOOST * hub(id) +
        BLEND.EVIDENCE_BOOST * ev(id) +
        // "Similar relevance": only studies that are on-topic by meaning get the human boost.
        (semNorm(id) > 0 ? human(id) : 0),
    );
  }
  return out;
}

/** The condition hub a free-text question names, if any (longest name wins). */
export async function detectCondition(text: string): Promise<string | null> {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  const rows = await getConditionRows();
  const hits = rows.filter((r) => {
    const name = ` ${r.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
    const slug = ` ${r.slug.replace(/-/g, " ")} `;
    return t.includes(name) || t.includes(slug);
  });
  hits.sort((a, b) => b.name.length - a.name.length);
  return hits[0]?.slug ?? null;
}

// ── filtering + sorting ──────────────────────────────────────

const DESIGN_STRENGTH: Record<StudyDesign, number> = {
  meta_analysis: 9, rct: 8, controlled_trial: 7, uncontrolled_trial: 6, observational: 5,
  case_report: 4, animal: 3, in_vitro: 2, review: 1, other: 0,
};

/** Higher = stronger evidence; unknown designs rank with legacy human/animal hints. */
export function evidenceRank(s: CorpusStudy): number {
  if (s.design) return DESIGN_STRENGTH[s.design];
  return s.subject === "human" ? 5 : s.subject === "animal" ? 3 : s.subject === "in_vitro" ? 2 : 0;
}

export function applyFilters(rows: CorpusStudy[], f: ResearchFilters): CorpusStudy[] {
  return rows.filter(
    (s) =>
      (!f.subject || s.subject === f.subject) &&
      (!f.design || s.design === f.design) &&
      (!f.deliveryMethod || s.deliveryMethod === f.deliveryMethod) &&
      (!f.outcome || s.outcome === f.outcome) &&
      (!f.yearFrom || (s.year !== null && s.year >= f.yearFrom)) &&
      (!f.yearTo || (s.year !== null && s.year <= f.yearTo)) &&
      (!f.minSampleSize || (s.sampleSize !== null && s.sampleSize >= f.minSampleSize)),
  );
}

export function sortStudies(rows: CorpusStudy[], order: SortOrder, ranks?: Map<number, number>): CorpusStudy[] {
  const q = (s: CorpusStudy) => s.qualityScore ?? -1;
  const cmp: Record<SortOrder, (a: CorpusStudy, b: CorpusStudy) => number> = {
    relevance: (a, b) => (ranks?.get(b.id) ?? 0) - (ranks?.get(a.id) ?? 0) || evidenceRank(b) - evidenceRank(a),
    evidence: (a, b) => evidenceRank(b) - evidenceRank(a) || q(b) - q(a) || (b.sampleSize ?? 0) - (a.sampleSize ?? 0),
    newest: (a, b) => (b.year ?? 0) - (a.year ?? 0) || b.id - a.id,
    quality: (a, b) => q(b) - q(a) || evidenceRank(b) - evidenceRank(a),
  };
  return [...rows].sort(cmp[order]);
}

export interface FindResult {
  studies: CorpusStudy[];
  condition: ConditionHub | null;
  notes: string[];
}

/** Every live study matching the filters, sorted. */
export async function findStudies(f: ResearchFilters, order?: SortOrder): Promise<FindResult> {
  const { rows } = await getCorpus();
  const notes: string[] = [];
  let pool = rows;
  let condition: ConditionHub | null = null;

  if (f.condition) {
    const row = matchConditionRow(await getConditionRows(), f.condition);
    if (row) {
      const ids = await conditionStudyIds(row);
      pool = pool.filter((s) => ids.has(s.id));
      condition = hubOf(row);
    } else {
      // Not a condition hub — match the condition tags and titles instead.
      const needle = f.condition.toLowerCase();
      pool = pool.filter((s) => s.conditions.some((c) => c.toLowerCase().includes(needle)) || s.title.toLowerCase().includes(needle));
      notes.push(`"${f.condition}" is not a condition hub; matched by condition tags and titles. Call list_conditions for hubs.`);
    }
  }

  let ranks: Map<number, number> | undefined;
  let namedHubIds: Set<number> | null = null;
  if (f.query?.trim() && !f.condition) {
    const named = await detectCondition(f.query);
    const row = named ? matchConditionRow(await getConditionRows(), named) : null;
    if (row) {
      namedHubIds = await conditionStudyIds(row);
      notes.push(`The query names the "${row.slug}" condition hub — its studies rank first; pass condition: "${row.slug}" to restrict to them.`);
    }
  }
  const doiRef = f.query?.trim() ? parseStudyRef(f.query) : null;
  if (doiRef?.kind === "doi") {
    // A pasted DOI is an exact lookup, not a text search.
    const doi = doiRef.value.toLowerCase();
    pool = pool.filter((s) => s.doi?.toLowerCase() === doi);
    ranks = new Map(pool.map((s) => [s.id, 1]));
    if (!pool.length) notes.push(`No live study has DOI ${doiRef.value}.`);
  } else if (f.query?.trim()) {
    // Hybrid: keyword ranking blended with meaning-based similarity; studies on a
    // hub the query names and stronger designs get a small boost.
    const [keyword, semantic] = await Promise.all([textRanks(f.query), semanticScores(f.query)]);
    const { byId } = await getCorpus();
    const query = f.query;
    ranks = blendScores(keyword, semantic, {
      hubIds: namedHubIds,
      evidence: (id) => {
        const s = byId.get(id);
        return s ? evidenceRank(s) / 9 : 0;
      },
      human: (id) => {
        const s = byId.get(id);
        return !!s && isHumanEvidence(s, query);
      },
    });
    const byAuthor = authorMatches(query, pool);
    applyAuthorMatches(ranks, byAuthor);
    if (byAuthor.size) notes.push(`${byAuthor.size} ${byAuthor.size === 1 ? "study is" : "studies are"} by an author the query names — ranked first.`);
    pool = pool.filter((s) => ranks!.has(s.id));
  }

  pool = applyFilters(pool, f);
  return { studies: sortStudies(pool, order ?? (ranks ? "relevance" : "evidence"), ranks), condition, notes };
}

// ── aggregation ──────────────────────────────────────────────

export const GROUP_BY = ["year", "subject", "design", "delivery_method", "outcome", "country", "condition", "species"] as const;
export type GroupBy = (typeof GROUP_BY)[number];

function groupValues(s: CorpusStudy, by: GroupBy): Array<string | null> {
  switch (by) {
    case "year": return [s.year === null ? null : String(s.year)];
    case "subject": return [s.subject === "unknown" ? null : s.subject];
    case "design": return [s.design];
    case "delivery_method": return [s.deliveryMethod];
    case "outcome": return [s.outcome];
    case "country": return [s.country];
    case "species": return [s.species];
    case "condition": return s.conditions.length ? s.conditions : [null];
  }
}

export function aggregate(rows: CorpusStudy[], by: GroupBy, top = 40) {
  const counts = new Map<string, number>();
  let unknown = 0;
  for (const s of rows) {
    for (const v of groupValues(s, by)) {
      if (v === null) unknown++;
      else counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  const buckets = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => (by === "year" ? Number(b.value) - Number(a.value) : b.count - a.count));
  return {
    group_by: by,
    total_studies: rows.length,
    buckets: buckets.slice(0, top),
    more_buckets: Math.max(0, buckets.length - top),
    unknown,
  };
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

const tally = <T extends string>(xs: Array<T | null>) => {
  const out: Record<string, number> = {};
  for (const x of xs) out[x ?? "unknown"] = (out[x ?? "unknown"] ?? 0) + 1;
  return out;
};

/** Side-by-side-comparable evidence summary for a set of studies. */
export function evidenceProfile(rows: CorpusStudy[], topN = 5) {
  const human = rows.filter((s) => s.subject === "human");
  const humanSizes = human.map((s) => s.sampleSize).filter((n): n is number => n !== null);
  const humanDurations = human.map((s) => s.durationDays).filter((n): n is number => n !== null);
  const years = rows.map((s) => s.year).filter((y): y is number => y !== null);
  const known = (pick: (s: CorpusStudy) => unknown) => rows.filter((s) => pick(s) !== null && pick(s) !== "unknown").length;
  return {
    total_studies: rows.length,
    by_subject: tally(rows.map((s) => (s.subject === "unknown" ? null : s.subject))),
    by_design: tally(rows.map((s) => s.design)),
    human_evidence: {
      studies: human.length,
      randomized_controlled_trials: human.filter((s) => s.design === "rct").length,
      outcomes: tally(human.map((s) => s.outcome)),
      total_participants_reported: humanSizes.reduce((a, b) => a + b, 0),
      median_sample_size: median(humanSizes),
      median_duration_days: median(humanDurations),
      sample_size_known_for: humanSizes.length,
    },
    outcomes_all_subjects: tally(rows.map((s) => s.outcome)),
    delivery_methods: tally(rows.map((s) => s.deliveryMethod)),
    publication_years: years.length ? { first: Math.min(...years), latest: Math.max(...years) } : null,
    coverage: {
      design_known: known((s) => s.design),
      subject_known: known((s) => s.subject),
      outcome_known: known((s) => s.outcome),
      delivery_method_known: known((s) => s.deliveryMethod),
      of: rows.length,
    },
    strongest_studies: sortStudies(rows, "evidence").slice(0, topN).map(studyCard),
  };
}

// ── output shapes ────────────────────────────────────────────

export const studyUrl = (slug: string) => `${SITE_URL}/study/${slug}`;
export const doiUrl = (doi: string | null) => (doi ? `https://doi.org/${doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")}` : null);

/** Compact study record for lists. Contains only our own text (key finding), never the abstract. */
export function studyCard(s: CorpusStudy) {
  return {
    id: s.id,
    title: s.title,
    citation: [s.firstAuthor && `${s.firstAuthor} et al.`, s.year, s.journal].filter(Boolean).join(", ") || null,
    url: studyUrl(s.slug),
    year: s.year,
    journal: s.journal,
    design: s.design,
    subject: s.subject,
    species: s.species,
    sample_size: s.sampleSize,
    duration_days: s.durationDays,
    delivery_method: s.deliveryMethod,
    outcome: s.outcome,
    key_finding: s.keyFinding,
    doi_url: doiUrl(s.doi),
    quality_score: s.qualityScore,
  };
}

// ── single study ─────────────────────────────────────────────

/** Accepts an id, slug, DOI, doi.org URL or hydrogenstudies.com study URL. */
export function parseStudyRef(ref: string): { kind: "id" | "slug" | "doi"; value: string } {
  const v = ref.trim();
  if (/^\d+$/.test(v)) return { kind: "id", value: v };
  const doi = v.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
  if (/^10\.\d{4,9}\//.test(doi)) return { kind: "doi", value: doi };
  const slug = v.replace(/^https?:\/\/[^/]+\/study\//i, "").replace(/[?#].*$/, "").replace(/\/$/, "");
  return { kind: "slug", value: slug };
}

export async function getStudyDetail(ref: string, opts: { full?: boolean } = {}) {
  const { kind, value } = parseStudyRef(ref);
  const where =
    kind === "id" ? sql`id = ${Number(value)}` : kind === "doi" ? sql`LOWER(doi) = LOWER(${value})` : sql`slug = ${value}`;
  const r = await db.execute(sql`
    SELECT id, slug, title, plain_language_title, authors, journal, publish_year, doi, url, country,
           study_design, study_type, is_human_trial, h2_delivery_method, outcome, sample_size, duration,
           health_conditions, body_systems, mechanisms, key_finding, tldr, plain_summary, practical_takeaway,
           h2_concentration, dosage_protocol, limitations, citation_count, abstract, conclusion,
           ${opts.full ? sql`full_text` : sql`NULL AS full_text`},
           (SELECT row_to_json(q) FROM (
              SELECT overall_score, methodology_score, impact_score, relevance_score, sample_size_score,
                     red_flags, score_confidence
                FROM study_quality_scores WHERE study_id = studies.id ORDER BY id DESC LIMIT 1) q) AS quality
      FROM studies
     WHERE is_excluded = false AND ${where}
     LIMIT 1
  `);
  const row = (r.rows?.[0] ?? null) as Record<string, any> | null;
  if (!row) return null;
  const s = toCorpusStudy({ ...row, title: row.plain_language_title || row.title, quality_score: row.quality?.overall_score });
  const q = row.quality ?? null;
  return {
    ...studyCard(s),
    original_title: row.title,
    authors: row.authors ?? null,
    source_url: row.url ?? null,
    country: s.country,
    conditions: s.conditions,
    body_systems: row.body_systems ?? [],
    mechanisms: row.mechanisms ?? [],
    h2_concentration: row.h2_concentration ?? null,
    dosage_protocol: row.dosage_protocol ?? null,
    limitations: row.limitations ?? null,
    citation_count: row.citation_count ?? null,
    tldr: row.tldr ?? null,
    plain_summary: row.plain_summary ?? null,
    practical_takeaway: row.practical_takeaway ?? null,
    quality: q && {
      overall: q.overall_score,
      methodology: q.methodology_score,
      impact: q.impact_score,
      relevance: q.relevance_score,
      sample_size: q.sample_size_score,
      red_flags: q.red_flags ?? [],
      confidence: q.score_confidence ?? null,
    },
    // Publisher copyright: public output gets a ≤300-char excerpt + DOI link, never the abstract.
    ...(opts.full
      ? { abstract: row.abstract ?? null, conclusion: row.conclusion ?? null, full_text: row.full_text ? String(row.full_text).slice(0, 60_000) : null }
      : { abstract_excerpt: abstractExcerpt(row.abstract) || null }),
  };
}

// ── related studies ──────────────────────────────────────────

export async function relatedStudies(id: number, limit = 8) {
  const { byId, rows } = await getCorpus();
  const self = byId.get(id);
  if (!self) return null;
  // Citation rows carry a denormalized title/DOI. A row pointing at an
  // excluded study (by id or by DOI) must not surface it — that would leak
  // retracted / off-topic papers through the public tool.
  const r = await db.execute(sql`
    SELECT c.direction, c.to_study_id, c.to_doi, c.to_title
      FROM study_citations c
      LEFT JOIN studies t ON t.id = c.to_study_id
     WHERE c.from_study_id = ${id}
       AND (c.to_study_id IS NULL OR t.is_excluded = false)
       AND NOT EXISTS (
         SELECT 1 FROM studies x
          WHERE x.is_excluded = true AND c.to_doi IS NOT NULL AND LOWER(x.doi) = LOWER(c.to_doi)
       )
     LIMIT 200
  `);
  const cites: unknown[] = [];
  const citedBy: unknown[] = [];
  for (const c of (r.rows ?? []) as any[]) {
    const inCorpus = c.to_study_id ? byId.get(Number(c.to_study_id)) : undefined;
    // An internal study missing from the corpus (no slug) is skipped, not shown via its cached title.
    const entry = inCorpus
      ? studyCard(inCorpus)
      : !c.to_study_id && (c.to_doi || c.to_title)
        ? { title: c.to_title ?? null, doi_url: doiUrl(c.to_doi) }
        : null;
    if (!entry) continue;
    (c.direction === "cited_by" ? citedBy : cites).push(entry);
  }
  const mine = new Set(self.conditions.map((c) => c.toLowerCase()));
  const similar = rows
    .filter((s) => s.id !== id && s.conditions.some((c) => mine.has(c.toLowerCase())))
    .map((s) => ({ s, overlap: s.conditions.filter((c) => mine.has(c.toLowerCase())).length }))
    .sort((a, b) => b.overlap - a.overlap || evidenceRank(b.s) - evidenceRank(a.s) || (b.s.qualityScore ?? -1) - (a.s.qualityScore ?? -1))
    .slice(0, limit)
    .map(({ s }) => studyCard(s));
  return {
    study: studyCard(self),
    cites: cites.slice(0, 25),
    cited_by: citedBy.slice(0, 25),
    similar_by_condition: similar,
  };
}

/** Test hook. */
export function resetResearchQueryCaches(): void {
  corpusCache = null;
  corpusLoading = null;
  conditionIdCache.clear();
}
