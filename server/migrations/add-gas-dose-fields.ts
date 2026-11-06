import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migration 034 — evidence for the bath (Echo Revive) and inhalation (Echo
 * Refresh) devices.
 *
 * Studies: the inhaled-gas dose. Inhalation papers report either an H2 flow
 * (mL/min), or a percentage of H2 plus a total gas flow (H2 flow = % × flow),
 * or only a percentage in a closed mask (not comparable with a flow-rated
 * device → no flow). Hyperbaric/diving studies are flagged and never matched.
 *
 * Products: the H2 Analytics figures from the two published reports.
 *  - Revive, H2A24020801 (2024-02-08): tub water 2.22 mg/L after 60 min in
 *    warm tap water (1.02 / 1.60 / 1.87 at 15 / 30 / 45 min; cold 2.48 at 60).
 *  - Refresh, H2A24020802 (2024-02-08): H2 flow 590 / 930 / 1,280 mL/min on the
 *    900 / 1,350 / 1,800 settings; electrolysis gas, ~2 parts H2 : 1 part O2.
 * Seeds only fill empty values, so later edits are never overwritten. Idempotent.
 */
export async function addGasDoseFields(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE studies
      ADD COLUMN IF NOT EXISTS h2_flow_ml_min NUMERIC,
      ADD COLUMN IF NOT EXISTS h2_flow_kind TEXT,
      ADD COLUMN IF NOT EXISTS h2_gas_percent NUMERIC,
      ADD COLUMN IF NOT EXISTS gas_total_flow_l_min NUMERIC,
      ADD COLUMN IF NOT EXISTS h2_gas_raw TEXT,
      ADD COLUMN IF NOT EXISTS hyperbaric BOOLEAN
  `);
  await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS certified_h2_flow_ml_min NUMERIC`);
  await db.execute(sql`
    UPDATE products SET
      certified_concentration_ppm = 2.22,
      certified_at_minutes = 60,
      measured_summary = 'tub water reached 1.02 mg/L at 15 minutes, 1.60 at 30, 1.87 at 45 and 2.22 mg/L at 60 minutes in warm tap water (starting at 44 °C); in cold water it reached 2.48 mg/L at 60 minutes',
      measurement_note = 'Hydrogen dissolved in the bath water, measured by gas chromatography while the machine ran into a standard tub.'
    WHERE slug = 'echo-revive' AND certified_concentration_ppm IS NULL
  `);
  await db.execute(sql`
    UPDATE products SET
      certified_h2_flow_ml_min = 1280,
      measured_summary = 'hydrogen flow of 590 mL/min on the 900 setting, 930 mL/min on the 1,350 setting and 1,280 mL/min on the 1,800 setting; the machine makes hydrogen and oxygen together by electrolysis, about 2 parts hydrogen to 1 part oxygen',
      measurement_note = 'Hydrogen gas flow measured with a mass flow meter at the combined output. The lab did not measure the hydrogen percentage a person breathes in.'
    WHERE slug = 'echo-refresh' AND certified_h2_flow_ml_min IS NULL
  `);
}
