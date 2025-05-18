import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Add support for multiple images per study
 */
export async function runMigration() {
  console.log("Starting migration: Adding multiple images support to studies table");
  
  try {
    // Check if the images column already exists
    const checkImagesColumn = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'studies' AND column_name = 'images'
    `);
    
    if (checkImagesColumn.rows.length === 0) {
      // Add the images column as a text array if it doesn't exist
      await db.execute(sql`
        ALTER TABLE studies 
        ADD COLUMN images TEXT[]
      `);
      console.log("Added images column to studies table");
    } else {
      console.log("images column already exists, skipping");
    }
    
    // Check if the image_captions column already exists
    const checkCaptionsColumn = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'studies' AND column_name = 'image_captions'
    `);
    
    if (checkCaptionsColumn.rows.length === 0) {
      // Add the image_captions column as a text array if it doesn't exist
      await db.execute(sql`
        ALTER TABLE studies 
        ADD COLUMN image_captions TEXT[]
      `);
      console.log("Added image_captions column to studies table");
    } else {
      console.log("image_captions column already exists, skipping");
    }

    console.log("Multiple images migration completed successfully");
    return true;
  } catch (error) {
    console.error("Error during multiple images migration:", error);
    return false;
  }
}