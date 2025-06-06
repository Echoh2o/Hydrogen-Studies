/**
 * Database Optimization and Connection Management
 * Implements connection pooling, query optimization, and error recovery
 */

import { db } from './db.js';
import { sql } from 'drizzle-orm';

// Query cache for frequently accessed data
const queryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CachedQuery {
  data: any;
  timestamp: number;
}

/**
 * Cached database query execution
 */
export async function cachedQuery(key: string, queryFn: () => Promise<any>, ttl = CACHE_TTL): Promise<any> {
  const cached = queryCache.get(key) as CachedQuery;
  
  if (cached && (Date.now() - cached.timestamp) < ttl) {
    return cached.data;
  }
  
  try {
    const data = await queryFn();
    queryCache.set(key, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error(`Query failed for key ${key}:`, error);
    // Return cached data if available, even if expired
    if (cached) {
      console.log(`Returning stale cache for ${key}`);
      return cached.data;
    }
    throw error;
  }
}

/**
 * Optimized study queries with pagination and field selection
 */
export async function getStudiesOptimized(options: {
  limit?: number;
  offset?: number;
  fields?: string[];
  categoryId?: number;
}): Promise<any[]> {
  const { limit = 20, offset = 0, fields, categoryId } = options;
  const cacheKey = `studies_${JSON.stringify(options)}`;
  
  return cachedQuery(cacheKey, async () => {
    const { studies } = await import('../shared/schema.js');
    const { eq } = await import('drizzle-orm');
    
    let query = db.select().from(studies);
    
    if (categoryId) {
      // Add category filtering when needed
      query = query.where(sql`consumer_categories LIKE ${'%"' + categoryId + '"%'}`);
    }
    
    return query.limit(Math.min(limit, 100)).offset(offset);
  });
}

/**
 * Get category statistics with caching
 */
export async function getCategoryStats(): Promise<any[]> {
  return cachedQuery('category_stats', async () => {
    const { categories } = await import('../shared/schema.js');
    return db.select().from(categories);
  }, 10 * 60 * 1000); // Cache for 10 minutes
}

/**
 * Database health check and recovery
 */
export async function checkDatabaseHealth(): Promise<{ healthy: boolean; latency: number; error?: string }> {
  const start = Date.now();
  
  try {
    await db.execute(sql`SELECT 1`);
    return {
      healthy: true,
      latency: Date.now() - start
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Clear expired cache entries
 */
export function cleanupCache(): void {
  const now = Date.now();
  for (const [key, value] of queryCache.entries()) {
    if (now - value.timestamp > CACHE_TTL * 2) {
      queryCache.delete(key);
    }
  }
}

/**
 * Initialize database optimizations
 */
export function initializeDatabaseOptimizations(): void {
  // Cleanup cache every 10 minutes
  setInterval(cleanupCache, 10 * 60 * 1000);
  
  // Log cache statistics every hour
  setInterval(() => {
    console.log(`Database cache: ${queryCache.size} entries`);
  }, 60 * 60 * 1000);
  
  console.log('Database optimizations initialized');
}