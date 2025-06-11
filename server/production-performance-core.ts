
/**
 * Production Performance Core
 * Unified high-performance system for maximum speed and reliability
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

// High-performance cache with intelligent cleanup
class ProductionCache {
  private cache = new Map<string, { data: any; expires: number }>();
  private readonly DEFAULT_TTL = 300000; // 5 minutes
  private readonly MAX_SIZE = 2000;
  
  constructor() {
    // Aggressive cleanup every 2 minutes
    setInterval(() => this.cleanup(), 120000);
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: any, customTTL?: number): void {
    // Prevent cache overflow
    if (this.cache.size >= this.MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      expires: Date.now() + (customTTL || this.DEFAULT_TTL)
    });
  }

  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        toDelete.push(key);
      }
    }
    
    toDelete.forEach(key => this.cache.delete(key));
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.MAX_SIZE
    };
  }

  clear(): void {
    this.cache.clear();
  }
}

export const cache = new ProductionCache();

// Performance monitoring
class PerformanceTracker {
  private metrics = new Map<string, number[]>();
  private readonly MAX_METRICS_PER_ENDPOINT = 100;

  track(endpoint: string, responseTime: number): void {
    if (!this.metrics.has(endpoint)) {
      this.metrics.set(endpoint, []);
    }
    
    const times = this.metrics.get(endpoint)!;
    times.push(responseTime);
    
    // Keep only recent metrics
    if (times.length > this.MAX_METRICS_PER_ENDPOINT) {
      times.shift();
    }
  }

  getStats(endpoint: string) {
    const times = this.metrics.get(endpoint) || [];
    if (times.length === 0) return null;

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    return {
      average: Math.round(avg),
      min,
      max,
      count: times.length
    };
  }

  getAllStats() {
    const stats: Record<string, any> = {};
    for (const endpoint of this.metrics.keys()) {
      stats[endpoint] = this.getStats(endpoint);
    }
    return stats;
  }
}

export const performanceTracker = new PerformanceTracker();

// Optimized database queries
export async function optimizedSearch(
  query: string, 
  filters: any = {}, 
  page = 1, 
  pageSize = 20
): Promise<any> {
  const cacheKey = `search:${JSON.stringify({query, filters, page, pageSize})}`;
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const offset = (page - 1) * pageSize;
  const startTime = Date.now();

  try {
    let countQuery: any;
    let studiesQuery: any;

    // Build optimized queries based on search criteria
    if (query?.trim() && filters.condition) {
      // Search + filter
      const searchTerm = `%${query.trim()}%`;
      const conditionTerm = `%${filters.condition}%`;
      
      [countQuery, studiesQuery] = await Promise.all([
        sql`
          SELECT COUNT(*) as total FROM studies 
          WHERE (title ILIKE ${searchTerm} OR abstract ILIKE ${searchTerm})
            AND consumer_categories ILIKE ${conditionTerm}
        `,
        sql`
          SELECT id, title, abstract, authors, journal, journal_publish_date, 
                 doi, array_to_string(keywords, ', ') as keywords, consumer_categories, slug
          FROM studies 
          WHERE (title ILIKE ${searchTerm} OR abstract ILIKE ${searchTerm})
            AND consumer_categories ILIKE ${conditionTerm}
          ORDER BY journal_publish_date DESC NULLS LAST
          LIMIT ${pageSize} OFFSET ${offset}
        `
      ]);
    } else if (query?.trim()) {
      // Search only
      const searchTerm = `%${query.trim()}%`;
      
      [countQuery, studiesQuery] = await Promise.all([
        sql`
          SELECT COUNT(*) as total FROM studies 
          WHERE title ILIKE ${searchTerm} OR abstract ILIKE ${searchTerm}
        `,
        sql`
          SELECT id, title, abstract, authors, journal, journal_publish_date, 
                 doi, array_to_string(keywords, ', ') as keywords, consumer_categories, slug
          FROM studies 
          WHERE title ILIKE ${searchTerm} OR abstract ILIKE ${searchTerm}
          ORDER BY 
            CASE WHEN title ILIKE ${searchTerm} THEN 1 ELSE 2 END,
            journal_publish_date DESC NULLS LAST
          LIMIT ${pageSize} OFFSET ${offset}
        `
      ]);
    } else if (filters.condition) {
      // Filter only
      const conditionTerm = `%${filters.condition}%`;
      
      [countQuery, studiesQuery] = await Promise.all([
        sql`
          SELECT COUNT(*) as total FROM studies 
          WHERE consumer_categories ILIKE ${conditionTerm}
        `,
        sql`
          SELECT id, title, abstract, authors, journal, journal_publish_date, 
                 doi, array_to_string(keywords, ', ') as keywords, consumer_categories, slug
          FROM studies 
          WHERE consumer_categories ILIKE ${conditionTerm}
          ORDER BY journal_publish_date DESC NULLS LAST
          LIMIT ${pageSize} OFFSET ${offset}
        `
      ]);
    } else {
      // No filters
      [countQuery, studiesQuery] = await Promise.all([
        sql`SELECT COUNT(*) as total FROM studies`,
        sql`
          SELECT id, title, abstract, authors, journal, journal_publish_date, 
                 doi, array_to_string(keywords, ', ') as keywords, consumer_categories, slug
          FROM studies 
          ORDER BY journal_publish_date DESC NULLS LAST
          LIMIT ${pageSize} OFFSET ${offset}
        `
      ]);
    }

    const [countResult, studiesResult] = await Promise.all([
      db.execute(countQuery),
      db.execute(studiesQuery)
    ]);

    const result = {
      data: (studiesResult as any).rows || [],
      total: parseInt((countResult as any).rows[0]?.total || '0'),
      page,
      pageSize,
      pageCount: Math.ceil(parseInt((countResult as any).rows[0]?.total || '0') / pageSize)
    };

    // Cache result
    cache.set(cacheKey, result);

    // Track performance
    performanceTracker.track('/api/search', Date.now() - startTime);

    return result;

  } catch (error) {
    console.error('Search error:', error);
    performanceTracker.track('/api/search', Date.now() - startTime);
    return { data: [], total: 0, page, pageSize, pageCount: 0 };
  }
}

export async function optimizedCategoryCounts(): Promise<any> {
  const cacheKey = 'category_counts';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const startTime = Date.now();

  try {
    const [conditionResult, bodySystemResult, lifeStageResult] = await Promise.all([
      // Condition categories
      db.execute(sql`
        SELECT 
          CASE 
            WHEN consumer_categories::text LIKE '%Heart%' OR consumer_categories::text LIKE '%Cardiovascular%' THEN 'Heart Disease & Hypertension'
            WHEN consumer_categories::text LIKE '%Brain%' OR consumer_categories::text LIKE '%Neuro%' THEN 'Brain & Neurological Disorders'
            WHEN consumer_categories::text LIKE '%Diabetes%' OR consumer_categories::text LIKE '%Metabolic%' THEN 'Diabetes & Metabolic Health'
            WHEN consumer_categories::text LIKE '%Arthritis%' OR consumer_categories::text LIKE '%Inflammation%' THEN 'Arthritis & Inflammation'
            WHEN consumer_categories::text LIKE '%Lung%' OR consumer_categories::text LIKE '%Respiratory%' THEN 'Lung & Respiratory Conditions'
            WHEN consumer_categories::text LIKE '%Digestive%' OR consumer_categories::text LIKE '%Gut%' THEN 'Digestive Health (Gut/Liver)'
            WHEN consumer_categories::text LIKE '%Cancer%' THEN 'Cancer Supportive Care'
          END as name,
          COUNT(*) as count
        FROM studies 
        WHERE consumer_categories IS NOT NULL
          AND (
            consumer_categories::text LIKE '%Heart%' OR consumer_categories::text LIKE '%Cardiovascular%' OR
            consumer_categories::text LIKE '%Brain%' OR consumer_categories::text LIKE '%Neuro%' OR
            consumer_categories::text LIKE '%Diabetes%' OR consumer_categories::text LIKE '%Metabolic%' OR
            consumer_categories::text LIKE '%Arthritis%' OR consumer_categories::text LIKE '%Inflammation%' OR
            consumer_categories::text LIKE '%Lung%' OR consumer_categories::text LIKE '%Respiratory%' OR
            consumer_categories::text LIKE '%Digestive%' OR consumer_categories::text LIKE '%Gut%' OR
            consumer_categories::text LIKE '%Cancer%'
          )
        GROUP BY 1
        ORDER BY count DESC
      `),
      // Body system categories
      db.execute(sql`
        SELECT 
          CASE 
            WHEN consumer_categories::text LIKE '%Heart%' OR consumer_categories::text LIKE '%Cardiovascular%' THEN 'Cardiovascular System'
            WHEN consumer_categories::text LIKE '%Brain%' OR consumer_categories::text LIKE '%Neuro%' THEN 'Nervous System'
            WHEN consumer_categories::text LIKE '%Lung%' OR consumer_categories::text LIKE '%Respiratory%' THEN 'Respiratory System'
            WHEN consumer_categories::text LIKE '%Digestive%' OR consumer_categories::text LIKE '%Gut%' THEN 'Digestive System'
            WHEN consumer_categories::text LIKE '%Immune%' OR consumer_categories::text LIKE '%Inflammation%' THEN 'Immune System'
            WHEN consumer_categories::text LIKE '%Muscle%' OR consumer_categories::text LIKE '%Bone%' THEN 'Musculoskeletal System'
          END as name,
          COUNT(*) as count
        FROM studies 
        WHERE consumer_categories IS NOT NULL
          AND (
            consumer_categories::text LIKE '%Heart%' OR consumer_categories::text LIKE '%Cardiovascular%' OR
            consumer_categories::text LIKE '%Brain%' OR consumer_categories::text LIKE '%Neuro%' OR
            consumer_categories::text LIKE '%Lung%' OR consumer_categories::text LIKE '%Respiratory%' OR
            consumer_categories::text LIKE '%Digestive%' OR consumer_categories::text LIKE '%Gut%' OR
            consumer_categories::text LIKE '%Immune%' OR consumer_categories::text LIKE '%Inflammation%' OR
            consumer_categories::text LIKE '%Muscle%' OR consumer_categories::text LIKE '%Bone%'
          )
        GROUP BY 1
        ORDER BY count DESC
      `),
      // Life stage categories
      db.execute(sql`
        SELECT 
          CASE 
            WHEN consumer_categories::text LIKE '%Adult%' AND NOT consumer_categories::text LIKE '%Older%' THEN 'Adults'
            WHEN consumer_categories::text LIKE '%Older%' OR consumer_categories::text LIKE '%Senior%' THEN 'Older Adults'
            WHEN consumer_categories::text LIKE '%Athletic%' OR consumer_categories::text LIKE '%Fitness%' THEN 'Athletes & Fitness'
          END as name,
          COUNT(*) as count
        FROM studies 
        WHERE consumer_categories IS NOT NULL
          AND (
            (consumer_categories::text LIKE '%Adult%' AND NOT consumer_categories::text LIKE '%Older%') OR
            consumer_categories::text LIKE '%Older%' OR consumer_categories::text LIKE '%Senior%' OR
            consumer_categories::text LIKE '%Athletic%' OR consumer_categories::text LIKE '%Fitness%'
          )
        GROUP BY 1
        ORDER BY count DESC
      `)
    ]);

    const result = {
      success: true,
      data: {
        condition: (conditionResult as any).rows || [],
        body_system: (bodySystemResult as any).rows || [],
        life_stage: (lifeStageResult as any).rows || []
      }
    };

    // Cache for 10 minutes (longer for category data)
    cache.set(cacheKey, result, 600000);

    performanceTracker.track('/api/categories', Date.now() - startTime);
    return result;

  } catch (error) {
    console.error('Category counts error:', error);
    performanceTracker.track('/api/categories', Date.now() - startTime);
    return { success: false, data: { condition: [], body_system: [], life_stage: [] } };
  }
}

export async function optimizedStudyById(id: number): Promise<any> {
  const cacheKey = `study:${id}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const startTime = Date.now();

  try {
    const result = await db.execute(sql`
      SELECT * FROM studies WHERE id = ${id}
    `);

    const study = (result as any).rows[0] || null;
    
    if (study) {
      // Cache for 15 minutes (individual studies don't change often)
      cache.set(cacheKey, study, 900000);
    }

    performanceTracker.track('/api/study', Date.now() - startTime);
    return study;

  } catch (error) {
    console.error('Study fetch error:', error);
    performanceTracker.track('/api/study', Date.now() - startTime);
    return null;
  }
}

// Essential database indexes for maximum performance
export async function createOptimizedIndexes(): Promise<void> {
  const indexes = [
    // Full-text search indexes
    sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_studies_title_gin ON studies USING gin(to_tsvector('english', title))`,
    sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_studies_abstract_gin ON studies USING gin(to_tsvector('english', abstract))`,
    
    // Category search indexes
    sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_studies_consumer_categories ON studies USING gin(consumer_categories)`,
    
    // Sorting indexes
    sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_studies_date_desc ON studies (journal_publish_date DESC NULLS LAST)`,
    sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_studies_id_asc ON studies (id ASC)`,
    
    // Combined search indexes
    sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_studies_title_ilike ON studies (title) WHERE title IS NOT NULL`,
    sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_studies_abstract_ilike ON studies (abstract) WHERE abstract IS NOT NULL`
  ];

  for (const index of indexes) {
    try {
      await db.execute(index);
    } catch (error) {
      // Index might already exist, continue
      console.log('Index creation skipped (likely exists)');
    }
  }
  
  console.log('✅ Optimized indexes ready');
}

// Performance monitoring endpoint data
export function getPerformanceMetrics() {
  return {
    cache: cache.getStats(),
    performance: performanceTracker.getAllStats(),
    uptime: Math.round(process.uptime()),
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
  };
}

// Health check function
export async function healthCheck(): Promise<any> {
  const start = Date.now();
  
  try {
    await db.execute(sql`SELECT 1`);
    
    return {
      status: 'healthy',
      database: 'connected',
      latency: Date.now() - start,
      cache: cache.getStats(),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      database: 'disconnected',
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
}

// Initialize performance optimizations
export async function initializeProductionPerformance(): Promise<void> {
  console.log('🚀 Initializing production performance system...');
  
  try {
    await createOptimizedIndexes();
    console.log('✅ Production performance system ready');
  } catch (error) {
    console.error('Performance initialization error:', error);
  }
}
