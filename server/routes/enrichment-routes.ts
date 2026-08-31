/**
 * API routes for managing targeted studies enrichment
 */

import { Router } from "express";
import {
  startTargetedEnrichment,
  stopTargetedEnrichment,
  getEnrichmentStatus,
  getEnrichmentSummary,
  enrichStudyById,
} from "../services/targeted-enrichment";

const router = Router();

/**
 * Start the targeted enrichment process.
 *
 * Runs in the background and returns immediately — the run takes minutes
 * (up to 50 studies × an AI call each), far past any request timeout; the
 * UI polls /batch/status for progress. If a run is already in progress
 * (e.g. the scheduler's periodic cycle), say so honestly instead of the
 * old behavior of replying "started successfully" for a skipped run.
 */
router.post("/start", async (req, res) => {
  try {
    const { batchSize = 10 } = req.body;

    if (getEnrichmentStatus().isRunning) {
      return res.status(409).json({
        success: false,
        skipped: true,
        message: "Enrichment is already running — check /batch/status for progress",
      });
    }

    void startTargetedEnrichment(batchSize).catch((err) =>
      console.error("Background enrichment run failed:", err),
    );

    res.status(202).json({
      success: true,
      message: "Targeted enrichment started — poll /api/enrichment/batch/status for progress",
    });
  } catch (error) {
    console.error("Error starting enrichment:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Enrich a single study on demand. (The admin BatchEnrichmentPage "Single
 * Study" button posts here — this route previously did not exist, so the
 * button 404'd every time.)
 */
router.post("/batch/enrichStudy/:id", async (req, res) => {
  try {
    const studyId = parseInt(req.params.id);
    if (isNaN(studyId)) {
      return res.status(400).json({ success: false, error: "Invalid study ID" });
    }

    const found = await enrichStudyById(studyId);
    if (!found) {
      return res.status(404).json({ success: false, error: "Study not found" });
    }

    res.json({ success: true, message: `Study ${studyId} enriched` });
  } catch (error) {
    console.error("Error enriching single study:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Get current enrichment status
 */
router.get("/status", async (req, res) => {
  try {
    const status = getEnrichmentStatus();

    res.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error("Error getting enrichment status:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Get enrichment summary and progress
 */
router.get("/summary", async (req, res) => {
  try {
    const summary = await getEnrichmentSummary();

    res.json({
      success: true,
      summary: {
        total_studies: parseInt(summary.total_studies),
        with_keywords: parseInt(summary.with_keywords),
        with_health_conditions: parseInt(summary.with_health_conditions),
        with_body_systems: parseInt(summary.with_body_systems),
        with_conclusions: parseInt(summary.with_conclusions),
        keywords_percentage: Math.round(
          (summary.with_keywords / summary.total_studies) * 100,
        ),
        health_conditions_percentage: Math.round(
          (summary.with_health_conditions / summary.total_studies) * 100,
        ),
        body_systems_percentage: Math.round(
          (summary.with_body_systems / summary.total_studies) * 100,
        ),
        conclusions_percentage: Math.round(
          (summary.with_conclusions / summary.total_studies) * 100,
        ),
      },
    });
  } catch (error) {
    console.error("Error getting enrichment summary:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Batch enrichment endpoints
 */
router.get("/batch/status", async (req, res) => {
  try {
    const status = getEnrichmentStatus();

    res.json({
      success: true,
      status: {
        inProgress: status.isRunning,
        // Real denominator from the run's candidate query (was hardcoded 0,
        // which pinned the admin progress bar at 0% forever).
        totalToProcess: status.totalToProcess,
        processed: status.totalProcessed,
        failed: status.errors,
        startTime: status.startTime,
        estimatedCompletion: null,
      },
    });
  } catch (error) {
    console.error("Error getting batch status:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post("/batch/start", async (req, res) => {
  try {
    const { batchSize = 10 } = req.body;

    // Honest concurrency handling: previously this awaited the entire run,
    // then replied "started… processed: 0" AFTER it had finished (or been
    // skipped by the isRunning guard). Now: refuse when busy, else run in
    // the background and let the UI poll /batch/status.
    if (getEnrichmentStatus().isRunning) {
      return res.status(409).json({
        success: false,
        skipped: true,
        message: "Enrichment is already running — check /batch/status for progress",
      });
    }

    void startTargetedEnrichment(batchSize).catch((err) =>
      console.error("Background enrichment run failed:", err),
    );

    res.status(202).json({
      success: true,
      message: "Batch enrichment started",
      status: {
        inProgress: true,
        totalToProcess: null, // known once the candidate query runs; poll /batch/status
        processed: 0,
        failed: 0,
        startTime: new Date(),
        estimatedCompletion: null,
      },
    });
  } catch (error) {
    console.error("Error starting batch enrichment:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post("/batch/stop", async (req, res) => {
  try {
    // Cooperative stop — takes effect after the in-flight study finishes.
    // (This endpoint used to be a pure no-op that replied "stopped".)
    const wasRunning = stopTargetedEnrichment();
    res.json({
      success: true,
      message: wasRunning
        ? "Stop requested — enrichment will halt after the current study"
        : "No enrichment run in progress",
    });
  } catch (error) {
    console.error("Error stopping batch enrichment:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
