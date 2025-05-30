/**
 * Memory Cache & API Response Optimizer
 * 
 * Implements intelligent caching and response optimization for improved performance
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

interface CacheConfig {
  maxSize: number;
  ttl: number; // Time to live in milliseconds
}

interface CachedItem<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

class MemoryCache<T> {
  private cache = new Map<string, CachedItem<T>>();
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
    
    // Clean expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  set(key: string, data: T): void {
    if (this.cache.size >= this.config.maxSize) {
      this.evictLeastUsed();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now()
    });
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    // Check if expired
    if (Date.now() - item.timestamp > this.config.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update access tracking
    item.accessCount++;
    item.lastAccessed = Date.now();
    
    return item.data;
  }

  private evictLeastUsed(): void {
    let leastUsedKey = '';
    let leastUsedCount = Infinity;
    let oldestAccess = Date.now();

    for (const [key, item] of this.cache) {
      if (item.accessCount < leastUsedCount || 
          (item.accessCount === leastUsedCount && item.lastAccessed < oldestAccess)) {
        leastUsedKey = key;
        leastUsedCount = item.accessCount;
        oldestAccess = item.lastAccessed;
      }
    }

    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.cache.forEach((item, key) => {
      if (now - item.timestamp > this.config.ttl) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      totalItems: this.cache.size
    };
  }
}

// Cache instances for different data types
const studyCache = new MemoryCache<any>({ maxSize: 1000, ttl: 10 * 60 * 1000 }); // 10 minutes
const searchCache = new MemoryCache<any[]>({ maxSize: 500, ttl: 5 * 60 * 1000 }); // 5 minutes
const categoryCache = new MemoryCache<any[]>({ maxSize: 50, ttl: 30 * 60 * 1000 }); // 30 minutes
const statsCache = new MemoryCache<any>({ maxSize: 20, ttl: 15 * 60 * 1000 }); // 15 minutes

/**
 * Optimized study retrieval with caching
 */
export async function getStudyOptimized(studyId: number) {
  const cacheKey = `study:${studyId}`;
  let study = studyCache.get(cacheKey);
  
  if (study) {
    return study;
  }

  // Fetch with selective fields to reduce memory usage
  const result = await db.execute(sql`
    SELECT 
      id, title, abstract, authors, journal, publish_date, category,
      methods, results, conclusion, doi, citation_url, source_url, pdf_url,
      peer_reviewed, publish_year, health_conditions, body_systems, 
      keywords, image_url, image_alt
    FROM studies 
    WHERE id = ${studyId}
  `);

  study = result.rows[0] || null;
  
  if (study) {
    studyCache.set(cacheKey, study);
  }
  
  return study;
}

/**
 * Optimized search with caching and pagination cursors
 */
export async function searchStudiesOptimized(params: {
  query?: string;
  category?: string;
  startYear?: number;
  endYear?: number;
  hasCitations?: boolean;
  limit?: number;
  cursor?: number;
}) {
  const cacheKey = `search:${JSON.stringify(params)}`;
  let results = searchCache.get(cacheKey);
  
  if (results) {
    return results;
  }

  const { query, category, startYear, endYear, hascitations, limit = 20, cursor = 0 } = params;
  
  let whereConditions = [];
  let queryParams: any[] = [];
  let paramIndex = 1;

  // Build dynamic query conditions
  if (query) {
    whereConditions.push(`to_tsvector('english', title || ' ' || abstract) @@ plainto_tsquery('english', $${paramIndex})`);
    queryParams.push(query);
    paramIndex++;
  }

  if (category) {
    whereConditions.push(`category = $${paramIndex}`);
    queryParams.push(category);
    paramIndex++;
  }

  if (startYear) {
    whereConditions.push(`publish_year >= $${paramIndex}`);
    queryParams.push(startYear);
    paramIndex++;
  }

  if (endYear) {
    whereConditions.push(`publish_year <= $${paramIndex}`);
    queryParams.push(endYear);
    paramIndex++;
  }

  if (hascitations) {
    whereConditions.push(`citation_url IS NOT NULL AND citation_url != ''`);
  }

  if (cursor > 0) {
    whereConditions.push(`id > $${paramIndex}`);
    queryParams.push(cursor);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  
  const queryText = `
    SELECT 
      id, title, abstract, authors, journal, publish_date, category,
      publish_year, citation_url, source_url, health_conditions, 
      body_systems, image_url, peer_reviewed
    FROM studies 
    ${whereClause}
    ORDER BY 
      CASE WHEN citation_url IS NOT NULL AND citation_url != '' THEN 1 ELSE 2 END,
      publish_year DESC, 
      id ASC
    LIMIT ${limit + 1}
  `;

  queryParams.push(limit + 1);
  const result = await db.execute(sql.raw(queryText, queryParams));
  
  const studies = result.rows.slice(0, limit);
  const hasMore = result.rows.length > limit;
  const nextCursor = hasMore ? result.rows[limit - 1].id : null;

  results = {
    studies,
    hasMore,
    nextCursor,
    total: studies.length
  };
  
  searchCache.set(cacheKey, results);
  return results;
}

/**
 * Cached category statistics
 */
export async function getCategoryStatsOptimized() {
  const cacheKey = 'category:stats';
  let stats = categoryCache.get(cacheKey);
  
  if (stats) {
    return stats;
  }

  const result = await db.execute(sql`
    SELECT 
      category,
      COUNT(*) as total_studies,
      COUNT(CASE WHEN citation_url IS NOT NULL AND citation_url != '' THEN 1 END) as studies_with_citations,
      COUNT(CASE WHEN publish_year >= 2020 THEN 1 END) as recent_studies,
      MAX(publish_year) as latest_year,
      AVG(CASE WHEN sample_size IS NOT NULL THEN sample_size END) as avg_sample_size
    FROM studies 
    WHERE category IS NOT NULL
    GROUP BY category
    ORDER BY total_studies DESC
  `);

  stats = result.rows;
  categoryCache.set(cacheKey, stats);
  return stats;
}

/**
 * Cached database statistics
 */
export async function getDatabaseStatsOptimized() {
  const cacheKey = 'database:stats';
  let stats = statsCache.get(cacheKey);
  
  if (stats) {
    return stats;
  }

  const result = await db.execute(sql`
    SELECT 
      COUNT(*) as total_studies,
      COUNT(CASE WHEN citation_url IS NOT NULL AND citation_url != '' THEN 1 END) as studies_with_citations,
      COUNT(CASE WHEN source_url IS NOT NULL AND source_url != '' THEN 1 END) as studies_with_sources,
      COUNT(CASE WHEN pdf_url IS NOT NULL AND pdf_url != '' THEN 1 END) as studies_with_pdfs,
      COUNT(DISTINCT category) as unique_categories,
      COUNT(DISTINCT journal) as unique_journals,
      MIN(publish_year) as earliest_year,
      MAX(publish_year) as latest_year,
      AVG(LENGTH(abstract)) as avg_abstract_length
    FROM studies
  `);

  stats = result.rows[0];
  statsCache.set(cacheKey, stats);
  return stats;
}

/**
 * Optimized study recommendations based on similar content
 */
export async function getRelatedStudiesOptimized(studyId: number, limit: number = 5) {
  const cacheKey = `related:${studyId}:${limit}`;
  let related = searchCache.get(cacheKey);
  
  if (related) {
    return related;
  }

  // Get the current study's keywords and category
  const currentStudy = await getStudyOptimized(studyId);
  if (!currentStudy) return [];

  const result = await db.execute(sql`
    SELECT 
      id, title, abstract, category, publish_year, citation_url, image_url,
      CASE 
        WHEN category = ${currentStudy.category} THEN 3
        WHEN keywords && ${currentStudy.keywords || []} THEN 2
        ELSE 1
      END as relevance_score
    FROM studies 
    WHERE id != ${studyId}
    AND (
      category = ${currentStudy.category}
      OR keywords && ${currentStudy.keywords || []}
      OR health_conditions = ${currentStudy.health_conditions}
    )
    ORDER BY relevance_score DESC, publish_year DESC
    LIMIT ${limit}
  `);

  related = result.rows;
  searchCache.set(cacheKey, related);
  return related;
}

/**
 * Clear specific cache entries
 */
export function invalidateCache(pattern: string) {
  if (pattern.startsWith('study:')) {
    // Clear all study caches or specific study
    for (const key of studyCache['cache'].keys()) {
      if (key.includes(pattern.replace('study:', ''))) {
        studyCache['cache'].delete(key);
      }
    }
  } else if (pattern === 'search') {
    searchCache['cache'].clear();
  } else if (pattern === 'categories') {
    categoryCache['cache'].clear();
  } else if (pattern === 'stats') {
    statsCache['cache'].clear();
  }
}

/**
 * Get cache performance metrics
 */
export function getCacheMetrics() {
  return {
    study: studyCache.getStats(),
    search: searchCache.getStats(),
    category: categoryCache.getStats(),
    stats: statsCache.getStats()
  };
}