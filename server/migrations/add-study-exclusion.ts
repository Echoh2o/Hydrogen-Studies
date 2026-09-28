/**
 * Migration 023: study exclusion flag (off-topic hydrogen-ENERGY studies).
 *
 * studies columns:
 *   is_excluded     BOOLEAN NOT NULL DEFAULT false — true = never shown on any
 *                   public surface (listings, search, hubs, sitemap, related,
 *                   bot SSR); its URLs answer 410 Gone
 *                   (server/services/excluded-studies.ts).
 *   excluded_reason TEXT      — why (e.g. classifier verdict + approval quote)
 *   excluded_at     TIMESTAMP — when it was excluded
 *
 * The row is KEPT (not deleted) so the DOI/title dedupe in the discovery
 * pipeline keeps treating it as "already known" and never re-imports it.
 *
 * Partial index on the excluded rows only: the 410 guard loads that small set
 * into memory; public queries filter `is_excluded = false`, which matches ~all
 * rows, so they don't need an index.
 *
 * No data writes — flagging is done by scripts/content/exclude-energy-studies.ts
 * after Josh approves the exact id list (CLAUDE.md: 410s are content-destructive).
 * Dedupe-first is moot (no unique constraint). ADD COLUMN ... DEFAULT false is
 * metadata-only on PG ≥ 11. Idempotent (IF NOT EXISTS); failures rethrow —
 * migration errors are fatal at boot.
 */
import { migrationDb as db } from "../db";
import { sql } from "drizzle-orm";

export async function addStudyExclusion(): Promise<void> {
  console.log("Starting migration: Adding exclusion flag to studies");

  try {
    await db.execute(
      sql`ALTER TABLE studies ADD COLUMN IF NOT EXISTS is_excluded BOOLEAN NOT NULL DEFAULT false`,
    );
    await db.execute(sql`ALTER TABLE studies ADD COLUMN IF NOT EXISTS excluded_reason TEXT`);
    await db.execute(sql`ALTER TABLE studies ADD COLUMN IF NOT EXISTS excluded_at TIMESTAMP`);
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS studies_is_excluded_idx ON studies (id) WHERE is_excluded = true`,
    );
    console.log("Study exclusion migration completed successfully");
  } catch (error) {
    console.error("Error adding study exclusion columns:", error);
    throw error;
  }
}
