-- ============================================================================
-- One-time migration: add the unique constraints the dedup code already assumes
-- ============================================================================
--
-- WHY THIS IS A MANUAL SCRIPT (not in schema.ts):
-- The production deploy runs `drizzle-kit push` on startup. If a unique index
-- were added to schema.ts and duplicate rows existed, the push — and therefore
-- the boot — would fail. Apply this once, by hand, after reviewing duplicates.
--
-- Run with:  psql "$DATABASE_URL" -f scripts/add-unique-constraints.sql
-- (CONCURRENTLY statements must run outside a transaction; do not wrap in BEGIN.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. content_generation_queue: at most one ACTIVE (pending/processing) row per
--    study. Backs the "already queued?" check in content-generation-worker.ts,
--    which is currently a non-atomic SELECT-then-INSERT and can race.
-- ----------------------------------------------------------------------------

-- 1a. Inspect duplicates first (should print 0 rows before creating the index):
-- SELECT study_id, count(*)
--   FROM content_generation_queue
--  WHERE status IN ('pending','processing')
--  GROUP BY study_id HAVING count(*) > 1;

-- 1b. De-dupe: keep the newest active row per study, drop the rest. Queue rows
--     are transient, so deleting stale duplicates is safe.
DELETE FROM content_generation_queue q
USING (
  SELECT id,
         row_number() OVER (PARTITION BY study_id ORDER BY created_at DESC, id DESC) AS rn
    FROM content_generation_queue
   WHERE status IN ('pending','processing')
) d
WHERE q.id = d.id AND d.rn > 1;

-- 1c. Create the partial unique index.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  uq_cgq_active_study
  ON content_generation_queue (study_id)
  WHERE status IN ('pending','processing');

-- ----------------------------------------------------------------------------
-- 2. studies.doi: a DOI should identify exactly one study. getStudyByIdentifier
--    and the discovery dedup path assume this, but there is no constraint.
--
--    NOTE: studies have foreign-key children (ledger, queues, links). DO NOT
--    auto-delete duplicate studies. Resolve duplicates by hand first, then
--    create the index. The index is on LOWER(doi) so it's case-insensitive.
-- ----------------------------------------------------------------------------

-- 2a. Find duplicate DOIs to resolve manually (must return 0 rows before 2b):
-- SELECT lower(doi) AS doi_key, count(*), array_agg(id) AS study_ids
--   FROM studies
--  WHERE doi IS NOT NULL AND doi <> ''
--  GROUP BY lower(doi) HAVING count(*) > 1
--  ORDER BY count(*) DESC;

-- 2b. After duplicates are resolved, create the case-insensitive unique index:
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  uq_studies_doi_lower
  ON studies (lower(doi))
  WHERE doi IS NOT NULL AND doi <> '';
