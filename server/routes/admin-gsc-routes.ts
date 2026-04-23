/**
 * Admin GSC routes.
 *
 *   GET  /api/admin/gsc/status                — connection state for the UI
 *   GET  /api/admin/gsc/oauth/start           — kicks off the consent dance
 *   GET  /api/admin/gsc/oauth/callback        — Google redirects here w/ code
 *   POST /api/admin/gsc/disconnect            — revokes + drops local creds
 *   POST /api/admin/gsc/sync                  — manual full-90-day re-pull
 *
 *   GET  /api/admin/gsc/opportunities/climbers
 *   GET  /api/admin/gsc/opportunities/low-ctr
 *   GET  /api/admin/gsc/opportunities/orphan-queries
 *   GET  /api/admin/gsc/page                  — per-page metrics ?path=/blog/...
 *
 * The OAuth callback is gated by a signed `state` cookie rather than the
 * usual session, so a fresh redirect from Google still lands on a known-safe
 * handler that proves the request originated from our /start endpoint.
 */

import { Router, Request, Response } from "express";
import { randomBytes } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { requireAdmin } from "../auth";
import {
  buildAuthUrl,
  disconnect,
  ensureGscTables,
  gscSiteUrl,
  lastSyncRun,
  loadCredentials,
  makeOAuthClient,
  oauthRedirectUri,
  saveCredentials,
  syncSearchConsole,
} from "../services/gsc-service";

const router = Router();

const STATE_COOKIE = "gsc_oauth_state";
const STATE_COOKIE_MAX_AGE_MS = 5 * 60 * 1000;

/** Connection status for the admin UI. */
router.get("/status", requireAdmin, async (_req, res) => {
  try {
    await ensureGscTables();
    const cred = await loadCredentials();
    const lastRun = await lastSyncRun();
    res.json({
      connected: !!cred,
      accountEmail: cred?.accountEmail ?? null,
      siteUrl: cred?.siteUrl ?? gscSiteUrl(),
      connectedAt: cred?.connectedAt ?? null,
      lastSyncAt: cred?.lastSyncAt ?? null,
      lastRun: lastRun
        ? {
            startedAt: lastRun.startedAt,
            completedAt: lastRun.completedAt,
            status: lastRun.status,
            daysPulled: lastRun.daysPulled,
            rowsInserted: lastRun.rowsInserted,
            rowsUpdated: lastRun.rowsUpdated,
            error: lastRun.error,
          }
        : null,
    });
  } catch (err) {
    console.error("GSC status error:", err);
    res.status(500).json({ error: "Failed to fetch GSC status" });
  }
});

/** Step 1 of the OAuth dance — sign a state, set a cookie, redirect to Google. */
router.get("/oauth/start", requireAdmin, async (req: Request, res: Response) => {
  if (!process.env.GSC_CLIENT_ID || !process.env.GSC_CLIENT_SECRET) {
    return res.status(500).json({
      error:
        "GSC_CLIENT_ID and GSC_CLIENT_SECRET env vars must be set on the server before connecting.",
    });
  }
  const state = randomBytes(24).toString("base64url");
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: req.protocol === "https",
    sameSite: "lax",
    maxAge: STATE_COOKIE_MAX_AGE_MS,
  });
  const url = buildAuthUrl(state, oauthRedirectUri(req));
  res.redirect(url);
});

/**
 * Step 2 — Google redirects here with `code` + `state`.
 * Note: this endpoint is NOT requireAdmin because the redirect itself is a
 * top-level browser navigation that won't include any auth header. The
 * state cookie + httpOnly check is the verification that this redirect came
 * from our own /start (which IS requireAdmin).
 */
router.get("/oauth/callback", async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const cookieState = (req as any).cookies?.[STATE_COOKIE];

    if (!code || !state || !cookieState || state !== cookieState) {
      return res
        .status(400)
        .send("OAuth callback failed: state mismatch. Try connecting again from the admin UI.");
    }
    res.clearCookie(STATE_COOKIE);

    const client = makeOAuthClient();
    const { tokens } = await client.getToken({
      code,
      redirect_uri: oauthRedirectUri(req),
    });

    if (!tokens.refresh_token) {
      return res
        .status(400)
        .send(
          "Google did not return a refresh token. This usually means the account already authorized this app — go to https://myaccount.google.com/permissions, remove access for 'Hydrogen Studies GSC', and try Connect again.",
        );
    }

    // Identify the authorizing account so the UI can show "Connected as X."
    let accountEmail = "unknown";
    try {
      const accessToken = tokens.access_token;
      if (accessToken) {
        const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (r.ok) {
          const info = (await r.json()) as { email?: string };
          if (info.email) accountEmail = info.email;
        }
      }
    } catch {
      // non-fatal — fall back to "unknown"
    }

    await saveCredentials({
      refreshToken: tokens.refresh_token,
      accountEmail,
      scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
    });

    // Redirect back to the admin Search Console page with a success flag.
    res.redirect("/admin/seo/search-console?connected=1");
  } catch (err) {
    console.error("GSC OAuth callback error:", err);
    res.status(500).send("OAuth callback failed. Check server logs.");
  }
});

/** Drop local credentials + best-effort revoke at Google. */
router.post("/disconnect", requireAdmin, async (_req, res) => {
  try {
    await disconnect();
    res.json({ success: true });
  } catch (err) {
    console.error("GSC disconnect error:", err);
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

/** Manual re-sync trigger for the admin UI's "Sync now" button. */
router.post("/sync", requireAdmin, async (_req, res) => {
  try {
    const result = await syncSearchConsole();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("GSC sync error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to sync",
    });
  }
});

// ── Opportunities ────────────────────────────────────────────────
//
// All three opportunity queries summarize the past 30 days. The thresholds
// are tuned to surface "actionable" rows and keep the response sizes small
// enough for the admin UI to render without virtualization.

const LOOKBACK_DAYS = 30;

/** Queries at position 11–30 with ≥100 impressions over 30d. The "almost there" pile. */
router.get("/opportunities/climbers", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.execute<{
      query: string;
      page: string;
      impressions: number;
      clicks: number;
      avg_position: number;
      best_position: number;
    }>(sql`
      SELECT
        query,
        page,
        SUM(impressions)::int AS impressions,
        SUM(clicks)::int AS clicks,
        AVG(position::float)::float AS avg_position,
        MIN(position::float)::float AS best_position
      FROM gsc_query_metrics
      WHERE date >= TO_CHAR(CURRENT_DATE - INTERVAL '${sql.raw(String(LOOKBACK_DAYS))} days', 'YYYY-MM-DD')
      GROUP BY query, page
      HAVING SUM(impressions) >= 100
        AND AVG(position::float) BETWEEN 11 AND 30
      ORDER BY SUM(impressions) DESC
      LIMIT 100
    `).then((r: any) => r.rows ?? r);
    res.json({ data: rows, lookbackDays: LOOKBACK_DAYS });
  } catch (err) {
    console.error("Climbers query error:", err);
    res.status(500).json({ error: "Failed to fetch climbers" });
  }
});

/** Pages with CTR < 2% AND ≥ 500 impressions over 30d. Title/meta-description fixes. */
router.get("/opportunities/low-ctr", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.execute<{
      page: string;
      impressions: number;
      clicks: number;
      ctr: number;
      avg_position: number;
    }>(sql`
      SELECT
        page,
        SUM(impressions)::int AS impressions,
        SUM(clicks)::int AS clicks,
        (SUM(clicks)::float / NULLIF(SUM(impressions), 0)::float) AS ctr,
        AVG(position::float)::float AS avg_position
      FROM gsc_query_metrics
      WHERE date >= TO_CHAR(CURRENT_DATE - INTERVAL '${sql.raw(String(LOOKBACK_DAYS))} days', 'YYYY-MM-DD')
      GROUP BY page
      HAVING SUM(impressions) >= 500
        AND (SUM(clicks)::float / NULLIF(SUM(impressions), 0)::float) < 0.02
        AND AVG(position::float) <= 20    -- only flag pages that *could* convert if titled better
      ORDER BY SUM(impressions) DESC
      LIMIT 100
    `).then((r: any) => r.rows ?? r);
    res.json({ data: rows, lookbackDays: LOOKBACK_DAYS });
  } catch (err) {
    console.error("Low CTR query error:", err);
    res.status(500).json({ error: "Failed to fetch low-CTR pages" });
  }
});

/**
 * Queries we rank for that have no matching slug in our content tables.
 * "Matching" = the slug of any study or blog article appears as a token
 * in the query (lowercased, hyphens-as-spaces). Imperfect, but cheap and
 * surfaces obvious gaps.
 */
router.get("/opportunities/orphan-queries", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.execute<{
      query: string;
      impressions: number;
      clicks: number;
      avg_position: number;
      best_page: string;
    }>(sql`
      WITH agg AS (
        SELECT
          LOWER(query) AS query,
          SUM(impressions)::int AS impressions,
          SUM(clicks)::int AS clicks,
          AVG(position::float)::float AS avg_position,
          (ARRAY_AGG(page ORDER BY impressions DESC))[1] AS best_page
        FROM gsc_query_metrics
        WHERE date >= TO_CHAR(CURRENT_DATE - INTERVAL '${sql.raw(String(LOOKBACK_DAYS))} days', 'YYYY-MM-DD')
        GROUP BY LOWER(query)
        HAVING SUM(impressions) >= 50
      )
      SELECT * FROM agg
      WHERE NOT EXISTS (
        SELECT 1 FROM studies s
        WHERE s.slug IS NOT NULL
          AND agg.query ILIKE '%' || REPLACE(s.slug, '-', ' ') || '%'
      )
      AND NOT EXISTS (
        SELECT 1 FROM blog_articles b
        WHERE agg.query ILIKE '%' || REPLACE(b.slug, '-', ' ') || '%'
      )
      ORDER BY impressions DESC
      LIMIT 100
    `).then((r: any) => r.rows ?? r);
    res.json({ data: rows, lookbackDays: LOOKBACK_DAYS });
  } catch (err) {
    console.error("Orphan queries error:", err);
    res.status(500).json({ error: "Failed to fetch orphan queries" });
  }
});

/**
 * Per-page metrics: 30-day daily impressions/clicks/position trend
 * + top 10 queries this page ranks for.
 */
router.get("/page", requireAdmin, async (req, res) => {
  try {
    const path = (req.query.path as string) || "";
    if (!path) return res.status(400).json({ error: "path query param required" });

    // Match by URL suffix — pages in GSC are full URLs but the admin
    // typically thinks in terms of paths. Use suffix match.
    const trend = await db.execute<{
      date: string;
      impressions: number;
      clicks: number;
      avg_position: number;
    }>(sql`
      SELECT
        date,
        SUM(impressions)::int AS impressions,
        SUM(clicks)::int AS clicks,
        AVG(position::float)::float AS avg_position
      FROM gsc_query_metrics
      WHERE page LIKE ${"%" + path}
        AND date >= TO_CHAR(CURRENT_DATE - INTERVAL '30 days', 'YYYY-MM-DD')
      GROUP BY date
      ORDER BY date
    `).then((r: any) => r.rows ?? r);

    const topQueries = await db.execute<{
      query: string;
      impressions: number;
      clicks: number;
      avg_position: number;
    }>(sql`
      SELECT
        query,
        SUM(impressions)::int AS impressions,
        SUM(clicks)::int AS clicks,
        AVG(position::float)::float AS avg_position
      FROM gsc_query_metrics
      WHERE page LIKE ${"%" + path}
        AND date >= TO_CHAR(CURRENT_DATE - INTERVAL '30 days', 'YYYY-MM-DD')
      GROUP BY query
      ORDER BY SUM(impressions) DESC
      LIMIT 10
    `).then((r: any) => r.rows ?? r);

    res.json({ trend, topQueries });
  } catch (err) {
    console.error("Per-page query error:", err);
    res.status(500).json({ error: "Failed to fetch page metrics" });
  }
});

export default router;
