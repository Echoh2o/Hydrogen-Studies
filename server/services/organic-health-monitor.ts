/**
 * Organic search health monitor.
 *
 * Answers one question on a schedule: "is organic search working, and would
 * we notice if it stopped?" — because twice now (2026-05, 2026-06→08) the
 * GSC/GA4 OAuth token expired and the syncs failed silently for weeks.
 *
 * Checks (all against locally synced tables, no external calls):
 *   1. Sync freshness — last SUCCESSFUL gsc/ga4 sync older than 26h is a
 *      critical alert (the exact failure mode that went unnoticed 47 days).
 *   2. Click decay — sitewide GSC clicks, trailing 7 days vs the prior
 *      28-day daily average; a >30% drop is a high alert. Top pages by
 *      prior-period clicks are also checked individually (>50% drop).
 *   3. Index visibility — share of published blog articles that appeared in
 *      any search result in the last 90 days (informational; the
 *      consolidation work is expected to move this number).
 *
 * Consumed by the weekly scheduler job, which routes alerts to Sentry, and
 * by GET /api/admin/monitoring surfaces. gsc_query_metrics.date and
 * .position are TEXT columns — cast before comparing.
 */

import { sql } from "drizzle-orm";
import { db } from "../db";
import { logger } from "../utils/logger";

const TAG = "OrganicHealth";

export interface OrganicHealthAlert {
  severity: "critical" | "high" | "medium" | "info";
  message: string;
}

export interface OrganicHealthReport {
  alerts: Array<{ severity: string; message: string }>;
  summary: Record<string, unknown>;
}

function rowsOf(result: unknown): any[] {
  return ((result as any).rows ?? result) as any[];
}

const STALE_SYNC_HOURS = 26;
const SITEWIDE_DROP_THRESHOLD = 0.3;
const PAGE_DROP_THRESHOLD = 0.5;
const PAGE_MIN_PRIOR_CLICKS = 10;
const MAX_PAGE_ALERTS = 10;

export async function runOrganicHealthCheck(): Promise<OrganicHealthReport> {
  const alerts: OrganicHealthAlert[] = [];
  const summary: Record<string, unknown> = { checkedAt: new Date().toISOString() };

  // ── 1. Sync freshness ─────────────────────────────────────────────────
  try {
    const freshness = rowsOf(
      await db.execute(sql`
        SELECT
          (SELECT MAX(completed_at) FROM gsc_sync_runs WHERE status = 'success') AS gsc_last,
          (SELECT MAX(completed_at) FROM ga4_sync_runs WHERE status = 'success') AS ga4_last
      `),
    )[0];

    for (const [name, value] of [
      ["GSC", freshness?.gsc_last],
      ["GA4", freshness?.ga4_last],
    ] as const) {
      const last = value ? new Date(value) : null;
      const ageHours = last ? (Date.now() - last.getTime()) / 3_600_000 : Infinity;
      summary[`${name.toLowerCase()}LastSuccessfulSync`] = last?.toISOString() ?? null;
      if (ageHours > STALE_SYNC_HOURS) {
        alerts.push({
          severity: "critical",
          message: last
            ? `${name} sync has not succeeded in ${Math.round(ageHours)}h (last: ${last.toISOString()}). ` +
              `Likely an expired Google OAuth token — reconnect in the admin UI.`
            : `${name} sync has never succeeded — connect it in the admin UI.`,
        });
      }
    }
  } catch (err) {
    logger.error("Organic health: sync freshness check failed", err, TAG);
    alerts.push({ severity: "info", message: "Sync freshness check could not run (see logs)." });
  }

  // ── 2. Sitewide click decay ───────────────────────────────────────────
  try {
    const decay = rowsOf(
      await db.execute(sql`
        SELECT
          COALESCE(SUM(clicks) FILTER (WHERE date::date > current_date - 7), 0)::int AS recent7,
          COALESCE(SUM(clicks) FILTER (
            WHERE date::date <= current_date - 7 AND date::date > current_date - 35
          ), 0)::int AS prior28
        FROM gsc_query_metrics
      `),
    )[0];

    const recentDaily = Number(decay?.recent7 ?? 0) / 7;
    const priorDaily = Number(decay?.prior28 ?? 0) / 28;
    summary.clicksRecent7d = Number(decay?.recent7 ?? 0);
    summary.clicksPrior28d = Number(decay?.prior28 ?? 0);

    if (priorDaily >= 1) {
      const drop = 1 - recentDaily / priorDaily;
      summary.sitewideClickTrend = Number((-drop * 100).toFixed(1)); // + = growth
      if (drop > SITEWIDE_DROP_THRESHOLD) {
        alerts.push({
          severity: "high",
          message:
            `Sitewide organic clicks dropped ${(drop * 100).toFixed(0)}% ` +
            `(trailing 7d avg ${recentDaily.toFixed(1)}/day vs prior 28d avg ${priorDaily.toFixed(1)}/day). ` +
            `Check GSC coverage + recent deploys.`,
        });
      }
    } else if (Number(decay?.prior28 ?? 0) === 0 && Number(decay?.recent7 ?? 0) === 0) {
      alerts.push({ severity: "info", message: "No GSC click data in the last 35 days — nothing to trend yet." });
    }
  } catch (err) {
    logger.error("Organic health: sitewide decay check failed", err, TAG);
  }

  // ── 2b. Per-page collapses among previous top performers ──────────────
  try {
    const pages = rowsOf(
      await db.execute(sql`
        WITH prior AS (
          SELECT page, SUM(clicks)::int AS prior_clicks
          FROM gsc_query_metrics
          WHERE date::date <= current_date - 7 AND date::date > current_date - 35
          GROUP BY page
          ORDER BY 2 DESC
          LIMIT 10
        ),
        recent AS (
          SELECT page, SUM(clicks)::int AS recent_clicks
          FROM gsc_query_metrics
          WHERE date::date > current_date - 7
          GROUP BY page
        )
        SELECT p.page, p.prior_clicks, COALESCE(r.recent_clicks, 0) AS recent_clicks
        FROM prior p LEFT JOIN recent r USING (page)
      `),
    );

    let pageAlerts = 0;
    for (const row of pages) {
      const prior = Number(row.prior_clicks);
      if (prior < PAGE_MIN_PRIOR_CLICKS) continue;
      const recentDaily = Number(row.recent_clicks) / 7;
      const priorDaily = prior / 28;
      const drop = priorDaily > 0 ? 1 - recentDaily / priorDaily : 0;
      if (drop > PAGE_DROP_THRESHOLD && pageAlerts < MAX_PAGE_ALERTS) {
        pageAlerts++;
        alerts.push({
          severity: "medium",
          message: `Top page losing clicks: ${row.page} (${(drop * 100).toFixed(0)}% below its 28d baseline).`,
        });
      }
    }
    summary.topPagesChecked = pages.length;
  } catch (err) {
    logger.error("Organic health: per-page decay check failed", err, TAG);
  }

  // ── 3. Index visibility of the blog corpus ────────────────────────────
  try {
    const vis = rowsOf(
      await db.execute(sql`
        SELECT
          (SELECT COUNT(DISTINCT page) FROM gsc_query_metrics
             WHERE date::date > current_date - 90 AND page LIKE '%/blog/%')::int AS visible_blog_pages,
          (SELECT COUNT(*) FROM blog_articles WHERE is_published = true)::int AS published_blogs
      `),
    )[0];

    const visible = Number(vis?.visible_blog_pages ?? 0);
    const published = Number(vis?.published_blogs ?? 0);
    const share = published > 0 ? visible / published : 0;
    summary.publishedBlogArticles = published;
    summary.blogPagesSeenInSearch90d = visible;
    summary.blogSearchVisibilitySharePct = Number((share * 100).toFixed(1));
    if (published > 0 && share < 0.05) {
      // Informational by design: with the pre-consolidation corpus this is
      // expected to be ~3%; it should climb as consolidation lands.
      alerts.push({
        severity: "info",
        message:
          `Only ${(share * 100).toFixed(1)}% of ${published} published blog articles appeared in any ` +
          `search result in 90 days — the corpus is much larger than its search footprint.`,
      });
    }
  } catch (err) {
    logger.error("Organic health: visibility check failed", err, TAG);
  }

  return { alerts, summary };
}
