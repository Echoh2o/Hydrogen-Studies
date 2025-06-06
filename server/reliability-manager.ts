/**
 * Application Reliability Manager
 * Implements comprehensive monitoring, error recovery, and performance optimization
 */

interface ApplicationMetrics {
  uptime: number;
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  memoryUsage: number;
  databaseConnections: number;
  lastHealthCheck: Date;
}

interface ErrorPattern {
  type: string;
  count: number;
  lastOccurrence: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

class ReliabilityManager {
  private metrics: ApplicationMetrics;
  private errorPatterns: Map<string, ErrorPattern>;
  private responseTimes: number[];
  private maxResponseTimeHistory = 1000;
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
    this.metrics = {
      uptime: 0,
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
      databaseConnections: 1,
      lastHealthCheck: new Date()
    };
    this.errorPatterns = new Map();
    this.responseTimes = [];
  }

  /**
   * Track request performance
   */
  trackRequest(responseTime: number): void {
    this.metrics.requestCount++;
    this.responseTimes.push(responseTime);
    
    if (this.responseTimes.length > this.maxResponseTimeHistory) {
      this.responseTimes.shift();
    }
    
    this.metrics.averageResponseTime = 
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
  }

  /**
   * Track errors and identify patterns
   */
  trackError(error: Error, context?: string): void {
    this.metrics.errorCount++;
    
    const errorKey = `${error.name}:${context || 'general'}`;
    const existing = this.errorPatterns.get(errorKey);
    
    if (existing) {
      existing.count++;
      existing.lastOccurrence = new Date();
    } else {
      this.errorPatterns.set(errorKey, {
        type: error.name,
        count: 1,
        lastOccurrence: new Date(),
        severity: this.determineSeverity(error)
      });
    }
    
    console.error(`Error tracked: ${errorKey}`, error.message);
  }

  /**
   * Determine error severity
   */
  private determineSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    if (error.message.includes('database') || error.message.includes('connection')) {
      return 'critical';
    }
    if (error.message.includes('timeout') || error.message.includes('memory')) {
      return 'high';
    }
    if (error.message.includes('validation') || error.message.includes('not found')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Get current application metrics
   */
  getMetrics(): ApplicationMetrics {
    this.metrics.uptime = Date.now() - this.startTime;
    this.metrics.memoryUsage = process.memoryUsage().heapUsed;
    this.metrics.lastHealthCheck = new Date();
    
    return { ...this.metrics };
  }

  /**
   * Get error analysis
   */
  getErrorAnalysis(): {
    totalErrors: number;
    criticalErrors: number;
    recentErrors: ErrorPattern[];
    topErrors: ErrorPattern[];
  } {
    const patterns = Array.from(this.errorPatterns.values());
    const recentErrors = patterns.filter(p => 
      Date.now() - p.lastOccurrence.getTime() < 60000 // Last minute
    );
    const criticalErrors = patterns.filter(p => p.severity === 'critical').length;
    const topErrors = patterns
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalErrors: this.metrics.errorCount,
      criticalErrors,
      recentErrors,
      topErrors
    };
  }

  /**
   * Check if application is healthy
   */
  isHealthy(): boolean {
    const metrics = this.getMetrics();
    
    // Check various health indicators
    const memoryOk = metrics.memoryUsage < 500 * 1024 * 1024; // 500MB limit
    const responseTimeOk = metrics.averageResponseTime < 2000; // 2 second limit
    const errorRateOk = metrics.errorCount < 100; // Error threshold
    
    return memoryOk && responseTimeOk && errorRateOk;
  }

  /**
   * Automatic recovery actions
   */
  async performRecovery(): Promise<void> {
    console.log('Performing automatic recovery...');
    
    // Clear response time history if too large
    if (this.responseTimes.length > this.maxResponseTimeHistory) {
      this.responseTimes = this.responseTimes.slice(-100);
    }
    
    // Reset error patterns if too many accumulated
    if (this.errorPatterns.size > 100) {
      const recentPatterns = new Map();
      for (const [key, pattern] of this.errorPatterns) {
        if (Date.now() - pattern.lastOccurrence.getTime() < 3600000) { // Last hour
          recentPatterns.set(key, pattern);
        }
      }
      this.errorPatterns = recentPatterns;
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    console.log('Recovery completed');
  }

  /**
   * Generate health report
   */
  generateHealthReport(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: ApplicationMetrics;
    recommendations: string[];
  } {
    const metrics = this.getMetrics();
    const isHealthy = this.isHealthy();
    const errorAnalysis = this.getErrorAnalysis();
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const recommendations: string[] = [];
    
    if (errorAnalysis.criticalErrors > 0) {
      status = 'unhealthy';
      recommendations.push('Critical errors detected - investigate database connectivity');
    } else if (metrics.averageResponseTime > 1000) {
      status = 'degraded';
      recommendations.push('High response times - consider enabling caching');
    } else if (metrics.memoryUsage > 300 * 1024 * 1024) {
      status = 'degraded';
      recommendations.push('High memory usage - monitor for memory leaks');
    }
    
    if (!isHealthy && status === 'healthy') {
      status = 'degraded';
    }
    
    return {
      status,
      metrics,
      recommendations
    };
  }
}

// Global reliability manager instance
export const reliabilityManager = new ReliabilityManager();

/**
 * Express middleware for tracking requests
 */
export function reliabilityMiddleware(req: any, res: any, next: any): void {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    reliabilityManager.trackRequest(responseTime);
  });
  
  next();
}

/**
 * Initialize reliability monitoring
 */
export function initializeReliabilityMonitoring(): void {
  // Health check every 30 seconds
  setInterval(() => {
    const report = reliabilityManager.generateHealthReport();
    if (report.status !== 'healthy') {
      console.warn(`Application status: ${report.status}`, report.recommendations);
    }
  }, 30000);
  
  // Auto-recovery every 5 minutes
  setInterval(() => {
    reliabilityManager.performRecovery();
  }, 5 * 60 * 1000);
  
  // Memory monitoring every minute
  setInterval(() => {
    const usage = process.memoryUsage();
    if (usage.heapUsed > 400 * 1024 * 1024) { // 400MB warning
      console.warn(`High memory usage: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
    }
  }, 60000);
  
  console.log('Reliability monitoring initialized');
}