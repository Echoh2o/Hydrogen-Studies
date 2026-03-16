import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger";

/**
 * Migration: Create blog_generation_jobs table.
 * Uses CREATE TABLE IF NOT EXISTS — safe to run multiple times.
 */
export async function createBlogGenerationJobsTable() {
  try {
    logger.info("Starting blog_generation_jobs migration", "Migration");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS blog_generation_jobs (
        id SERIAL PRIMARY KEY,
        study_ids INTEGER[] NOT NULL,
        article_types TEXT[] NOT NULL,
        reading_level TEXT NOT NULL DEFAULT 'general',
        include_images BOOLEAN DEFAULT TRUE,
        include_seo BOOLEAN DEFAULT TRUE,
        status TEXT NOT NULL DEFAULT 'pending',
        total_items INTEGER NOT NULL DEFAULT 0,
        completed_items INTEGER NOT NULL DEFAULT 0,
        failed_items INTEGER NOT NULL DEFAULT 0,
        saved_items INTEGER NOT NULL DEFAULT 0,
        current_study_index INTEGER NOT NULL DEFAULT 0,
        current_type_index INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        errors TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS blog_gen_jobs_status_idx ON blog_generation_jobs(status);`);

    logger.info("Created blog_generation_jobs table", "Migration");
  } catch (err: any) {
    logger.error("blog_generation_jobs migration failed", err, "Migration");
    throw err;
  }
}
