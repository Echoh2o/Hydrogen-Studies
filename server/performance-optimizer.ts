/**
 * Performance Optimizer - Comprehensive performance enhancements
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

// Performance cache with TTL
class PerformanceCache {
  private cache = new Map<string, { data: any; expires: number }>();
  private readonly ttl: number;

  constructor(ttlMinutes = 10) {
    this.ttl = ttlMinutes * 60 * 1000;
    
    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + this.ttl
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; hitRate?: number } {
    return { size: this.cache.size };
  }
}

// Global cache instance
export const cache = new PerformanceCache(15);

// Database connection pool with optimization
class DatabasePool {
  private connectionCount = 0;
  private maxConnections = 10;

  async executeWithRetry<T>(
    query: any,
    maxRetries = 3,
    delay = 1000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await db.execute(query);
      } catch (error: any) {
        if (attempt === maxRetries) throw error;
        
        // Exponential backoff for connection issues
        if (error.message?.includes('connection') || error.message?.includes('timeout')) {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
        } else {
          throw error; // Don't retry non-connection errors
        }
      }
    }
    throw new Error('Max retries exceeded');
  }
}

export const dbPool = new DatabasePool();

// Query optimization utilities
export function getCacheKey(endpoint: string, params?: any): string {
  if (!params) return endpoint;
  
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  return `${endpoint}?${sortedParams}`;
}

// Optimized search with pagination and caching
export async function optimizedSearch(
  query: string,
  filters: any = {},
  page = 1,
  pageSize = 20
): Promise<any> {
  const cacheKey = getCacheKey('/api/search', { query, filters, page, pageSize });
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const offset = (page - 1) * pageSize;
  
  // Build optimized query with indexes
  let whereClause = `WHERE 1=1`;
  const params: any[] = [];
  let paramIndex = 1;

  if (query) {
    whereClause += ` AND (
      title ILIKE $${paramIndex} OR 
      abstract ILIKE $${paramIndex + 1} OR
      keywords ILIKE $${paramIndex + 2}
    )`;
    const searchTerm = `%${query}%`;
    params.push(searchTerm, searchTerm, searchTerm);
    paramIndex += 3;
  }

  if (filters.condition) {
    whereClause += ` AND consumer_categories::text ILIKE $${paramIndex}`;
    params.push(`%${filters.condition}%`);
    paramIndex++;
  }

  if (filters.year) {
    whereClause += ` AND EXTRACT(YEAR FROM journal_publish_date) = $${paramIndex}`;
    params.push(filters.year);
    paramIndex++;
  }

  // Count query with same filters
  const countQuery = `SELECT COUNT(*) as total FROM studies ${whereClause}`;
  const searchQuery = `
    SELECT id, title, abstract, authors, journal, journal_publish_date, 
           doi, keywords, consumer_categories, images
    FROM studies 
    ${whereClause}
    ORDER BY journal_publish_date DESC NULLS LAST
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  try {
    const [countResult, studiesResult] = await Promise.all([
      dbPool.executeWithRetry(sql.raw(countQuery, params)),
      dbPool.executeWithRetry(sql.raw(searchQuery, [...params, pageSize, offset]))
    ]);

    const total = parseInt(countResult.rows[0].total);
    const studies = studiesResult.rows;

    const result = {
      data: studies,
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize)
    };

    // Cache for 10 minutes
    cache.set(cacheKey, result);
    return result;

  } catch (error) {
    console.error('Search optimization error:', error);
    throw error;
  }
}

// Optimized category counts with caching
export async function getOptimizedCategoryCounts(): Promise<any> {
  const cacheKey = 'category-counts';
  
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const result = await dbPool.executeWithRetry(sql`
      SELECT 
        CASE 
          WHEN consumer_categories::text LIKE '%Heart Health%' THEN 'Heart Health'
          WHEN consumer_categories::text LIKE '%Brain Health%' THEN 'Brain Health'
          WHEN consumer_categories::text LIKE '%Energy%' THEN 'Energy & Metabolism'
          WHEN consumer_categories::text LIKE '%Anti-Aging%' THEN 'Anti-Aging'
          WHEN consumer_categories::text LIKE '%Athletic%' THEN 'Athletic Performance'
          WHEN consumer_categories::text LIKE '%Inflammation%' THEN 'Inflammation'
          WHEN consumer_categories::text LIKE '%Diabetes%' THEN 'Diabetes'
          ELSE 'General Wellness'
        END as category,
        COUNT(*) as count
      FROM studies 
      WHERE consumer_categories IS NOT NULL
      GROUP BY 
        CASE 
          WHEN consumer_categories::text LIKE '%Heart Health%' THEN 'Heart Health'
          WHEN consumer_categories::text LIKE '%Brain Health%' THEN 'Brain Health'
          WHEN consumer_categories::text LIKE '%Energy%' THEN 'Energy & Metabolism'
          WHEN consumer_categories::text LIKE '%Anti-Aging%' THEN 'Anti-Aging'
          WHEN consumer_categories::text LIKE '%Athletic%' THEN 'Athletic Performance'
          WHEN consumer_categories::text LIKE '%Inflammation%' THEN 'Inflammation'
          WHEN consumer_categories::text LIKE '%Diabetes%' THEN 'Diabetes'
          ELSE 'General Wellness'
        END
      ORDER BY count DESC
    `);

    const counts = result.rows;
    
    // Cache for 30 minutes
    cache.set(cacheKey, counts);
    return counts;

  } catch (error) {
    console.error('Category counts optimization error:', error);
    throw error;
  }
}

// Batch processing utility
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize = 10,
  delayMs = 100
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(item => processor(item))
    );
    
    results.push(...batchResults);
    
    // Small delay between batches to prevent overwhelming
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}

// Memory monitoring
export function getMemoryUsage(): any {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024) + ' MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB',
    external: Math.round(usage.external / 1024 / 1024) + ' MB',
    cacheSize: cache.getStats().size
  };
}

// Initialize performance monitoring
export function initializePerformanceMonitoring(): void {
  // Log memory usage every 10 minutes
  setInterval(() => {
    const memory = getMemoryUsage();
    console.log('Performance Monitor:', memory);
  }, 10 * 60 * 1000);

  console.log('Performance optimizer initialized');
}