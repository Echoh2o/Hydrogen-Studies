/**
 * Stale Job Recovery
 *
 * When the server restarts mid-job (deploy, crash, OOM), items in
 * `pipeline_queue.status = 'processing'` and
 * `content_generation_queue.status = 'processing'` are orphaned — no worker
 * is actually touching them, but the status field never rolls back.
 *
 * This runs on startup and resets any "processing" row that hasn't been
 * touched in a while (default: 30 minutes) back to "pending" so the job
 * scheduler picks them up on its next tick.
 *
 * Safe to call repeatedly; only acts on rows that are demonstrably stale.
 */
import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger";

// Pipeline items checkpoint `updated_at` after every step (3-min job timeout),
// so 30 min idle is unambiguously stuck. Content-generation items set
// `started_at` once at claim and never heartbeat, and the multi-step waterfall
// (multiple AI calls + retries + image gen) can legitimately run well over 30
// min — so a short threshold would reset a LIVE job and, now that claims are
// atomic, let another worker re-claim it (duplicate AI spend). Use a threshold
// safely beyond the worst-case waterfall instead.
const PIPELINE_STALE_THRESHOLD = "30 minutes";
const CONTENT_STALE_THRESHOLD = "90 minutes";

export async function resetStaleProcessingJobs(): Promise<void> {
  // Pipeline queue — core AI analysis.
  // Each reset now counts against retry_count, and items past max_retries
  // fail out instead of resetting: previously an item whose processing ALWAYS
  // died (poison input, OOM) bounced back to 'pending' forever — churning AI
  // spend with no terminal state and never surfacing as 'failed'.
  try {
    const pq = await db.execute(sql`
      UPDATE pipeline_queue
      SET retry_count = retry_count + 1,
          status = CASE
            WHEN retry_count + 1 >= COALESCE(max_retries, 3) THEN 'failed'
            ELSE 'pending'
          END,
          error_message = CASE
            WHEN retry_count + 1 >= COALESCE(max_retries, 3)
              THEN 'Failed after repeated stale-recovery resets (processing died without completing)'
            ELSE error_message
          END,
          updated_at = NOW()
      WHERE status = 'processing'
        AND updated_at < NOW() - INTERVAL '${sql.raw(PIPELINE_STALE_THRESHOLD)}'
      RETURNING id, status
    `);
    const rows = (pq.rows ?? []) as Array<{ id: number; status: string }>;
    if (rows.length > 0) {
      const failed = rows.filter((r) => r.status === "failed").length;
      logger.info(
        `Reset ${rows.length - failed} stale pipeline_queue items to pending` +
          (failed > 0 ? `, failed-out ${failed} past max retries` : ""),
        "JobRecovery",
      );
    }
  } catch (err) {
    // Table may not exist in a fresh dev DB
    logger.warn(
      `pipeline_queue recovery skipped: ${err instanceof Error ? err.message : String(err)}`,
      "JobRecovery",
    );
  }

  // Content generation queue — blog/summary/tag waterfall. Same retry-count
  // accounting as above (worker's MAX_RETRIES is 3 — mirror it here).
  try {
    const cg = await db.execute(sql`
      UPDATE content_generation_queue
      SET retry_count = retry_count + 1,
          status = CASE
            WHEN retry_count + 1 >= 3 THEN 'failed'
            ELSE 'pending'
          END,
          error_message = CASE
            WHEN retry_count + 1 >= 3
              THEN 'Failed after repeated stale-recovery resets (processing died without completing)'
            ELSE error_message
          END
      WHERE status = 'processing'
        AND started_at < NOW() - INTERVAL '${sql.raw(CONTENT_STALE_THRESHOLD)}'
      RETURNING id, status
    `);
    const rows = (cg.rows ?? []) as Array<{ id: number; status: string }>;
    if (rows.length > 0) {
      const failed = rows.filter((r) => r.status === "failed").length;
      logger.info(
        `Reset ${rows.length - failed} stale content_generation_queue items to pending` +
          (failed > 0 ? `, failed-out ${failed} past max retries` : ""),
        "JobRecovery",
      );
    }
  } catch (err) {
    logger.warn(
      `content_generation_queue recovery skipped: ${err instanceof Error ? err.message : String(err)}`,
      "JobRecovery",
    );
  }
}
