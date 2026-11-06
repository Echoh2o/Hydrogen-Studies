/**
 * TRUST-BADGE-PLAN Phase 1 — evidence profile data for a product: approved
 * human-study evidence fields + the product's lab data → dose match (shared/
 * evidence-match.ts). Cached 30 min; invalidated with the other evidence
 * numbers whenever the reviewer changes a field.
 */
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { doseMatch, topicMatch, isClaimTopic, EVIDENCE_RULE_VERSION, type EvidenceStudyRow, type DoseMatch } from "../../shared/evidence-match";

const TTL_MS = 30 * 60 * 1000;

export interface ProductRow {
  slug: string;
  shopifyHandle: string;
  name: string;
  deliveryRoute: string;
  certifiedConcentrationPpm: number | null;
  certifiedAtMinutes: number | null;
  measuredSummary: string | null;
  lab: string | null;
  reportId: string | null;
  testDate: string | null;
  reportUrl: string | null;
  status: string;
  badgeEnabled: boolean;
  measurementNote: string | null;
}

let _rows: EvidenceStudyRow[] | null = null;
let _rowsAt = 0;
let _version = "";

export function invalidateEvidenceProfile(): void {
  _rows = null;
  void import("./study-dose").then((m) => m.invalidateDoseDevices()).catch(() => {});
}

async function humanRows(): Promise<{ rows: EvidenceStudyRow[]; version: string }> {
  if (_rows && Date.now() - _rowsAt < TTL_MS) return { rows: _rows, version: _version };
  const r = await db.execute(sql`
    SELECT id, slug, COALESCE(plain_language_title, title) AS title, publish_year, pmid, doi, study_design, sample_size,
           duration_days, delivery_route, h2_concentration_ppm, h2_concentration_kind, population_kind, effect_direction,
           funding_category, funded_by_echo, used_echo_device, health_conditions, evidence_fields_reviewed_at
      FROM studies
     WHERE is_excluded = false AND is_human_trial = true AND slug IS NOT NULL
       AND evidence_fields_status IN ('auto_approved', 'approved')
     ORDER BY publish_year DESC NULLS LAST, id DESC`);
  const rows = (r.rows as any[]).map((x) => ({
    id: Number(x.id),
    slug: String(x.slug),
    title: String(x.title ?? ""),
    publishYear: x.publish_year == null ? null : Number(x.publish_year),
    pmid: /^\d{4,9}$/.test(String(x.pmid ?? "").trim()) ? String(x.pmid).trim() : null,
    doi: x.doi ? String(x.doi) : null,
    studyDesign: x.study_design ?? null,
    sampleSize: x.sample_size != null && x.sample_size > 0 ? Number(x.sample_size) : null,
    durationDays: x.duration_days != null ? Number(x.duration_days) : null,
    deliveryRoute: x.delivery_route ?? null,
    concentrationPpm: x.h2_concentration_ppm != null ? Number(x.h2_concentration_ppm) : null,
    concentrationKind: x.h2_concentration_kind ?? null,
    populationKind: x.population_kind ?? null,
    effectDirection: String(x.effect_direction ?? "not_reported"),
    fundingCategory: x.funding_category ?? null,
    fundedByEcho: x.funded_by_echo === true,
    usedEchoDevice: x.used_echo_device === true,
    healthConditions: Array.isArray(x.health_conditions) ? x.health_conditions.map(String) : [],
  }));
  const latest = (r.rows as any[]).reduce((m, x) => Math.max(m, x.evidence_fields_reviewed_at ? new Date(x.evidence_fields_reviewed_at).getTime() : 0), 0);
  _version = crypto.createHash("sha1").update(`${EVIDENCE_RULE_VERSION}:${rows.length}:${latest}:${rows.map((x) => `${x.id}${x.effectDirection}${x.concentrationPpm}`).join(",")}`).digest("hex").slice(0, 10);
  _rows = rows;
  _rowsAt = rows.length ? Date.now() : 0;
  return { rows, version: _version };
}

export async function getProduct(slug: string): Promise<ProductRow | null> {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null;
  const r = await db.execute(sql`SELECT * FROM products WHERE slug = ${slug} LIMIT 1`);
  const x: any = r.rows?.[0];
  if (!x) return null;
  return {
    slug: x.slug, shopifyHandle: x.shopify_handle, name: x.name, deliveryRoute: x.delivery_route,
    certifiedConcentrationPpm: x.certified_concentration_ppm != null ? Number(x.certified_concentration_ppm) : null,
    certifiedAtMinutes: x.certified_at_minutes != null ? Number(x.certified_at_minutes) : null,
    measuredSummary: x.measured_summary, lab: x.lab, reportId: x.report_id,
    testDate: x.test_date ? new Date(x.test_date).toISOString().slice(0, 10) : null,
    reportUrl: x.report_url, status: x.status, badgeEnabled: x.badge_enabled === true, measurementNote: x.measurement_note ?? null,
  };
}

export interface EvidenceProfile {
  product: ProductRow;
  match: DoseMatch;
  version: string;
  generatedAt: string;
}

/** Profile for a product that has a lab-measured drinking-water concentration; null otherwise. */
export async function getEvidenceProfile(slug: string): Promise<EvidenceProfile | null> {
  const product = await getProduct(slug);
  if (!product || product.deliveryRoute !== "drinking_water" || product.certifiedConcentrationPpm == null || !product.reportId) return null;
  // A figure measured in a sealed lab vial is not a drinkable concentration (prebiotic sticks):
  // no dose-match badge until an open-glass measurement exists.
  if (/sealed|closed lab vial|headspace vial/i.test(`${product.measurementNote ?? ""} ${product.measuredSummary ?? ""}`)) return null;
  const { rows, version } = await humanRows();
  return {
    product,
    match: doseMatch(rows, { slug: product.slug, name: product.name, deliveryRoute: product.deliveryRoute, certifiedConcentrationPpm: product.certifiedConcentrationPpm }),
    version: `${version}-${product.reportId}`,
    generatedAt: new Date().toISOString(),
  };
}

export async function getTopicEvidence(topic: string): Promise<{ topic: string; count: number; mix: ReturnType<typeof topicMatch>["mix"]; studies: EvidenceStudyRow[]; version: string } | null> {
  if (!isClaimTopic(topic)) return null;
  const { rows, version } = await humanRows();
  const t = topicMatch(rows, topic);
  return { topic, count: t.studies.length, mix: t.mix, studies: t.studies, version };
}
