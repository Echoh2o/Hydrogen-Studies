/**
 * Blog lifecycle utilities.
 *
 * Handles the boot-time housekeeping for the blog publishing pipeline:
 *   • Idempotent column setup for publishedAt / scheduledFor / isArchived
 *     (so deployments don't break if drizzle push hasn't applied the schema)
 *   • Recovery of blog-generation jobs that were `running` when the server
 *     last shut down — they get reset to `paused` so an admin can resume,
 *     instead of being silently stuck forever.
 *
 * The cron-driven scheduled-publish runner lives in job-scheduler.ts as
 * a normal Job in the runJobs() loop.
 */

import { sql } from "drizzle-orm";
import { db } from "../db";
import { blogArticles, blogGenerationJobs } from "@shared/schema";
import { eq, and, lte, isNotNull, asc } from "drizzle-orm";
import { logger } from "../utils/logger";

const TAG = "BlogLifecycle";

let ensureColumnsPromise: Promise<void> | null = null;

/** Idempotent ALTER for the new lifecycle columns. Reset on failure. */
export function ensureBlogLifecycleColumns(): Promise<void> {
  if (ensureColumnsPromise) return ensureColumnsPromise;
  ensureColumnsPromise = (async () => {
    try {
      await db.execute(sql`ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS published_at timestamp`);
      await db.execute(sql`ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS scheduled_for timestamp`);
      await db.execute(sql`ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false`);
      // Phase B pillar/cluster columns
      await db.execute(sql`ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS is_pillar boolean NOT NULL DEFAULT false`);
      await db.execute(sql`ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS pillar_blog_id integer`);
      await db.execute(sql`ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS promoted_to_pillar_at timestamp`);
      // Phase C visual-depth columns
      await db.execute(sql`ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS youtube_embed_id text`);
      // Indexed because cluster lookups (`pillarBlogId = X`) are part of the
      // pillar-edit-page render path. Partial index on the parent flag keeps
      // the pillar-list query trivial.
      await db.execute(sql`CREATE INDEX IF NOT EXISTS blog_articles_pillar_blog_id_idx ON blog_articles (pillar_blog_id) WHERE pillar_blog_id IS NOT NULL`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS blog_articles_is_pillar_idx ON blog_articles (is_pillar) WHERE is_pillar = true`);
      // Index for the scheduled-publish cron — scans for due rows every 5 min
      await db.execute(sql`CREATE INDEX IF NOT EXISTS blog_articles_scheduled_for_idx ON blog_articles (scheduled_for) WHERE scheduled_for IS NOT NULL`);
      // Index for status tab filters on the admin list
      await db.execute(sql`CREATE INDEX IF NOT EXISTS blog_articles_archived_idx ON blog_articles (is_archived)`);
      // Backfill publishedAt for already-published articles so the column is
      // useful immediately. Uses createdAt as a reasonable proxy for posts
      // published before this column existed.
      await db.execute(sql`
        UPDATE blog_articles
        SET published_at = created_at
        WHERE is_published = true AND published_at IS NULL
      `);
      logger.info("Blog lifecycle columns ensured", TAG);
    } catch (err) {
      ensureColumnsPromise = null;
      logger.error("Failed to ensure blog lifecycle columns", err, TAG);
    }
  })();
  return ensureColumnsPromise;
}

/**
 * On boot, find blog-generation jobs that were `running` when the server
 * last shut down and reset them to `paused`. The worker tracks current
 * job state in module-level memory; without this, those jobs stay in
 * `running` forever and nothing picks them up.
 *
 * Paused (rather than auto-resumed) so an admin sees them in the UI and
 * makes the explicit decision to continue. If we auto-resumed and the
 * crash was caused by a poison row, we'd just crash again.
 */
/**
 * Marker written when a restart interrupts a running job. autoResume below
 * matches on this exact prefix, and encodes its attempt counter after it —
 * keep the two in sync.
 */
const RESTART_MARKER = "Worker was interrupted (server restart). Resume to continue.";
/** Give up auto-resuming after this many restart interruptions (poison-input guard). */
const MAX_AUTO_RESUMES = 3;

export async function recoverStuckBlogJobs(): Promise<void> {
  try {
    const result = await db
      .update(blogGenerationJobs)
      .set({
        status: "paused",
        // Preserve+increment the interruption counter across restarts:
        // "…Resume to continue. [interruption N]". autoResumeInterruptedBlogJobs
        // parses N and stops resuming after MAX_AUTO_RESUMES so a job whose
        // input crashes the process can't restart-loop forever.
        lastError: sql`${RESTART_MARKER} || ' [interruption ' || (
          CASE WHEN ${blogGenerationJobs.lastError} LIKE ${RESTART_MARKER + "%"}
            THEN COALESCE(NULLIF(regexp_replace(${blogGenerationJobs.lastError}, '[^0-9]', '', 'g'), ''), '0')::int
            ELSE 0
          END + 1) || ']'`,
        updatedAt: new Date(),
      })
      .where(eq(blogGenerationJobs.status, "running"))
      .returning({ id: blogGenerationJobs.id });

    if (result.length > 0) {
      logger.warn(
        `Recovered ${result.length} stuck blog-generation job(s); marked as paused`,
        TAG,
        { jobIds: result.map((r) => r.id) },
      );
    }
  } catch (err) {
    logger.error("Failed to recover stuck blog jobs", err, TAG);
  }
}

/**
 * Auto-resume blog-generation jobs that were paused by a server restart, and
 * start the oldest still-pending job when the worker is idle.
 *
 * Why: recoverStuckBlogJobs() pauses running jobs on EVERY boot, and with a
 * frequent deploy cadence a long job could never finish — it sat "paused"
 * until an admin happened to visit /admin/jobs. Similarly, a job created
 * while the single-flight worker was busy stayed "pending" forever because
 * nothing polls the table. Called from the scheduler fast loop (5 min).
 *
 * Poison-input guard: a job interrupted more than MAX_AUTO_RESUMES times is
 * left paused for a human — its lastError carries the interruption count.
 * The worker is single-flight, so at most one job is (re)started per tick;
 * startJob() itself refuses when busy.
 */
export async function autoResumeInterruptedBlogJobs(): Promise<{ resumed: number }> {
  // Master kill-switch (docs/PLAN.md): while generation is paused, do NOT
  // auto-resume or drain generation jobs — leave them paused/pending for a
  // deliberate human decision when the pause lifts.
  if (process.env.GENERATION_ENABLED === "false") {
    return { resumed: 0 };
  }
  try {
    // Lazy import to keep this module free of a static cycle with the worker.
    const { startJob } = await import("./blog-generation-worker");

    const interrupted = await db
      .select()
      .from(blogGenerationJobs)
      .where(
        and(
          eq(blogGenerationJobs.status, "paused"),
          sql`${blogGenerationJobs.lastError} LIKE ${RESTART_MARKER + "%"}`,
        ),
      )
      .orderBy(asc(blogGenerationJobs.id));

    for (const job of interrupted) {
      const attempts = parseInt(job.lastError?.match(/interruption (\d+)/)?.[1] ?? "1", 10);
      if (attempts > MAX_AUTO_RESUMES) {
        logger.warn(
          `Blog job #${job.id} interrupted ${attempts}x — leaving paused for manual review`,
          TAG,
        );
        continue;
      }
      const res = await startJob(job.id);
      if (res.success) {
        logger.info(`Auto-resumed restart-interrupted blog job #${job.id}`, TAG, {
          attempt: attempts,
        });
        return { resumed: 1 };
      }
      // Worker busy — no point trying further jobs this tick.
      return { resumed: 0 };
    }

    // Nothing interrupted to resume — drain the oldest pending job, if any.
    const [pending] = await db
      .select()
      .from(blogGenerationJobs)
      .where(eq(blogGenerationJobs.status, "pending"))
      .orderBy(asc(blogGenerationJobs.id))
      .limit(1);
    if (pending) {
      const res = await startJob(pending.id);
      if (res.success) {
        logger.info(`Started pending blog job #${pending.id} from queue poller`, TAG);
        return { resumed: 1 };
      }
    }
    return { resumed: 0 };
  } catch (err) {
    logger.error("Auto-resume of blog jobs failed", err, TAG);
    return { resumed: 0 };
  }
}

/**
 * Promote any drafts whose scheduledFor has passed. Called by the
 * job-scheduler cron (every 5 min). Idempotent: a row that's already
 * isPublished=true is skipped by the WHERE clause.
 */
export async function publishScheduledBlogs(): Promise<{
  published: number;
}> {
  try {
    const result = await db
      .update(blogArticles)
      .set({
        isPublished: true,
        publishedAt: sql`NOW()`,
        updatedAt: sql`NOW()`,
      })
      .where(
        and(
          eq(blogArticles.isPublished, false),
          eq(blogArticles.isArchived, false),
          isNotNull(blogArticles.scheduledFor),
          lte(blogArticles.scheduledFor, sql`NOW()`),
        ),
      )
      .returning({ id: blogArticles.id, title: blogArticles.title });

    if (result.length > 0) {
      logger.info(`Published ${result.length} scheduled blog(s)`, TAG, {
        ids: result.map((r) => r.id),
      });
    }
    return { published: result.length };
  } catch (err) {
    logger.error("Failed to publish scheduled blogs", err, TAG);
    return { published: 0 };
  }
}
