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
import { requireAdmin } from "../auth";
import { db } from "../db";
import {
  pipelineQueue,
  discoveryRuns,
  studyCitations,
  researchDigests,
} from "@shared/schema";
import { eq, desc, sql, count } from "drizzle-orm";
import { logger } from "../utils/logger";

const router = Router();

// All pipeline routes require admin authentication
router.use(requireAdmin);

// ─── Status Overview ─────────────────────────────────────────────

router.get("/status", async (req, res) => {
  try {
    const [pending] = await db.select({ value: count() }).from(pipelineQueue).where(eq(pipelineQueue.status, "pending"));
    const [processing] = await db.select({ value: count() }).from(pipelineQueue).where(eq(pipelineQueue.status, "processing"));
    const [completed] = await db.select({ value: count() }).from(pipelineQueue).where(eq(pipelineQueue.status, "completed"));
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
        completed: Number(completed.value),
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
