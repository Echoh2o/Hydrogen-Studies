/**
 * Migration to add authentic research data fields to studies table
 * These fields store real data from PubMed, Europe PMC, and CrossRef APIs
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

export async function addResearchDataFields() {
  console.log('Starting migration: Adding authentic research data fields to studies table');
  
  try {
    // Check if columns already exist before adding them
    const checkColumns = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'studies' 
      AND column_name IN ('author_affiliations', 'funding_sources', 'statistical_methods', 'ethical_approval', 'full_text')
    `);
    
    const existingColumns = checkColumns.rows?.map((row: any) => row.column_name) || [];
    
    // Add author_affiliations column if it doesn't exist
    if (!existingColumns.includes('author_affiliations')) {
      await db.execute(sql`
        ALTER TABLE studies 
        ADD COLUMN author_affiliations TEXT
      `);
      console.log('Added author_affiliations column');
    } else {
      console.log('author_affiliations column already exists, skipping');
    }
    
    // Add funding_sources column if it doesn't exist
    if (!existingColumns.includes('funding_sources')) {
      await db.execute(sql`
        ALTER TABLE studies 
        ADD COLUMN funding_sources TEXT
      `);
      console.log('Added funding_sources column');
    } else {
      console.log('funding_sources column already exists, skipping');
    }
    
    // Add statistical_methods column if it doesn't exist
    if (!existingColumns.includes('statistical_methods')) {
      await db.execute(sql`
        ALTER TABLE studies 
        ADD COLUMN statistical_methods TEXT
      `);
      console.log('Added statistical_methods column');
    } else {
      console.log('statistical_methods column already exists, skipping');
    }
    
    // Add ethical_approval column if it doesn't exist
    if (!existingColumns.includes('ethical_approval')) {
      await db.execute(sql`
        ALTER TABLE studies 
        ADD COLUMN ethical_approval TEXT
      `);
      console.log('Added ethical_approval column');
    } else {
      console.log('ethical_approval column already exists, skipping');
    }
    
    // Add full_text column if it doesn't exist
    if (!existingColumns.includes('full_text')) {
      await db.execute(sql`
        ALTER TABLE studies 
        ADD COLUMN full_text TEXT
      `);
      console.log('Added full_text column');
    } else {
      console.log('full_text column already exists, skipping');
    }
    
    console.log('Authentic research data fields migration completed successfully');
    return true;
    
  } catch (error) {
    console.error('Error adding authentic research data fields:', error);
    throw error;
  }
}