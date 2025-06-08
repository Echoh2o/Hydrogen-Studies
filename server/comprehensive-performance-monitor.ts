/**
 * Comprehensive Performance Monitor - Real-time system optimization
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

interface PerformanceMetrics {
  responseTime: number[];
  memoryUsage: number[];
  dbQueries: number;
  cacheHitRate: number;
  activeConnections: number;
  errorRate: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    responseTime: [],
    memoryUsage: [],
    dbQueries: 0,
    cacheHitRate: 0,
    activeConnections: 0,
    errorRate: 0
  };

  private queryCount = 0;
  private errorCount = 0;
  private requestCount = 0;
  private cacheHits = 0;
  private cacheRequests = 0;

  // Track response times
  trackResponseTime(duration: number): void {
    this.metrics.responseTime.push(duration);
    this.requestCount++;
    
    // Keep only last 100 measurements
    if (this.metrics.responseTime.length > 100) {
      this.metrics.responseTime.shift();
    }
  }

  // Track database queries
  trackDatabaseQuery(): void {
    this.queryCount++;
    this.metrics.dbQueries = this.queryCount;
  }

  // Track cache performance
  trackCacheHit(): void {
    this.cacheHits++;
    this.cacheRequests++;
    this.updateCacheHitRate();
  }

  trackCacheMiss(): void {
    this.cacheRequests++;
    this.updateCacheHitRate();
  }

  private updateCacheHitRate(): void {
    this.metrics.cacheHitRate = this.cacheRequests > 0 
      ? (this.cacheHits / this.cacheRequests) * 100 
      : 0;
  }

  // Track errors
  trackError(): void {
    this.errorCount++;
    this.metrics.errorRate = this.requestCount > 0 
      ? (this.errorCount / this.requestCount) * 100 
      : 0;
  }

  // Update memory metrics
  updateMemoryMetrics(): void {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    
    this.metrics.memoryUsage.push(heapUsedMB);
    
    // Keep only last 60 measurements (1 hour at 1 minute intervals)
    if (this.metrics.memoryUsage.length > 60) {
      this.metrics.memoryUsage.shift();
    }
  }

  // Get comprehensive performance statistics
  getMetrics(): any {
    const avgResponseTime = this.metrics.responseTime.length > 0
      ? this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length
      : 0;

    const currentMemory = process.memoryUsage();
    
    return {
      performance: {
        avgResponseTime: Math.round(avgResponseTime),
        p95ResponseTime: this.calculatePercentile(this.metrics.responseTime, 95),
        requestsPerMinute: this.calculateRequestsPerMinute(),
        errorRate: Math.round(this.metrics.errorRate * 100) / 100
      },
      database: {
        totalQueries: this.metrics.dbQueries,
        queriesPerMinute: this.calculateQueriesPerMinute()
      },
      cache: {
        hitRate: Math.round(this.metrics.cacheHitRate * 100) / 100,
        totalRequests: this.cacheRequests,
        totalHits: this.cacheHits
      },
      memory: {
        current: Math.round(currentMemory.heapUsed / 1024 / 1024),
        peak: Math.max(...this.metrics.memoryUsage, 0),
        average: this.metrics.memoryUsage.length > 0
          ? Math.round(this.metrics.memoryUsage.reduce((a, b) => a + b, 0) / this.metrics.memoryUsage.length)
          : 0
      },
      system: {
        uptime: Math.round(process.uptime()),
        nodeVersion: process.version,
        platform: process.platform
      }
    };
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return Math.round(sorted[index] || 0);
  }

  private calculateRequestsPerMinute(): number {
    // Simple estimation based on total requests and uptime
    const uptimeMinutes = process.uptime() / 60;
    return uptimeMinutes > 0 ? Math.round(this.requestCount / uptimeMinutes) : 0;
  }

  private calculateQueriesPerMinute(): number {
    const uptimeMinutes = process.uptime() / 60;
    return uptimeMinutes > 0 ? Math.round(this.queryCount / uptimeMinutes) : 0;
  }

  // Reset metrics (for testing or periodic resets)
  reset(): void {
    this.metrics = {
      responseTime: [],
      memoryUsage: [],
      dbQueries: 0,
      cacheHitRate: 0,
      activeConnections: 0,
      errorRate: 0
    };
    this.queryCount = 0;
    this.errorCount = 0;
    this.requestCount = 0;
    this.cacheHits = 0;
    this.cacheRequests = 0;
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Automatic memory monitoring
setInterval(() => {
  performanceMonitor.updateMemoryMetrics();
}, 60000); // Every minute

// Database performance optimization check
export async function checkDatabasePerformance(): Promise<any> {
  try {
    const start = Date.now();
    
    // Quick performance test queries
    const [studyCount, indexCount, tableSize] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as count FROM studies`),
      db.execute(sql`
        SELECT COUNT(*) as count 
        FROM pg_indexes 
        WHERE tablename = 'studies'
      `),
      db.execute(sql`
        SELECT pg_size_pretty(pg_total_relation_size('studies')) as size
      `)
    ]);

    const queryTime = Date.now() - start;
    performanceMonitor.trackDatabaseQuery();

    return {
      queryLatency: queryTime,
      studyCount: (studyCount as any).rows[0]?.count || 0,
      indexCount: (indexCount as any).rows[0]?.count || 0,
      tableSize: (tableSize as any).rows[0]?.size || 'Unknown',
      status: queryTime < 1000 ? 'optimal' : queryTime < 3000 ? 'acceptable' : 'needs_attention'
    };

  } catch (error) {
    performanceMonitor.trackError();
    return {
      status: 'error',
      error: (error as Error).message
    };
  }
}

// Memory leak detection
export function detectMemoryLeaks(): any {
  const usage = process.memoryUsage();
  const heapUsed = usage.heapUsed / 1024 / 1024;
  const heapTotal = usage.heapTotal / 1024 / 1024;
  
  const memoryPressure = (heapUsed / heapTotal) * 100;
  
  return {
    heapUsed: Math.round(heapUsed),
    heapTotal: Math.round(heapTotal),
    memoryPressure: Math.round(memoryPressure),
    status: memoryPressure > 90 ? 'critical' : memoryPressure > 70 ? 'warning' : 'normal',
    recommendations: memoryPressure > 70 ? [
      'Consider restarting the application',
      'Check for memory leaks in long-running processes',
      'Clear cache if memory usage is high'
    ] : []
  };
}

// Express middleware for automatic performance tracking
export function performanceMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      performanceMonitor.trackResponseTime(duration);
      
      if (res.statusCode >= 400) {
        performanceMonitor.trackError();
      }
    });
    
    next();
  };
}

// Health check with performance data
export async function comprehensiveHealthCheck(): Promise<any> {
  try {
    const [dbPerf, memoryStatus] = await Promise.all([
      checkDatabasePerformance(),
      Promise.resolve(detectMemoryLeaks())
    ]);

    const metrics = performanceMonitor.getMetrics();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      performance: metrics,
      database: dbPerf,
      memory: memoryStatus,
      recommendations: generateRecommendations(metrics, dbPerf, memoryStatus)
    };

  } catch (error) {
    return {
      status: 'unhealthy',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    };
  }
}

function generateRecommendations(metrics: any, dbPerf: any, memoryStatus: any): string[] {
  const recommendations: string[] = [];

  if (metrics.performance.avgResponseTime > 1000) {
    recommendations.push('Average response time is high - consider optimizing queries');
  }

  if (metrics.cache.hitRate < 50) {
    recommendations.push('Cache hit rate is low - review caching strategy');
  }

  if (dbPerf.queryLatency > 500) {
    recommendations.push('Database queries are slow - check indexes and query optimization');
  }

  if (memoryStatus.memoryPressure > 70) {
    recommendations.push('Memory usage is high - monitor for memory leaks');
  }

  if (recommendations.length === 0) {
    recommendations.push('System performance is optimal');
  }

  return recommendations;
}