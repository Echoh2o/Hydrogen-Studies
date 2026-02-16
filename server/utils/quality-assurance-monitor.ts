import { sqlQuery as sql } from "../db";

interface QualityMetrics {
  responseTime: number;
  errorRate: number;
  databaseHealth: boolean;
  memoryUsage: number;
  activeConnections: number;
  searchPerformance: number;
}

export class QualityAssuranceMonitor {
  private metrics: QualityMetrics[] = [];
  private alerts: string[] = [];

  async runContinuousMonitoring(): Promise<void> {
    setInterval(async () => {
      const metrics = await this.collectMetrics();
      this.metrics.push(metrics);

      // Keep only last 100 metrics
      if (this.metrics.length > 100) {
        this.metrics.shift();
      }

      await this.analyzeQuality(metrics);
    }, 30000); // Every 30 seconds
  }

  private async collectMetrics(): Promise<QualityMetrics> {
    const start = Date.now();

    try {
      // Test database response time
      await sql`SELECT 1`;
      const dbResponseTime = Date.now() - start;

      // Get memory usage
      const memUsage = process.memoryUsage();

      // Test search performance
      const searchStart = Date.now();
      await sql`SELECT COUNT(*) FROM studies WHERE title ILIKE '%hydrogen%' LIMIT 10`;
      const searchTime = Date.now() - searchStart;

      return {
        responseTime: dbResponseTime,
        errorRate: 0, // Will be calculated from error logs
        databaseHealth: dbResponseTime < 1000,
        memoryUsage: memUsage.heapUsed / 1024 / 1024, // MB
        activeConnections: 1, // Neon handles this automatically
        searchPerformance: searchTime,
      };
    } catch (error) {
      console.error("Quality metrics collection failed:", error);
      return {
        responseTime: 9999,
        errorRate: 100,
        databaseHealth: false,
        memoryUsage: 0,
        activeConnections: 0,
        searchPerformance: 9999,
      };
    }
  }

  private async analyzeQuality(metrics: QualityMetrics): Promise<void> {
    const issues: string[] = [];

    if (metrics.responseTime > 500) {
      issues.push(`High database response time: ${metrics.responseTime}ms`);
    }

    if (metrics.memoryUsage > 100) {
      issues.push(`High memory usage: ${metrics.memoryUsage.toFixed(2)}MB`);
    }

    if (metrics.searchPerformance > 200) {
      issues.push(`Slow search performance: ${metrics.searchPerformance}ms`);
    }

    if (!metrics.databaseHealth) {
      issues.push("Database health check failed");
    }

    if (issues.length > 0) {
      console.warn("Quality issues detected:", issues);
      this.alerts.push(...issues);

      // Keep only last 50 alerts
      if (this.alerts.length > 50) {
        this.alerts = this.alerts.slice(-50);
      }
    }
  }

  getQualityReport() {
    const recent = this.metrics.slice(-10);
    if (recent.length === 0) return { status: "No data" };

    const avgResponseTime =
      recent.reduce((sum, m) => sum + m.responseTime, 0) / recent.length;
    const avgMemory =
      recent.reduce((sum, m) => sum + m.memoryUsage, 0) / recent.length;
    const avgSearch =
      recent.reduce((sum, m) => sum + m.searchPerformance, 0) / recent.length;

    return {
      status: "healthy",
      averageResponseTime: Math.round(avgResponseTime),
      averageMemoryUsage: Math.round(avgMemory),
      averageSearchTime: Math.round(avgSearch),
      recentAlerts: this.alerts.slice(-5),
      healthScore: this.calculateHealthScore(recent),
    };
  }

  private calculateHealthScore(metrics: QualityMetrics[]): number {
    if (metrics.length === 0) return 0;

    let score = 100;

    metrics.forEach((m) => {
      if (m.responseTime > 200) score -= 5;
      if (m.responseTime > 500) score -= 10;
      if (m.memoryUsage > 80) score -= 5;
      if (m.searchPerformance > 150) score -= 5;
      if (!m.databaseHealth) score -= 20;
    });

    return Math.max(0, score);
  }
}

export const qualityMonitor = new QualityAssuranceMonitor();
