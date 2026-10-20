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
  };
}

let corpusCache: { at: number; rows: CorpusStudy[]; byId: Map<number, CorpusStudy> } | null = null;

export async function getCorpus(): Promise<{ rows: CorpusStudy[]; byId: Map<number, CorpusStudy> }> {
  if (corpusCache && Date.now() - corpusCache.at < CACHE_TTL_MS) return corpusCache;
  const r = await db.execute(sql`
    SELECT s.id, s.slug, COALESCE(NULLIF(s.plain_language_title, ''), s.title) AS title, s.publish_year,
           s.journal, s.country, s.study_design, s.study_type, s.is_human_trial, s.h2_delivery_method,
           s.outcome, s.sample_size, s.duration, s.health_conditions, s.key_finding, s.doi,
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

const conditionIdCache = new Map<string, { at: number; ids: Set<number> }>();

async function conditionStudyIds(row: ConditionRow): Promise<Set<number>> {
  const hit = conditionIdCache.get(row.slug);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.ids;
  const r = await db.execute(sql`SELECT id FROM studies WHERE ${conditionHubWhere(row)}`);
  const ids = new Set(((r.rows ?? []) as any[]).map((x) => Number(x.id)));
  conditionIdCache.set(row.slug, { at: Date.now(), ids });
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
async function textRanks(query: string): Promise<Map<number, number>> {
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
  if (f.query?.trim() && !f.condition) {
    const named = await detectCondition(f.query);
    if (named) notes.push(`The query names the "${named}" condition hub — pass condition: "${named}" for its curated study set.`);
  }
  if (f.query?.trim()) {
    ranks = await textRanks(f.query);
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
  const r = await db.execute(sql`
    SELECT direction, to_study_id, to_doi, to_title FROM study_citations WHERE from_study_id = ${id} LIMIT 200
  `);
  const cites: unknown[] = [];
  const citedBy: unknown[] = [];
  for (const c of (r.rows ?? []) as any[]) {
    const inCorpus = c.to_study_id ? byId.get(Number(c.to_study_id)) : undefined;
    const entry = inCorpus ? studyCard(inCorpus) : c.to_doi || c.to_title ? { title: c.to_title ?? null, doi_url: doiUrl(c.to_doi) } : null;
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
  conditionIdCache.clear();
}
