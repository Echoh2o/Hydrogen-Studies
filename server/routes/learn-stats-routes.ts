import { Router } from "express";
import { db } from "../db";
import { studies, healthConditions } from "@shared/schema";
import { sql, count, countDistinct, eq } from "drizzle-orm";
import { logger } from "../utils/logger";

const router = Router();

// In-memory cache (5-minute TTL)
let cachedResult: { totalStudies: number; humanTrials: number; healthConditions: number } | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/learn-stats
 * Public endpoint returning high-level research database counts.
 * Cached in-memory for 5 minutes to avoid redundant DB hits.
 */
router.get("/", async (_req, res) => {
  try {
    const now = Date.now();

    if (cachedResult && now - cachedAt < CACHE_TTL_MS) {
      return res.json(cachedResult);
    }

    const [totalRow] = await db.select({ value: count() }).from(studies);
    const [humanRow] = await db
      .select({ value: count() })
      .from(studies)
      .where(eq(studies.isHumanTrial, true));
    const [conditionsRow] = await db
      .select({ value: countDistinct(healthConditions.name) })
      .from(healthConditions);

    cachedResult = {
      totalStudies: Number(totalRow?.value ?? 0),
      humanTrials: Number(humanRow?.value ?? 0),
      healthConditions: Number(conditionsRow?.value ?? 0),
    };
    cachedAt = now;

    return res.json(cachedResult);
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
