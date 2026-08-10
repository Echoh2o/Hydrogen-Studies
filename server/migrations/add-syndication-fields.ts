/**
 * Migration: Shopify-blog syndication tracking (all-in-on-echowater).
 *
 * Adds nullable columns to blog_articles recording where/when an article was
 * syndicated into echowater.com's native Shopify blog. Additive + idempotent
 * (ADD COLUMN IF NOT EXISTS); failures log and rethrow — migration errors are
 * fatal at boot (see app.ts).
 */

// No-timeout migration connection so this can't be killed by the request
// pool's 30s statement_timeout (see server/db.ts).
import { migrationDb as db } from "../db";
import { sql } from "drizzle-orm";

export async function addSyndicationFields(): Promise<void> {
  console.log("Starting migration: Adding syndication fields to blog_articles");

  try {
    await db.execute(
      sql`ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS syndicated_url TEXT`,
    );
    await db.execute(
      sql`ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS syndicated_at TIMESTAMP`,
    );
    console.log("Syndication fields migration completed successfully");
  } catch (error) {
    console.error("Error adding syndication fields:", error);
    throw error;
  }
}
