import express from "express";
import {
  findStudiesNeedingEnhancement,
  enhanceStudyWithDoi,
  batchEnhanceStudiesWithDoi,
  ENHANCEABLE_FIELDS,
  calculateDataQualityScore,
} from "../services/doi-enhancer";

const router = express.Router();

/**
 * POST /api/doi/find-needing-enhancement
 * Find studies that need data enhancement
 */
router.post("/find-needing-enhancement", async (req, res) => {
  try {
    const { limit = 50, requireDoi = true, minQualityScore = 0 } = req.body;
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
    const studies = await findStudiesNeedingEnhancement({
      limit: limitNum,
      requireDoi,
      minQualityScore,
    });

    const studiesWithScores = studies.map((study) => ({
      ...study,
      qualityScore: calculateDataQualityScore(study),
    }));

    res.json({ studies: studiesWithScores, count: studiesWithScores.length });
  } catch (error) {
    console.error("Error finding studies needing enhancement:", error);
    res.status(500).json({ message: "Failed to find studies needing enhancement" });
  }
});

/**
 * GET /api/doi/enhanceable-fields
 * Return list of fields that can be enhanced
 */
router.get("/enhanceable-fields", async (_req, res) => {
  res.json({ fields: ENHANCEABLE_FIELDS });
});

/**
 * POST /api/doi/enhance/batch
 * Batch enhance studies using DOI data
 */
router.post("/enhance/batch", async (req, res) => {
  try {
    const { limit = 50 } = req.body;
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
    const result = await batchEnhanceStudiesWithDoi(limitNum);
    res.json({ success: true, result });
  } catch (error) {
    console.error("Error in batch DOI enhancement:", error);
    res.status(500).json({ message: "Failed to batch enhance studies" });
  }
});

/**
 * POST /api/doi/enhance
 * Enhance a single study using DOI data
 */
router.post("/enhance", async (req, res) => {
  try {
    const { studyId } = req.body;
    if (!studyId) {
      return res.status(400).json({ message: "studyId is required" });
    }
    const result = await enhanceStudyWithDoi(studyId);
    res.json(result);
  } catch (error) {
    console.error("Error enhancing study:", error);
    res.status(500).json({ message: "Failed to enhance study" });
  }
});

export default router;
