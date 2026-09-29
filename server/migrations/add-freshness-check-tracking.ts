/**
 * Migration 025: studies.freshness_checked_at — the rotation marker for the
 * weekly CrossRef metadata-freshness job (job-scheduler runMetadataFreshnessJob).
 *
 * The job used to rotate its 100-study batch by touching `last_modified`, but
 * only on success: a DOI CrossRef doesn't index (404 — e.g. CNKI/Wanfang
 * DOIs, junk values) never rotated, so the same ~100 failing studies were
 * re-fetched every run and the rest of the catalog was never checked. And
 * touching `last_modified` without a change made sitemap <lastmod> claim an
 * edit that never happened. This column is stamped on every attempt instead.
 *
 * Idempotent (IF NOT EXISTS); failures rethrow — migration errors are fatal
 * at boot.
 */
import { migrationDb as db } from "../db";
import { sql } from "drizzle-orm";

export async function addFreshnessCheckTracking(): Promise<void> {
  console.log("Starting migration: studies.freshness_checked_at");
  try {
    await db.execute(sql`ALTER TABLE studies ADD COLUMN IF NOT EXISTS freshness_checked_at TIMESTAMP`);
    console.log("Freshness check tracking migration completed");
  } catch (error) {
    console.error("Error adding studies.freshness_checked_at:", error);
    throw error;
  }
}
