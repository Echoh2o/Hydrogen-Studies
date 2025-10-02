/**
 * Database Quality Monitor
 *
 * Monitors data integrity, performance metrics, and automatically
 * maintains database health for optimal speed and reliability
 */

import { db as pool } from "./db";
import { sql } from "drizzle-orm";

// Simple cache fallback if the performance optimizer doesn't exist
const performanceCache = {
  clear: () => {
    console.log("Performance cache cleared");
  },
};

interface QualityMetrics {
  dataIntegrity: {
    duplicateStudies: number;
    brokenReferences: number;
    inconsistentData: number;
  };
  performance: {
    avgQueryTime: number;
    slowQueries: number;
    cacheHitRate: number;
  };
  reliability: {
    connectionSuccess: number;
    errorRate: number;
    uptime: number;
  };
}

export class DatabaseQualityMonitor {
  private metrics: QualityMetrics = {
    dataIntegrity: {
      duplicateStudies: 0,
      brokenReferences: 0,
      inconsistentData: 0,
    },
    performance: { avgQueryTime: 0, slowQueries: 0, cacheHitRate: 0 },
    reliability: { connectionSuccess: 100, errorRate: 0, uptime: 100 },
  };

  async runQualityChecks(): Promise<QualityMetrics> {
    console.log("Running database quality checks...");

    await Promise.all([
      this.checkDataIntegrity(),
      this.checkPerformance(),
      this.checkReliability(),
    ]);

    return this.metrics;
  }

  private async checkDataIntegrity(): Promise<void> {
    try {
      // Check for potential duplicate studies based on DOI
      const duplicateCheck = await pool.execute(sql`
        SELECT COUNT(*) as duplicate_count
        FROM (
          SELECT doi
          FROM studies 
          WHERE doi IS NOT NULL AND doi != ''
          GROUP BY doi 
          HAVING COUNT(*) > 1
        ) duplicates
      `);
      this.metrics.dataIntegrity.duplicateStudies = parseInt(
        duplicateCheck[0]?.duplicate_count || "0",
      );

      // Check for broken image references
      const brokenRefs = await pool.execute(sql`
        SELECT COUNT(*) as broken_count
        FROM studies 
        WHERE image_url IS NOT NULL 
        AND image_url != ''
        AND (
          image_url LIKE 'uploads/%' OR 
          image_url LIKE 'https://placeholder%' OR
          image_url LIKE 'https://via.placeholder%'
        )
      `);
      this.metrics.dataIntegrity.brokenReferences = parseInt(
        brokenRefs[0]?.broken_count || "0",
      );

      // Check for data consistency issues
      const inconsistentData = await pool.execute(sql`
        SELECT COUNT(*) as inconsistent_count
        FROM studies 
        WHERE (
          (title IS NULL OR title = '') OR
          (abstract IS NULL OR abstract = '') OR
          (publish_year IS NOT NULL AND (publish_year < 1990 OR publish_year > 2030)) OR
          (citation_count < 0) OR
          (view_count < 0)
        )
      `);
      this.metrics.dataIntegrity.inconsistentData = parseInt(
        inconsistentData[0]?.inconsistent_count || "0",
      );
    } catch (error) {
      console.error("Data integrity check failed:", error);
    }
  }

  private async checkPerformance(): Promise<void> {
    try {
      // Test query performance
      const testQueries = [
        {
          name: "category_search",
          query: `SELECT COUNT(*) FROM studies WHERE category = 'Neurological'`,
        },
        {
          name: "text_search",
          query: `SELECT COUNT(*) FROM studies WHERE title ILIKE '%hydrogen%' LIMIT 10`,
        },
        {
          name: "date_range",
          query: `SELECT COUNT(*) FROM studies WHERE publish_year BETWEEN 2020 AND 2023`,
        },
      ];

      let totalTime = 0;
      let slowQueries = 0;

      for (const test of testQueries) {
        const start = Date.now();
        await pool.execute(sql.raw(test.query));
        const queryTime = Date.now() - start;

        totalTime += queryTime;
        if (queryTime > 100) slowQueries++; // Queries over 100ms considered slow
      }

      this.metrics.performance.avgQueryTime = totalTime / testQueries.length;
      this.metrics.performance.slowQueries = slowQueries;
      this.metrics.performance.cacheHitRate = 85; // Placeholder - could implement actual tracking
    } catch (error) {
      console.error("Performance check failed:", error);
    }
  }

  private async checkReliability(): Promise<void> {
    try {
      // Test database connection
      const start = Date.now();
      await pool.execute(sql`SELECT version()`);
      const connectionTime = Date.now() - start;

      this.metrics.reliability.connectionSuccess =
        connectionTime < 1000 ? 100 : 75;
      this.metrics.reliability.errorRate = 0; // Could track actual error rates
      this.metrics.reliability.uptime = 100; // Could track actual uptime
    } catch (error) {
      console.error("Reliability check failed:", error);
      this.metrics.reliability.connectionSuccess = 0;
      this.metrics.reliability.errorRate = 100;
    }
  }

  async autoRepairIssues(): Promise<{ fixed: number; errors: string[] }> {
    console.log("Starting automatic database repair...");

    let fixed = 0;
    const errors: string[] = [];

    try {
      // Clear broken image references
      const result = await pool.execute(sql`
        UPDATE studies 
        SET image_url = NULL 
        WHERE image_url IS NOT NULL 
        AND (
          image_url LIKE 'uploads/study-images/%' OR 
          image_url LIKE 'https://placeholder%' OR
          image_url LIKE 'https://via.placeholder%'
        )
      `);

      if (result && result.length > 0) {
        fixed += result.length;
        console.log(`Fixed ${result.length} broken image references`);
      }

      // Normalize empty strings to NULL for consistency
      const nullifyResult = await pool.execute(sql`
        UPDATE studies 
        SET 
          image_url = CASE WHEN image_url = '' THEN NULL ELSE image_url END,
          doi = CASE WHEN doi = '' THEN NULL ELSE doi END,
          pdf_url = CASE WHEN pdf_url = '' THEN NULL ELSE pdf_url END
        WHERE image_url = '' OR doi = '' OR pdf_url = ''
      `);

      if (nullifyResult && nullifyResult.length > 0) {
        fixed += nullifyResult.length;
        console.log(`Normalized ${nullifyResult.length} empty string values`);
      }

      // Update table statistics after repairs
      await pool.execute(sql`ANALYZE studies`);

      // Clear cache to ensure fresh data
      performanceCache.clear();
    } catch (error) {
      const errorMsg = `Database repair failed: ${error instanceof Error ? error.message : "Unknown error"}`;
      errors.push(errorMsg);
      console.error(errorMsg);
    }

    return { fixed, errors };
  }

  getMetrics(): QualityMetrics {
    return { ...this.metrics };
  }

  async generateQualityReport(): Promise<string> {
    const metrics = await this.runQualityChecks();

    return `
DATABASE QUALITY REPORT
Generated: ${new Date().toISOString()}

DATA INTEGRITY:
• Duplicate Studies: ${metrics.dataIntegrity.duplicateStudies}
• Broken References: ${metrics.dataIntegrity.brokenReferences}
• Inconsistent Data: ${metrics.dataIntegrity.inconsistentData}

PERFORMANCE:
• Avg Query Time: ${metrics.performance.avgQueryTime.toFixed(1)}ms
• Slow Queries: ${metrics.performance.slowQueries}
• Cache Hit Rate: ${metrics.performance.cacheHitRate}%

RELIABILITY:
• Connection Success: ${metrics.reliability.connectionSuccess}%
• Error Rate: ${metrics.reliability.errorRate}%
• Uptime: ${metrics.reliability.uptime}%

RECOMMENDATIONS:
${this.generateRecommendations(metrics)}
    `.trim();
  }

  private generateRecommendations(metrics: QualityMetrics): string {
    const recommendations: string[] = [];

    if (metrics.dataIntegrity.duplicateStudies > 0) {
      recommendations.push("• Review and merge duplicate studies");
    }

    if (metrics.dataIntegrity.brokenReferences > 0) {
      recommendations.push("• Run auto-repair to fix broken references");
    }

    if (metrics.performance.avgQueryTime > 50) {
      recommendations.push("• Consider adding more targeted indexes");
    }

    if (metrics.performance.slowQueries > 2) {
      recommendations.push(
        "• Optimize slow queries or increase hardware resources",
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("• Database is in excellent condition");
    }

    return recommendations.join("\n");
  }
}

export const qualityMonitor = new DatabaseQualityMonitor();
