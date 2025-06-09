/**
 * Performance Monitoring System
 * Tracks response times and detects performance regressions
 */

interface PerformanceMetric {
  endpoint: string;
  responseTime: number;
  timestamp: Date;
  cacheHit: boolean;
}

interface EndpointStats {
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  totalRequests: number;
  cacheHitRate: number;
  lastUpdated: Date;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 1000; // Keep last 1000 metrics
  private readonly performanceThresholds = {
    '/api/consumer-categories/counts': 50, // 50ms warning threshold
    '/api/search/enhanced': 100, // 100ms warning threshold
    '/api/studies': 100, // 100ms warning threshold
  };

  recordMetric(endpoint: string, responseTime: number, cacheHit: boolean = false) {
    this.metrics.push({
      endpoint,
      responseTime,
      timestamp: new Date(),
      cacheHit
    });

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Check for performance regressions
    this.checkPerformanceRegression(endpoint, responseTime);
  }

  private checkPerformanceRegression(endpoint: string, responseTime: number) {
    const threshold = this.performanceThresholds[endpoint];
    if (threshold && responseTime > threshold) {
      console.warn(`⚠️ Performance regression detected: ${endpoint} took ${responseTime}ms (threshold: ${threshold}ms)`);
    }
  }

  getEndpointStats(endpoint: string): EndpointStats | null {
    const endpointMetrics = this.metrics.filter(m => m.endpoint === endpoint);
    if (endpointMetrics.length === 0) return null;

    const responseTimes = endpointMetrics.map(m => m.responseTime);
    const cacheHits = endpointMetrics.filter(m => m.cacheHit).length;

    return {
      averageResponseTime: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      totalRequests: endpointMetrics.length,
      cacheHitRate: Math.round((cacheHits / endpointMetrics.length) * 100),
      lastUpdated: new Date()
    };
  }

  getAllStats(): Record<string, EndpointStats> {
    const endpoints = [...new Set(this.metrics.map(m => m.endpoint))];
    const stats: Record<string, EndpointStats> = {};
    
    endpoints.forEach(endpoint => {
      const endpointStats = this.getEndpointStats(endpoint);
      if (endpointStats) {
        stats[endpoint] = endpointStats;
      }
    });

    return stats;
  }

  getPerformanceSummary() {
    const stats = this.getAllStats();
    const criticalEndpoints = [
      '/api/consumer-categories/counts',
      '/api/search/enhanced', 
      '/api/studies'
    ];

    return {
      totalRequests: this.metrics.length,
      monitoredEndpoints: Object.keys(stats).length,
      criticalEndpoints: criticalEndpoints.map(endpoint => ({
        endpoint,
        stats: stats[endpoint] || null,
        status: this.getEndpointStatus(endpoint, stats[endpoint])
      })),
      timestamp: new Date()
    };
  }

  private getEndpointStatus(endpoint: string, stats: EndpointStats | null): string {
    if (!stats) return 'No data';
    
    const threshold = this.performanceThresholds[endpoint];
    if (!threshold) return 'Unmonitored';
    
    if (stats.averageResponseTime <= threshold * 0.5) return 'Excellent';
    if (stats.averageResponseTime <= threshold) return 'Good';
    if (stats.averageResponseTime <= threshold * 2) return 'Warning';
    return 'Critical';
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Middleware to automatically track response times
export function performanceMiddleware(req: any, res: any, next: any) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    performanceMonitor.recordMetric(req.path, responseTime, res.getHeader('X-Cache-Hit') === 'true');
  });
  
  next();
}