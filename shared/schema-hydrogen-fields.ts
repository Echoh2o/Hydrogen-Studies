/**
 * Schema updates for hydrogen research database specific fields
 */
import { db } from "../server/db";

export async function addHydrogenResearchFields() {
  try {
    console.log("Adding hydrogen research specific fields to studies table...");
    
    // Add fields specific to the hydrogen research database
    await db.execute(`
      ALTER TABLE studies 
      ADD COLUMN IF NOT EXISTS first_author TEXT,
      ADD COLUMN IF NOT EXISTS other_authors TEXT,
      ADD COLUMN IF NOT EXISTS last_author TEXT,
      ADD COLUMN IF NOT EXISTS rank TEXT,
      ADD COLUMN IF NOT EXISTS primary_topic TEXT,
      ADD COLUMN IF NOT EXISTS secondary_topic TEXT,
      ADD COLUMN IF NOT EXISTS tertiary_topic TEXT,
      ADD COLUMN IF NOT EXISTS vehicle TEXT,
      ADD COLUMN IF NOT EXISTS ph TEXT,
      ADD COLUMN IF NOT EXISTS application TEXT,
      ADD COLUMN IF NOT EXISTS comparison TEXT,
      ADD COLUMN IF NOT EXISTS complement TEXT
    `);
    
    console.log("Successfully added hydrogen research database fields");
    return true;
  } catch (error) {
    console.error("Error adding hydrogen research fields:", error);
    throw error;
  }
}