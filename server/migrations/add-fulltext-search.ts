import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migration: Add PostgreSQL full-text search to the studies table.
 * Creates a tsvector column, GIN index, and auto-update trigger.
 */
export async function addFullTextSearch() {
  try {
    console.log("Starting migration: Adding full-text search to studies table");

    // Check if the search_vector column already exists
    const checkColumn = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'studies' AND column_name = 'search_vector';
    `);

    if (checkColumn.rows.length > 0) {
      console.log("search_vector column already exists, skipping migration");
      return;
    }

    // Add tsvector column
    await db.execute(sql`
      ALTER TABLE studies ADD COLUMN search_vector tsvector;
    `);
    console.log("Added search_vector column");

    // Populate the search_vector for all existing rows
    await db.execute(sql`
      UPDATE studies SET search_vector =
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(plain_language_title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(abstract, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(conclusion, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(authors, '')), 'D');
    `);
    console.log("Populated search_vector for existing studies");

    // Create GIN index for fast full-text search
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_studies_search_vector
      ON studies USING GIN(search_vector);
    `);
    console.log("Created GIN index on search_vector");

    // Create trigger function to auto-update search_vector on INSERT/UPDATE
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION studies_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(NEW.plain_language_title, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(NEW.abstract, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(NEW.conclusion, '')), 'C') ||
          setweight(to_tsvector('english', coalesce(NEW.authors, '')), 'D');
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;
    `);

    await db.execute(sql`
      DROP TRIGGER IF EXISTS studies_search_vector_trigger ON studies;
    `);

    await db.execute(sql`
      CREATE TRIGGER studies_search_vector_trigger
        BEFORE INSERT OR UPDATE OF title, plain_language_title, abstract, conclusion, authors
        ON studies
        FOR EACH ROW EXECUTE FUNCTION studies_search_vector_update();
    `);
    console.log("Created auto-update trigger for search_vector");

    console.log("Full-text search migration completed successfully");
  } catch (error) {
    console.error("Full-text search migration failed:", error);
    throw error;
  }
}
