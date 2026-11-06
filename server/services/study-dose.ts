/**
 * PLAN 5.1 — data for the "studied dose" module on a study page: the study's
 * reviewed evidence fields + the lab-measured Echo devices (products table).
 * The eligibility rules and copy live in shared/study-dose-module.ts.
 * Fails closed: any DB error → null (no module), never a broken page.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import { buildStudyDoseModule, type DoseDevice, type StudyDoseFields, type StudyDoseModule } from "../../shared/study-dose-module";
import { logger } from "../utils/logger";

const TTL_MS = 30 * 60 * 1000;
let _devices: DoseDevice[] | null = null;
let _devicesAt = 0;

export function invalidateDoseDevices(): void {
  _devices = null;
}

const num = (v: unknown): number | null => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export async function getDoseDevices(): Promise<DoseDevice[]> {
  if (_devices && Date.now() - _devicesAt < TTL_MS) return _devices;
  const r = await db.execute(sql`
    SELECT slug, name, shopify_handle, delivery_route, certified_concentration_ppm, lab, report_id, report_url,
           badge_enabled, measurement_note, measured_summary
      FROM products`);
  _devices = (r.rows as any[]).map((x) => ({
    slug: String(x.slug),
    name: String(x.name),
    shopifyHandle: String(x.shopify_handle ?? x.slug),
    deliveryRoute: String(x.delivery_route ?? ""),
    certifiedConcentrationPpm: num(x.certified_concentration_ppm),
    lab: x.lab ?? null,
    reportId: x.report_id ?? null,
    reportUrl: x.report_url ?? null,
    badgeEnabled: x.badge_enabled === true,
    measurementNote: `${x.measurement_note ?? ""} ${x.measured_summary ?? ""}`.trim() || null,
  }));
  _devicesAt = Date.now();
  return _devices;
}

export function doseFieldsFromRow(x: any): StudyDoseFields {
  return {
    slug: String(x.slug),
    isHumanTrial: x.is_human_trial === true,
    evidenceFieldsStatus: x.evidence_fields_status ?? null,
    deliveryRoute: x.delivery_route ?? null,
    concentrationPpm: num(x.h2_concentration_ppm),
    concentrationKind: x.h2_concentration_kind ?? null,
    concentrationRaw: x.h2_concentration_raw ?? null,
    doseMlPerDay: num(x.dose_ml_per_day),
    dosesPerDay: num(x.doses_per_day),
    durationDays: num(x.duration_days),
    populationKind: x.population_kind ?? null,
    populationCondition: x.population_condition ?? null,
    usedEchoDevice: x.used_echo_device == null ? null : x.used_echo_device === true,
    healthConditions: Array.isArray(x.health_conditions) ? x.health_conditions.map(String) : [],
  };
}

/** The module for one study (by id), or null when it doesn't qualify. */
export async function getStudyDoseModule(studyId: number): Promise<StudyDoseModule | null> {
  try {
    const r = await db.execute(sql`
      SELECT slug, is_human_trial, evidence_fields_status, delivery_route, h2_concentration_ppm, h2_concentration_kind,
             h2_concentration_raw, dose_ml_per_day, doses_per_day, duration_days, population_kind, population_condition,
             used_echo_device, health_conditions
        FROM studies WHERE id = ${studyId} AND is_excluded = false AND slug IS NOT NULL LIMIT 1`);
    const row: any = r.rows?.[0];
    if (!row) return null;
    const fields = doseFieldsFromRow(row);
    if (fields.deliveryRoute !== "drinking_water" || fields.concentrationPpm == null) return null;
    return buildStudyDoseModule(fields, await getDoseDevices());
  } catch (error) {
    logger.warn("study dose module failed", "StudyDose", { studyId, error: String(error) });
    return null;
  }
}
