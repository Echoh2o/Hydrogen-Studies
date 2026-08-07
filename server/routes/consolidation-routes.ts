/**
 * Admin Content Consolidation Routes
 *
 * Endpoints for the corpus-consolidation engine that fixes the mass
 * keyword cannibalization from per-study article generation.
 *
 * ORCHESTRATOR NOTE: mount this router at /api/admin/consolidation
 * in server/app.ts (above any wide /api/admin catch-all).
 */
import { Router, Request, Response } from "express";
import { requireAdmin } from "../auth";
import {
  analyzeConsolidation,
  executeConsolidation,
  getConsolidationStatus,
} from "../services/content-consolidation";

const router = Router();

// Every endpoint here is admin-only — reports expose the full corpus and
// execute mutates publish state.
router.use(requireAdmin);

/** GET /api/admin/consolidation/report — full cluster analysis (read-only).
 *  Clusters all blog articles by topic key, picks winners from 90d GSC
 *  impressions, and projects the post-consolidation corpus size.
 *  Heavy (scans the whole corpus + 90d GSC aggregates) — can take a while.
 */
router.get("/report", async (_req: Request, res: Response) => {
  try {
    const report = await analyzeConsolidation();
    res.json(report);
  } catch (error) {
    console.error("Failed to build consolidation report:", error);
    res.status(500).json({ error: "Failed to build consolidation report" });
  }
});

/** POST /api/admin/consolidation/execute — run one consolidation batch.
 *  Body: { limit?: number (1-500, default 50), dryRun?: boolean }
 *  dryRun defaults to TRUE — the batch only mutates when the caller sends
 *  an explicit dryRun: false. Dry runs return exactly what WOULD change.
 */
router.post("/execute", async (req: Request, res: Response) => {
  try {
    const limitRaw = Number(req.body?.limit);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(500, Math.max(1, Math.floor(limitRaw)))
      : 50;
    // Anything other than an explicit boolean false stays a dry run.
    const dryRun = req.body?.dryRun !== false;

    const result = await executeConsolidation({ limit, dryRun });
    res.json(result);
  } catch (error) {
    console.error("Consolidation execute failed:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Consolidation execute failed",
    });
  }
});

/** GET /api/admin/consolidation/status — cheap progress counters:
 *  published/unpublished article counts, articles stamped as consolidated,
 *  and consolidation-created redirects.
 */
router.get("/status", async (_req: Request, res: Response) => {
  try {
    const status = await getConsolidationStatus();
    res.json(status);
  } catch (error) {
    console.error("Failed to fetch consolidation status:", error);
    res.status(500).json({ error: "Failed to fetch consolidation status" });
  }
});

export default router;
