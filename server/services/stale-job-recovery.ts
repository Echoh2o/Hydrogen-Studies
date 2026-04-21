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

const STALE_THRESHOLD = "30 minutes";

export async function resetStaleProcessingJobs(): Promise<void> {
  // Pipeline queue — core AI analysis
  try {
    const pq = await db.execute(sql`
      UPDATE pipeline_queue
      SET status = 'pending', updated_at = NOW()
      WHERE status = 'processing'
        AND updated_at < NOW() - INTERVAL '${sql.raw(STALE_THRESHOLD)}'
      RETURNING id
    `);
    const n = pq.rows?.length ?? 0;
    if (n > 0) {
      logger.info(`Reset ${n} stale pipeline_queue items to pending`, "JobRecovery");
    }
  } catch (err) {
    // Table may not exist in a fresh dev DB
    logger.warn(
      `pipeline_queue recovery skipped: ${err instanceof Error ? err.message : String(err)}`,
      "JobRecovery",
    );
  }

  // Content generation queue — blog/summary/tag waterfall
  try {
    const cg = await db.execute(sql`
      UPDATE content_generation_queue
      SET status = 'pending'
      WHERE status = 'processing'
        AND started_at < NOW() - INTERVAL '${sql.raw(STALE_THRESHOLD)}'
      RETURNING id
    `);
    const n = cg.rows?.length ?? 0;
    if (n > 0) {
      logger.info(
        `Reset ${n} stale content_generation_queue items to pending`,
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
