import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migration 032 — docs/TRUST-BADGE-PLAN.md Phase 0 (0.1–0.6), the human-study
 * subset of PLAN 4.3. Additive columns on studies plus a products table seeded
 * from the H2 Analytics reports Echo publishes on support.echowater.com.
 *
 * Approval model (Josh, 2026-11-05): extracted values are approved by default
 * under the reviewer's name (evidence_fields_status = 'auto_approved'); Sarah
 * can unapprove ('unapproved') or confirm ('approved') later. Public counts
 * use auto_approved + approved, never unapproved.
 *
 * Idempotent: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS, upsert seed.
 */
export async function addEvidenceFieldsAndProducts(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE studies
      ADD COLUMN IF NOT EXISTS h2_concentration_ppm NUMERIC,
      ADD COLUMN IF NOT EXISTS h2_concentration_kind TEXT,
      ADD COLUMN IF NOT EXISTS h2_concentration_raw TEXT,
      ADD COLUMN IF NOT EXISTS delivery_route TEXT,
      ADD COLUMN IF NOT EXISTS h2_source TEXT,
      ADD COLUMN IF NOT EXISTS dose_ml_per_day NUMERIC,
      ADD COLUMN IF NOT EXISTS doses_per_day INTEGER,
      ADD COLUMN IF NOT EXISTS duration_days INTEGER,
      ADD COLUMN IF NOT EXISTS population_kind TEXT,
      ADD COLUMN IF NOT EXISTS population_condition TEXT,
      ADD COLUMN IF NOT EXISTS species TEXT,
      ADD COLUMN IF NOT EXISTS primary_outcome TEXT,
      ADD COLUMN IF NOT EXISTS effect_direction TEXT,
      ADD COLUMN IF NOT EXISTS effect_direction_evidence TEXT,
      ADD COLUMN IF NOT EXISTS funding_category TEXT,
      ADD COLUMN IF NOT EXISTS funded_by_echo BOOLEAN,
      ADD COLUMN IF NOT EXISTS used_echo_device BOOLEAN,
      ADD COLUMN IF NOT EXISTS device_maker TEXT,
      ADD COLUMN IF NOT EXISTS coi_declared TEXT,
      ADD COLUMN IF NOT EXISTS evidence_fields_status TEXT,
      ADD COLUMN IF NOT EXISTS evidence_fields_extracted_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS evidence_fields_model TEXT,
      ADD COLUMN IF NOT EXISTS evidence_fields_reviewed_by TEXT,
      ADD COLUMN IF NOT EXISTS evidence_fields_reviewed_at TIMESTAMP
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS studies_evidence_fields_status_idx ON studies (evidence_fields_status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS studies_delivery_route_idx ON studies (delivery_route)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS evidence_field_changes (
      id SERIAL PRIMARY KEY,
      study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
      action TEXT NOT NULL CHECK (action IN ('extract', 'approve', 'unapprove', 'correct')),
      actor TEXT NOT NULL,
      changes JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS evidence_field_changes_study_idx ON evidence_field_changes (study_id, created_at DESC)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS products (
      slug TEXT PRIMARY KEY,
      shopify_handle TEXT NOT NULL,
      name TEXT NOT NULL,
      delivery_route TEXT NOT NULL,
      certified_concentration_ppm NUMERIC,
      certified_at_minutes INTEGER,
      measured_summary TEXT,
      lab TEXT,
      report_id TEXT,
      test_date DATE,
      method TEXT,
      water_type TEXT,
      report_url TEXT,
      certificate_url TEXT,
      measurement_note TEXT,
      status TEXT NOT NULL DEFAULT 'on_sale' CHECK (status IN ('on_sale', 'in_development', 'not_listed', 'discontinued')),
      badge_enabled BOOLEAN NOT NULL DEFAULT false,
      allowed_claim_topics TEXT[] NOT NULL DEFAULT '{}',
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS product_measurements (
      id SERIAL PRIMARY KEY,
      product_slug TEXT NOT NULL REFERENCES products(slug) ON DELETE CASCADE,
      minutes_after_cycle INTEGER,
      cycle_minutes INTEGER,
      concentration_mg_l NUMERIC NOT NULL,
      lab TEXT NOT NULL,
      report_id TEXT,
      test_date DATE,
      note TEXT
    )
  `);

  // Seed from the H2 Analytics documents on support.echowater.com (2026-11-05).
  // badge_enabled stays false until Phase 1 ships; Forty/One are pre-launch.
  const H2A = "H2 Analytics (Las Vegas)";
  const SUP = "https://support.echowater.com/hc/en-us/articles/";
  const seed: Array<[string, string, string, string, number | null, number | null, string, string | null, string | null, string | null, string | null, string | null, string, string | null]> = [
    ["echo-flask", "echo-flask", "Echo Flask", "drinking_water", 8.25, 20, "6.07 mg/L after a 10-minute cycle; 8.25 mg/L after a 20-minute cycle (~350 mL)", "H2AR-250116-1", "2025-01-16", "gas chromatography, static headspace", "distilled, 24.5 °C", `${SUP}34011584300180`, "on_sale", null],
    ["echo-h2-machine", "echo-h2-hydrogen-water-machine", "Echo H2 Machine", "drinking_water", 1.43, null, "1.43 mg/L", "H2A-240603-3", "2024-06-03", "gas chromatography, static headspace", null, `${SUP}15773484953876`, "on_sale", null],
    ["echo-ultimate", "echo-ultimate-hydrogen-water", "Echo Ultimate", "drinking_water", 1.46, null, "1.46 mg/L", "H2A-240603-4", "2024-06-03", "gas chromatography, static headspace", null, `${SUP}14940528317844`, "on_sale", null],
    ["echo-flow", "echo-flow-hydrogen-water-machine", "Echo Flow", "drinking_water", 1.21, null, "1.21 mg/L", "H2A-240603-5", "2024-06-03", "gas chromatography, static headspace", null, `${SUP}15772811129236`, "on_sale", null],
    ["echo-pitcher", "echo-hydrogen-water-pitcher", "Echo Pitcher", "drinking_water", 1.40, 20, "1.03 mg/L after a 10-minute cycle; 1.40 mg/L after a 20-minute cycle", "H2A-240603-6", "2024-06-03", "gas chromatography, static headspace", null, `${SUP}15773178512660`, "not_listed", "Shopify product is a DRAFT (not on sale) as of 2026-11-05."],
    ["echo-revive", "echo-revive-hydrogen-bath-machine", "Echo Revive", "bath", null, null, "see report", "H2A24020801", "2024-02-08", "gas chromatography", "tap", `${SUP}35659776020372`, "on_sale", null],
    ["echo-refresh", "echo-refresh-hydrogen-inhalation-machine", "Echo Refresh", "inhaled_gas", null, null, "gas output; see report", "H2A24020802", "2024-02-08", "gas chromatography", null, `${SUP}35659850104724`, "on_sale", null],
    ["echo-prebiotic-sticks", "hydrogen-prebiotic-stick-pack-30-pack", "Echo Hydrogen Prebiotic Stick Packs", "drinking_water", 16.15, null, "16.15 mg/L measured in a sealed headspace vial (5 g in 350 mL); an open glass will hold far less", "H2AR-250930-1", "2025-09-30", "headspace gas chromatography", "distilled", `${SUP}36640861062548`, "on_sale", "Measured in a closed lab vial; say so wherever the figure appears."],
    ["echo-forty", "echo-forty-hydrogen-tumbler", "Echo Forty", "drinking_water", null, null, "pre-release target 4–6 ppm; not yet lab-tested", null, null, null, null, null, "in_development", "H2 Analytics tests once a product is on sale (Josh, 2026-11-05)."],
    ["echo-one", "echo-one-machine", "Echo One", "drinking_water", null, null, "pre-release target 2–4 ppm; not yet lab-tested", null, null, null, null, null, "in_development", "H2 Analytics tests once a product is on sale (Josh, 2026-11-05)."],
  ];
  for (const [slug, handle, name, route, ppm, minutes, summary, reportId, testDate, method, water, reportUrl, status, note] of seed) {
    await db.execute(sql`
      INSERT INTO products (slug, shopify_handle, name, delivery_route, certified_concentration_ppm, certified_at_minutes, measured_summary, lab, report_id, test_date, method, water_type, report_url, measurement_note, status)
      VALUES (${slug}, ${handle}, ${name}, ${route}, ${ppm}, ${minutes}, ${summary}, ${reportId ? H2A : null}, ${reportId}, ${testDate}, ${method}, ${water}, ${reportUrl}, ${note}, ${status})
      ON CONFLICT (slug) DO NOTHING
    `);
  }
  await db.execute(sql`
    INSERT INTO product_measurements (product_slug, minutes_after_cycle, cycle_minutes, concentration_mg_l, lab, report_id, test_date, note)
    SELECT * FROM (VALUES
      ('echo-flask', 0, 10, 6.07::numeric, ${H2A}, 'H2AR-250116-1', DATE '2025-01-16', 'end of cycle'),
      ('echo-flask', 0, 20, 8.25::numeric, ${H2A}, 'H2AR-250116-1', DATE '2025-01-16', 'end of cycle'),
      ('echo-pitcher', 0, 10, 1.03::numeric, ${H2A}, 'H2A-240603-6', DATE '2024-06-03', 'end of cycle'),
      ('echo-pitcher', 0, 20, 1.40::numeric, ${H2A}, 'H2A-240603-6', DATE '2024-06-03', 'end of cycle')
    ) AS v(product_slug, minutes_after_cycle, cycle_minutes, concentration_mg_l, lab, report_id, test_date, note)
    WHERE NOT EXISTS (SELECT 1 FROM product_measurements)
  `);
}
