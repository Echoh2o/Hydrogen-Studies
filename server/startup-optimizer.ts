/**
 * Startup Optimizer - Eliminate redundant migrations and speed up application boot
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import fs from 'fs/promises';
import path from 'path';

// Track migration status to prevent redundant runs
class MigrationTracker {
  private static statusFile = '.migration-status.json';
  private static status: any = {};

  static async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.statusFile, 'utf8');
      this.status = JSON.parse(data);
    } catch {
      this.status = {};
    }
  }

  static async save(): Promise<void> {
    await fs.writeFile(this.statusFile, JSON.stringify(this.status, null, 2));
  }

  static isCompleted(migrationName: string): boolean {
    return this.status[migrationName] === true;
  }

  static markCompleted(migrationName: string): void {
    this.status[migrationName] = true;
  }

  static async checkDatabaseSchema(): Promise<boolean> {
    try {
      // Quick check if main tables exist with expected columns
      const tableCheck = await db.execute(sql`
        SELECT table_name, column_name 
        FROM information_schema.columns 
        WHERE table_name IN ('studies', 'benefits', 'demographics') 
        AND column_name IN ('consumer_categories', 'journal_publish_date', 'images')
        ORDER BY table_name, column_name
      `);

      const expectedColumns = [
        'studies.consumer_categories',
        'studies.journal_publish_date', 
        'studies.images'
      ];

      const existingColumns = tableCheck.rows.map(row => 
        `${row.table_name}.${row.column_name}`
      );

      return expectedColumns.every(col => existingColumns.includes(col));
    } catch {
      return false;
    }
  }
}

// Optimized startup sequence
export async function optimizedStartup(): Promise<void> {
  console.log('Starting optimized application startup...');
  const startTime = Date.now();

  await MigrationTracker.load();

  // Skip migrations if database schema is already complete
  const schemaComplete = await MigrationTracker.checkDatabaseSchema();
  
  if (schemaComplete && MigrationTracker.isCompleted('full-migration-cycle')) {
    console.log('Database schema complete, skipping migrations');
  } else {
    console.log('Running essential migrations only...');
    await runEssentialMigrations();
    MigrationTracker.markCompleted('full-migration-cycle');
    await MigrationTracker.save();
  }

  // Initialize category counts only if needed
  if (!MigrationTracker.isCompleted('category-counts-initialized')) {
    console.log('Initializing category counts...');
    await updateCategoryCountsOptimized();
    MigrationTracker.markCompleted('category-counts-initialized');
    await MigrationTracker.save();
  }

  const duration = Date.now() - startTime;
  console.log(`Optimized startup completed in ${duration}ms`);
}

async function runEssentialMigrations(): Promise<void> {
  try {
    // Only run migrations that haven't been completed
    const migrations = [
      {
        name: 'consumer_categories_column',
        query: sql`
          ALTER TABLE studies 
          ADD COLUMN IF NOT EXISTS consumer_categories jsonb DEFAULT '["General Wellness"]'::jsonb
        `
      },
      {
        name: 'journal_publish_date_column', 
        query: sql`
          ALTER TABLE studies 
          ADD COLUMN IF NOT EXISTS journal_publish_date date
        `
      },
      {
        name: 'images_column',
        query: sql`
          ALTER TABLE studies 
          ADD COLUMN IF NOT EXISTS images text[] DEFAULT ARRAY[]::text[]
        `
      },
      {
        name: 'research_data_fields',
        query: sql`
          ALTER TABLE studies 
          ADD COLUMN IF NOT EXISTS author_affiliations text,
          ADD COLUMN IF NOT EXISTS funding_sources text,
          ADD COLUMN IF NOT EXISTS statistical_methods text,
          ADD COLUMN IF NOT EXISTS ethical_approval text,
          ADD COLUMN IF NOT EXISTS full_text text
        `
      }
    ];

    for (const migration of migrations) {
      if (!MigrationTracker.isCompleted(migration.name)) {
        await db.execute(migration.query);
        MigrationTracker.markCompleted(migration.name);
        console.log(`✓ ${migration.name} migration completed`);
      }
    }

    // Ensure essential reference tables exist
    await ensureReferenceTables();

  } catch (error) {
    console.error('Essential migrations failed:', error);
    throw error;
  }
}

async function ensureReferenceTables(): Promise<void> {
  const tables = [
    {
      name: 'benefits',
      query: sql`
        CREATE TABLE IF NOT EXISTS benefits (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          description TEXT,
          category VARCHAR(100),
          study_count INTEGER DEFAULT 0
        )
      `
    },
    {
      name: 'demographics', 
      query: sql`
        CREATE TABLE IF NOT EXISTS demographics (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          description TEXT,
          study_count INTEGER DEFAULT 0
        )
      `
    }
  ];

  for (const table of tables) {
    if (!MigrationTracker.isCompleted(`table_${table.name}`)) {
      await db.execute(table.query);
      MigrationTracker.markCompleted(`table_${table.name}`);
    }
  }
}

async function updateCategoryCountsOptimized(): Promise<void> {
  try {
    // Use a single optimized query to update all category counts
    await db.execute(sql`
      WITH category_counts AS (
        SELECT 
          CASE 
            WHEN consumer_categories::text LIKE '%Heart Health%' THEN 4
            WHEN consumer_categories::text LIKE '%Brain Health%' THEN 5
            WHEN consumer_categories::text LIKE '%Energy%' THEN 8
            WHEN consumer_categories::text LIKE '%Anti-Aging%' THEN 9
            WHEN consumer_categories::text LIKE '%Athletic%' THEN 10
            WHEN consumer_categories::text LIKE '%Inflammation%' THEN 11
            WHEN consumer_categories::text LIKE '%Diabetes%' THEN 12
            ELSE 13
          END as category_id,
          COUNT(*) as study_count
        FROM studies 
        WHERE consumer_categories IS NOT NULL
        GROUP BY category_id
      )
      UPDATE benefits 
      SET study_count = category_counts.study_count
      FROM category_counts 
      WHERE benefits.id = category_counts.category_id
    `);

    console.log('Category counts updated with single optimized query');
  } catch (error) {
    console.error('Category count update failed:', error);
  }
}

// Fast health check for monitoring
export async function healthCheck(): Promise<any> {
  try {
    const start = Date.now();
    
    // Quick database connectivity test
    const dbResult = await db.execute(sql`SELECT 1 as status`);
    const dbLatency = Date.now() - start;

    // Quick study count
    const countResult = await db.execute(sql`SELECT COUNT(*) as total FROM studies`);
    const studyCount = parseInt(countResult.rows[0].total);

    return {
      status: 'healthy',
      database: {
        connected: true,
        latency: `${dbLatency}ms`,
        studyCount
      },
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}