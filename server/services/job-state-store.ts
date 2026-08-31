/**
 * Restart-safe persistence for background jobs whose live state is tracked in
 * in-memory Maps (SEO content-factory runs, image-generation batches).
 *
 * Why: those Maps evaporate on every deploy/restart. The admin UIs poll a
 * /jobs/:id endpoint; when the entry vanished mid-run they either 404'd or —
 * worse — read "no longer in the list" as "finished successfully". This store
 * write-throughs each state change to the transient_jobs table (migration
 * 021) so a job's terminal state (or the fact it was interrupted) survives
 * the process.
 *
 * Design notes:
 *  - Best-effort by contract: every call swallows DB errors after logging.
 *    Job state is observability, not correctness — a DB blip must never fail
 *    the job itself.
 *  - markInterruptedJobs() runs at boot: any row still 'running' belonged to
 *    the previous process and cannot still be running — flag it so the UI
 *    shows the truth ("interrupted by restart") instead of a phantom.
 *  - The writer prunes rows older than PRUNE_AFTER_MS on each save, keeping
 *    the table tiny without a scheduled job.
 */
import { db } from "../db";
import { transientJobs } from "@shared/schema";
import { eq, and, lt, sql } from "drizzle-orm";
import { logger } from "../utils/logger";

const TAG = "JobStateStore";
const PRUNE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // keep a week of history

export type TransientJobStatus = "running" | "completed" | "failed" | "interrupted";

export interface TransientJobState {
  id: string;
  kind: string;
  status: TransientJobStatus;
  progress?: unknown;
  error?: string | null;
}

/** Create or update a job row (upsert by id). Never throws. */
export async function saveJobState(state: TransientJobState): Promise<void> {
  try {
    await db
      .insert(transientJobs)
      .values({
        id: state.id,
        kind: state.kind,
        status: state.status,
        progress: state.progress ?? null,
        error: state.error ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: transientJobs.id,
        set: {
          status: state.status,
          progress: state.progress ?? null,
          error: state.error ?? null,
          updatedAt: new Date(),
        },
      });

    // Opportunistic prune of ancient rows for this kind.
    await db
      .delete(transientJobs)
      .where(
        and(
          eq(transientJobs.kind, state.kind),
          lt(transientJobs.updatedAt, new Date(Date.now() - PRUNE_AFTER_MS)),
        ),
      );
  } catch (err) {
    logger.warn("Failed to persist job state", TAG, {
      jobId: state.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Read a persisted job row — the fallback when the in-memory Map has no entry. */
export async function getJobState(id: string): Promise<
  | { id: string; kind: string; status: TransientJobStatus; progress: unknown; error: string | null; updatedAt: Date }
  | null
> {
  try {
    const [row] = await db
      .select()
      .from(transientJobs)
      .where(eq(transientJobs.id, id))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      kind: row.kind,
      status: row.status as TransientJobStatus,
      progress: row.progress,
      error: row.error,
      updatedAt: row.updatedAt,
    };
  } catch (err) {
    logger.warn("Failed to read job state", TAG, {
      jobId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** List recent persisted jobs of a kind (newest first). */
export async function listJobStates(kind: string, limit = 20) {
  try {
    return await db
      .select()
      .from(transientJobs)
      .where(eq(transientJobs.kind, kind))
      .orderBy(sql`${transientJobs.updatedAt} DESC`)
      .limit(limit);
  } catch (err) {
    logger.warn("Failed to list job states", TAG, {
      kind,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Boot recovery: rows still 'running' belonged to the dead process. Flag them
 * so the admin UI reports "interrupted by restart" instead of a phantom
 * in-progress job (or a silent vanish-as-success).
 */
export async function markInterruptedJobs(): Promise<void> {
  try {
    const rows = await db
      .update(transientJobs)
      .set({
        status: "interrupted",
        error: "Server restarted while this job was running.",
        updatedAt: new Date(),
      })
      .where(eq(transientJobs.status, "running"))
      .returning({ id: transientJobs.id });
    if (rows.length > 0) {
      logger.warn(`Marked ${rows.length} orphaned background job(s) as interrupted`, TAG, {
        jobIds: rows.map((r) => r.id),
      });
    }
  } catch (err) {
    // Table may not exist yet on first boot before migration 021 — harmless.
    logger.warn("Interrupted-job sweep skipped", TAG, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
