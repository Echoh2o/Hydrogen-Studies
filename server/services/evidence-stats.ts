/**
 * Live numbers for /limits-of-the-evidence and the null/negative hub
 * (PLAN.md 4.6), computed from the studies table and cached 30 minutes. Each
 * figure is a plain count or percentile the page states as-is; nothing here
 * interprets a result.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import { studyEvidence } from "../../shared/study-page";
import { NON_POSITIVE_OUTCOMES } from "../../shared/evidence-pages";

/**
 * The outcome direction public pages use (TRUST-BADGE-PLAN 0.9): the
 * per-primary-outcome effect_direction when the evidence fields are approved
 * (auto_approved or approved — never unapproved), mapped onto the old
 * vocabulary; otherwise the legacy per-paper outcome label.
 */
export const OUTCOME_SQL = sql.raw(`(CASE WHEN evidence_fields_status IN ('auto_approved','approved') THEN
  CASE effect_direction WHEN 'improved' THEN 'positive' WHEN 'no_clear_effect' THEN 'neutral' WHEN 'worsened' THEN 'negative' WHEN 'mixed' THEN 'mixed' ELSE NULL END
  ELSE lower(nullif(outcome, '')) END)`);

export interface EvidenceStats {
  asOf: Date;
  total: number;
  human: number;
  since2010: number;
  designs: { design: string; n: number }[];
  humanTrials: {
    withN: number;
    medianN: number | null;
    lt30: number;
    lt100: number;
    ge100: number;
    maxN: number | null;
    withDuration: number;
    medianDays: number | null;
    singleDay: number;
    upTo4Weeks: number;
    to6Months: number;
    over6Months: number;
  };
  outcomes: { positive: number; neutral: number; negative: number; mixed: number; withOutcome: number; humanNonPositive: number };
  countries: { country: string; n: number }[];
  coverage: { funding: number; coi: number; concentration: number; registrationMention: number };
  replication: { conditionsWithRct: number; conditionsWith2PlusRcts: number };
}

const TTL_MS = 30 * 60 * 1000;
let _stats: EvidenceStats | null = null;
let _statsAt = 0;

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

export async function getEvidenceStats(): Promise<EvidenceStats> {
  if (_stats && Date.now() - _statsAt < TTL_MS) return _stats;
  const [totals, designs, human, outcomes, countries, coverage, replication] = await Promise.all([
    db.execute(sql`
      SELECT count(*)::int AS total, count(*) FILTER (WHERE is_human_trial)::int AS human,
             count(*) FILTER (WHERE publish_year >= 2010)::int AS since2010
        FROM studies WHERE is_excluded = false`),
    db.execute(sql`
      SELECT coalesce(nullif(study_design, ''), 'unknown') AS design, count(*)::int AS n
        FROM studies WHERE is_excluded = false GROUP BY 1 ORDER BY 2 DESC`),
    db.execute(sql`
      SELECT count(sample_size)::int AS with_n,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY sample_size) AS median_n,
             count(*) FILTER (WHERE sample_size < 30)::int AS lt30,
             count(*) FILTER (WHERE sample_size < 100)::int AS lt100,
             count(*) FILTER (WHERE sample_size >= 100)::int AS ge100,
             max(sample_size)::int AS max_n,
             count(duration)::int AS with_dur,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY duration) AS median_days,
             count(*) FILTER (WHERE duration <= 1)::int AS single_day,
             count(*) FILTER (WHERE duration BETWEEN 2 AND 28)::int AS up_to_4w,
             count(*) FILTER (WHERE duration > 28 AND duration <= 180)::int AS to_6m,
             count(*) FILTER (WHERE duration > 180)::int AS over_6m
        FROM studies WHERE is_excluded = false AND is_human_trial`),
    db.execute(sql`
      SELECT count(*) FILTER (WHERE ${OUTCOME_SQL} = 'positive')::int AS positive,
             count(*) FILTER (WHERE ${OUTCOME_SQL} = 'neutral')::int AS neutral,
             count(*) FILTER (WHERE ${OUTCOME_SQL} = 'negative')::int AS negative,
             count(*) FILTER (WHERE ${OUTCOME_SQL} = 'mixed')::int AS mixed,
             count(*) FILTER (WHERE ${OUTCOME_SQL} IS NOT NULL)::int AS with_outcome,
             count(*) FILTER (WHERE is_human_trial AND ${OUTCOME_SQL} IN ('neutral', 'negative', 'mixed'))::int AS human_non_positive
        FROM studies WHERE is_excluded = false`),
    db.execute(sql`
      SELECT country, count(*)::int AS n FROM studies
       WHERE is_excluded = false AND coalesce(country, '') <> '' GROUP BY 1 ORDER BY 2 DESC LIMIT 6`),
    db.execute(sql`
      SELECT count(*) FILTER (WHERE coalesce(funding_sources::text, '') NOT IN ('', '[]', 'null'))::int AS funding,
             count(*) FILTER (WHERE coalesce(conflict_of_interest, '') <> '')::int AS coi,
             count(*) FILTER (WHERE coalesce(h2_concentration, '') <> '')::int AS concentration,
             count(*) FILTER (WHERE is_human_trial AND abstract ~* 'NCT[0-9]{8}|UMIN[0-9]{9}|ChiCTR|ISRCTN|ClinicalTrials\\.gov|jRCT')::int AS registration_mention
        FROM studies WHERE is_excluded = false`),
    db.execute(sql`
      WITH c AS (
        SELECT unnest(health_conditions) AS cond FROM studies
         WHERE is_excluded = false AND is_human_trial AND study_design = 'rct'
      ), g AS (SELECT cond, count(*) AS n FROM c GROUP BY 1)
      SELECT count(*)::int AS conditions_with_rct, count(*) FILTER (WHERE n >= 2)::int AS conditions_with_2plus FROM g`),
  ]);
  const t: any = totals.rows[0] ?? {};
  const h: any = human.rows[0] ?? {};
  const o: any = outcomes.rows[0] ?? {};
  const c: any = coverage.rows[0] ?? {};
  const r: any = replication.rows[0] ?? {};
  _stats = {
    asOf: new Date(),
    total: num(t.total),
    human: num(t.human),
    since2010: num(t.since2010),
    designs: (designs.rows as any[]).map((d) => ({ design: String(d.design), n: num(d.n) })),
    humanTrials: {
      withN: num(h.with_n),
      medianN: numOrNull(h.median_n),
      lt30: num(h.lt30),
      lt100: num(h.lt100),
      ge100: num(h.ge100),
      maxN: numOrNull(h.max_n),
      withDuration: num(h.with_dur),
      medianDays: numOrNull(h.median_days),
      singleDay: num(h.single_day),
      upTo4Weeks: num(h.up_to_4w),
      to6Months: num(h.to_6m),
      over6Months: num(h.over_6m),
    },
    outcomes: {
      positive: num(o.positive),
      neutral: num(o.neutral),
      negative: num(o.negative),
      mixed: num(o.mixed),
      withOutcome: num(o.with_outcome),
      humanNonPositive: num(o.human_non_positive),
    },
    countries: (countries.rows as any[]).map((x) => ({ country: String(x.country), n: num(x.n) })),
    coverage: { funding: num(c.funding), coi: num(c.coi), concentration: num(c.concentration), registrationMention: num(c.registration_mention) },
    replication: { conditionsWithRct: num(r.conditions_with_rct), conditionsWith2PlusRcts: num(r.conditions_with_2plus) },
  };
  _statsAt = _stats.total ? Date.now() : 0; // an empty read is not cached
  return _stats;
}

export interface NonPositiveStudy {
  slug: string;
  title: string;
  year: number | null;
  journal: string | null;
  evidence: string | null;
  isHuman: boolean;
  outcome: string;
}

let _nonPositive: NonPositiveStudy[] | null = null;
let _nonPositiveAt = 0;

/** Studies whose recorded outcome direction is neutral, negative or mixed — people first, newest first. */
export async function getNonPositiveStudies(): Promise<NonPositiveStudy[]> {
  if (_nonPositive && Date.now() - _nonPositiveAt < TTL_MS) return _nonPositive;
  const r = await db.execute(sql`
    SELECT slug, COALESCE(plain_language_title, title) AS title, publish_year, journal, study_design, study_type,
           is_human_trial, ${OUTCOME_SQL} AS outcome
      FROM studies
     WHERE is_excluded = false AND slug IS NOT NULL
       AND ${OUTCOME_SQL} IN (${sql.join(NON_POSITIVE_OUTCOMES.map((o) => sql`${o}`), sql`, `)})
     ORDER BY is_human_trial DESC, publish_year DESC NULLS LAST, id DESC`);
  _nonPositive = (r.rows as any[]).map((row) => ({
    slug: String(row.slug),
    title: String(row.title ?? ""),
    year: row.publish_year == null ? null : Number(row.publish_year),
    journal: row.journal ? String(row.journal) : null,
    evidence: studyEvidence({ studyDesign: row.study_design, studyType: row.study_type, isHumanTrial: row.is_human_trial })?.label ?? null,
    isHuman: !!row.is_human_trial,
    outcome: String(row.outcome),
  }));
  _nonPositiveAt = _nonPositive.length ? Date.now() : 0;
  return _nonPositive;
}

/** Drop every cached evidence number (called when a reviewer approves/unapproves/corrects). */
export function invalidateEvidenceStats(): void {
  _stats = null;
  _nonPositive = null;
  _gap = null;
}

export function __resetEvidenceStatsForTests(): void {
  _stats = null;
  _nonPositive = null;
}

// ── Evidence gap map (PLAN 6.3) ───────────────────────────────────

export interface GapRow {
  condition: string;
  total: number;
  /** Systematic reviews / meta-analyses. */
  sr: number;
  rct: number;
  /** Human studies that are neither SR/MA nor RCT. */
  otherHuman: number;
  animal: number;
  inVitro: number;
  review: number;
  humanPositive: number;
  humanNonPositive: number;
}

let _gap: GapRow[] | null = null;
let _gapAt = 0;

/** One row per condition tag with ≥ GAP_MAP_MIN_STUDIES studies, most studied first. */
export async function getGapMatrix(minStudies: number): Promise<GapRow[]> {
  if (_gap && Date.now() - _gapAt < TTL_MS) return _gap;
  const r = await db.execute(sql`
    WITH t AS (
      SELECT unnest(health_conditions) AS cond, study_design AS d, is_human_trial AS h, ${OUTCOME_SQL} AS o
        FROM studies WHERE is_excluded = false
    )
    SELECT cond, count(*)::int AS total,
           count(*) FILTER (WHERE d = 'meta_analysis')::int AS sr,
           count(*) FILTER (WHERE d = 'rct')::int AS rct,
           count(*) FILTER (WHERE h AND d NOT IN ('meta_analysis', 'rct'))::int AS other_human,
           count(*) FILTER (WHERE d = 'animal')::int AS animal,
           count(*) FILTER (WHERE d = 'in_vitro')::int AS in_vitro,
           count(*) FILTER (WHERE d = 'review')::int AS review,
           count(*) FILTER (WHERE h AND o = 'positive')::int AS human_positive,
           count(*) FILTER (WHERE h AND o IN ('neutral', 'negative', 'mixed'))::int AS human_non_positive
      FROM t
     WHERE coalesce(cond, '') <> ''
     GROUP BY cond
    HAVING count(*) >= ${minStudies}
     ORDER BY total DESC, cond ASC`);
  _gap = (r.rows as any[]).map((x) => ({
    condition: String(x.cond),
    total: num(x.total),
    sr: num(x.sr),
    rct: num(x.rct),
    otherHuman: num(x.other_human),
    animal: num(x.animal),
    inVitro: num(x.in_vitro),
    review: num(x.review),
    humanPositive: num(x.human_positive),
    humanNonPositive: num(x.human_non_positive),
  }));
  _gapAt = _gap.length ? Date.now() : 0;
  return _gap;
}

export function __resetGapMatrixForTests(): void {
  _gap = null;
}
