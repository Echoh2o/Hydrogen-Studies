import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migration 031: every study has an approval record (Josh, 2026-11-05).
 *
 * Sarah Taylor-Laine (shared/reviewer.ts) reviews every study before it is
 * published — mostly by importing it herself after review, sometimes by
 * approving it from the discovery queue. Nothing recorded who approved what or
 * when, so:
 *   1. study_approvals holds one row per approval (append-only history).
 *   2. Backfill: one row per existing study, approved_at = studies.created_at
 *      (the date the study entered this database; 1,690 rows are the
 *      2026-04-08 migration), method = 'backfill'. The real review date was
 *      not recorded, so backfilled dates are internal only — pages never show
 *      them as a review date.
 *   3. A trigger records an approval (method 'import') for every new study,
 *      whichever code path inserts it, so the invariant can't drift.
 * Idempotent: IF NOT EXISTS, NOT EXISTS backfill, CREATE OR REPLACE + DROP
 * TRIGGER IF EXISTS.
 */
export const BACKFILL_NOTE =
  "Backfilled 2026-11-05 from studies.created_at (date the study entered this database); the actual review date was not recorded.";

export async function addStudyApprovals(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS study_approvals (
      id SERIAL PRIMARY KEY,
      study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
      reviewer_name TEXT NOT NULL,
      approved_at TIMESTAMP NOT NULL,
      method TEXT NOT NULL CHECK (method IN ('import', 'queue', 'backfill', 'edit')),
      note TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS study_approvals_study_idx ON study_approvals (study_id, approved_at DESC)`);
  await db.execute(sql`
    INSERT INTO study_approvals (study_id, reviewer_name, approved_at, method, note)
    SELECT s.id, 'Sarah Taylor-Laine', COALESCE(s.created_at, NOW()), 'backfill', ${BACKFILL_NOTE}
      FROM studies s
     WHERE NOT EXISTS (SELECT 1 FROM study_approvals a WHERE a.study_id = s.id)
  `);
  await db.execute(sql.raw(`
    CREATE OR REPLACE FUNCTION record_study_approval() RETURNS trigger AS $fn$
    BEGIN
      INSERT INTO study_approvals (study_id, reviewer_name, approved_at, method, note)
      VALUES (NEW.id, 'Sarah Taylor-Laine', NOW(), 'import', 'Recorded automatically when the study was added');
      RETURN NEW;
    END
    $fn$ LANGUAGE plpgsql
  `));
  await db.execute(sql`DROP TRIGGER IF EXISTS studies_record_approval ON studies`);
  await db.execute(sql`
    CREATE TRIGGER studies_record_approval AFTER INSERT ON studies
    FOR EACH ROW EXECUTE FUNCTION record_study_approval()
  `);
}
