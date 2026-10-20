/**
 * Migration 026: studies.study_design + studies.fields_extracted_at.
 *
 * study_design is the extracted research design (shared/research-vocab.ts
 * STUDY_DESIGNS) the MCP server uses to separate human trials from animal,
 * in-vitro and review evidence — the legacy study_type column holds the
 * species, and 525 rows sit in an unclassified "clinical" bucket.
 * fields_extracted_at stamps scripts/research/backfill-study-fields.ts runs so
 * re-runs resume instead of re-paying for done rows.
 *
 * Additive and idempotent (IF NOT EXISTS); failures rethrow — migration errors
 * are fatal at boot.
 */
import { migrationDb as db } from "../db";
import { sql } from "drizzle-orm";

export async function addStudyDesignFields(): Promise<void> {
  console.log("Starting migration: studies.study_design / fields_extracted_at");
  try {
    await db.execute(sql`ALTER TABLE studies ADD COLUMN IF NOT EXISTS study_design VARCHAR(40)`);
    await db.execute(sql`ALTER TABLE studies ADD COLUMN IF NOT EXISTS fields_extracted_at TIMESTAMP`);
    console.log("Study design fields migration completed");
  } catch (error) {
    console.error("Error adding studies.study_design / fields_extracted_at:", error);
    throw error;
  }
}
