/**
 * Migration: audit-tracking fields (2026-08 audit batch).
 *
 * Additive and idempotent:
 *  - Adds PubMed / enrichment identifier + authorship columns and
 *    background-job tracking timestamps to `studies`.
 *  - Makes `blog_articles.study_id` nullable so content-factory articles
 *    can attach to no specific study.
 *  - Dedupes `monitor_results` by DOI and adds a partial UNIQUE index so
 *    the retraction/monitor pipeline can rely on DOI uniqueness.
 *
 * Every statement is guarded (ADD COLUMN IF NOT EXISTS / DROP NOT NULL /
 * CREATE UNIQUE INDEX IF NOT EXISTS) so re-running is safe. Failures are
 * logged and rethrown — migration errors are fatal at boot (see app.ts).
 */

// Use the no-timeout migration connection so the monitor_results dedupe and
// index build are not killed by the request pool's 30s statement_timeout.
import { migrationDb as db } from "../db";
import { sql } from "drizzle-orm";

export async function addAuditTrackingFields(): Promise<void> {
  console.log(
    "Starting migration: Adding audit-tracking fields (studies, blog_articles, monitor_results)",
  );

  try {
    // ── Studies: new nullable columns ──────────────────────────────────
    await db.execute(sql`ALTER TABLE studies ADD COLUMN IF NOT EXISTS pmid TEXT`);
    await db.execute(
      sql`ALTER TABLE studies ADD COLUMN IF NOT EXISTS first_author TEXT`,
    );
    await db.execute(
      sql`ALTER TABLE studies ADD COLUMN IF NOT EXISTS last_author TEXT`,
    );
    await db.execute(sql`ALTER TABLE studies ADD COLUMN IF NOT EXISTS license TEXT`);
    await db.execute(
      sql`ALTER TABLE studies ADD COLUMN IF NOT EXISTS h2_extraction_attempted_at TIMESTAMP`,
    );
    await db.execute(
      sql`ALTER TABLE studies ADD COLUMN IF NOT EXISTS enrichment_attempted_at TIMESTAMP`,
    );
    await db.execute(
      sql`ALTER TABLE studies ADD COLUMN IF NOT EXISTS image_backfill_failed_at TIMESTAMP`,
    );
    console.log("Ensured audit-tracking columns on studies");

    // ── blog_articles.study_id: allow NULL ─────────────────────────────
    await db.execute(
      sql`ALTER TABLE blog_articles ALTER COLUMN study_id DROP NOT NULL`,
    );
    console.log("Dropped NOT NULL on blog_articles.study_id");

    // ── monitor_results: dedupe by DOI, then enforce uniqueness ────────
    // Keep the lowest id for each DOI; NULL DOIs are left untouched.
    await db.execute(sql`
      DELETE FROM monitor_results a
      USING monitor_results b
      WHERE a.id > b.id
        AND a.doi = b.doi
        AND a.doi IS NOT NULL
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS monitor_results_doi_unique
      ON monitor_results (doi)
      WHERE doi IS NOT NULL
    `);
    console.log(
      "Deduped monitor_results by DOI and ensured monitor_results_doi_unique",
    );

    console.log("Audit-tracking fields migration completed successfully");
  } catch (error) {
    console.error("Error adding audit-tracking fields:", error);
    throw error;
  }
}
