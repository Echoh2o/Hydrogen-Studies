/**
 * Admin Monitoring Routes
 * Provides content completion analytics and process control for the admin monitoring dashboard.
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { studies, studyQualityScores, studyReviewQueue, redirects, notFoundLog } from "../../shared/schema";
import { sql, isNotNull, isNull, count, eq, desc, gte } from "drizzle-orm";
import { requireAdmin } from "../auth";
import { jobScheduler } from "../services/job-scheduler";
import { RUBRIC_VERSION } from "../services/study-scoring-service";
import { ai } from "../services/ai-provider";

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
 * GET /api/admin/monitoring/system-health
 *
 * Unified snapshot of the newer subsystems that the old /analyze endpoint
 * doesn't cover: review queue depth, quality-score distribution, cron job
 * last-run timestamps, and redirect/404 stats. Single round-trip so the
 * admin page renders 4 cards off one query.
 */
router.get("/system-health", async (_req: Request, res: Response) => {
  try {
    // 1. Review queue — status breakdown + red-flag count among pending
    const [queueRow] = await db.execute<{
      pending: number;
      approved: number;
      rejected: number;
      pending_with_flags: number;
    }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
        COUNT(*) FILTER (WHERE status = 'pending' AND COALESCE(red_flag_count, 0) > 0)::int AS pending_with_flags
      FROM ${studyReviewQueue}
    `).then((r: any) => r.rows ?? r);

    // 2. Quality score distribution — bands + rubric freshness + red flags
    const [scoreRow] = await db.execute<{
      total_studies: number;
      scored: number;
      high: number;
      medium: number;
      low: number;
      with_flags: number;
      stale_rubric: number;
    }>(sql`
      SELECT
        (SELECT COUNT(*) FROM ${studies})::int AS total_studies,
        COUNT(*)::int AS scored,
        COUNT(*) FILTER (WHERE overall_score >= 70)::int AS high,
        COUNT(*) FILTER (WHERE overall_score >= 40 AND overall_score < 70)::int AS medium,
        COUNT(*) FILTER (WHERE overall_score < 40)::int AS low,
        COUNT(*) FILTER (WHERE red_flag_count > 0)::int AS with_flags,
        COUNT(*) FILTER (WHERE rubric_version IS NULL OR rubric_version <> ${RUBRIC_VERSION})::int AS stale_rubric
      FROM ${studyQualityScores}
    `).then((r: any) => r.rows ?? r);

    // 3. Cron jobs — last-run times from the scheduler
    const cron = jobScheduler.getStatus();

    // 4. Redirects + 404s
    const [redirectRow] = await db.execute<{
      total: number;
      active: number;
      total_hits: number;
    }>(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE is_active = true)::int AS active,
        COALESCE(SUM(hit_count), 0)::bigint AS total_hits
      FROM ${redirects}
    `).then((r: any) => r.rows ?? r);

    const [notFoundRow] = await db.execute<{
      unresolved: number;
      resolved: number;
      hits_last_7d: number;
    }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE resolved = false)::int AS unresolved,
        COUNT(*) FILTER (WHERE resolved = true)::int AS resolved,
        COALESCE(SUM(hit_count) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '7 days'), 0)::bigint AS hits_last_7d
      FROM ${notFoundLog}
    `).then((r: any) => r.rows ?? r);

    const topUnresolved = await db
      .select({
        path: notFoundLog.path,
        hitCount: notFoundLog.hitCount,
        lastSeenAt: notFoundLog.lastSeenAt,
      })
      .from(notFoundLog)
      .where(eq(notFoundLog.resolved, false))
      .orderBy(desc(notFoundLog.hitCount))
      .limit(5);

    // 5. AI provider — which providers are configured / primary vs fallback
    const aiStatus = ai.getProviderStatus();

    res.json({
      reviewQueue: {
        pending: Number(queueRow?.pending ?? 0),
        approved: Number(queueRow?.approved ?? 0),
        rejected: Number(queueRow?.rejected ?? 0),
        pendingWithFlags: Number(queueRow?.pending_with_flags ?? 0),
      },
      qualityScores: {
        totalStudies: Number(scoreRow?.total_studies ?? 0),
        scored: Number(scoreRow?.scored ?? 0),
        high: Number(scoreRow?.high ?? 0),
        medium: Number(scoreRow?.medium ?? 0),
        low: Number(scoreRow?.low ?? 0),
        withFlags: Number(scoreRow?.with_flags ?? 0),
        staleRubric: Number(scoreRow?.stale_rubric ?? 0),
        currentRubric: RUBRIC_VERSION,
      },
      cron,
      redirects: {
        total: Number(redirectRow?.total ?? 0),
        active: Number(redirectRow?.active ?? 0),
        totalHits: Number(redirectRow?.total_hits ?? 0),
        unresolved404s: Number(notFoundRow?.unresolved ?? 0),
        resolved404s: Number(notFoundRow?.resolved ?? 0),
        hitsLast7d: Number(notFoundRow?.hits_last_7d ?? 0),
        topUnresolved: topUnresolved.map((r) => ({
          path: r.path,
          hitCount: r.hitCount,
          lastSeenAt: r.lastSeenAt,
        })),
      },
      ai: aiStatus,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("System health error:", error);
    res.status(500).json({ error: "Failed to get system health" });
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
