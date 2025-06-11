/**
 * Health Monitoring and Auto-Recovery System
 * Monitors application health and automatically recovers from failures
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  errors: string[];
  uptime: number;
  database: {
    connected: boolean;
    latency: number;
  };
}

let healthStatus: HealthStatus = {
  status: 'healthy',
  timestamp: new Date().toISOString(),
  errors: [],
  uptime: 0,
  database: {
    connected: false,
    latency: 0
  }
};

let errorCount = 0;

/**
 * Perform comprehensive health check
 */
export async function performHealthCheck(): Promise<HealthStatus> {
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    // Test database connection
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1`);
    const dbLatency = Date.now() - dbStart;
    
    healthStatus.database = {
      connected: true,
      latency: dbLatency
    };

    if (dbLatency > 1000) {
      errors.push('Database response time is slow');
    }
  } catch (error) {
    errors.push(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    healthStatus.database = {
      connected: false,
      latency: -1
    };
  }

  // Update health status
  healthStatus = {
    status: errors.length === 0 ? 'healthy' : errors.length < 3 ? 'degraded' : 'unhealthy',
    timestamp: new Date().toISOString(),
    errors,
    uptime: Date.now() - startTime,
    database: healthStatus.database
  };

  return healthStatus;
}

/**
 * Log error and increment error count
 */
function logError(error: Error): void {
  console.error('Health monitoring error:', error);
  errorCount++;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: boolean;
  memory: { used: number; total: number; percentage: number };
  uptime: number;
  errors: string[];
  lastCheck: Date;
}

let healthStatus: HealthStatus = {
  status: 'healthy',
  database: false,
  memory: { used: 0, total: 0, percentage: 0 },
  uptime: 0,
  errors: [],
  lastCheck: new Date()
};

let errorCount = 0;
const MAX_ERRORS = 10;
const startTime = Date.now();

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<boolean> {
  try {
    await db.execute('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Check memory usage
 */
function checkMemory(): { used: number; total: number; percentage: number } {
  const memUsage = process.memoryUsage();
  const totalMem = memUsage.heapTotal;
  const usedMem = memUsage.heapUsed;
  const percentage = (usedMem / totalMem) * 100;
  
  return {
    used: usedMem,
    total: totalMem,
    percentage: Math.round(percentage)
  };
}

/**
 * Perform comprehensive health check
 */
export async function performHealthCheck(): Promise<HealthStatus> {
  const errors: string[] = [];
  
  // Check database
  const dbHealthy = await checkDatabase();
  if (!dbHealthy) {
    errors.push('Database connection failed');
  }
  
  // Check memory
  const memory = checkMemory();
  if (memory.percentage > 90) {
    errors.push('High memory usage detected');
  }
  
  // Determine overall status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (errors.length > 0) {
    status = errors.length > 2 ? 'unhealthy' : 'degraded';
  }
  
  healthStatus = {
    status,
    database: dbHealthy,
    memory,
    uptime: Date.now() - startTime,
    errors,
    lastCheck: new Date()
  };
  
  return healthStatus;
}

/**
 * Log error and track error count
 */
export function logError(error: Error | string): void {
  const errorMessage = error instanceof Error ? error.message : error;
  console.error('Application error:', errorMessage);
  
  errorCount++;
  if (errorCount > MAX_ERRORS) {
    console.error('Too many errors detected, application may be unstable');
    // Could implement auto-restart logic here
  }
}

/**
 * Get current health status
 */
export function getHealthStatus(): HealthStatus {
  return healthStatus;
}

/**
 * Reset error count
 */
export function resetErrorCount(): void {
  errorCount = 0;
}

/**
 * Initialize health monitoring with periodic checks
 */
export function initializeHealthMonitoring(): void {
  // Perform health check every 30 seconds
  setInterval(async () => {
    try {
      await performHealthCheck();
      
      if (healthStatus.status === 'unhealthy') {
        console.warn('Application health degraded:', healthStatus.errors);
      }
    } catch (error) {
      logError(error as Error);
    }
  }, 30000);
  
  console.log('Health monitoring initialized');
}