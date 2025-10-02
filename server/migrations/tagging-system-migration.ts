/**
 * Database Migration for Automated Tagging System
 * Creates tables for tags, tag categories, study-tag relationships, and synonyms
 */

import { db } from "../db";

export async function runTaggingSystemMigration(): Promise<void> {
  console.log("Running tagging system migration...");

  try {
    // Create tag_categories table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS tag_categories (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        color TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log("✓ Created tag_categories table");

    // Create tags table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        color TEXT,
        usage_count INTEGER DEFAULT 0,
        is_system_generated BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log("✓ Created tags table");

    // Create study_tags junction table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS study_tags (
        id SERIAL PRIMARY KEY,
        study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        confidence INTEGER DEFAULT 100,
        source TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(study_id, tag_id)
      );
    `);
    console.log("✓ Created study_tags table");

    // Create indexes for performance
    await db.execute(`
      CREATE INDEX IF NOT EXISTS study_tags_study_idx ON study_tags(study_id);
    `);
    await db.execute(`
      CREATE INDEX IF NOT EXISTS study_tags_tag_idx ON study_tags(tag_id);
    `);
    console.log("✓ Created indexes for study_tags");

    // Create tag_synonyms table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS tag_synonyms (
        id SERIAL PRIMARY KEY,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        synonym TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(tag_id, synonym)
      );
    `);
    console.log("✓ Created tag_synonyms table");

    console.log("Tagging system migration completed successfully");
  } catch (error) {
    console.error("Error running tagging system migration:", error);
    throw error;
  }
}
