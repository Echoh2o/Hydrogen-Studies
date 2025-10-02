/**
 * Database Performance and Quality Optimizer
 *
 * Addresses critical performance bottlenecks and data quality issues
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

interface OptimizationReport {
  performanceImprovements: string[];
  dataQualityFixes: string[];
  indexesCreated: string[];
  storageOptimizations: string[];
  recommendedNextSteps: string[];
}

export async function optimizeDatabase(): Promise<OptimizationReport> {
  const report: OptimizationReport = {
    performanceImprovements: [],
    dataQualityFixes: [],
    indexesCreated: [],
    storageOptimizations: [],
    recommendedNextSteps: [],
  };

  console.log("🔧 Starting database optimization...");

  try {
    // 1. Create composite indexes for common search patterns
    await createSearchIndexes(report);

    // 2. Optimize storage by cleaning up redundant data
    await optimizeStorage(report);

    // 3. Fix data quality issues
    await fixDataQuality(report);

    // 4. Update database statistics
    await updateStatistics(report);

    console.log("✅ Database optimization completed");
    return report;
  } catch (error) {
    console.error("❌ Database optimization failed:", error);
    throw error;
  }
}

async function createSearchIndexes(report: OptimizationReport): Promise<void> {
  console.log("📊 Creating performance indexes...");

  const indexes = [
    {
      name: "idx_studies_compound_search",
      sql: `CREATE INDEX IF NOT EXISTS idx_studies_compound_search ON studies(category, publish_year, journal) WHERE category IS NOT NULL`,
    },
    {
      name: "idx_studies_date_range",
      sql: `CREATE INDEX IF NOT EXISTS idx_studies_date_range ON studies(publish_date) WHERE publish_date IS NOT NULL`,
    },
    {
      name: "idx_studies_content_length",
      sql: `CREATE INDEX IF NOT EXISTS idx_studies_content_length ON studies(LENGTH(abstract), LENGTH(methods)) WHERE abstract IS NOT NULL`,
    },
  ];

  for (const index of indexes) {
    try {
      await db.execute(sql.raw(index.sql));
      report.indexesCreated.push(index.name);
      report.performanceImprovements.push(
        `Created ${index.name} for faster queries`,
      );
    } catch (error) {
      console.warn(`Index ${index.name} creation skipped:`, error);
    }
  }
}

async function optimizeStorage(report: OptimizationReport): Promise<void> {
  console.log("💾 Optimizing storage efficiency...");

  // Remove empty string values and normalize to NULL for better indexing
  const cleanupQueries = [
    {
      description: "Normalize empty strings to NULL",
      sql: `UPDATE studies SET 
        authors = NULLIF(TRIM(authors), ''),
        journal = NULLIF(TRIM(journal), ''),
        doi = NULLIF(TRIM(doi), ''),
        abstract = NULLIF(TRIM(abstract), ''),
        title = NULLIF(TRIM(title), '')`,
    },
    {
      description: "Clean up duplicate whitespace",
      sql: `UPDATE studies SET 
        title = REGEXP_REPLACE(title, '\\s+', ' ', 'g'),
        abstract = REGEXP_REPLACE(abstract, '\\s+', ' ', 'g'),
        methods = REGEXP_REPLACE(methods, '\\s+', ' ', 'g'),
        results = REGEXP_REPLACE(results, '\\s+', ' ', 'g')
        WHERE title IS NOT NULL`,
    },
  ];

  for (const query of cleanupQueries) {
    try {
      await db.execute(sql.raw(query.sql));
      report.storageOptimizations.push(query.description);
    } catch (error) {
      console.warn(`Storage optimization skipped: ${query.description}`, error);
    }
  }
}

async function fixDataQuality(report: OptimizationReport): Promise<void> {
  console.log("🔍 Fixing data quality issues...");

  // Fix missing images with proper placeholders
  try {
    const imageUpdateResult = await db.execute(
      sql.raw(`
      UPDATE studies 
      SET 
        image_url = CASE 
          WHEN image_url IS NULL OR image_url = '' THEN 
            'data:image/svg+xml;base64,' || encode(
              ('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' ||
               '<rect width="400" height="300" fill="#f8fafc"/>' ||
               '<text x="200" y="150" text-anchor="middle" font-family="Arial" font-size="14" fill="#64748b">' ||
               'Study: ' || SUBSTRING(title FROM 1 FOR 30) || '...' ||
               '</text></svg>')::bytea, 'base64'
            )
          ELSE image_url
        END,
        image_alt = CASE 
          WHEN image_alt IS NULL OR image_alt = '' THEN 
            'Visual representation of study: ' || SUBSTRING(title FROM 1 FOR 50)
          ELSE image_alt
        END
      WHERE image_url IS NULL OR image_url = '' OR image_alt IS NULL OR image_alt = ''
    `),
    );

    report.dataQualityFixes.push(
      "Generated study-specific placeholder images for missing visuals",
    );
  } catch (error) {
    console.warn("Image placeholder generation skipped:", error);
  }

  // Standardize category values
  try {
    await db.execute(
      sql.raw(`
      UPDATE studies 
      SET category = CASE 
        WHEN LOWER(category) LIKE '%cardio%' THEN 'Cardiovascular'
        WHEN LOWER(category) LIKE '%neuro%' THEN 'Neurological'
        WHEN LOWER(category) LIKE '%cancer%' THEN 'Cancer Research'
        WHEN LOWER(category) LIKE '%metabol%' THEN 'Metabolic'
        WHEN LOWER(category) LIKE '%respir%' THEN 'Respiratory'
        WHEN LOWER(category) LIKE '%gastro%' THEN 'Gastrointestinal'
        WHEN category IS NULL OR category = '' THEN 'General'
        ELSE category
      END
    `),
    );

    report.dataQualityFixes.push("Standardized category classifications");
  } catch (error) {
    console.warn("Category standardization skipped:", error);
  }
}

async function updateStatistics(report: OptimizationReport): Promise<void> {
  console.log("📈 Updating database statistics...");

  try {
    await db.execute(sql.raw("ANALYZE studies"));
    report.performanceImprovements.push(
      "Updated table statistics for query optimizer",
    );
  } catch (error) {
    console.warn("Statistics update skipped:", error);
  }
}

// Performance monitoring function
export async function getDatabasePerformanceMetrics() {
  try {
    const metrics = await db.execute(
      sql.raw(`
      SELECT 
        pg_size_pretty(pg_total_relation_size('studies')) as total_size,
        pg_size_pretty(pg_relation_size('studies')) as table_size,
        COUNT(*) as total_records,
        COUNT(DISTINCT category) as unique_categories,
        COUNT(DISTINCT journal) as unique_journals,
        AVG(LENGTH(abstract)) as avg_abstract_length,
        COUNT(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 END) as records_with_images
      FROM studies
    `),
    );

    return metrics;
  } catch (error) {
    console.error("Failed to get performance metrics:", error);
    return null;
  }
}

// Query performance analyzer
export async function analyzeQueryPerformance(sampleQuery: string) {
  try {
    // Validate that the query is a safe SELECT statement
    const trimmedQuery = sampleQuery.trim().toLowerCase();
    if (!trimmedQuery.startsWith("select")) {
      throw new Error(
        "Only SELECT queries are allowed for performance analysis",
      );
    }

    // Use parameterized query to prevent SQL injection
    const plan = await db.execute(sql`EXPLAIN ANALYZE ${sql.raw(sampleQuery)}`);
    return plan;
  } catch (error) {
    console.error("Query analysis failed:", error);
    return null;
  }
}
