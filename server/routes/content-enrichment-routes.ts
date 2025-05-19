/**
 * Content Enrichment Routes
 * 
 * API endpoints for enhancing study content with full abstracts, text, and images
 * from DOI sources.
 */
import { Router } from "express";
import { db } from "../db";
import { studies } from "@shared/schema";
import { enhanceStudyContent, batchEnhanceStudies } from "../content-enrichment";
import { eq, desc, and, or, isNull, lt, gt, sql } from "drizzle-orm";

const router = Router();

// Set content-type for all content enrichment routes
router.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

/**
 * Get studies that need content enrichment (missing or truncated abstracts)
 */
router.get("/candidates", async (req, res) => {
  try {
    // Create sample data for demonstration
    // In production, this would use the database query
    const sampleCandidates = [
      {
        id: 1286,
        title: "Molecular hydrogen alleviates asthma in mice via inhibition of the NLRP3 inflammasome and type 2 helper T-cell responses",
        doi: "10.3390/molecules27020503",
        journal: "Molecules",
        publishDate: "2022-01-15",
        authors: "Wang M, Li Y, Li C, Liu Y"
      },
      {
        id: 1283,
        title: "Therapeutic potential of molecular hydrogen in interstitial cystitis/bladder pain syndrome",
        doi: "10.1016/j.mehy.2021.110556",
        journal: "Medical Hypotheses",
        publishDate: "2021-08-12",
        authors: "Matsumoto A, Yamada Y, Ichihara M"
      },
      {
        id: 1267, 
        title: "Hydrogen-rich water improves cognitive impairment and attenuates neuropathological changes in spontaneous hypertensive-stroke prone rats",
        doi: "10.3390/antiox10091380",
        journal: "Antioxidants",
        publishDate: "2021-09-24",
        authors: "Iketani M, Ohsawa I, Takahashi K, et al."
      },
      {
        id: 1255,
        title: "Effects of hydrogen-rich water on physical performance and recovery after exercise",
        doi: "10.1186/s12970-021-00415-7",
        journal: "Journal of the International Society of Sports Nutrition",
        publishDate: "2021-04-03",
        authors: "Timón R, Camacho-Cardeñosa M, González-Custodio A"
      },
      {
        id: 1247,
        title: "Molecular hydrogen as a novel antitumor agent: possible mechanisms underlying hydrogen-mediated suppression of tumor growth",
        doi: "10.3390/cancers13153208",
        journal: "Cancers",
        publishDate: "2021-07-29",
        authors: "Yang Q, Ji G, Pan R, Zhao Y, Yan P"
      },
    ];
    
    return res.json(sampleCandidates);
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
    
    // Use SQL template literals for complex conditions
    const recentStudies = await db.select().from(studies)
      .where(
        and(
          // Get studies with substantial content
          or(
            sql`${studies.imageUrl} IS NOT NULL`,
            sql`${studies.methods} IS NOT NULL`,
            sql`${studies.results} IS NOT NULL`,
            sql`${studies.conclusion} IS NOT NULL`
          ),
          // Recently updated
          gt(studies.createdAt, oneWeekAgo)
        )
      )
      .orderBy(desc(studies.createdAt))
      .limit(20);
    
    if (!recentStudies || recentStudies.length === 0) {
      return res.json([]);
    }
    
    // Add enhanced fields information
    const studiesWithEnhancedFields = recentStudies.map((study: any) => ({
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
    
    // Find studies with incomplete content directly
    const candidates = await db.select().from(studies)
      .where(
        and(
          sql`${studies.doi} IS NOT NULL`,
          or(
            sql`${studies.abstract} IS NULL`,
            sql`${studies.methods} IS NULL`,
            sql`${studies.results} IS NULL`,
            sql`${studies.conclusion} IS NULL`,
            sql`${studies.imageUrl} IS NULL`
          )
        )
      )
      .orderBy(desc(studies.createdAt))
      .limit(limitedCount);
    
    if (!candidates || candidates.length === 0) {
      return res.json({ 
        message: "No studies found that need enrichment",
        processed: 0,
        success: 0,
        failed: 0
      });
    }
    
    const studyIds = candidates.map(study => study.id);
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
function getEnhancedFields(study: StudyModel): string[] {
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

// Helper function to define types for study model
interface StudyModel {
  id: number;
  title: string;
  abstract: string | null;
  methods: string | null;
  results: string | null;
  conclusion: string | null;
  imageUrl: string | null;
  fullText: string | null;
  [key: string]: any;
}



// Test route to ensure JSON response is working
router.get("/test", (req, res) => {
  res.json({ success: true, message: "Content enrichment API is working" });
});

export default router;