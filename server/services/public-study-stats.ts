import { db } from "../db";
import { studies, healthConditions } from "@shared/schema";
import { count, countDistinct, eq, and } from "drizzle-orm";

export interface PublicStudyStats {
  totalStudies: number;
  humanTrials: number;
  healthConditions: number;
}

// In-memory cache (5-minute TTL) shared by /api/learn-stats and the /embed
// widgets on echowater.com, so off-site traffic never adds DB load.
let cachedResult: PublicStudyStats | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * High-level research database counts. Throws on DB failure — callers pick
 * their own fallback (the SPA shows zeros; embeds keep their static text).
 */
export async function getPublicStudyStats(): Promise<PublicStudyStats> {
  const now = Date.now();
  if (cachedResult && now - cachedAt < CACHE_TTL_MS) return cachedResult;

  // Excluded (off-topic) studies never count toward public stats.
  const [totalRow] = await db.select({ value: count() }).from(studies).where(eq(studies.isExcluded, false));
  const [humanRow] = await db
    .select({ value: count() })
    .from(studies)
    .where(and(eq(studies.isHumanTrial, true), eq(studies.isExcluded, false)));
  const [conditionsRow] = await db
    .select({ value: countDistinct(healthConditions.name) })
    .from(healthConditions);

  cachedResult = {
    totalStudies: Number(totalRow?.value ?? 0),
    humanTrials: Number(humanRow?.value ?? 0),
    healthConditions: Number(conditionsRow?.value ?? 0),
  };
  cachedAt = now;
  return cachedResult;
}

/** Test hook: drop the in-memory cache. */
export function resetPublicStudyStatsCache(): void {
  cachedResult = null;
  cachedAt = 0;
}
