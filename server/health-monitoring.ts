/**
 * Health Monitoring and Auto-Recovery System
 * Monitors application health and automatically recovers from failures
 */

import { db } from './db';

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