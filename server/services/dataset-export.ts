/**
 * PLAN.md 6.2 — the public dataset (CSV + JSON) and the numbers behind the
 * "State of hydrogen research" report. Built from the live studies table and
 * cached for an hour; never includes abstracts or our prose summaries.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import { DATASET_FIELDS, deliveryGroup } from "../../shared/dataset";
import { normalizeDoi } from "../../shared/seo-markup";

const SITE_URL = "https://hydrogenstudies.com";
const TTL_MS = 60 * 60 * 1000;

interface Row {
  id: number;
  slug: string;
  title: string | null;
  authors: string | null;
  journal: string | null;
  publish_year: number | null;
  doi: string | null;
  pmid: string | null;
  study_design: string | null;
  is_human_trial: boolean | null;
  study_type: string | null;
  sample_size: number | null;
  duration: number | null;
  h2_delivery_method: string | null;
  h2_concentration: string | null;
  outcome: string | null;
  health_conditions: string[] | null;
  body_systems: string[] | null;
  country: string | null;
  funding_sources: string | null;
  conflict_of_interest: string | null;
  citation_count: number | null;
  citation_source: string | null;
  citation_count_updated_at: string | Date | null;
  openalex_id: string | null;
}

export type DatasetRecord = Record<(typeof DATASET_FIELDS)[number]["name"], string | number | boolean | null>;

let _rows: Row[] | null = null;
let _rowsAt = 0;

async function liveRows(): Promise<Row[]> {
  if (_rows && Date.now() - _rowsAt < TTL_MS) return _rows;
  const r = await db.execute(sql`
    SELECT id, slug, title, authors, journal, publish_year, doi, pmid, study_design, is_human_trial, study_type,
           sample_size, duration, h2_delivery_method, h2_concentration, outcome, health_conditions, body_systems,
           country, funding_sources::text AS funding_sources, conflict_of_interest,
           citation_count, citation_source, citation_count_updated_at, openalex_id
      FROM studies
     WHERE is_excluded = false AND slug IS NOT NULL
     ORDER BY id`);
  _rows = (r.rows || []) as unknown as Row[];
  _rowsAt = _rows.length ? Date.now() : 0;
  return _rows;
}

const clean = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return s && s !== "null" && s !== "[]" ? s : null;
};

export function toRecord(r: Row): DatasetRecord {
  const cited = r.citation_source === "openalex" && typeof r.citation_count === "number";
  const asOf = cited && r.citation_count_updated_at ? new Date(r.citation_count_updated_at) : null;
  return {
    id: Number(r.id),
    url: `${SITE_URL}/study/${r.slug}`,
    title: clean(r.title),
    authors: clean(r.authors),
    journal: clean(r.journal),
    year: r.publish_year ?? null,
    doi: normalizeDoi(r.doi) || null,
    pmid: /^\d{4,9}$/.test(String(r.pmid ?? "").trim()) ? String(r.pmid).trim() : null,
    study_design: clean(r.study_design),
    human: !!r.is_human_trial,
    species_or_model: clean(r.study_type),
    sample_size: r.sample_size != null && r.sample_size > 0 ? Number(r.sample_size) : null,
    duration_days: r.duration != null && r.duration > 0 ? Number(r.duration) : null,
    delivery_method: clean(r.h2_delivery_method),
    h2_concentration: clean(r.h2_concentration),
    outcome_direction: clean(r.outcome)?.toLowerCase() ?? null,
    health_conditions: r.health_conditions?.length ? r.health_conditions.join("|") : null,
    body_systems: r.body_systems?.length ? r.body_systems.join("|") : null,
    country: clean(r.country),
    funding_sources: clean(r.funding_sources),
    conflict_of_interest: clean(r.conflict_of_interest),
    citation_count: cited ? Number(r.citation_count) : null,
    citation_count_as_of: asOf && !isNaN(asOf.getTime()) ? asOf.toISOString().slice(0, 10) : null,
    openalex_id: cited ? clean(r.openalex_id) : null,
    excluded: false,
  };
}

export async function getDatasetRecords(): Promise<DatasetRecord[]> {
  return (await liveRows()).map(toRecord);
}

export function csvField(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(records: readonly DatasetRecord[]): string {
  const header = DATASET_FIELDS.map((f) => f.name).join(",");
  const lines = records.map((rec) => DATASET_FIELDS.map((f) => csvField(rec[f.name as keyof DatasetRecord])).join(","));
  return [header, ...lines].join("\n") + "\n";
}

export interface DatasetSummary {
  rows: number;
  generatedAt: Date;
  human: number;
  withDoi: number;
  withPmid: number;
}

export async function getDatasetSummary(): Promise<DatasetSummary> {
  const records = await getDatasetRecords();
  return {
    rows: records.length,
    generatedAt: new Date(_rowsAt || Date.now()),
    human: records.filter((r) => r.human).length,
    withDoi: records.filter((r) => r.doi).length,
    withPmid: records.filter((r) => r.pmid).length,
  };
}

// ── Report numbers ────────────────────────────────────────────────

export interface ReportStats {
  asOf: Date;
  total: number;
  human: number;
  /** 2010 onwards, oldest first. */
  byYear: { year: number; n: number; human: number }[];
  pre2010: number;
  noYear: number;
  byDelivery: { group: string; n: number }[];
  byCountry: { country: string; n: number }[];
  topConditions: { name: string; n: number }[];
  withFunding: number;
  withCoi: number;
  withConcentration: number;
  withSampleSize: number;
  withDuration: number;
  /** Published this year vs last year (calendar). */
  thisYear: { year: number; n: number; human: number };
  lastYear: { year: number; n: number; human: number };
}

let _report: ReportStats | null = null;
let _reportAt = 0;

export async function getReportStats(now = new Date()): Promise<ReportStats> {
  if (_report && Date.now() - _reportAt < TTL_MS) return _report;
  const rows = await liveRows();
  const years = new Map<number, { n: number; human: number }>();
  const delivery = new Map<string, number>();
  const countries = new Map<string, number>();
  const conditions = new Map<string, number>();
  let pre2010 = 0;
  let noYear = 0;
  let human = 0;
  let withFunding = 0;
  let withCoi = 0;
  let withConcentration = 0;
  let withSampleSize = 0;
  let withDuration = 0;
  for (const r of rows) {
    const h = !!r.is_human_trial;
    if (h) human++;
    if (r.publish_year == null) noYear++;
    else if (r.publish_year < 2010) pre2010++;
    else {
      const y = years.get(r.publish_year) ?? { n: 0, human: 0 };
      y.n++;
      if (h) y.human++;
      years.set(r.publish_year, y);
    }
    const g = deliveryGroup(r.h2_delivery_method);
    delivery.set(g, (delivery.get(g) ?? 0) + 1);
    const c = clean(r.country);
    if (c) countries.set(c, (countries.get(c) ?? 0) + 1);
    for (const cond of r.health_conditions ?? []) {
      const name = String(cond).trim();
      if (name) conditions.set(name, (conditions.get(name) ?? 0) + 1);
    }
    if (clean(r.funding_sources)) withFunding++;
    if (clean(r.conflict_of_interest)) withCoi++;
    if (clean(r.h2_concentration)) withConcentration++;
    if (r.sample_size != null && r.sample_size > 0) withSampleSize++;
    if (r.duration != null && r.duration > 0) withDuration++;
  }
  const byYear = [...years].map(([year, v]) => ({ year, ...v })).sort((a, b) => a.year - b.year);
  const pick = (year: number) => ({ year, n: years.get(year)?.n ?? 0, human: years.get(year)?.human ?? 0 });
  const sortDesc = <T extends { n: number }>(xs: T[]) => xs.sort((a, b) => b.n - a.n);
  _report = {
    asOf: new Date(),
    total: rows.length,
    human,
    byYear,
    pre2010,
    noYear,
    byDelivery: sortDesc([...delivery].map(([group, n]) => ({ group, n }))),
    byCountry: sortDesc([...countries].map(([country, n]) => ({ country, n }))).slice(0, 10),
    topConditions: sortDesc([...conditions].map(([name, n]) => ({ name, n }))).slice(0, 12),
    withFunding,
    withCoi,
    withConcentration,
    withSampleSize,
    withDuration,
    thisYear: pick(now.getUTCFullYear()),
    lastYear: pick(now.getUTCFullYear() - 1),
  };
  _reportAt = rows.length ? Date.now() : 0;
  return _report;
}

export function __resetDatasetForTests(): void {
  _rows = null;
  _report = null;
}
