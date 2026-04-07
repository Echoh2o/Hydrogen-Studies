/**
 * Migration: Create stored_images table with bytea column for database image storage.
 * This replaces filesystem/volume storage to enable zero-downtime deploys on Railway.
 */
import { pool } from "../db";
import { logger } from "../utils/logger";

export async function runStoredImagesMigration() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stored_images (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        data BYTEA NOT NULL,
        content_type TEXT NOT NULL DEFAULT 'image/png',
        size INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS stored_images_key_idx ON stored_images (key);
    `);
    logger.info("stored_images table ready", "Migration");
  } catch (err) {
    logger.error("stored_images migration failed", err, "Migration");
  }
}
