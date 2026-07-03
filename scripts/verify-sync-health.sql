-- Run against the production Postgres (Railway → service → connect → psql).
-- Each block is independent; you can paste them one at a time.

-- ─────────────────────────────────────────────────────────────────────
-- 1. GSC data accumulation: row count + date range + per-page coverage
-- ─────────────────────────────────────────────────────────────────────
SELECT
  COUNT(*)                                     AS total_rows,
  COUNT(DISTINCT date)                         AS distinct_days,
  MIN(date)                                    AS earliest_day,
  MAX(date)                                    AS latest_day,
  COUNT(DISTINCT page)                         AS distinct_pages,
  COUNT(DISTINCT query)                        AS distinct_queries
FROM gsc_query_metrics;

-- Expect: distinct_days ≈ 90 if first-run backfill finished; latest_day within 2-3 days of today.
-- If distinct_days < 10, the 90-day backfill never completed — re-trigger via /admin/seo/search-console "Sync now".

-- ─────────────────────────────────────────────────────────────────────
-- 2. GA4 data accumulation
-- ─────────────────────────────────────────────────────────────────────
SELECT
  COUNT(*)                                     AS total_rows,
  COUNT(DISTINCT date)                         AS distinct_days,
  MIN(date)                                    AS earliest_day,
  MAX(date)                                    AS latest_day,
  COUNT(DISTINCT page)                         AS distinct_pages
FROM ga4_page_metrics;

SELECT COUNT(*) AS search_term_rows, COUNT(DISTINCT date) AS days
FROM ga4_search_terms;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Latest sync runs — surface stuck or failing crons
-- ─────────────────────────────────────────────────────────────────────
SELECT 'gsc' AS source, started_at, completed_at, status, days_pulled,
       rows_inserted, rows_updated, LEFT(COALESCE(error, ''), 200) AS error
FROM gsc_sync_runs
ORDER BY started_at DESC LIMIT 10;

SELECT 'ga4' AS source, started_at, completed_at, status, days_pulled,
       rows_inserted, rows_updated, LEFT(COALESCE(error, ''), 200) AS error
FROM ga4_sync_runs
ORDER BY started_at DESC LIMIT 10;

-- Red flags:
--   * Any row with status='running' and started_at > 1h ago → stuck job.
--   * Latest row status='failed' → check error column.
--   * No row in last 12h → cron isn't firing (job-scheduler issue).

-- ─────────────────────────────────────────────────────────────────────
-- 4. Opportunities smoke test — do thresholds actually return rows?
-- ─────────────────────────────────────────────────────────────────────
-- Climbers: position 11-30 with ≥100 impressions in last 30 days.
SELECT page, query,
       SUM(impressions::int)                AS impressions_30d,
       SUM(clicks::int)                     AS clicks_30d,
       AVG(position::numeric)               AS avg_position
FROM gsc_query_metrics
WHERE date >= (CURRENT_DATE - INTERVAL '30 days')::text
GROUP BY page, query
HAVING SUM(impressions::int) >= 100
   AND AVG(position::numeric) BETWEEN 11 AND 30
ORDER BY impressions_30d DESC
LIMIT 20;

-- Low-CTR: ≥500 impressions/30d and CTR < 2%.
SELECT page,
       SUM(impressions::int)                AS impressions_30d,
       SUM(clicks::int)                     AS clicks_30d,
       (SUM(clicks::int)::numeric / NULLIF(SUM(impressions::int), 0)) AS ctr
FROM gsc_query_metrics
WHERE date >= (CURRENT_DATE - INTERVAL '30 days')::text
GROUP BY page
HAVING SUM(impressions::int) >= 500
   AND (SUM(clicks::int)::numeric / NULLIF(SUM(impressions::int), 0)) < 0.02
ORDER BY impressions_30d DESC
LIMIT 20;

-- If both return 0 rows but row counts in (1) are healthy → thresholds are
-- too high for current traffic. Lower to 25 / 100 for an early-stage site.
