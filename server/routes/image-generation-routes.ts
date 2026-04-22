import { Router, Request, Response } from "express";
import { db } from "../db";
import { studies } from "../../shared/schema";
import { sql, isNull, or, eq } from "drizzle-orm";
import { logger } from "../utils/logger";

const router = Router();

// Tracks in-flight async batch/auto-generate jobs so the UI can poll status.
// Each image takes ~15-30s and the server has a 30s request timeout, so any
// batch of 2+ studies has to run in the background, not within the request.
interface BatchJobStatus {
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  startedAt: Date;
  finishedAt?: Date;
}
const imageBatchJobs = new Map<string, BatchJobStatus>();
let nextJobId = 1;

async function runImageBatchInBackground(jobId: string, studyIds: number[]): Promise<void> {
  const status = imageBatchJobs.get(jobId);
  if (!status) return;
  const { generateImageForStudy } = await import("../services/image-generator");
  for (const studyId of studyIds) {
    try {
      const result = await generateImageForStudy(studyId);
      if (result.success) {
        status.succeeded++;
      } else {
        status.failed++;
        logger.warn(
          `Image gen failed for study ${studyId}: ${result.message}`,
          "ImageGen",
        );
      }
    } catch (err) {
      status.failed++;
      logger.error(`Image gen threw for study ${studyId}`, err, "ImageGen");
    }
    status.completed++;
  }
  status.finishedAt = new Date();
  logger.info(
    `Image batch ${jobId} complete: ${status.succeeded} succeeded, ${status.failed} failed`,
    "ImageGen",
  );
  // Keep finished jobs in memory for 10 minutes so the UI can show the final status.
  setTimeout(() => imageBatchJobs.delete(jobId), 10 * 60 * 1000);
}

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
 * Generate images for multiple studies in the background. Returns 202
 * immediately with a jobId the client can poll via GET /jobs/:id.
 */
router.post("/batch-generate", async (req: Request, res: Response) => {
  try {
    const { studyIds } = req.body;
    if (!Array.isArray(studyIds) || studyIds.length === 0) {
      return res.status(400).json({ success: false, message: "No study IDs provided" });
    }
    const ids = studyIds.slice(0, 50) as number[];
    const jobId = `batch-${nextJobId++}`;
    imageBatchJobs.set(jobId, {
      total: ids.length,
      completed: 0,
      succeeded: 0,
      failed: 0,
      startedAt: new Date(),
    });
    void runImageBatchInBackground(jobId, ids);
    res.status(202).json({
      success: true,
      jobId,
      total: ids.length,
      message: `Started generating ${ids.length} images in the background. Poll /api/image-generation/jobs/${jobId} for progress.`,
    });
  } catch (error: any) {
    logger.error("Batch generate images error", error, "ImageGen");
    res.status(500).json({ success: false, message: error.message || "Batch generation failed" });
  }
});

/**
 * POST /auto-generate-all
 * Find all studies missing images (up to `limit`, default 100, max 500)
 * and kick off background generation. Returns 202 immediately.
 */
router.post("/auto-generate-all", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.body?.limit) || 100, 500);
    const rows = await db
      .select({ id: studies.id })
      .from(studies)
      .where(or(isNull(studies.imageUrl), eq(studies.imageUrl, "")))
      .limit(limit);

    if (rows.length === 0) {
      return res.json({ success: true, total: 0, message: "No studies need images" });
    }

    const ids = rows.map((r) => r.id);
    const jobId = `auto-${nextJobId++}`;
    imageBatchJobs.set(jobId, {
      total: ids.length,
      completed: 0,
      succeeded: 0,
      failed: 0,
      startedAt: new Date(),
    });
    void runImageBatchInBackground(jobId, ids);
    res.status(202).json({
      success: true,
      jobId,
      total: ids.length,
      message: `Started generating images for ${ids.length} studies in the background. Poll /api/image-generation/jobs/${jobId} for progress.`,
    });
  } catch (error: any) {
    logger.error("Auto-generate all images error", error, "ImageGen");
    res.status(500).json({ success: false, message: error.message || "Auto-generation failed" });
  }
});

/**
 * GET /jobs/:id — poll status of a batch/auto job.
 */
router.get("/jobs/:id", (req: Request, res: Response) => {
  const status = imageBatchJobs.get(req.params.id);
  if (!status) {
    return res.status(404).json({ success: false, message: "Job not found or expired" });
  }
  res.json({
    success: true,
    jobId: req.params.id,
    ...status,
    done: !!status.finishedAt,
  });
});

/**
 * GET /jobs — list all in-flight + recently-finished jobs.
 */
router.get("/jobs", (_req: Request, res: Response) => {
  const jobs = Array.from(imageBatchJobs.entries()).map(([id, s]) => ({
    jobId: id,
    ...s,
    done: !!s.finishedAt,
  }));
  res.json({ jobs });
});

export default router;
