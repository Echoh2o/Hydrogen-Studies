import { Router } from "express";
import { getPublicStudyStats } from "../services/public-study-stats";
import { logger } from "../utils/logger";

const router = Router();

/**
 * GET /api/learn-stats
 * Public endpoint returning high-level research database counts.
 * Cached in-memory for 5 minutes (see services/public-study-stats).
 */
router.get("/", async (_req, res) => {
  try {
    return res.json(await getPublicStudyStats());
  } catch (error) {
    logger.error("learn-stats query failed", error, "LearnStats");

    // Return fallback values so the frontend never breaks
    return res.json({
      totalStudies: 0,
      humanTrials: 0,
      healthConditions: 0,
    });
  }
});

export default router;
