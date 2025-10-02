import { pool } from "./db";

/**
 * Update schema with the new tables and columns needed for multiple platform scraping
 */
export async function updateSchema() {
  const client = await pool.connect();

  try {
    // Start transaction
    await client.query("BEGIN");

    console.log("Applying schema updates for scraper functionality...");

    // Add new columns to studies table if they don't exist
    const checkColumnsResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'studies' 
      AND column_name IN ('source_url', 'source_platform')
    `);

    const existingColumns = checkColumnsResult.rows.map(
      (row) => row.column_name,
    );

    if (!existingColumns.includes("source_url")) {
      console.log("Adding source_url column to studies table...");
      await client.query(`
        ALTER TABLE studies 
        ADD COLUMN source_url TEXT
      `);
    }

    if (!existingColumns.includes("source_platform")) {
      console.log("Adding source_platform column to studies table...");
      await client.query(`
        ALTER TABLE studies 
        ADD COLUMN source_platform TEXT
      `);
    }

    // Create scraped_sources table if it doesn't exist
    const checkTableResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'scraped_sources'
      ) as exists
    `);

    if (!checkTableResult.rows[0].exists) {
      console.log("Creating scraped_sources table...");
      await client.query(`
        CREATE TABLE scraped_sources (
          id SERIAL PRIMARY KEY,
          source_url TEXT NOT NULL,
          source_platform TEXT NOT NULL,
          study_id INTEGER NOT NULL REFERENCES studies(id),
          scraped_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // Commit transaction
    await client.query("COMMIT");
    console.log("Schema updates applied successfully");

    return { success: true, message: "Schema updated successfully" };
  } catch (error) {
    // Rollback in case of error
    await client.query("ROLLBACK");
    console.error("Error updating schema:", error);
    throw error;
  } finally {
    client.release();
  }
}
