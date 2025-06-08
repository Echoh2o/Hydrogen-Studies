/**
 * Database Performance Optimizer - Adds indexes and query optimizations
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

export async function optimizeDatabasePerformance(): Promise<void> {
  console.log('Optimizing database performance...');
  
  try {
    // Create essential indexes for fast queries
    const indexes = [
      {
        name: 'idx_studies_title_search',
        query: sql`CREATE INDEX IF NOT EXISTS idx_studies_title_search ON studies USING gin(to_tsvector('english', title))`
      },
      {
        name: 'idx_studies_abstract_search', 
        query: sql`CREATE INDEX IF NOT EXISTS idx_studies_abstract_search ON studies USING gin(to_tsvector('english', abstract))`
      },
      {
        name: 'idx_studies_keywords',
        query: sql`CREATE INDEX IF NOT EXISTS idx_studies_keywords ON studies (keywords)`
      },
      {
        name: 'idx_studies_consumer_categories',
        query: sql`CREATE INDEX IF NOT EXISTS idx_studies_consumer_categories ON studies USING gin(consumer_categories)`
      },
      {
        name: 'idx_studies_publish_date',
        query: sql`CREATE INDEX IF NOT EXISTS idx_studies_publish_date ON studies (journal_publish_date DESC NULLS LAST)`
      },
      {
        name: 'idx_studies_journal',
        query: sql`CREATE INDEX IF NOT EXISTS idx_studies_journal ON studies (journal)`
      },
      {
        name: 'idx_studies_authors',
        query: sql`CREATE INDEX IF NOT EXISTS idx_studies_authors ON studies (authors)`
      },
      {
        name: 'idx_studies_doi',
        query: sql`CREATE INDEX IF NOT EXISTS idx_studies_doi ON studies (doi)`
      }
    ];

    // Create indexes in parallel for faster setup
    await Promise.all(indexes.map(async (index) => {
      try {
        await db.execute(index.query);
        console.log(`✓ Created index: ${index.name}`);
      } catch (error) {
        console.log(`→ Index ${index.name} already exists or failed to create`);
      }
    }));

    // Update table statistics for better query planning
    await db.execute(sql`ANALYZE studies`);
    
    console.log('Database performance optimization completed');
    
  } catch (error) {
    console.error('Database optimization error:', error);
  }
}

// Fast health check query
export async function databaseHealthCheck(): Promise<any> {
  try {
    const start = Date.now();
    
    const [countResult, indexResult] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as total FROM studies`),
      db.execute(sql`
        SELECT schemaname, tablename, indexname 
        FROM pg_indexes 
        WHERE tablename = 'studies'
        ORDER BY indexname
      `)
    ]);

    const latency = Date.now() - start;
    
    return {
      status: 'healthy',
      latency: `${latency}ms`,
      studyCount: (countResult as any).rows[0]?.total || 0,
      indexes: (indexResult as any).rows?.length || 0,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      status: 'unhealthy',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    };
  }
}

// Query performance monitoring
export async function getQueryPerformance(): Promise<any> {
  try {
    const result = await db.execute(sql`
      SELECT 
        query,
        calls,
        total_time,
        mean_time,
        rows
      FROM pg_stat_statements 
      WHERE query LIKE '%studies%'
      ORDER BY total_time DESC
      LIMIT 10
    `);
    
    return (result as any).rows || [];
    
  } catch (error) {
    // pg_stat_statements may not be enabled
    return [];
  }
}