/**
 * Admin Image Generation Routes
 * Manual control for image generation instead of automatic background processing
 */
import { Router } from "express";
import { db } from "../db";
import { studies } from "../../shared/schema";
import { isNull, sql } from "drizzle-orm";
import { generateStudyImage } from "../enhanced-image-generator";
import {
  imageGenerationRateLimiter,
  generalApiRateLimiter,
} from "../rate-limiting";

const router = Router();

/**
 * Get statistics about studies with missing images
 */
router.get("/image-stats", async (req, res) => {
  try {
    const results = await db.execute(
      sql`SELECT 
        count(*) as total,
        count(case when image_url is not null then 1 end) as withImages,
        count(case when image_url is null then 1 end) as withoutImages
      FROM studies`,
    );

    const stats = results.rows[0] as any;

    res.json({
      success: true,
      data: {
        total: Number(stats.total || 0),
        withImages: Number(stats.withimages || 0),
        withoutImages: Number(stats.withoutimages || 0),
        completionPercentage: Math.round(
          (Number(stats.withimages || 0) / Number(stats.total || 1)) * 100,
        ),
      },
    });
  } catch (error) {
    console.error("Error getting image stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get image statistics",
      error: String(error),
    });
  }
});

/**
 * Get studies that need images (admin preview)
 */
router.get("/studies-needing-images", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const studiesNeedingImages = await db
      .select({
        id: studies.id,
        title: studies.title,
        abstract: studies.abstract,
        journal: studies.journal,
        publishDate: studies.publishDate,
      })
      .from(studies)
      .where(isNull(studies.imageUrl))
      .orderBy(studies.id)
      .limit(limit);

    res.json({
      success: true,
      data: studiesNeedingImages,
      count: studiesNeedingImages.length,
    });
  } catch (error) {
    console.error("Error getting studies needing images:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get studies needing images",
      error: String(error),
    });
  }
});

/**
 * Generate image for a specific study (admin action)
 * Strictly rate limited due to high cost of image generation
 */
router.post(
  "/generate-single/:studyId",
  imageGenerationRateLimiter,
  async (req, res) => {
    try {
      const studyId = parseInt(req.params.studyId);
      if (isNaN(studyId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid study ID",
        });
      }

      // Check if study exists and needs an image
      const study = await db
        .select()
        .from(studies)
        .where(sql`id = ${studyId}`)
        .limit(1);

      if (study.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Study not found",
        });
      }

      if (study[0].imageUrl) {
        return res.json({
          success: false,
          message: "Study already has an image",
          existingImageUrl: study[0].imageUrl,
        });
      }

      // Generate image
      const result = await generateStudyImage(studyId);

      res.json({
        success: result.success,
        message: result.success ? "Image generated successfully" : result.error,
        studyId: studyId,
        imageUrl: result.success ? result.imageUrl : null,
      });
    } catch (error) {
      console.error("Error generating single image:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate image",
        error: String(error),
      });
    }
  },
);

/**
 * Generate images for multiple studies (batch admin action)
 * Very strict rate limit due to batch nature and high cost
 */
router.post("/generate-batch", imageGenerationRateLimiter, async (req, res) => {
  try {
    const { studyIds, maxCount = 10 } = req.body;

    if (!Array.isArray(studyIds)) {
      return res.status(400).json({
        success: false,
        message: "studyIds must be an array",
      });
    }

    // Limit batch size to prevent overwhelming the system
    const limitedStudyIds = studyIds.slice(0, Math.min(maxCount, 10));

    const results = [];

    for (const studyId of limitedStudyIds) {
      try {
        const result = await generateStudyImage(studyId);
        results.push({
          studyId,
          success: result.success,
          message: result.success ? "Generated" : result.error,
          imageUrl: result.success ? result.imageUrl : null,
        });

        // Rate limiting: wait 10 seconds between generations
        if (limitedStudyIds.indexOf(studyId) < limitedStudyIds.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }
      } catch (error) {
        results.push({
          studyId,
          success: false,
          message: String(error),
          imageUrl: null,
        });
      }
    }

    const successful = results.filter((r) => r.success).length;

    res.json({
      success: true,
      message: `Batch complete: ${successful}/${results.length} images generated`,
      results: results,
      summary: {
        total: results.length,
        successful: successful,
        failed: results.length - successful,
      },
    });
  } catch (error) {
    console.error("Error in batch image generation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate batch images",
      error: String(error),
    });
  }
});

/**
 * Auto-generate images for all studies missing them (admin action)
 * Extremely strict rate limit - this is a very expensive operation
 */
router.post(
  "/generate-all-missing",
  imageGenerationRateLimiter,
  async (req, res) => {
    try {
      const { maxStudies = 50 } = req.body;

      // Get studies that need images
      const studiesNeedingImages = await db
        .select({ id: studies.id })
        .from(studies)
        .where(isNull(studies.imageUrl))
        .orderBy(studies.id)
        .limit(Math.min(maxStudies, 100));

      if (studiesNeedingImages.length === 0) {
        return res.json({
          success: true,
          message: "All studies already have images",
          processed: 0,
        });
      }

      const results = [];

      for (const study of studiesNeedingImages) {
        try {
          const result = await generateStudyImage(study.id);
          results.push({
            studyId: study.id,
            success: result.success,
            message: result.success ? "Generated" : result.error,
          });

          // Rate limiting: wait 10 seconds between generations
          if (
            studiesNeedingImages.indexOf(study) <
            studiesNeedingImages.length - 1
          ) {
            await new Promise((resolve) => setTimeout(resolve, 10000));
          }
        } catch (error) {
          results.push({
            studyId: study.id,
            success: false,
            message: String(error),
          });
        }
      }

      const successful = results.filter((r) => r.success).length;

      res.json({
        success: true,
        message: `Generated images for ${successful}/${results.length} studies`,
        processed: results.length,
        successful: successful,
        failed: results.length - successful,
        results: results,
      });
    } catch (error) {
      console.error("Error in generate all missing:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate all missing images",
        error: String(error),
      });
    }
  },
);

export default router;
