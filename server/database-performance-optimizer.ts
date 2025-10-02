/**
 * Database Performance Optimizer
 *
 * Implements intelligent caching, query optimization, and connection management
 * to maximize database speed, quality, and reliability.
 */

import { db, pool } from "./db";
import memoize from "memoizee";

// In-memory cache for frequently accessed data
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

/**
 * Intelligent cache with TTL and size limits
 */
export class PerformanceCache {
  private maxSize = 1000;
  private defaultTTL = 300000; // 5 minutes

  set(key: string, data: any, ttl: number = this.defaultTTL): void {
    // Remove oldest entries if cache is full
    if (cache.size >= this.maxSize) {
      const oldestKey = Array.from(cache.keys())[0];
      cache.delete(oldestKey);
    }

    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get(key: string): any | null {
    const entry = cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      cache.delete(key);
      return null;
    }

    return entry.data;
  }

  invalidate(pattern: string): void {
    cache.forEach((_, key) => {
      if (key.includes(pattern)) {
        cache.delete(key);
      }
    });
  }

  clear(): void {
    cache.clear();
  }

  getStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Could implement hit tracking
    };
  }
}

export const performanceCache = new PerformanceCache();

/**
 * Memoized database queries for frequently accessed data
 */
export const memoizedQueries = {
  // Cache category counts for 10 minutes
  getCategoryCounts: memoize(
    async () => {
      const cacheKey = "category_counts";
      const cached = performanceCache.get(cacheKey);
      if (cached) return cached;

      const result = await pool.query(`
        SELECT 
          category,
          COUNT(*) as count
        FROM studies 
        WHERE category IS NOT NULL 
        GROUP BY category 
        ORDER BY count DESC
      `);

      performanceCache.set(cacheKey, result.rows, 600000); // 10 minutes
      return result.rows;
    },
    { maxAge: 600000, primitive: true },
  ),

  // Cache consumer category counts for 15 minutes
  getConsumerCategoryCounts: memoize(
    async () => {
      const cacheKey = "consumer_category_counts";
      const cached = performanceCache.get(cacheKey);
      if (cached) return cached;

      const result = await pool.query(`
        SELECT 
          consumer_categories,
          COUNT(*) as count
        FROM studies 
        WHERE consumer_categories IS NOT NULL 
        GROUP BY consumer_categories 
        ORDER BY count DESC
      `);

      performanceCache.set(cacheKey, result.rows, 900000); // 15 minutes
      return result.rows;
    },
    { maxAge: 900000, primitive: true },
  ),

  // Cache database statistics for 30 minutes
  getDatabaseStats: memoize(
    async () => {
      const cacheKey = "database_stats";
      const cached = performanceCache.get(cacheKey);
      if (cached) return cached;

      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_studies,
          COUNT(CASE WHEN image_url IS NOT NULL THEN 1 END) as studies_with_images,
          COUNT(CASE WHEN full_text IS NOT NULL THEN 1 END) as studies_with_full_text,
          AVG(citation_count) as avg_citations,
          MIN(publish_year) as earliest_year,
          MAX(publish_year) as latest_year
        FROM studies
      `);

      performanceCache.set(cacheKey, result.rows[0], 1800000); // 30 minutes
      return result.rows[0];
    },
    { maxAge: 1800000, primitive: true },
  ),
};

/**
 * Optimized search with intelligent caching
 */
export async function optimizedSearch(
  query: string,
  limit: number = 20,
  offset: number = 0,
) {
  const cacheKey = `search_${query}_${limit}_${offset}`;
  const cached = performanceCache.get(cacheKey);
  if (cached) return cached;

  // Use the new GIN indexes for fast text search
  const result = await pool.query(
    `
    SELECT 
      id, title, abstract, authors, journal, publish_date, category,
      consumer_categories, doi, image_url, citation_count,
      ts_rank(to_tsvector('english', title), plainto_tsquery('english', $1)) +
      ts_rank(to_tsvector('english', abstract), plainto_tsquery('english', $1)) as relevance
    FROM studies 
    WHERE 
      to_tsvector('english', title) @@ plainto_tsquery('english', $1) OR
      to_tsvector('english', abstract) @@ plainto_tsquery('english', $1)
    ORDER BY relevance DESC, citation_count DESC
    LIMIT $2 OFFSET $3
  `,
    [query, limit, offset],
  );

  performanceCache.set(cacheKey, result.rows, 300000); // 5 minutes
  return result.rows;
}

/**
 * Connection health monitoring and optimization
 */
export class ConnectionHealthMonitor {
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metrics = {
    totalQueries: 0,
    avgResponseTime: 0,
    errorRate: 0,
    connectionErrors: 0,
  };

  start(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const start = Date.now();
        await pool.query("SELECT 1");
        const responseTime = Date.now() - start;

        this.updateMetrics({ responseTime, success: true });
      } catch (error) {
        console.error("Database health check failed:", error);
        this.updateMetrics({ responseTime: 0, success: false });
      }
    }, 30000); // Check every 30 seconds
  }

  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private updateMetrics({
    responseTime,
    success,
  }: {
    responseTime: number;
    success: boolean;
  }): void {
    this.metrics.totalQueries++;

    if (success) {
      this.metrics.avgResponseTime =
        (this.metrics.avgResponseTime + responseTime) / 2;
    } else {
      this.metrics.connectionErrors++;
    }

    this.metrics.errorRate =
      this.metrics.connectionErrors / this.metrics.totalQueries;
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

/**
 * Database maintenance and optimization scheduler
 */
export class DatabaseMaintenance {
  private maintenanceInterval: NodeJS.Timeout | null = null;

  start(): void {
    // Run maintenance every 6 hours
    this.maintenanceInterval = setInterval(
      async () => {
        await this.performMaintenance();
      },
      6 * 60 * 60 * 1000,
    );
  }

  stop(): void {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
    }
  }

  async performMaintenance(): Promise<void> {
    try {
      console.log("Starting database maintenance...");

      // Update table statistics
      await pool.query("ANALYZE studies");
      await pool.query("ANALYZE study_categories");
      await pool.query("ANALYZE study_tags");

      // Clear old cache entries
      performanceCache.clear();

      // Force refresh of memoized queries
      memoizedQueries.getCategoryCounts.clear();
      memoizedQueries.getConsumerCategoryCounts.clear();
      memoizedQueries.getDatabaseStats.clear();

      console.log("Database maintenance completed successfully");
    } catch (error) {
      console.error("Database maintenance failed:", error);
    }
  }
}

// Initialize monitoring and maintenance
export const connectionMonitor = new ConnectionHealthMonitor();
export const databaseMaintenance = new DatabaseMaintenance();

// Start monitoring in production
if (process.env.NODE_ENV === "production") {
  connectionMonitor.start();
  databaseMaintenance.start();
}

/**
 * Graceful shutdown handler
 */
export async function gracefulShutdown(): Promise<void> {
  console.log("Shutting down database connections...");

  connectionMonitor.stop();
  databaseMaintenance.stop();

  try {
    await pool.end();
    console.log("Database connections closed successfully");
  } catch (error) {
    console.error("Error closing database connections:", error);
  }
}

// Handle process shutdown
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
