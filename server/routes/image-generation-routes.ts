import { Router, Request, Response } from "express";
import { db } from "../db";
import { studies } from "../../shared/schema";
import { sql, isNull, or, eq } from "drizzle-orm";
import { logger } from "../utils/logger";

const router = Router();

/**
 * GET /find-studies-needing-images
 * Returns study IDs that have no image_url set.
 */
router.get("/find-studies-needing-images", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const rows = await db
      .select({ id: studies.id })
      .from(studies)
      .where(or(isNull(studies.imageUrl), eq(studies.imageUrl, "")))
      .limit(limit);

    const studyIds = rows.map((r) => r.id);
    res.json({ success: true, studyIds, total: studyIds.length });
  } catch (error) {
    logger.error("Find studies needing images error", error, "ImageGen");
    res.status(500).json({ success: false, message: "Failed to find studies needing images" });
  }
});

/**
 * POST /generate/:studyId
 * Generate an AI image for a single study.
 */
router.post("/generate/:studyId", async (req: Request, res: Response) => {
  try {
    const studyId = Number(req.params.studyId);
    if (!studyId || isNaN(studyId)) {
      return res.status(400).json({ success: false, message: "Invalid study ID" });
    }

    const { generateImageForStudy } = await import("../services/image-generator");
    const result = await generateImageForStudy(studyId);
    res.json(result);
  } catch (error: any) {
    logger.error("Generate image error", error, "ImageGen");
    res.status(500).json({ success: false, message: error.message || "Image generation failed" });
  }
});

/**
 * POST /batch-generate
 * Generate images for multiple studies sequentially.
 */
router.post("/batch-generate", async (req: Request, res: Response) => {
  try {
    const { studyIds } = req.body;
    if (!Array.isArray(studyIds) || studyIds.length === 0) {
      return res.status(400).json({ success: false, message: "No study IDs provided" });
    }

    const { generateImageForStudy } = await import("../services/image-generator");
    const results: Array<{ studyId: number; success: boolean; message: string }> = [];

    for (const studyId of studyIds.slice(0, 50)) {
      try {
        const result = await generateImageForStudy(studyId);
        results.push({ studyId, ...result });
      } catch (err: any) {
        results.push({ studyId, success: false, message: err.message });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    res.json({
      success: true,
      message: `Generated ${succeeded}/${results.length} images`,
      results,
    });
  } catch (error: any) {
    logger.error("Batch generate images error", error, "ImageGen");
    res.status(500).json({ success: false, message: error.message || "Batch generation failed" });
  }
});

/**
 * POST /auto-generate-all
 * Find and generate images for all studies missing them (capped at limit).
 */
router.post("/auto-generate-all", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.body.limit) || 20, 100);
    const rows = await db
      .select({ id: studies.id })
      .from(studies)
      .where(or(isNull(studies.imageUrl), eq(studies.imageUrl, "")))
      .limit(limit);

    const { generateImageForStudy } = await import("../services/image-generator");
    const results: Array<{ studyId: number; success: boolean; message: string }> = [];

    for (const row of rows) {
      try {
        const result = await generateImageForStudy(row.id);
        results.push({ studyId: row.id, ...result });
      } catch (err: any) {
        results.push({ studyId: row.id, success: false, message: err.message });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    res.json({
      success: true,
      message: `Generated ${succeeded}/${results.length} images`,
      total: rows.length,
      results,
    });
  } catch (error: any) {
    logger.error("Auto-generate all images error", error, "ImageGen");
    res.status(500).json({ success: false, message: error.message || "Auto-generation failed" });
  }
});

export default router;
