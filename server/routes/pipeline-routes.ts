/**
 * Research Intelligence Pipeline API Routes
 *
 * Admin endpoints for managing the autonomous research pipeline:
 * - Discovery triggers and history
 * - Pipeline queue management
 * - Citation network building
 * - Weekly digest CRUD
 */

import { Router } from "express";
import { requireAdmin, isAdminOrEditor } from "../auth";
import { db } from "../db";
import {
  pipelineQueue,
  discoveryRuns,
  studyCitations,
  researchDigests,
  studies,
} from "@shared/schema";
import { eq, desc, sql, count } from "drizzle-orm";
import { logger } from "../utils/logger";

/**
 * Trigger content generation waterfall for an approved study.
 * Runs async (fire-and-forget) — generates blog articles + images immediately
 * instead of waiting for the 6-hour batch timer.
 */
async function triggerContentWaterfall(studyId: number) {
  const study = await db.query.studies.findFirst({
    where: eq(studies.id, studyId),
  });

  if (!study || !study.plainLanguageTitle || !study.category) {
    logger.info("Skipping content waterfall — study not enriched yet", "PipelineRoutes", { studyId });
    return;
  }

  logger.info("Triggering content waterfall for approved study", "PipelineRoutes", {
    studyId,
    title: study.plainLanguageTitle,
  });

  const { generateBlogArticlesForStudy } = await import("../services/blog-generator-enhanced");
  const result = await generateBlogArticlesForStudy(study, {
    count: 1,
    fallbackToBasic: true,
  });

  logger.info("Content waterfall complete", "PipelineRoutes", {
    studyId,
    articlesGenerated: result.articles.length,
  });
}

const router = Router();

// Read endpoints (GET) are available to admins and editors so the dashboard
// can display pipeline status. Write endpoints (POST/PUT/DELETE) remain admin-only.
router.use((req, res, next) => {
  if (req.method === "GET") {
    return isAdminOrEditor(req, res, next);
  }
  return requireAdmin(req, res, next);
});

// ─── Status Overview ─────────────────────────────────────────────

router.get("/status", async (req, res) => {
  try {
    const [pending] = await db.select({ value: count() }).from(pipelineQueue).where(eq(pipelineQueue.status, "pending"));
    const [processing] = await db.select({ value: count() }).from(pipelineQueue).where(eq(pipelineQueue.status, "processing"));
    const [awaitingApproval] = await db.select({ value: count() }).from(pipelineQueue).where(eq(pipelineQueue.status, "awaiting_approval"));
    const [completed] = await db.select({ value: count() }).from(pipelineQueue).where(eq(pipelineQueue.status, "completed"));
    const [rejected] = await db.select({ value: count() }).from(pipelineQueue).where(eq(pipelineQueue.status, "rejected"));
    const [failed] = await db.select({ value: count() }).from(pipelineQueue).where(eq(pipelineQueue.status, "failed"));
    const [totalCitations] = await db.select({ value: count() }).from(studyCitations);
    const [totalDigests] = await db.select({ value: count() }).from(researchDigests).where(eq(researchDigests.isPublished, true));

    const lastRun = await db.query.discoveryRuns.findFirst({
      orderBy: [desc(discoveryRuns.createdAt)],
    });

    res.json({
      queue: {
        pending: Number(pending.value),
        processing: Number(processing.value),
        awaitingApproval: Number(awaitingApproval.value),
        completed: Number(completed.value),
        rejected: Number(rejected.value),
        failed: Number(failed.value),
      },
      citations: Number(totalCitations.value),
      publishedDigests: Number(totalDigests.value),
      lastDiscoveryRun: lastRun
        ? {
            id: lastRun.id,
            status: lastRun.status,
            createdAt: lastRun.createdAt,
            newCount: lastRun.newCount,
            queuedCount: lastRun.queuedCount,
          }
        : null,
    });
  } catch (error) {
    logger.error("Pipeline status failed", error, "PipelineRoutes");
    res.status(500).json({ error: "Failed to get pipeline status" });
  }
});

// ─── Pipeline Queue ──────────────────────────────────────────────

router.get("/queue", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const status = req.query.status as string;
    const offset = (page - 1) * limit;

    let query = db.select().from(pipelineQueue).orderBy(desc(pipelineQueue.createdAt)).limit(limit).offset(offset);

    const items = status
      ? await db.select().from(pipelineQueue).where(eq(pipelineQueue.status, status)).orderBy(desc(pipelineQueue.createdAt)).limit(limit).offset(offset)
      : await db.select().from(pipelineQueue).orderBy(desc(pipelineQueue.createdAt)).limit(limit).offset(offset);

    const [totalResult] = status
      ? await db.select({ value: count() }).from(pipelineQueue).where(eq(pipelineQueue.status, status))
      : await db.select({ value: count() }).from(pipelineQueue);

    res.json({
      items,
      total: Number(totalResult.value),
      page,
      limit,
      totalPages: Math.ceil(Number(totalResult.value) / limit),
    });
  } catch (error) {
    logger.error("Pipeline queue fetch failed", error, "PipelineRoutes");
    res.status(500).json({ error: "Failed to get pipeline queue" });
  }
});

// ─── Discovery ───────────────────────────────────────────────────

router.post("/discover", async (req, res) => {
  try {
    const { runDiscovery } = await import("../services/research-discovery-engine");
    const result = await runDiscovery();
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error("Manual discovery failed", error, "PipelineRoutes");
    res.status(500).json({ error: "Discovery run failed" });
  }
});

router.get("/runs", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const runs = await db
      .select()
      .from(discoveryRuns)
      .orderBy(desc(discoveryRuns.createdAt))
      .limit(limit);
    res.json({ runs });
  } catch (error) {
    logger.error("Discovery runs fetch failed", error, "PipelineRoutes");
    res.status(500).json({ error: "Failed to get discovery runs" });
  }
});

// ─── Study Approval ─────────────────────────────────────────────

// Approve a discovered study: creates it in the studies table and triggers content waterfall
router.post("/approve/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    // Get the pipeline item
    const [item] = await db.select().from(pipelineQueue).where(eq(pipelineQueue.id, id)).limit(1);
    if (!item) return res.status(404).json({ error: "Pipeline item not found" });

    if (item.status === "completed") {
      return res.status(400).json({ error: "Already approved and created" });
    }

    // Create the study from the pipeline results
    const { createStudyFromPipelineItem } = await import("../services/study-analysis-pipeline");
    const studyId = await createStudyFromPipelineItem(id);

    // Trigger content generation immediately (blog, images) — don't wait for 6-hour batch timer
    triggerContentWaterfall(studyId).catch((err) =>
      logger.error("Content waterfall failed for approved study", err, "PipelineRoutes", { studyId })
    );

    res.json({ success: true, studyId, message: "Study approved and content waterfall triggered" });
  } catch (error) {
    logger.error("Study approval failed", error, "PipelineRoutes");
    res.status(500).json({ error: "Approval failed" });
  }
});

// Reject a discovered study: removes it from the queue
router.post("/reject/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    await db.update(pipelineQueue).set({
      status: "rejected",
      updatedAt: new Date(),
    }).where(eq(pipelineQueue.id, id));

    res.json({ success: true, message: "Study rejected" });
  } catch (error) {
    logger.error("Study rejection failed", error, "PipelineRoutes");
    res.status(500).json({ error: "Rejection failed" });
  }
});

// Bulk approve multiple studies
router.post("/approve-bulk", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids must be a non-empty array" });
    }

    const { createStudyFromPipelineItem } = await import("../services/study-analysis-pipeline");
    const results = { approved: 0, failed: 0, studyIds: [] as number[] };

    for (const id of ids) {
      try {
        const studyId = await createStudyFromPipelineItem(id);
        results.approved++;
        results.studyIds.push(studyId);
        // Trigger content generation for each approved study
        triggerContentWaterfall(studyId).catch((err) =>
          logger.error("Content waterfall failed for bulk-approved study", err, "PipelineRoutes", { studyId })
        );
      } catch {
        results.failed++;
      }
    }

    res.json({ success: true, ...results });
  } catch (error) {
    logger.error("Bulk approval failed", error, "PipelineRoutes");
    res.status(500).json({ error: "Bulk approval failed" });
  }
});

// ─── Processing ──────────────────────────────────────────────────

router.post("/process", async (req, res) => {
  try {
    const { processPipelineQueue } = await import("../services/study-analysis-pipeline");
    const result = await processPipelineQueue();
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error("Manual processing failed", error, "PipelineRoutes");
    res.status(500).json({ error: "Processing failed" });
  }
});

router.post("/reprocess/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const { reprocessItem } = await import("../services/study-analysis-pipeline");
    await reprocessItem(id);
    res.json({ success: true, message: `Item ${id} queued for reprocessing` });
  } catch (error) {
    logger.error("Reprocess failed", error, "PipelineRoutes");
    res.status(500).json({ error: "Reprocess failed" });
  }
});

// ─── Digests ─────────────────────────────────────────────────────

router.get("/digests", async (req, res) => {
  try {
    const { getDigestArchive } = await import("../services/research-digest-generator");
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const digests = await getDigestArchive(limit, offset);
    res.json({ digests });
  } catch (error) {
    logger.error("Digest list failed", error, "PipelineRoutes");
    res.status(500).json({ error: "Failed to get digests" });
  }
});

router.post("/digests/generate", async (req, res) => {
  try {
    const { generateWeeklyDigest } = await import("../services/research-digest-generator");
    const digest = await generateWeeklyDigest();
    res.json({ success: true, digest });
  } catch (error) {
    logger.error("Digest generation failed", error, "PipelineRoutes");
    res.status(500).json({ error: "Digest generation failed" });
  }
});

// ─── Citations ───────────────────────────────────────────────────

router.get("/citations/:studyId", async (req, res) => {
  try {
    const studyId = parseInt(req.params.studyId);
    if (isNaN(studyId)) return res.status(400).json({ error: "Invalid study ID" });

    const { getCitationGraph } = await import("../services/citation-network-builder");
    const graph = await getCitationGraph(studyId);
    res.json(graph);
  } catch (error) {
    logger.error("Citation graph failed", error, "PipelineRoutes");
    res.status(500).json({ error: "Failed to get citation graph" });
  }
});

router.post("/citations/build", async (req, res) => {
  try {
    const { buildCitationNetwork } = await import("../services/citation-network-builder");
    const result = await buildCitationNetwork();
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error("Citation build failed", error, "PipelineRoutes");
    res.status(500).json({ error: "Citation build failed" });
  }
});

export default router;
