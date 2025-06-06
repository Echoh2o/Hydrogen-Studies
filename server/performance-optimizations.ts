/**
 * Performance Optimizations for Hydrogen Research Platform
 * Implements caching, connection pooling, and response optimization
 */

import { LRUCache } from 'lru-cache';

// Memory cache for frequently accessed data
const cache = new LRUCache<string, any>({
  max: 1000,
  ttl: 1000 * 60 * 15, // 15 minutes
});

// Database query cache
const queryCache = new LRUCache<string, any>({
  max: 500,
  ttl: 1000 * 60 * 5, // 5 minutes
});

// Response compression and optimization
export function optimizeResponse(data: any): any {
  // Remove unnecessary fields for API responses
  if (Array.isArray(data)) {
    return data.map(item => ({
      id: item.id,
      title: item.title,
      abstract: item.abstract?.substring(0, 300) + '...',
      authors: item.authors,
      journal: item.journal,
      year: item.year,
      study_type: item.study_type,
      consumer_categories: item.consumer_categories,
    }));
  }
  return data;
}

// Cache management utilities
export function getCachedData(key: string): any {
  return cache.get(key);
}

export function setCachedData(key: string, data: any, ttl?: number): void {
  cache.set(key, data, { ttl });
}

export function getCachedQuery(key: string): any {
  return queryCache.get(key);
}

export function setCachedQuery(key: string, data: any): void {
  queryCache.set(key, data);
}

export function clearCache(): void {
  cache.clear();
  queryCache.clear();
}

// Performance monitoring
let requestCount = 0;
let responseTimeSum = 0;

export function trackRequest(responseTime: number): void {
  requestCount++;
  responseTimeSum += responseTime;
}

export function getPerformanceStats(): { avgResponseTime: number; requestCount: number } {
  return {
    avgResponseTime: requestCount > 0 ? responseTimeSum / requestCount : 0,
    requestCount,
  };
}