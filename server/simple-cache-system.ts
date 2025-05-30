/**
 * Simple Memory Cache System
 * 
 * Lightweight caching for improved API performance
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
    
    // Cleanup expired entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  set(key: string, data: any, ttlMinutes: number = 10): void {
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    this.cache.forEach((entry, key) => {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }
}

// Create cache instances
export const studyCache = new SimpleCache(500);
export const searchCache = new SimpleCache(200);
export const statsCache = new SimpleCache(50);

/**
 * Cache wrapper for study queries
 */
export async function getCachedStudy(studyId: number, fetchFunction: () => Promise<any>) {
  const cacheKey = `study:${studyId}`;
  
  let study = studyCache.get(cacheKey);
  if (study) {
    return study;
  }

  study = await fetchFunction();
  if (study) {
    studyCache.set(cacheKey, study, 10); // Cache for 10 minutes
  }
  
  return study;
}

/**
 * Cache wrapper for search queries
 */
export async function getCachedSearch(searchParams: any, fetchFunction: () => Promise<any>) {
  const cacheKey = `search:${JSON.stringify(searchParams)}`;
  
  let results = searchCache.get(cacheKey);
  if (results) {
    return results;
  }

  results = await fetchFunction();
  if (results) {
    searchCache.set(cacheKey, results, 5); // Cache for 5 minutes
  }
  
  return results;
}

/**
 * Cache wrapper for statistics
 */
export async function getCachedStats(statsType: string, fetchFunction: () => Promise<any>) {
  const cacheKey = `stats:${statsType}`;
  
  let stats = statsCache.get(cacheKey);
  if (stats) {
    return stats;
  }

  stats = await fetchFunction();
  if (stats) {
    statsCache.set(cacheKey, stats, 30); // Cache for 30 minutes
  }
  
  return stats;
}

/**
 * Invalidate cache entries
 */
export function invalidateCache(pattern: string) {
  if (pattern === 'studies') {
    studyCache.clear();
  } else if (pattern === 'search') {
    searchCache.clear();
  } else if (pattern === 'stats') {
    statsCache.clear();
  }
}