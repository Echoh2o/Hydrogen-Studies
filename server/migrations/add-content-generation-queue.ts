/**
 * Migration: Create content_generation_queue table
 * Unified pipeline queue for post-import study enrichment.
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

export async function addContentGenerationQueue() {
  console.log("Starting migration: Creating content_generation_queue table");

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS content_generation_queue (
        id SERIAL PRIMARY KEY,
        study_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        current_step TEXT,
        completed_steps TEXT[] DEFAULT '{}',
        error_message TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        priority INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        started_at TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);
    console.log("Created content_generation_queue table");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS cgq_status_idx ON content_generation_queue (status)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS cgq_study_id_idx ON content_generation_queue (study_id)
    `);
    console.log("Created indexes on content_generation_queue");

    console.log("Content generation queue migration completed successfully");
  } catch (error) {
    console.error("Error creating content_generation_queue:", error);
    throw error;
  }
}
