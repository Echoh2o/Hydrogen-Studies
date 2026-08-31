import { Router, Request, Response } from "express";
import { db } from "../db";
import { studies } from "../../shared/schema";
import { sql, isNull, or, eq } from "drizzle-orm";
import { logger } from "../utils/logger";
import { saveJobState, getJobState, listJobStates } from "../services/job-state-store";

const router = Router();

// Tracks in-flight async batch/auto-generate jobs so the UI can poll status.
// Each image takes ~15-30s and the server has a 30s request timeout, so any
// batch of 2+ studies has to run in the background, not within the request.
// State is ALSO write-through-persisted to transient_jobs (migration 021) so
// a deploy mid-batch leaves an "interrupted" record instead of the job
// vanishing from the poller (which the UI used to read as success).
interface BatchJobStatus {
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  startedAt: Date;
  finishedAt?: Date;
}
const imageBatchJobs = new Map<string, BatchJobStatus>();
// Boot-unique prefix: the old plain counter restarted at 1 on every deploy,
// so persisted job IDs from a previous process would collide with new ones.
const JOB_ID_EPOCH = Date.now().toString(36);
let nextJobId = 1;
function newJobId(kind: "batch" | "auto"): string {
  return `${kind}-${JOB_ID_EPOCH}-${nextJobId++}`;
}

function persistBatchStatus(jobId: string, status: BatchJobStatus): void {
  void saveJobState({
    id: `image-gen:${jobId}`,
    kind: "image-generation",
    status: status.finishedAt
      ? status.succeeded > 0 || status.failed === 0
        ? "completed"
        : "failed"
      : "running",
    progress: {
      total: status.total,
      completed: status.completed,
      succeeded: status.succeeded,
      failed: status.failed,
    },
    error: status.finishedAt && status.failed > 0 ? `${status.failed} image(s) failed` : null,
  });
}

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
    persistBatchStatus(jobId, status); // per-item write-through (~1 tiny upsert / 15-30s image)
  }
  status.finishedAt = new Date();
  persistBatchStatus(jobId, status);
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
    const jobId = newJobId("batch");
    const initial = {
      total: ids.length,
      completed: 0,
      succeeded: 0,
      failed: 0,
      startedAt: new Date(),
    };
    imageBatchJobs.set(jobId, initial);
    persistBatchStatus(jobId, initial);
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
    const jobId = newJobId("auto");
    const initial = {
      total: ids.length,
      completed: 0,
      succeeded: 0,
      failed: 0,
      startedAt: new Date(),
    };
    imageBatchJobs.set(jobId, initial);
    persistBatchStatus(jobId, initial);
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
router.get("/jobs/:id", async (req: Request, res: Response) => {
  const status = imageBatchJobs.get(req.params.id);
  if (!status) {
    // Fall back to the persisted row — after a restart the Map is empty, but
    // the DB still knows whether the job completed, failed, or was interrupted.
    const persisted = await getJobState(`image-gen:${req.params.id}`);
    if (persisted) {
      const p = (persisted.progress ?? {}) as Record<string, unknown>;
      return res.json({
        success: true,
        jobId: req.params.id,
        ...p,
        status: persisted.status,
        error: persisted.error,
        done: persisted.status !== "running",
      });
    }
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
 * GET /jobs — list all in-flight + recently-finished jobs (memory), plus
 * persisted history that survives restarts (completed/failed/interrupted).
 */
router.get("/jobs", async (_req: Request, res: Response) => {
  const jobs = Array.from(imageBatchJobs.entries()).map(([id, s]) => ({
    jobId: id,
    ...s,
    done: !!s.finishedAt,
  }));
  const history = (await listJobStates("image-generation", 10)).map((row) => ({
    jobId: row.id.replace(/^image-gen:/, ""),
    status: row.status,
    error: row.error,
    updatedAt: row.updatedAt,
    ...(typeof row.progress === "object" && row.progress ? row.progress : {}),
  }));
  res.json({ jobs, history });
});

/**
 * GET /backfill/stats — counts of blogs and studies that have a real
 * image vs. need one. Drives the progress dashboard on the admin page.
 */
router.get("/backfill/stats", async (_req: Request, res: Response) => {
  try {
    const { getImageBackfillStats } = await import("../services/image-backfill");
    const stats = await getImageBackfillStats();
    res.json(stats);
  } catch (err) {
    logger.error("Failed to fetch image backfill stats", err, "ImageGen");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

/**
 * POST /backfill/run — manual trigger for a backfill batch. Larger
 * default batch than the cron (10 each) since admin is presumed to be
 * watching and willing to pay the cost. Runs synchronously and returns
 * the batch summary.
 */
router.post("/backfill/run", async (req: Request, res: Response) => {
  try {
    const blogLimit = Math.min(Number(req.body?.blogLimit) || 10, 50);
    const studyLimit = Math.min(Number(req.body?.studyLimit) || 10, 50);
    const { runImageBackfillBatch } = await import("../services/image-backfill");
    const result = await runImageBackfillBatch({ blogLimit, studyLimit });
    res.json(result);
  } catch (err) {
    logger.error("Manual image backfill failed", err, "ImageGen");
    res.status(500).json({
      error: err instanceof Error ? err.message : "Backfill failed",
    });
  }
});

export default router;
