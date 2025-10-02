/**
 * API Performance Enhancement
 *
 * Adds memory caching and response optimization to existing routes
 */

import { Router } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";
import {
  getCachedStudy,
  getCachedSearch,
  getCachedStats,
} from "./simple-cache-system";

const router = Router();

/**
 * Enhanced study endpoint with caching and selective field loading
 */
router.get("/studies/enhanced/:id", async (req, res) => {
  try {
    const studyId = parseInt(req.params.id);

    if (isNaN(studyId)) {
      return res.status(400).json({ error: "Invalid study ID" });
    }

    const study = await getCachedStudy(studyId, async () => {
      const result = await db.execute(sql`
        SELECT 
          id, title, abstract, authors, journal, publish_date, category,
          methods, results, conclusion, doi, citation_url, source_url, pdf_url,
          peer_reviewed, publish_year, health_conditions, body_systems, 
          keywords, image_url, image_alt, sample_size, duration
        FROM studies 
        WHERE id = ${studyId}
      `);
      return result.rows[0] || null;
    });

    if (!study) {
      return res.status(404).json({ error: "Study not found" });
    }

    // Set caching headers
    res.set("Cache-Control", "public, max-age=300");
    res.set("ETag", `"study-${studyId}"`);

    res.json({
      success: true,
      data: study,
    });
  } catch (error) {
    console.error("Error fetching enhanced study:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Enhanced search with cursor-based pagination and caching
 */
router.get("/search/enhanced", async (req, res) => {
  try {
    const {
      q: query,
      category,
      startYear,
      endYear,
      hasCitations,
      limit = 20,
      cursor = 0,
    } = req.query;

    const searchParams = {
      query: query as string,
      category: category as string,
      startYear: startYear ? parseInt(startYear as string) : undefined,
      endYear: endYear ? parseInt(endYear as string) : undefined,
      hasCitations: hasCitations === "true",
      limit: Math.min(parseInt(limit as string) || 20, 50),
      cursor: parseInt(cursor as string) || 0,
    };

    const results = await getCachedSearch(searchParams, async () => {
      let whereConditions = [];
      let queryParams: any[] = [];
      let paramIndex = 1;

      if (searchParams.query) {
        whereConditions.push(
          `to_tsvector('english', title || ' ' || abstract) @@ plainto_tsquery('english', $${paramIndex})`,
        );
        queryParams.push(searchParams.query);
        paramIndex++;
      }

      if (searchParams.category) {
        whereConditions.push(`category = $${paramIndex}`);
        queryParams.push(searchParams.category);
        paramIndex++;
      }

      if (searchParams.startYear) {
        whereConditions.push(`publish_year >= $${paramIndex}`);
        queryParams.push(searchParams.startYear);
        paramIndex++;
      }

      if (searchParams.endYear) {
        whereConditions.push(`publish_year <= $${paramIndex}`);
        queryParams.push(searchParams.endYear);
        paramIndex++;
      }

      if (searchParams.hasCitations) {
        whereConditions.push(`citation_url IS NOT NULL AND citation_url != ''`);
      }

      if (searchParams.cursor > 0) {
        whereConditions.push(`id > $${paramIndex}`);
        queryParams.push(searchParams.cursor);
        paramIndex++;
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      const queryText = `
        SELECT 
          id, title, abstract, authors, journal, publish_date, category,
          publish_year, citation_url, source_url, health_conditions, 
          body_systems, image_url, peer_reviewed
        FROM studies 
        ${whereClause}
        ORDER BY 
          CASE WHEN citation_url IS NOT NULL AND citation_url != '' THEN 1 ELSE 2 END,
          publish_year DESC, 
          id ASC
        LIMIT $${paramIndex}
      `;

      queryParams.push(searchParams.limit + 1);
      const result = await db.execute(sql.raw(queryText, queryParams));

      const studies = result.rows.slice(0, searchParams.limit);
      const hasMore = result.rows.length > searchParams.limit;
      const nextCursor = hasMore ? studies[studies.length - 1]?.id : null;

      return {
        studies,
        hasMore,
        nextCursor,
        total: studies.length,
      };
    });

    res.set("Cache-Control", "public, max-age=180");
    res.json({
      success: true,
      data: results.studies,
      pagination: {
        hasMore: results.hasMore,
        nextCursor: results.nextCursor,
        limit: searchParams.limit,
      },
    });
  } catch (error) {
    console.error("Error in enhanced search:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

/**
 * Enhanced category statistics with caching
 */
router.get("/categories/enhanced-stats", async (req, res) => {
  try {
    const stats = await getCachedStats("categories", async () => {
      const result = await db.execute(sql`
        SELECT 
          category,
          COUNT(*) as total_studies,
          COUNT(CASE WHEN citation_url IS NOT NULL AND citation_url != '' THEN 1 END) as studies_with_citations,
          COUNT(CASE WHEN publish_year >= 2020 THEN 1 END) as recent_studies,
          MAX(publish_year) as latest_year,
          AVG(CASE WHEN sample_size IS NOT NULL THEN sample_size END) as avg_sample_size
        FROM studies 
        WHERE category IS NOT NULL
        GROUP BY category
        ORDER BY total_studies DESC
      `);
      return result.rows;
    });

    res.set("Cache-Control", "public, max-age=1800");
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching enhanced category stats:", error);
    res.status(500).json({ error: "Failed to fetch category statistics" });
  }
});

/**
 * Enhanced database overview with caching
 */
router.get("/stats/enhanced-overview", async (req, res) => {
  try {
    const stats = await getCachedStats("overview", async () => {
      const result = await db.execute(sql`
        SELECT 
          COUNT(*) as total_studies,
          COUNT(CASE WHEN citation_url IS NOT NULL AND citation_url != '' THEN 1 END) as studies_with_citations,
          COUNT(CASE WHEN source_url IS NOT NULL AND source_url != '' THEN 1 END) as studies_with_sources,
          COUNT(CASE WHEN pdf_url IS NOT NULL AND pdf_url != '' THEN 1 END) as studies_with_pdfs,
          COUNT(DISTINCT category) as unique_categories,
          COUNT(DISTINCT journal) as unique_journals,
          MIN(publish_year) as earliest_year,
          MAX(publish_year) as latest_year,
          ROUND(AVG(LENGTH(abstract)), 0) as avg_abstract_length,
          COUNT(CASE WHEN methods IS NOT NULL AND methods != '' THEN 1 END) as studies_with_methods,
          COUNT(CASE WHEN results IS NOT NULL AND results != '' THEN 1 END) as studies_with_results
        FROM studies
      `);
      return result.rows[0];
    });

    res.set("Cache-Control", "public, max-age=900");
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching enhanced database stats:", error);
    res.status(500).json({ error: "Failed to fetch database statistics" });
  }
});

/**
 * Batch study retrieval for efficient multiple study access
 */
router.post("/studies/batch-enhanced", async (req, res) => {
  try {
    const { ids, fields } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Invalid study IDs array" });
    }

    if (ids.length > 50) {
      return res
        .status(400)
        .json({ error: "Maximum 50 studies per batch request" });
    }

    // Allow selective field loading
    const selectedFields = fields || [
      "id",
      "title",
      "abstract",
      "authors",
      "journal",
      "publish_date",
      "category",
      "citation_url",
      "source_url",
      "image_url",
    ];

    const fieldsList = selectedFields.join(", ");
    const placeholders = ids.map((_, index) => `$${index + 1}`).join(", ");

    const result = await db.execute(
      sql.raw(
        `
      SELECT ${fieldsList}
      FROM studies 
      WHERE id IN (${placeholders})
      ORDER BY 
        CASE WHEN citation_url IS NOT NULL AND citation_url != '' THEN 1 ELSE 2 END,
        publish_year DESC
    `,
        ids,
      ),
    );

    res.set("Cache-Control", "public, max-age=300");
    res.json({
      success: true,
      data: result.rows,
      meta: {
        requested: ids.length,
        found: result.rows.length,
        fields: selectedFields,
      },
    });
  } catch (error) {
    console.error("Error in enhanced batch fetch:", error);
    res.status(500).json({ error: "Batch fetch failed" });
  }
});

export default router;
