/**
 * Admin Monitoring Routes
 * Provides content completion analytics and process control for the admin monitoring dashboard.
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { studies } from "../../shared/schema";
import { sql, isNotNull, isNull, count } from "drizzle-orm";
import { requireAdmin } from "../auth";

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// Track active processes
const processStatus = {
  consumerContentGeneration: {
    isRunning: false,
    lastRun: null as string | null,
    studiesProcessed: 0,
  },
  researchEnrichment: {
    isRunning: false,
    lastRun: null as string | null,
    studiesProcessed: 0,
  },
  visualEnhancement: {
    isRunning: false,
    lastRun: null as string | null,
    studiesProcessed: 0,
  },
};

/**
 * GET /api/admin/monitoring/status
 * Returns current monitoring status including process states
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    res.json({
      stats: null, // Will be populated by /analyze
      processes: processStatus,
      lastCheck: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Monitoring status error:", error);
    res.status(500).json({ error: "Failed to get monitoring status" });
  }
});

/**
 * GET /api/admin/monitoring/analyze
 * Analyzes content completion across all studies
 */
router.get("/analyze", async (req: Request, res: Response) => {
  try {
    // Get total study count
    const [totalResult] = await db
      .select({ count: count() })
      .from(studies);
    const totalStudies = totalResult.count;

    // Phase 1: Plain language titles
    const [pltResult] = await db
      .select({ count: count() })
      .from(studies)
      .where(isNotNull(studies.plainLanguageTitle));
    const pltComplete = pltResult.count;

    // Phase 2: Consumer content (methods, results, conclusion)
    const [methodsResult] = await db
      .select({ count: count() })
      .from(studies)
      .where(isNotNull(studies.methods));
    const [resultsResult] = await db
      .select({ count: count() })
      .from(studies)
      .where(isNotNull(studies.results));
    const [conclusionResult] = await db
      .select({ count: count() })
      .from(studies)
      .where(isNotNull(studies.conclusion));

    // Research enrichment (has DOI or source URL)
    const [enrichedResult] = await db
      .select({ count: count() })
      .from(studies)
      .where(isNotNull(studies.doi));

    // Phase 3: Visual content (image URLs)
    const [imageResult] = await db
      .select({ count: count() })
      .from(studies)
      .where(isNotNull(studies.imageUrl));

    const pct = (n: number) =>
      totalStudies > 0 ? Math.round((n / totalStudies) * 100) : 0;

    const stats = {
      totalStudies,
      plainLanguageTitles: {
        complete: pltComplete,
        percentage: pct(pltComplete),
        missing: totalStudies - pltComplete,
      },
      consumerContent: {
        methods: {
          complete: methodsResult.count,
          percentage: pct(methodsResult.count),
          missing: totalStudies - methodsResult.count,
        },
        results: {
          complete: resultsResult.count,
          percentage: pct(resultsResult.count),
          missing: totalStudies - resultsResult.count,
        },
        conclusions: {
          complete: conclusionResult.count,
          percentage: pct(conclusionResult.count),
          missing: totalStudies - conclusionResult.count,
        },
      },
      researchEnrichment: {
        complete: enrichedResult.count,
        percentage: pct(enrichedResult.count),
        missing: totalStudies - enrichedResult.count,
      },
      visualContent: {
        complete: imageResult.count,
        percentage: pct(imageResult.count),
        missing: totalStudies - imageResult.count,
      },
      lastUpdated: new Date().toISOString(),
      completionStatus: {
        phase1Complete: pct(pltComplete) >= 99,
        phase2Complete:
          pct(methodsResult.count) >= 99 &&
          pct(resultsResult.count) >= 99 &&
          pct(conclusionResult.count) >= 99,
        phase3Complete: pct(imageResult.count) >= 99,
        allComplete:
          pct(pltComplete) >= 99 &&
          pct(methodsResult.count) >= 99 &&
          pct(resultsResult.count) >= 99 &&
          pct(conclusionResult.count) >= 99 &&
          pct(imageResult.count) >= 99,
      },
    };

    res.json(stats);
  } catch (error) {
    console.error("Content analysis error:", error);
    res.status(500).json({ error: "Failed to analyze content" });
  }
});

/**
 * POST /api/admin/trigger/consumer-content
 * Triggers consumer content generation for studies missing it
 */
router.post("/trigger/consumer-content", async (req: Request, res: Response) => {
  try {
    if (processStatus.consumerContentGeneration.isRunning) {
      return res.json({
        started: false,
        message: "Consumer content generation is already running.",
      });
    }

    processStatus.consumerContentGeneration.isRunning = true;
    processStatus.consumerContentGeneration.lastRun = new Date().toISOString();

    // Find studies missing consumer content
    const candidates = await db
      .select({ id: studies.id })
      .from(studies)
      .where(isNull(studies.methods))
      .limit(50);

    // Process in background
    (async () => {
      let processed = 0;
      for (const study of candidates) {
        try {
          // Use the existing content enrichment endpoint
          const response = await fetch(
            `http://localhost:${process.env.PORT || 5000}/api/content-enrichment/study/${study.id}`,
            { method: "POST", headers: { "Content-Type": "application/json" } },
          );
          if (response.ok) processed++;
        } catch (err) {
          console.error(`Failed to enrich study ${study.id}:`, err);
        }
      }
      processStatus.consumerContentGeneration.studiesProcessed += processed;
      processStatus.consumerContentGeneration.isRunning = false;
    })();

    res.json({
      started: true,
      message: `Processing ${candidates.length} studies for consumer content generation.`,
    });
  } catch (error) {
    processStatus.consumerContentGeneration.isRunning = false;
    console.error("Consumer content trigger error:", error);
    res.status(500).json({ error: "Failed to start consumer content generation" });
  }
});

/**
 * POST /api/admin/trigger/research-enrichment
 * Triggers research enrichment for studies missing DOI/external data
 */
router.post("/trigger/research-enrichment", async (req: Request, res: Response) => {
  try {
    if (processStatus.researchEnrichment.isRunning) {
      return res.json({
        started: false,
        message: "Research enrichment is already running.",
      });
    }

    processStatus.researchEnrichment.isRunning = true;
    processStatus.researchEnrichment.lastRun = new Date().toISOString();

    const candidates = await db
      .select({ id: studies.id })
      .from(studies)
      .where(isNull(studies.doi))
      .limit(50);

    (async () => {
      let processed = 0;
      for (const study of candidates) {
        try {
          const response = await fetch(
            `http://localhost:${process.env.PORT || 5000}/api/content-enrichment/study/${study.id}`,
            { method: "POST", headers: { "Content-Type": "application/json" } },
          );
          if (response.ok) processed++;
        } catch (err) {
          console.error(`Failed to enrich study ${study.id}:`, err);
        }
      }
      processStatus.researchEnrichment.studiesProcessed += processed;
      processStatus.researchEnrichment.isRunning = false;
    })();

    res.json({
      started: true,
      message: `Processing ${candidates.length} studies for research enrichment.`,
    });
  } catch (error) {
    processStatus.researchEnrichment.isRunning = false;
    console.error("Research enrichment trigger error:", error);
    res.status(500).json({ error: "Failed to start research enrichment" });
  }
});

/**
 * POST /api/admin/trigger/visual-enhancement
 * Triggers visual content generation for studies missing images
 */
router.post("/trigger/visual-enhancement", async (req: Request, res: Response) => {
  try {
    if (processStatus.visualEnhancement.isRunning) {
      return res.json({
        started: false,
        message: "Visual enhancement is already running.",
      });
    }

    processStatus.visualEnhancement.isRunning = true;
    processStatus.visualEnhancement.lastRun = new Date().toISOString();

    const candidates = await db
      .select({ id: studies.id })
      .from(studies)
      .where(isNull(studies.imageUrl))
      .limit(20);

    (async () => {
      let processed = 0;
      for (const study of candidates) {
        try {
          const response = await fetch(
            `http://localhost:${process.env.PORT || 5000}/api/content-enrichment/study/${study.id}`,
            { method: "POST", headers: { "Content-Type": "application/json" } },
          );
          if (response.ok) processed++;
        } catch (err) {
          console.error(`Failed to enrich study ${study.id}:`, err);
        }
      }
      processStatus.visualEnhancement.studiesProcessed += processed;
      processStatus.visualEnhancement.isRunning = false;
    })();

    res.json({
      started: true,
      message: `Processing ${candidates.length} studies for visual enhancement.`,
    });
  } catch (error) {
    processStatus.visualEnhancement.isRunning = false;
    console.error("Visual enhancement trigger error:", error);
    res.status(500).json({ error: "Failed to start visual enhancement" });
  }
});

/**
 * POST /api/admin/stop-processes
 * Emergency stop for all running processes
 */
router.post("/stop-processes", async (req: Request, res: Response) => {
  processStatus.consumerContentGeneration.isRunning = false;
  processStatus.researchEnrichment.isRunning = false;
  processStatus.visualEnhancement.isRunning = false;

  res.json({
    message: "All processes have been flagged to stop.",
  });
});

export default router;
