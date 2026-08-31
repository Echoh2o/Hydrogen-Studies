/**
 * Migration 021: uniqueness constraints deferred from the 2026-08-30 audit,
 * plus the transient_jobs table backing restart-safe background-job state.
 *
 * Each unique is created dedupe-first so the index build cannot fail on
 * existing duplicate data (same pattern as migration 018's monitor_results
 * dedupe). All statements are idempotent (IF NOT EXISTS / re-runnable DML).
 *
 *  1. content_generation_queue — partial unique index uq_cgq_active_study.
 *     The worker's enqueue comments have claimed this index for months but it
 *     was never created: two enqueues racing past the pre-SELECT could both
 *     insert, and the same study got the full AI waterfall twice (double
 *     spend). Duplicate active rows are cancelled (keep the oldest), then the
 *     partial index enforces one active row per study. The worker's bare
 *     onConflictDoNothing() needs no target — any unique violation resolves
 *     to a silent no-op.
 *
 *  2. keyword_group_mappings — UNIQUE(keyword_id, group_id). The add-to-group
 *     route uses onConflictDoNothing() which was a no-op without a constraint,
 *     so re-adding a keyword to a group inserted duplicate mapping rows.
 *
 *  3. user_preferences — UNIQUE(user_id). recommendation-engine's upsert
 *     targets user_id (42P10 without this), and the dashboard's
 *     select-then-write races could create duplicate preference rows making
 *     later reads nondeterministic. Keep the most recently updated row.
 *
 *  4. transient_jobs — persistence for background jobs whose state previously
 *     lived only in in-memory Maps (SEO factory generation, image-gen
 *     batches): a deploy mid-run erased all progress and the admin UI read
 *     the vanished job as finished. Rows are small and pruned by the writer.
 */
import { migrationDb as db } from "../db";
import { sql } from "drizzle-orm";

export async function addUniquenessAndJobState(): Promise<void> {
  console.log("Starting migration: uniqueness constraints + transient_jobs");

  try {
    // ── 1. content_generation_queue: cancel duplicate ACTIVE rows, keep oldest ──
    await db.execute(sql`
      UPDATE content_generation_queue a
      SET status = 'cancelled',
          error_message = COALESCE(a.error_message, '')
            || ' [cancelled by migration 021: duplicate active row for study]'
      FROM content_generation_queue b
      WHERE a.study_id = b.study_id
        AND a.id > b.id
        AND a.status IN ('pending', 'processing')
        AND b.status IN ('pending', 'processing')
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cgq_active_study
      ON content_generation_queue (study_id)
      WHERE status IN ('pending', 'processing')
    `);
    console.log("Ensured uq_cgq_active_study (deduped active queue rows)");

    // ── 2. keyword_group_mappings: drop duplicate pairs, keep lowest id ──
    await db.execute(sql`
      DELETE FROM keyword_group_mappings a
      USING keyword_group_mappings b
      WHERE a.keyword_id = b.keyword_id
        AND a.group_id = b.group_id
        AND a.id > b.id
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS keyword_group_mappings_keyword_group_unique
      ON keyword_group_mappings (keyword_id, group_id)
    `);
    console.log("Ensured keyword_group_mappings uniqueness (deduped pairs)");

    // ── 3. user_preferences: keep the freshest row per user, drop the rest ──
    // "Freshest" = latest updated_at, tiebreak highest id — preferences are
    // last-write-wins by nature.
    await db.execute(sql`
      DELETE FROM user_preferences a
      USING user_preferences b
      WHERE a.user_id = b.user_id
        AND a.id <> b.id
        AND (a.updated_at, a.id) < (b.updated_at, b.id)
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS user_preferences_user_id_unique
      ON user_preferences (user_id)
    `);
    console.log("Ensured user_preferences.user_id uniqueness (kept freshest row)");

    // ── 4. transient_jobs: restart-safe background-job state ──
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS transient_jobs (
        id text PRIMARY KEY,
        kind text NOT NULL,
        status text NOT NULL,
        progress jsonb,
        error text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS transient_jobs_kind_idx ON transient_jobs (kind, updated_at)
    `);
    console.log("Ensured transient_jobs table");

    console.log("Migration 021 completed successfully");
  } catch (error) {
    console.error("Error in uniqueness/job-state migration:", error);
    throw error;
  }
}
