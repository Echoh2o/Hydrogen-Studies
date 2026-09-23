/**
 * Migration 022: blog byline fields (CLAUDE.md — every indexable page shows
 * author or reviewer + a last-reviewed date).
 *
 * blog_articles columns used by the public byline:
 *   author_name    TEXT (new)      — named author; NULL renders
 *                                    "By Hydrogen Studies Editorial Team"
 *   reviewer_name  TEXT (new)      — named reviewer; NULL renders no
 *                                    "Reviewed by", no "Last reviewed" date and
 *                                    no schema reviewedBy (never invented)
 *   last_reviewed  TIMESTAMP (existing in prod; ensured here for fresh DBs)
 *
 * No new review-date column: prod already has last_reviewed (verified with
 * \d blog_articles). It is machine-stamped at generation time, so the byline
 * only shows it alongside a named reviewer (shared/seo-markup.ts blogByline).
 *
 * Additive + idempotent (ADD COLUMN IF NOT EXISTS), no backfill, no data
 * writes. Failures log and rethrow — migration errors are fatal at boot.
 */

// No-timeout migration connection so this can't be killed by the request
// pool's 30s statement_timeout (see server/db.ts).
import { migrationDb as db } from "../db";
import { sql } from "drizzle-orm";

export async function addBlogBylineFields(): Promise<void> {
  console.log("Starting migration: Adding byline fields to blog_articles");

  try {
    await db.execute(
      sql`ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS author_name TEXT`,
    );
    await db.execute(
      sql`ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS reviewer_name TEXT`,
    );
    await db.execute(
      sql`ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS last_reviewed TIMESTAMP`,
    );
    console.log("Blog byline fields migration completed successfully");
  } catch (error) {
    console.error("Error adding blog byline fields:", error);
    throw error;
  }
}
