/**
 * Migration: Create deleted_studies ledger table
 * Tracks studies that were intentionally deleted so they are not re-imported.
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

export async function addDeletedStudiesLedger() {
  console.log("Starting migration: Creating deleted_studies ledger table");

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS deleted_studies (
        id SERIAL PRIMARY KEY,
        original_study_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        doi TEXT,
        authors TEXT,
        journal TEXT,
        publish_year INTEGER,
        deleted_by TEXT,
        reason TEXT,
        deleted_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("Created deleted_studies table");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS deleted_studies_doi_idx ON deleted_studies (doi)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS deleted_studies_title_idx ON deleted_studies (title)
    `);
    console.log("Created indexes on deleted_studies");

    console.log("Deleted studies ledger migration completed successfully");
  } catch (error) {
    console.error("Error creating deleted_studies ledger:", error);
    throw error;
  }
}
