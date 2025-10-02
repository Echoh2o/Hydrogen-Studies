/**
 * Database migration to add consumer-friendly categorization to studies
 */
import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Add the consumer_categories column to the studies table
 */
export async function addConsumerCategoriesColumn() {
  try {
    console.log(
      "Starting migration: Adding consumer_categories column to studies table...",
    );

    // Check if the column already exists
    const checkColumnExists = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'studies' AND column_name = 'consumer_categories'
    `);

    // If column doesn't exist, add it
    if (checkColumnExists.rows.length === 0) {
      console.log("Column consumer_categories does not exist, adding it...");

      await db.execute(sql`
        ALTER TABLE studies 
        ADD COLUMN consumer_categories TEXT
      `);

      console.log(
        "Successfully added consumer_categories column to studies table",
      );
      return true;
    } else {
      console.log(
        "Column consumer_categories already exists, skipping migration",
      );
      return false;
    }
  } catch (error) {
    console.error(
      "Error running migration to add consumer_categories column:",
      error,
    );
    throw error;
  }
}

// Export the migration for use in other files
export default { addConsumerCategoriesColumn };
