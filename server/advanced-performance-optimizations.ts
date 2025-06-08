/**
 * Advanced Performance Optimizations - Next-level system enhancements
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import cluster from 'cluster';
import { cpus } from 'os';

// Multi-tier caching strategy with different TTLs based on data volatility
class AdaptiveCacheManager {
  private hotCache = new Map(); // 1 minute TTL for frequently changing data
  private warmCache = new Map(); // 10 minute TTL for moderate changes  
  private coldCache = new Map(); // 60 minute TTL for static data
  
  constructor() {
    // Cleanup expired entries every 30 seconds
    setInterval(() => this.cleanup(), 30000);
  }

  set(key: string, data: any, tier: 'hot' | 'warm' | 'cold' = 'warm'): void {
    const ttl = tier === 'hot' ? 60000 : tier === 'warm' ? 600000 : 3600000;
    const cache = this.getCache(tier);
    
    cache.set(key, {
      data,
      expires: Date.now() + ttl,
      hits: 0,
      tier
    });
  }

  get(key: string): any | null {
    // Check all tiers, starting with hot cache
    for (const tier of ['hot', 'warm', 'cold'] as const) {
      const cache = this.getCache(tier);
      const entry = cache.get(key);
      
      if (entry && Date.now() < entry.expires) {
        entry.hits++;
        // Promote frequently accessed items to hotter cache
        if (entry.hits > 5 && tier !== 'hot') {
          this.promote(key, entry, tier);
        }
        return entry.data;
      }
    }
    return null;
  }

  private getCache(tier: 'hot' | 'warm' | 'cold') {
    return tier === 'hot' ? this.hotCache : tier === 'warm' ? this.warmCache : this.coldCache;
  }

  private promote(key: string, entry: any, fromTier: 'warm' | 'cold'): void {
    const targetTier = fromTier === 'cold' ? 'warm' : 'hot';
    this.set(key, entry.data, targetTier);
    this.getCache(fromTier).delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const cache of [this.hotCache, this.warmCache, this.coldCache]) {
      for (const [key, entry] of cache.entries()) {
        if (now > entry.expires) {
          cache.delete(key);
        }
      }
    }
  }

  getStats(): any {
    return {
      hotCache: this.hotCache.size,
      warmCache: this.warmCache.size,
      coldCache: this.coldCache.size,
      total: this.hotCache.size + this.warmCache.size + this.coldCache.size
    };
  }
}

export const adaptiveCache = new AdaptiveCacheManager();

// Database connection pool with intelligent load balancing
class IntelligentConnectionPool {
  private connections: any[] = [];
  private activeQueries = 0;
  private readonly maxConnections = 20;
  private readonly queryTimeout = 5000;

  async executeQuery(query: any): Promise<any> {
    this.activeQueries++;
    
    try {
      const startTime = Date.now();
      const result = await Promise.race([
        db.execute(query),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), this.queryTimeout)
        )
      ]);
      
      const duration = Date.now() - startTime;
      this.logPerformance(duration);
      
      return result;
    } finally {
      this.activeQueries--;
    }
  }

  private logPerformance(duration: number): void {
    if (duration > 1000) {
      console.warn(`Slow query detected: ${duration}ms`);
    }
  }

  getStats(): any {
    return {
      activeQueries: this.activeQueries,
      maxConnections: this.maxConnections
    };
  }
}

export const connectionPool = new IntelligentConnectionPool();

// Predictive data preloader based on usage patterns
class PredictivePreloader {
  private accessPatterns = new Map<string, number[]>();
  private preloadQueue = new Set<string>();

  trackAccess(endpoint: string): void {
    const now = Date.now();
    if (!this.accessPatterns.has(endpoint)) {
      this.accessPatterns.set(endpoint, []);
    }
    
    const pattern = this.accessPatterns.get(endpoint)!;
    pattern.push(now);
    
    // Keep only last 50 accesses
    if (pattern.length > 50) {
      pattern.shift();
    }

    // Predict next likely access and preload
    this.predictAndPreload(endpoint);
  }

  private predictAndPreload(endpoint: string): void {
    const pattern = this.accessPatterns.get(endpoint);
    if (!pattern || pattern.length < 3) return;

    // Simple prediction: if accessed frequently in last hour, preload related data
    const hourAgo = Date.now() - 3600000;
    const recentAccesses = pattern.filter(time => time > hourAgo);
    
    if (recentAccesses.length > 5) {
      this.schedulePreload(endpoint);
    }
  }

  private schedulePreload(endpoint: string): void {
    if (this.preloadQueue.has(endpoint)) return;
    
    this.preloadQueue.add(endpoint);
    
    // Preload in background after short delay
    setTimeout(() => {
      this.executePreload(endpoint);
      this.preloadQueue.delete(endpoint);
    }, 1000);
  }

  private async executePreload(endpoint: string): Promise<void> {
    try {
      // Preload common related queries based on endpoint
      if (endpoint.includes('search')) {
        await this.preloadSearchData();
      } else if (endpoint.includes('categories')) {
        await this.preloadCategoryData();
      }
    } catch (error) {
      console.warn('Preload failed:', error);
    }
  }

  private async preloadSearchData(): Promise<void> {
    // Preload trending searches and popular studies
    const trendingKey = 'trending_searches_preload';
    if (!adaptiveCache.get(trendingKey)) {
      const trending = await connectionPool.executeQuery(sql`
        SELECT keywords, COUNT(*) as frequency
        FROM studies 
        WHERE keywords IS NOT NULL
        GROUP BY keywords
        ORDER BY frequency DESC
        LIMIT 10
      `);
      adaptiveCache.set(trendingKey, trending, 'cold');
    }
  }

  private async preloadCategoryData(): Promise<void> {
    // Preload category distribution data
    const categoryKey = 'category_distribution_preload';
    if (!adaptiveCache.get(categoryKey)) {
      const distribution = await connectionPool.executeQuery(sql`
        SELECT 
          jsonb_array_elements_text(consumer_categories) as category,
          COUNT(*) as count
        FROM studies 
        WHERE consumer_categories IS NOT NULL
        GROUP BY category
        ORDER BY count DESC
      `);
      adaptiveCache.set(categoryKey, distribution, 'cold');
    }
  }
}

export const predictivePreloader = new PredictivePreloader();

// Response compression and optimization
export function optimizeResponse(data: any): any {
  // Remove null/undefined fields to reduce payload size
  if (Array.isArray(data)) {
    return data.map(item => cleanObject(item));
  } else if (typeof data === 'object' && data !== null) {
    return cleanObject(data);
  }
  return data;
}

function cleanObject(obj: any): any {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined && value !== '') {
      if (typeof value === 'object' && !Array.isArray(value)) {
        cleaned[key] = cleanObject(value);
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
}

// Memory optimization with automatic garbage collection
export class MemoryOptimizer {
  private memoryThreshold = 200; // MB
  private lastGC = Date.now();
  private gcInterval = 300000; // 5 minutes

  constructor() {
    setInterval(() => this.checkMemory(), 60000); // Check every minute
  }

  private checkMemory(): void {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    
    if (heapUsedMB > this.memoryThreshold || Date.now() - this.lastGC > this.gcInterval) {
      this.forceGarbageCollection();
    }
  }

  private forceGarbageCollection(): void {
    if (global.gc) {
      global.gc();
      this.lastGC = Date.now();
      console.log('Garbage collection triggered');
    }
  }

  getMemoryStats(): any {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024)
    };
  }
}

export const memoryOptimizer = new MemoryOptimizer();

// CPU optimization with work distribution
export function optimizeCPUUsage(): void {
  // If running in production, use cluster mode for CPU optimization
  if (process.env.NODE_ENV === 'production' && cluster.isPrimary) {
    const numCPUs = cpus().length;
    console.log(`Setting up ${numCPUs} worker processes`);
    
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }
    
    cluster.on('exit', (worker) => {
      console.log(`Worker ${worker.process.pid} died, restarting...`);
      cluster.fork();
    });
  }
}

// Query result streaming for large datasets
export async function streamQueryResults(query: any, callback: (chunk: any) => void): Promise<void> {
  try {
    // For large result sets, process in chunks to avoid memory issues
    const batchSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const batchQuery = sql`${query} LIMIT ${batchSize} OFFSET ${offset}`;
      const result = await connectionPool.executeQuery(batchQuery);
      
      const rows = (result as any).rows || [];
      if (rows.length === 0) {
        hasMore = false;
      } else {
        callback(rows);
        offset += batchSize;
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  } catch (error) {
    console.error('Streaming query error:', error);
    throw error;
  }
}

// Real-time performance monitoring
export function startAdvancedMonitoring(): void {
  setInterval(() => {
    const stats = {
      cache: adaptiveCache.getStats(),
      connections: connectionPool.getStats(),
      memory: memoryOptimizer.getMemoryStats(),
      timestamp: new Date().toISOString()
    };
    
    // Log performance stats every 5 minutes
    console.log('Advanced Performance Stats:', JSON.stringify(stats, null, 2));
  }, 300000);
}

// Initialize all advanced optimizations
export function initializeAdvancedOptimizations(): void {
  console.log('Initializing advanced performance optimizations...');
  
  // Start CPU optimization
  optimizeCPUUsage();
  
  // Start advanced monitoring
  startAdvancedMonitoring();
  
  console.log('Advanced optimizations initialized');
}