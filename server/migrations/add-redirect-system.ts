/**
 * Migration: Create redirects and not_found_log tables
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

export async function addRedirectSystem() {
  console.log("Starting migration: Creating redirect system tables");

  try {
    // Create redirects table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS redirects (
        id SERIAL PRIMARY KEY,
        from_path TEXT NOT NULL,
        to_path TEXT NOT NULL,
        status_code INTEGER NOT NULL DEFAULT 301,
        hit_count INTEGER NOT NULL DEFAULT 0,
        last_hit_at TIMESTAMP,
        is_active BOOLEAN NOT NULL DEFAULT true,
        note TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT redirects_from_path_uniq UNIQUE (from_path)
      )
    `);
    console.log("Created redirects table");

    // Create not_found_log table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS not_found_log (
        id SERIAL PRIMARY KEY,
        path TEXT NOT NULL,
        referrer TEXT,
        hit_count INTEGER NOT NULL DEFAULT 1,
        first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
        resolved BOOLEAN NOT NULL DEFAULT false,
        suggested_target TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT not_found_log_path_uniq UNIQUE (path)
      )
    `);
    console.log("Created not_found_log table");

    // Create indexes
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS not_found_log_hit_count_idx ON not_found_log (hit_count DESC)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS not_found_log_resolved_idx ON not_found_log (resolved)
    `);
    console.log("Created indexes");

    console.log("Redirect system migration completed successfully");
  } catch (error) {
    console.error("Error creating redirect system:", error);
    throw error;
  }
}
