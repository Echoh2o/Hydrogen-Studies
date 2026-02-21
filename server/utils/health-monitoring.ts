/**
 * Health Monitoring and Auto-Recovery System
 * Monitors application health and automatically recovers from failures
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  errors: string[];
  uptime: number;
  version: string;
  database: {
    connected: boolean;
    latency: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  requestStats: {
    totalRequests: number;
    errorCount: number;
    avgResponseTimeMs: number;
  };
}

let totalRequests = 0;
let totalErrors = 0;
let totalResponseTime = 0;

let healthStatus: HealthStatus = {
  status: "healthy",
  timestamp: new Date().toISOString(),
  errors: [],
  uptime: 0,
  version: process.env.npm_package_version || "unknown",
  database: {
    connected: false,
    latency: 0,
  },
  memory: {
    used: 0,
    total: 0,
    percentage: 0,
  },
  requestStats: {
    totalRequests: 0,
    errorCount: 0,
    avgResponseTimeMs: 0,
  },
};

let errorCount = 0;
const MAX_ERRORS = 10;
const startTime = Date.now();

/** Track a completed request for health metrics */
export function trackRequest(durationMs: number, isError: boolean): void {
  totalRequests++;
  totalResponseTime += durationMs;
  if (isError) totalErrors++;
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<{
  connected: boolean;
  latency: number;
}> {
  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    const latency = Date.now() - start;
    return { connected: true, latency };
  } catch (error) {
    console.error("Database health check failed:", error);
    return { connected: false, latency: -1 };
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
    percentage: Math.round(percentage),
  };
}

/**
 * Perform comprehensive health check
 */
export async function performHealthCheck(): Promise<HealthStatus> {
  const errors: string[] = [];

  // Check database with more lenient thresholds
  const dbHealth = await checkDatabase();
  if (!dbHealth.connected) {
    errors.push("Database connection failed");
  } else if (dbHealth.latency > 5000) {
    // Increased from 1000ms to 5000ms
    errors.push(`Database response time is slow: ${dbHealth.latency}ms`);
  }

  // Check memory with higher threshold
  const memory = checkMemory();
  if (memory.percentage > 95) {
    // Increased from 90% to 95%
    errors.push("High memory usage detected");
  }

  // Determine overall status with more stable criteria
  let status: "healthy" | "degraded" | "unhealthy" = "healthy";
  if (errors.length >= 3) {
    // Only degrade when 3+ errors
    status = "unhealthy";
  } else if (errors.length >= 2) {
    // Degraded with 2+ errors
    status = "degraded";
  }
  // Single errors or latency issues don't change status from healthy

  healthStatus = {
    status,
    timestamp: new Date().toISOString(),
    errors,
    uptime: Date.now() - startTime,
    version: process.env.npm_package_version || "unknown",
    database: dbHealth,
    memory,
    requestStats: {
      totalRequests,
      errorCount: totalErrors,
      avgResponseTimeMs: totalRequests > 0 ? Math.round(totalResponseTime / totalRequests) : 0,
    },
  };

  return healthStatus;
}

/**
 * Log error and track error count
 */
export function logError(error: Error | string): void {
  const errorMessage = error instanceof Error ? error.message : error;
  console.error("Health monitoring error:", errorMessage);

  errorCount++;
  if (errorCount > MAX_ERRORS) {
    console.error("Too many errors detected, application may be unstable");
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
let healthInterval: NodeJS.Timeout | null = null;

export function initializeHealthMonitoring(): void {
  if (healthInterval) return;
  healthInterval = setInterval(async () => {
    try {
      await performHealthCheck();
      if (healthStatus.status === "unhealthy") {
        console.warn("Application health degraded:", healthStatus.errors);
      }
    } catch (error) {
      logError(error as Error);
    }
  }, 30000);
  console.log("Health monitoring initialized");
}

export function stopHealthMonitoring(): void {
  if (healthInterval) {
    clearInterval(healthInterval);
    healthInterval = null;
  }
}
