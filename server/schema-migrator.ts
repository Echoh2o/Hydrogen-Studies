import { db } from './db';
import { sql } from 'drizzle-orm';
import { addJournalPublishDateField } from './migrations/add-journal-publish-date';

/**
 * Run database schema migrations to ensure the database structure
 * is in sync with our schema definitions
 */
export async function runMigrations() {
  try {
    console.log('Starting database migrations...');
    
    // Run specific migrations in order
    await addJournalPublishDateField();
    
    // Add any other migrations here in the future
    
    console.log('Database migrations completed successfully');
    return true;
  } catch (error) {
    console.error('Error running database migrations:', error);
    return false;
  }
}