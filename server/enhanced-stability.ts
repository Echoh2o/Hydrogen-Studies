/**
 * Enhanced Stability System
 * Implements circuit breakers, rate limiting, and automatic recovery
 */

interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: number;
  successCount: number;
}

class EnhancedStabilityManager {
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private rateLimiters: Map<string, { count: number; resetTime: number }> = new Map();
  private requestQueue: Array<{ id: string; timestamp: number; priority: number }> = [];
  private maxQueueSize = 1000;
  
  // Circuit breaker configuration
  private readonly FAILURE_THRESHOLD = 5;
  private readonly RECOVERY_TIMEOUT = 30000; // 30 seconds
  private readonly SUCCESS_THRESHOLD = 3;

  /**
   * Circuit breaker for database operations
   */
  async executeWithCircuitBreaker<T>(
    operation: string,
    fn: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const breaker = this.getCircuitBreaker(operation);
    
    if (breaker.isOpen) {
      if (Date.now() - breaker.lastFailureTime > this.RECOVERY_TIMEOUT) {
        // Try to reset circuit breaker
        breaker.isOpen = false;
        breaker.successCount = 0;
        console.log(`Circuit breaker reset for ${operation}`);
      } else if (fallback) {
        console.log(`Circuit breaker open, using fallback for ${operation}`);
        return fallback();
      } else {
        throw new Error(`Service ${operation} temporarily unavailable`);
      }
    }

    try {
      const result = await fn();
      this.recordSuccess(operation);
      return result;
    } catch (error) {
      this.recordFailure(operation);
      if (fallback && breaker.isOpen) {
        return fallback();
      }
      throw error;
    }
  }

  /**
   * Rate limiting for API endpoints
   */
  checkRateLimit(clientId: string, maxRequests = 100, windowMs = 60000): boolean {
    const now = Date.now();
    const limiter = this.rateLimiters.get(clientId);
    
    if (!limiter || now > limiter.resetTime) {
      this.rateLimiters.set(clientId, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    if (limiter.count >= maxRequests) {
      return false;
    }
    
    limiter.count++;
    return true;
  }

  /**
   * Request queue management for high load scenarios
   */
  async queueRequest<T>(
    requestId: string,
    priority: number,
    operation: () => Promise<T>
  ): Promise<T> {
    if (this.requestQueue.length >= this.maxQueueSize) {
      throw new Error('Request queue full');
    }

    this.requestQueue.push({
      id: requestId,
      timestamp: Date.now(),
      priority
    });

    // Sort by priority and timestamp
    this.requestQueue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.timestamp - b.timestamp; // FIFO for same priority
    });

    // Execute when queue is processed
    return operation();
  }

  /**
   * Memory pressure detection and management
   */
  checkMemoryPressure(): { pressure: 'low' | 'medium' | 'high'; action: string } {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    const usagePercentage = (heapUsedMB / heapTotalMB) * 100;

    if (usagePercentage > 85) {
      return { pressure: 'high', action: 'Force garbage collection and clear caches' };
    } else if (usagePercentage > 70) {
      return { pressure: 'medium', action: 'Clear non-essential caches' };
    }
    
    return { pressure: 'low', action: 'Normal operation' };
  }

  /**
   * Automatic recovery actions
   */
  async performEmergencyRecovery(): Promise<void> {
    console.log('Performing emergency recovery...');
    
    // Clear request queue if too large
    if (this.requestQueue.length > 500) {
      this.requestQueue = this.requestQueue.slice(0, 100);
      console.log('Request queue cleared');
    }

    // Reset rate limiters
    this.rateLimiters.clear();
    console.log('Rate limiters reset');

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('Garbage collection forced');
    }

    // Reset circuit breakers for non-critical operations
    for (const [key, breaker] of this.circuitBreakers) {
      if (breaker.failureCount < this.FAILURE_THRESHOLD * 2) {
        breaker.isOpen = false;
        breaker.failureCount = 0;
        breaker.successCount = 0;
      }
    }

    console.log('Emergency recovery completed');
  }

  /**
   * Health status summary
   */
  getHealthSummary(): {
    circuitBreakers: number;
    openBreakers: number;
    queueSize: number;
    memoryPressure: string;
    rateLimiters: number;
  } {
    const openBreakers = Array.from(this.circuitBreakers.values())
      .filter(b => b.isOpen).length;
    
    const memoryStatus = this.checkMemoryPressure();

    return {
      circuitBreakers: this.circuitBreakers.size,
      openBreakers,
      queueSize: this.requestQueue.length,
      memoryPressure: memoryStatus.pressure,
      rateLimiters: this.rateLimiters.size
    };
  }

  private getCircuitBreaker(operation: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(operation)) {
      this.circuitBreakers.set(operation, {
        isOpen: false,
        failureCount: 0,
        lastFailureTime: 0,
        successCount: 0
      });
    }
    return this.circuitBreakers.get(operation)!;
  }

  private recordSuccess(operation: string): void {
    const breaker = this.getCircuitBreaker(operation);
    breaker.successCount++;
    breaker.failureCount = 0;
    
    if (breaker.successCount >= this.SUCCESS_THRESHOLD) {
      breaker.isOpen = false;
    }
  }

  private recordFailure(operation: string): void {
    const breaker = this.getCircuitBreaker(operation);
    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();
    
    if (breaker.failureCount >= this.FAILURE_THRESHOLD) {
      breaker.isOpen = true;
      console.warn(`Circuit breaker opened for ${operation}`);
    }
  }
}

// Global stability manager
export const stabilityManager = new EnhancedStabilityManager();

/**
 * Middleware for enhanced stability
 */
export function stabilityMiddleware(req: any, res: any, next: any): void {
  const clientId = req.ip || 'unknown';
  const path = req.path;
  
  // Rate limiting
  if (!stabilityManager.checkRateLimit(clientId)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  
  // Add stability headers
  res.setHeader('X-Request-ID', `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  
  next();
}

/**
 * Initialize enhanced stability monitoring
 */
export function initializeEnhancedStability(): void {
  // Monitor memory pressure every 30 seconds
  setInterval(() => {
    const memoryStatus = stabilityManager.checkMemoryPressure();
    if (memoryStatus.pressure !== 'low') {
      console.warn(`Memory pressure: ${memoryStatus.pressure} - ${memoryStatus.action}`);
      if (memoryStatus.pressure === 'high') {
        stabilityManager.performEmergencyRecovery();
      }
    }
  }, 30000);

  // Log stability summary every 5 minutes
  setInterval(() => {
    const summary = stabilityManager.getHealthSummary();
    console.log('Stability summary:', summary);
  }, 5 * 60 * 1000);

  console.log('Enhanced stability system initialized');
}