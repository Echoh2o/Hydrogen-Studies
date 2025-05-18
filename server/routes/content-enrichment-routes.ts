/**
 * Content Enrichment Routes
 * 
 * API endpoints for enhancing study content with full abstracts, text, and images
 * from DOI sources.
 */
import { Router } from "express";
import { db } from "../db";
import { studies } from "@shared/schema";
import { enhanceStudyContent, batchEnhanceStudies, findStudiesForEnhancement } from "../content-enrichment";
import { eq, desc, and, or, isNull, lt, gt, sql } from "drizzle-orm";

const router = Router();

/**
 * Get studies that need content enrichment (missing or truncated abstracts)
 */
router.get("/candidates", async (req, res) => {
  try {
    const studyIds = await findStudiesForEnhancement(50);
    
    if (studyIds.length === 0) {
      return res.json([]);
    }
    
    const candidates = await db.query.studies.findMany({
      where: (eb) => eb.inArray(studies.id, studyIds),
      orderBy: [desc(studies.updatedAt)]
    });
    
    return res.json(candidates);
  } catch (error) {
    console.error("Error getting enrichment candidates:", error);
    return res.status(500).json({ error: "Failed to get enrichment candidates" });
  }
});

/**
 * Get recently enriched studies
 */
router.get("/recent", async (req, res) => {
  try {
    // Limit to 20 most recent studies that have non-empty fields
    // and were recently updated
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const recentlyEnriched = await db.select().from(studies)
      .where(
        or(
          sql`length(${studies.abstract}) > 500`,
          sql`length(${studies.methods}) > 200`,
          sql`length(${studies.results}) > 200`, 
          sql`length(${studies.conclusion}) > 200`,
          sql`${studies.imageUrl} IS NOT NULL`
        )
      )
      .where(sql`${studies.updatedAt} > ${oneWeekAgo}`)
      .orderBy(desc(studies.updatedAt))
      .limit(20);
    
    // Add enhanced fields information
    const studiesWithEnhancedFields = recentlyEnriched.map(study => ({
      ...study,
      enhancedFields: getEnhancedFields(study)
    }));
    
    return res.json(studiesWithEnhancedFields);
  } catch (error) {
    console.error("Error getting recently enriched studies:", error);
    return res.status(500).json({ error: "Failed to get recently enriched studies" });
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
    const limitedCount = Math.min(50, Math.max(1, count)); // Limit between 1 and 50
    
    const studyIds = await findStudiesForEnhancement(limitedCount);
    
    if (studyIds.length === 0) {
      return res.json({ 
        message: "No studies found that need enrichment",
        processed: 0,
        success: 0,
        failed: 0
      });
    }
    
    const results = await batchEnhanceStudies(studyIds);
    return res.json(results);
  } catch (error) {
    console.error("Error batch enhancing studies:", error);
    return res.status(500).json({ error: "Failed to batch enhance studies" });
  }
});

/**
 * Helper function to determine which fields were likely enhanced
 * based on the content of the study
 */
function getEnhancedFields(study: any): string[] {
  const enhancedFields: string[] = [];
  
  if (study.abstract && study.abstract.length > 500) {
    enhancedFields.push('Abstract');
  }
  
  if (study.methods && study.methods.length > 200) {
    enhancedFields.push('Methods');
  }
  
  if (study.results && study.results.length > 200) {
    enhancedFields.push('Results');
  }
  
  if (study.conclusion && study.conclusion.length > 200) {
    enhancedFields.push('Conclusion');
  }
  
  if (study.imageUrl) {
    enhancedFields.push('Image');
  }
  
  if (study.fullText && study.fullText.length > 1000) {
    enhancedFields.push('Full Text');
  }
  
  return enhancedFields;
}

// Helper for the IN operator since TypeScript complains about the raw usage
function inArray(column: any, values: any[]) {
  return values.length > 0 ? column.in(values) : undefined;
}

export default router;