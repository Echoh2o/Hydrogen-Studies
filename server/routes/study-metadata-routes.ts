/**
 * Study Metadata Routes
 * Provides authentic data counts for study categorizations and filtering
 */

import { Router } from "express";
import { db } from "../db";
import { studies } from "@shared/schema";
import { sql, count, eq, like, or, and } from "drizzle-orm";

const router = Router();

/**
 * Get counts for all keywords across studies
 */
router.get("/keywords/counts", async (req, res) => {
  try {
    // Get all unique keywords with counts
    const keywordCounts = await db
      .select({
        keyword: sql<string>`unnest(keywords)`.as('keyword'),
        count: count()
      })
      .from(studies)
      .where(sql`keywords IS NOT NULL AND array_length(keywords, 1) > 0`)
      .groupBy(sql`unnest(keywords)`)
      .orderBy(sql`count(*) DESC`);

    res.json(keywordCounts);
  } catch (error) {
    console.error("Error fetching keyword counts:", error);
    res.status(500).json({ error: "Failed to fetch keyword counts" });
  }
});

/**
 * Get counts for consumer categories
 */
router.get("/consumer-categories/counts", async (req, res) => {
  try {
    const categoryCounts = await db
      .select({
        category: sql<string>`trim(unnest(string_to_array(consumer_categories, ',')))`.as('category'),
        count: count()
      })
      .from(studies)
      .where(sql`consumer_categories IS NOT NULL AND consumer_categories != ''`)
      .groupBy(sql`trim(unnest(string_to_array(consumer_categories, ',')))`)
      .orderBy(sql`count(*) DESC`);

    res.json(categoryCounts);
  } catch (error) {
    console.error("Error fetching consumer category counts:", error);
    res.status(500).json({ error: "Failed to fetch consumer category counts" });
  }
});

/**
 * Get counts for study types
 */
router.get("/study-types/counts", async (req, res) => {
  try {
    const typeCounts = await db
      .select({
        studyType: studies.studyType,
        count: count()
      })
      .from(studies)
      .where(sql`study_type IS NOT NULL`)
      .groupBy(studies.studyType)
      .orderBy(sql`count(*) DESC`);

    res.json(typeCounts);
  } catch (error) {
    console.error("Error fetching study type counts:", error);
    res.status(500).json({ error: "Failed to fetch study type counts" });
  }
});

/**
 * Get counts for countries
 */
router.get("/countries/counts", async (req, res) => {
  try {
    const countryCounts = await db
      .select({
        country: studies.country,
        count: count()
      })
      .from(studies)
      .where(sql`country IS NOT NULL`)
      .groupBy(studies.country)
      .orderBy(sql`count(*) DESC`);

    res.json(countryCounts);
  } catch (error) {
    console.error("Error fetching country counts:", error);
    res.status(500).json({ error: "Failed to fetch country counts" });
  }
});

/**
 * Get counts for main categories
 */
router.get("/categories/counts", async (req, res) => {
  try {
    const categoryCounts = await db
      .select({
        category: studies.category,
        count: count()
      })
      .from(studies)
      .groupBy(studies.category)
      .orderBy(sql`count(*) DESC`);

    res.json(categoryCounts);
  } catch (error) {
    console.error("Error fetching category counts:", error);
    res.status(500).json({ error: "Failed to fetch category counts" });
  }
});

/**
 * Get counts for journals
 */
router.get("/journals/counts", async (req, res) => {
  try {
    const journalCounts = await db
      .select({
        journal: studies.journal,
        count: count()
      })
      .from(studies)
      .groupBy(studies.journal)
      .orderBy(sql`count(*) DESC`)
      .limit(50); // Top 50 journals

    res.json(journalCounts);
  } catch (error) {
    console.error("Error fetching journal counts:", error);
    res.status(500).json({ error: "Failed to fetch journal counts" });
  }
});

/**
 * Get count for specific keyword
 */
router.get("/keyword/:keyword/count", async (req, res) => {
  try {
    const { keyword } = req.params;
    
    const result = await db
      .select({ count: count() })
      .from(studies)
      .where(sql`keywords @> ARRAY[${keyword}]::text[]`);

    res.json({ keyword, count: result[0]?.count || 0 });
  } catch (error) {
    console.error("Error fetching keyword count:", error);
    res.status(500).json({ error: "Failed to fetch keyword count" });
  }
});

/**
 * Get count for specific consumer category
 */
router.get("/consumer-category/:category/count", async (req, res) => {
  try {
    const { category } = req.params;
    
    const result = await db
      .select({ count: count() })
      .from(studies)
      .where(like(studies.consumerCategories, `%${category}%`));

    res.json({ category, count: result[0]?.count || 0 });
  } catch (error) {
    console.error("Error fetching consumer category count:", error);
    res.status(500).json({ error: "Failed to fetch consumer category count" });
  }
});

/**
 * Get studies by author with pagination
 */
router.get("/author/:author/studies", async (req, res) => {
  try {
    const { author } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const authorStudies = await db
      .select()
      .from(studies)
      .where(like(studies.authors, `%${author}%`))
      .limit(limit)
      .offset(offset)
      .orderBy(studies.citationCount);

    const totalCount = await db
      .select({ count: count() })
      .from(studies)
      .where(like(studies.authors, `%${author}%`));

    res.json({
      studies: authorStudies,
      total: totalCount[0]?.count || 0,
      page,
      limit,
      totalPages: Math.ceil((totalCount[0]?.count || 0) / limit)
    });
  } catch (error) {
    console.error("Error fetching author studies:", error);
    res.status(500).json({ error: "Failed to fetch author studies" });
  }
});

/**
 * Get related studies based on keywords and category
 */
router.get("/related/:studyId", async (req, res) => {
  try {
    const { studyId } = req.params;
    const limit = parseInt(req.query.limit as string) || 5;

    // Get the current study to find related ones
    const currentStudy = await db
      .select()
      .from(studies)
      .where(eq(studies.id, parseInt(studyId)))
      .limit(1);

    if (!currentStudy.length) {
      return res.status(404).json({ error: "Study not found" });
    }

    const study = currentStudy[0];
    const keywords = study.keywords || [];

    // Find related studies based on shared keywords and category
    let relatedStudies;
    
    if (keywords.length > 0) {
      relatedStudies = await db
        .select()
        .from(studies)
        .where(
          and(
            sql`id != ${studyId}`,
            or(
              sql`keywords && ARRAY[${keywords.join(',')}]::text[]`,
              eq(studies.category, study.category)
            )
          )
        )
        .limit(limit)
        .orderBy(studies.citationCount);
    } else {
      // Fallback to same category
      relatedStudies = await db
        .select()
        .from(studies)
        .where(
          and(
            sql`id != ${studyId}`,
            eq(studies.category, study.category)
          )
        )
        .limit(limit)
        .orderBy(studies.citationCount);
    }

    res.json(relatedStudies);
  } catch (error) {
    console.error("Error fetching related studies:", error);
    res.status(500).json({ error: "Failed to fetch related studies" });
  }
});

export default router;