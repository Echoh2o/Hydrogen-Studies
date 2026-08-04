import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Adds studies.last_retraction_check_at so the retraction monitor can rotate
 * its daily batch through the entire catalog (ORDER BY ... ASC NULLS FIRST)
 * and stamp each study after checking, instead of re-checking the same ~50
 * rows every run while the rest are never screened.
 *
 * Idempotent: checks information_schema before altering.
 */
export async function addRetractionCheckTracking() {
  const existing = await db.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'studies'
      AND column_name = 'last_retraction_check_at';
  `);

  if ((existing.rows?.length ?? 0) > 0) {
    console.log("last_retraction_check_at already exists, skipping");
    return;
  }

  await db.execute(sql`
    ALTER TABLE studies
    ADD COLUMN last_retraction_check_at TIMESTAMP;
  `);
  console.log("Added studies.last_retraction_check_at");
}
