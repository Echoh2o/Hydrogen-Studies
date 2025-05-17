import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Migration script to add the journal_publish_date column to the studies table
 */
export async function addJournalPublishDateField() {
  try {
    console.log('Starting migration: Adding journal_publish_date field to studies table');
    
    // Check if the column already exists
    const checkColumnQuery = sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'studies' 
      AND column_name = 'journal_publish_date';
    `;
    
    const result = await db.execute(checkColumnQuery);
    
    if (result.rows.length === 0) {
      // Column doesn't exist, add it
      const alterTableQuery = sql`
        ALTER TABLE studies
        ADD COLUMN journal_publish_date TEXT;
      `;
      
      await db.execute(alterTableQuery);
      console.log('Successfully added journal_publish_date column to studies table');
      
      // Initially set journal_publish_date equal to publish_date for existing records
      const updateQuery = sql`
        UPDATE studies
        SET journal_publish_date = publish_date
        WHERE journal_publish_date IS NULL;
      `;
      
      await db.execute(updateQuery);
      console.log('Successfully initialized journal_publish_date with publish_date values');
      
      return true;
    } else {
      console.log('journal_publish_date column already exists, skipping migration');
      return false;
    }
  } catch (error) {
    console.error('Error in migration:', error);
    throw error;
  }
}