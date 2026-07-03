/**
 * Admin GA4 routes.
 *
 *   GET  /api/admin/ga4/status                — connection state for the UI
 *   GET  /api/admin/ga4/oauth/start           — kicks off the consent dance
 *   GET  /api/admin/ga4/oauth/callback        — Google redirects here w/ code
 *   POST /api/admin/ga4/disconnect            — revokes + drops local creds
 *   POST /api/admin/ga4/sync                  — manual re-pull
 *
 *   GET  /api/admin/ga4/page?path=/foo        — per-page engagement trend
 *   GET  /api/admin/ga4/search-terms          — top on-site search queries
 *   GET  /api/admin/ga4/top-engaged           — leaderboard of high-engagement pages
 *
 * The OAuth callback is gated by a signed `state` cookie rather than the
 * usual session, mirroring the GSC pattern.
 */

import { Router, Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { fetchWithTimeout } from "../utils/http";
import { requireAdmin } from "../auth";
import {
  buildAuthUrl,
  disconnect,
  ensureGa4Tables,
  ga4PropertyId,
  lastSyncRun,
  loadCredentials,
  makeOAuthClient,
  oauthRedirectUri,
  saveCredentials,
  syncGa4,
} from "../services/ga4-service";

const router = Router();

const STATE_COOKIE = "ga4_oauth_state";
const STATE_COOKIE_MAX_AGE_MS = 5 * 60 * 1000;

/** Constant-time string comparison for the OAuth state token. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

router.get("/status", requireAdmin, async (_req, res) => {
  try {
    await ensureGa4Tables();
    const cred = await loadCredentials();
    const lastRun = await lastSyncRun();
    res.json({
      connected: !!cred,
      accountEmail: cred?.accountEmail ?? null,
      propertyId: cred?.propertyId ?? ga4PropertyId(),
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
    console.error("GA4 status error:", err);
    res.status(500).json({ error: "Failed to fetch GA4 status" });
  }
});

router.get("/oauth/start", requireAdmin, async (req: Request, res: Response) => {
  const clientId = process.env.GA4_CLIENT_ID || process.env.GSC_CLIENT_ID;
  const clientSecret = process.env.GA4_CLIENT_SECRET || process.env.GSC_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error:
        "GA4_CLIENT_ID and GA4_CLIENT_SECRET (or GSC_*) env vars must be set on the server before connecting.",
    });
  }
  if (!ga4PropertyId()) {
    return res.status(500).json({
      error:
        "GA4_PROPERTY_ID env var must be set on the server before connecting (find under GA4 Admin → Property Settings).",
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
 * NOT requireAdmin — top-level browser redirect from Google won't carry
 * any auth header. The signed state cookie is the verification path.
 */
router.get("/oauth/callback", async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const cookieState = (req as any).cookies?.[STATE_COOKIE];

    if (!code || !state || !cookieState || !safeEqual(state, cookieState)) {
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
          "Google did not return a refresh token. This usually means the account already authorized this app — go to https://myaccount.google.com/permissions, remove access for the app, and try Connect again.",
        );
    }

    let accountEmail = "unknown";
    try {
      const accessToken = tokens.access_token;
      if (accessToken) {
        const r = await fetchWithTimeout("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (r.ok) {
          const info = (await r.json()) as { email?: string };
          if (info.email) accountEmail = info.email;
        }
      }
    } catch {
      // non-fatal
    }

    await saveCredentials({
      refreshToken: tokens.refresh_token,
      accountEmail,
      propertyId: ga4PropertyId(),
      scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
    });

    res.redirect("/admin/seo/analytics?connected=1");
  } catch (err) {
    console.error("GA4 OAuth callback error:", err);
    res.status(500).send("OAuth callback failed. Check server logs.");
  }
});

router.post("/disconnect", requireAdmin, async (_req, res) => {
  try {
    await disconnect();
    res.json({ success: true });
  } catch (err) {
    console.error("GA4 disconnect error:", err);
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

router.post("/sync", requireAdmin, async (_req, res) => {
  try {
    const result = await syncGa4();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("GA4 sync error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to sync",
    });
  }
});

// ── Read endpoints ───────────────────────────────────────────────

const LOOKBACK_DAYS = 30;

/** Per-page engagement trend over the last 30 days. */
router.get("/page", requireAdmin, async (req, res) => {
  try {
    const path = (req.query.path as string) || "";
    if (!path) return res.status(400).json({ error: "path query param required" });

    const trend = await db.execute<{
      date: string;
      sessions: number;
      engaged_sessions: number;
      avg_engagement_time: number;
      bounces: number;
      conversions: number;
    }>(sql`
      SELECT
        date,
        SUM(sessions)::int AS sessions,
        SUM(engaged_sessions)::int AS engaged_sessions,
        AVG(avg_engagement_time::float)::float AS avg_engagement_time,
        SUM(bounces)::int AS bounces,
        SUM(conversions)::int AS conversions
      FROM ga4_page_metrics
      WHERE page = ${path}
        AND date >= TO_CHAR(CURRENT_DATE - INTERVAL '${sql.raw(String(LOOKBACK_DAYS))} days', 'YYYY-MM-DD')
      GROUP BY date
      ORDER BY date
    `).then((r: any) => r.rows ?? r);

    res.json({ trend, lookbackDays: LOOKBACK_DAYS });
  } catch (err) {
    console.error("GA4 per-page error:", err);
    res.status(500).json({ error: "Failed to fetch page metrics" });
  }
});

/** Top on-site search queries over the past 30 days. */
router.get("/search-terms", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.execute<{
      search_term: string;
      event_count: number;
    }>(sql`
      SELECT
        search_term,
        SUM(event_count)::int AS event_count
      FROM ga4_search_terms
      WHERE date >= TO_CHAR(CURRENT_DATE - INTERVAL '${sql.raw(String(LOOKBACK_DAYS))} days', 'YYYY-MM-DD')
      GROUP BY search_term
      ORDER BY SUM(event_count) DESC
      LIMIT 100
    `).then((r: any) => r.rows ?? r);
    res.json({ data: rows, lookbackDays: LOOKBACK_DAYS });
  } catch (err) {
    console.error("GA4 search-terms error:", err);
    res.status(500).json({ error: "Failed to fetch search terms" });
  }
});

/** Top-engaged pages: ranked by engagement_rate × sessions over 30d. */
router.get("/top-engaged", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.execute<{
      page: string;
      sessions: number;
      engaged_sessions: number;
      engagement_rate: number;
      avg_engagement_time: number;
      conversions: number;
    }>(sql`
      SELECT
        page,
        SUM(sessions)::int AS sessions,
        SUM(engaged_sessions)::int AS engaged_sessions,
        (SUM(engaged_sessions)::float / NULLIF(SUM(sessions), 0)::float) AS engagement_rate,
        AVG(avg_engagement_time::float)::float AS avg_engagement_time,
        SUM(conversions)::int AS conversions
      FROM ga4_page_metrics
      WHERE date >= TO_CHAR(CURRENT_DATE - INTERVAL '${sql.raw(String(LOOKBACK_DAYS))} days', 'YYYY-MM-DD')
      GROUP BY page
      HAVING SUM(sessions) >= 50
      ORDER BY (SUM(engaged_sessions)::float / NULLIF(SUM(sessions), 0)::float) DESC NULLS LAST
      LIMIT 100
    `).then((r: any) => r.rows ?? r);
    res.json({ data: rows, lookbackDays: LOOKBACK_DAYS });
  } catch (err) {
    console.error("GA4 top-engaged error:", err);
    res.status(500).json({ error: "Failed to fetch top-engaged pages" });
  }
});

export default router;
