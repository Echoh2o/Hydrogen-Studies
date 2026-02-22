/**
 * Content Enrichment Routes
 *
 * API endpoints for enhancing study content with full abstracts, text, and images
 * from DOI sources.
 */
import { Router } from "express";
import { db } from "../db";
import { studies } from "@shared/schema";
import {
  enhanceStudyContent,
  batchEnhanceStudies,
  findStudiesForEnhancement,
} from "../services/content-enrichment";
import { eq, desc, and, or, isNull, lt, gt, sql } from "drizzle-orm";

const router = Router();

// Set content-type for all content enrichment routes
router.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  next();
});

/**
 * Get studies that need content enrichment (missing or truncated abstracts)
 */
router.get("/candidates", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;

    // Find studies with DOIs that have incomplete content
    const candidates = await db
      .select({
        id: studies.id,
        title: studies.title,
        doi: studies.doi,
        journal: studies.journal,
        publishDate: studies.publishDate,
        authors: studies.authors,
      })
      .from(studies)
      .where(
        and(
          sql`${studies.doi} IS NOT NULL AND ${studies.doi} != ''`,
          or(
            isNull(studies.abstract),
            sql`LENGTH(${studies.abstract}) < 200`,
            isNull(studies.methods),
            isNull(studies.results),
            isNull(studies.conclusion),
            isNull(studies.imageUrl),
          ),
        ),
      )
      .orderBy(desc(studies.createdAt))
      .limit(limit);

    return res.json(candidates);
  } catch (error) {
    console.error("Error getting enrichment candidates:", error);
    return res
      .status(500)
      .json({ error: "Failed to get enrichment candidates" });
  }
});

/**
 * Get recently enriched studies
 */
router.get("/recent", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    // Find studies that have been enriched (have multiple completed fields)
    const recentStudies = await db
      .select({
        id: studies.id,
        title: studies.title,
        doi: studies.doi,
        journal: studies.journal,
        publishDate: studies.publishDate,
        authors: studies.authors,
        abstract: studies.abstract,
        methods: studies.methods,
        results: studies.results,
        conclusion: studies.conclusion,
        imageUrl: studies.imageUrl,
        createdAt: studies.createdAt,
      })
      .from(studies)
      .where(
        and(
          sql`${studies.doi} IS NOT NULL AND ${studies.doi} != ''`,
          sql`${studies.abstract} IS NOT NULL AND LENGTH(${studies.abstract}) > 200`,
        ),
      )
      .orderBy(desc(studies.createdAt))
      .limit(limit);

    // Add enhancedFields array to each study
    const enrichedStudies = recentStudies.map((study) => {
      const enhancedFields: string[] = [];
      if (study.abstract && study.abstract.length > 200) enhancedFields.push("Abstract");
      if (study.methods && study.methods.length > 50) enhancedFields.push("Methods");
      if (study.results && study.results.length > 50) enhancedFields.push("Results");
      if (study.conclusion && study.conclusion.length > 50) enhancedFields.push("Conclusion");
      if (study.imageUrl) enhancedFields.push("Image");

      return {
        id: study.id,
        title: study.title,
        doi: study.doi,
        journal: study.journal,
        publishDate: study.publishDate,
        authors: study.authors,
        enhancedFields,
      };
    });

    return res.json(enrichedStudies);
  } catch (error) {
    console.error("Error getting recently enriched studies:", error);
    return res
      .status(500)
      .json({ error: "Failed to get recently enriched studies" });
  }
});

/**
 * Enhance a single study content by id
 */
router.post("/study/:id", async (req, res) => {
  try {
    const studyId = parseInt(req.params.id);
    if (isNaN(studyId)) {
      return res.status(400).json({ error: "Invalid study ID" });
    }

    const result = await enhanceStudyContent(studyId);
    return res.json(result);
  } catch (error) {
    console.error("Error enhancing study:", error);
    return res.status(500).json({ error: "Failed to enhance study content" });
  }
});

/**
 * Batch enhance multiple studies
 */
router.post("/batch", async (req, res) => {
  try {
    const { count = 5 } = req.body;
    const limitedCount = Math.min(50, Math.max(1, count));

    // Find studies that need enhancement
    const studyIds = await findStudiesForEnhancement(limitedCount);

    if (studyIds.length === 0) {
      return res.json({
        message: "No studies found that need enhancement",
        processed: 0,
        success: 0,
        failed: 0,
      });
    }

    // Process the studies
    const result = await batchEnhanceStudies(studyIds);

    return res.json({
      message: result.message,
      processed: result.processed,
      success: result.success,
      failed: result.failed,
    });
  } catch (error) {
    console.error("Error batch enhancing studies:", error);
    return res.status(500).json({ error: "Failed to batch enhance studies" });
  }
});

// Test route to ensure JSON response is working
router.get("/test", (req, res) => {
  res.json({ success: true, message: "Content enrichment API is working" });
});

export default router;
