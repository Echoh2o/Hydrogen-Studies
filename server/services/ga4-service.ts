/**
 * Google Analytics 4 (GA4) integration.
 *
 * Mirrors gsc-service.ts almost line-for-line. One module owns:
 *   • OAuth client construction (reusing the GSC OAuth credentials —
 *     same Google Cloud project, just an additional scope)
 *   • Persisting and loading the encrypted refresh token
 *   • The Analytics Data API v1beta `runReport` call
 *   • Daily sync orchestration: 90-day backfill on first run, 3-day
 *     incremental thereafter
 *
 * Two report shapes are pulled per day:
 *   1. Per-page engagement metrics (sessions, engagement, bounces, conversions)
 *   2. On-site search terms (the `search_term` event)
 */

import { OAuth2Client } from "google-auth-library";
import { sql, eq, desc } from "drizzle-orm";
import { db } from "../db";
import { ga4Credentials, ga4PageMetrics, ga4SearchTerms, ga4SyncRuns } from "@shared/schema";
import { encryptSecret, decryptSecret, ensureSystemSecretsTable } from "./crypto-secrets";
import { fetchWithTimeout } from "../utils/http";
import { logger } from "../utils/logger";

const TAG = "Ga4Service";

const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

function requireOauthClientId(): string {
  // Fall back to GSC vars so the admin doesn't have to duplicate env in Railway.
  const v = process.env.GA4_CLIENT_ID || process.env.GSC_CLIENT_ID;
  if (!v) throw new Error("Missing GA4_CLIENT_ID / GSC_CLIENT_ID env var");
  return v;
}
function requireOauthClientSecret(): string {
  const v = process.env.GA4_CLIENT_SECRET || process.env.GSC_CLIENT_SECRET;
  if (!v) throw new Error("Missing GA4_CLIENT_SECRET / GSC_CLIENT_SECRET env var");
  return v;
}

/** GA4 property ID — numeric, e.g. "123456789". Required env var. */
export function ga4PropertyId(): string {
  return process.env.GA4_PROPERTY_ID || "";
}

export function makeOAuthClient(): OAuth2Client {
  return new OAuth2Client({
    clientId: requireOauthClientId(),
    clientSecret: requireOauthClientSecret(),
    redirectUri: oauthRedirectUri(),
  });
}

export function oauthRedirectUri(req?: { protocol: string; get(h: string): string | undefined }): string {
  if (process.env.GA4_REDIRECT_URI) return process.env.GA4_REDIRECT_URI;
  if (req) {
    const host = req.get("host");
    return `${req.protocol}://${host}/api/admin/ga4/oauth/callback`;
  }
  return "https://hydrogenstudies.com/api/admin/ga4/oauth/callback";
}

export function buildAuthUrl(state: string, redirectUri: string): string {
  const client = new OAuth2Client({
    clientId: requireOauthClientId(),
    clientSecret: requireOauthClientSecret(),
    redirectUri,
  });
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [SCOPE],
    state,
  });
}

let ensurePromise: Promise<void> | null = null;
export function ensureGa4Tables(): Promise<void> {
  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    try {
      await ensureSystemSecretsTable();
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ga4_credentials (
          id serial PRIMARY KEY,
          account_email text NOT NULL,
          property_id text NOT NULL,
          token_ciphertext text NOT NULL,
          scopes text[],
          connected_at timestamp NOT NULL DEFAULT NOW(),
          last_refreshed_at timestamp,
          last_sync_at timestamp
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ga4_page_metrics (
          id serial PRIMARY KEY,
          date text NOT NULL,
          page text NOT NULL,
          sessions integer NOT NULL DEFAULT 0,
          engaged_sessions integer NOT NULL DEFAULT 0,
          engagement_rate text NOT NULL DEFAULT '0',
          avg_engagement_time text NOT NULL DEFAULT '0',
          bounces integer NOT NULL DEFAULT 0,
          conversions integer NOT NULL DEFAULT 0,
          fetched_at timestamp NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS ga4_page_metrics_dp_unique
          ON ga4_page_metrics (date, page)
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS ga4_page_metrics_page_date_idx ON ga4_page_metrics (page, date)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS ga4_page_metrics_date_idx ON ga4_page_metrics (date)`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ga4_search_terms (
          id serial PRIMARY KEY,
          date text NOT NULL,
          search_term text NOT NULL,
          event_count integer NOT NULL DEFAULT 0,
          fetched_at timestamp NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS ga4_search_terms_ds_unique
          ON ga4_search_terms (date, search_term)
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS ga4_search_terms_date_idx ON ga4_search_terms (date)`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ga4_sync_runs (
          id serial PRIMARY KEY,
          started_at timestamp NOT NULL DEFAULT NOW(),
          completed_at timestamp,
          days_pulled integer NOT NULL DEFAULT 0,
          rows_inserted integer NOT NULL DEFAULT 0,
          rows_updated integer NOT NULL DEFAULT 0,
          status text NOT NULL DEFAULT 'running',
          error text
        )
      `);
      logger.info("GA4 tables ensured", TAG);
    } catch (err) {
      ensurePromise = null;
      logger.error("Failed to ensure GA4 tables", err, TAG);
    }
  })();
  return ensurePromise;
}

export async function saveCredentials(args: {
  refreshToken: string;
  accountEmail: string;
  propertyId: string;
  scopes: string[];
}): Promise<void> {
  await ensureGa4Tables();
  const ciphertext = await encryptSecret(args.refreshToken);
  await db.delete(ga4Credentials);
  await db.insert(ga4Credentials).values({
    accountEmail: args.accountEmail,
    propertyId: args.propertyId,
    tokenCiphertext: ciphertext,
    scopes: args.scopes,
  });
}

export async function loadCredentials(): Promise<{
  id: number;
  accountEmail: string;
  propertyId: string;
  refreshToken: string;
  lastSyncAt: Date | null;
  connectedAt: Date;
} | null> {
  await ensureGa4Tables();
  const [row] = await db.select().from(ga4Credentials).orderBy(desc(ga4Credentials.id)).limit(1);
  if (!row) return null;
  const refreshToken = await decryptSecret(row.tokenCiphertext);
  return {
    id: row.id,
    accountEmail: row.accountEmail,
    propertyId: row.propertyId,
    refreshToken,
    lastSyncAt: row.lastSyncAt,
    connectedAt: row.connectedAt,
  };
}

export async function disconnect(): Promise<void> {
  await ensureGa4Tables();
  try {
    const cred = await loadCredentials();
    if (cred) {
      const client = makeOAuthClient();
      client.setCredentials({ refresh_token: cred.refreshToken });
      await client.revokeCredentials().catch(() => {});
    }
  } catch {
    // ignore — local delete is the source of truth
  }
  await db.delete(ga4Credentials);
}

// ── Sync ─────────────────────────────────────────────────────────

const FIRST_RUN_LOOKBACK_DAYS = 90;
const INCREMENTAL_LOOKBACK_DAYS = 3;
const ROW_LIMIT_PER_REPORT = 100000;

interface PageMetricRow {
  date: string;
  page: string;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  avgEngagementTime: number;
  bounces: number;
  conversions: number;
}

interface SearchTermRow {
  date: string;
  searchTerm: string;
  eventCount: number;
}

/** Format YYYY-MM-DD → YYYYMMDD for GA4 row date dimension. */
function ga4DateToIso(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

async function runReport(
  oauth: OAuth2Client,
  propertyId: string,
  body: Record<string, any>,
): Promise<{ rows: any[]; metricHeaders: any[]; dimensionHeaders: any[] }> {
  const accessToken = await oauth.getAccessToken();
  if (!accessToken.token) throw new Error("Failed to obtain access token");

  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(
    propertyId,
  )}:runReport`;

  // 30s: a 90-day backfill runReport can return large row sets slowly.
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }, 30_000);
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`GA4 API ${res.status}: ${errBody.slice(0, 400)}`);
  }
  const json = (await res.json()) as any;
  return {
    rows: json.rows ?? [],
    metricHeaders: json.metricHeaders ?? [],
    dimensionHeaders: json.dimensionHeaders ?? [],
  };
}

async function fetchPageMetrics(
  oauth: OAuth2Client,
  propertyId: string,
  startDate: string,
  endDate: string,
): Promise<PageMetricRow[]> {
  const { rows } = await runReport(oauth, propertyId, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }, { name: "pagePath" }],
    metrics: [
      { name: "sessions" },
      { name: "engagedSessions" },
      { name: "engagementRate" },
      { name: "userEngagementDuration" },
      { name: "bounceRate" },
      { name: "conversions" },
    ],
    limit: ROW_LIMIT_PER_REPORT,
    keepEmptyRows: false,
  });

  const out: PageMetricRow[] = [];
  for (const r of rows) {
    const dimVals = r.dimensionValues ?? [];
    const metVals = r.metricValues ?? [];
    const date = ga4DateToIso(dimVals[0]?.value ?? "");
    const page = dimVals[1]?.value ?? "";
    if (!date || !page) continue;
    const sessions = Number(metVals[0]?.value ?? 0) | 0;
    const engagedSessions = Number(metVals[1]?.value ?? 0) | 0;
    const engagementRate = Number(metVals[2]?.value ?? 0);
    // userEngagementDuration is total seconds across sessions; divide by
    // sessions for an average. Guard against divide-by-zero.
    const totalEngagementSeconds = Number(metVals[3]?.value ?? 0);
    const avgEngagementTime = sessions > 0 ? totalEngagementSeconds / sessions : 0;
    const bounceRate = Number(metVals[4]?.value ?? 0);
    const bounces = Math.round(bounceRate * sessions);
    const conversions = Number(metVals[5]?.value ?? 0) | 0;
    out.push({
      date, page, sessions, engagedSessions, engagementRate,
      avgEngagementTime, bounces, conversions,
    });
  }
  return out;
}

async function fetchSearchTerms(
  oauth: OAuth2Client,
  propertyId: string,
  startDate: string,
  endDate: string,
): Promise<SearchTermRow[]> {
  // The `search_term` event fires when GA4's enhanced measurement detects
  // a site search. If the property doesn't have site search configured,
  // this returns zero rows — that's fine, just skip.
  const { rows } = await runReport(oauth, propertyId, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }, { name: "searchTerm" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        stringFilter: { value: "search", matchType: "EXACT" },
      },
    },
    limit: ROW_LIMIT_PER_REPORT,
    keepEmptyRows: false,
  }).catch(() => ({ rows: [] as any[] }));

  const out: SearchTermRow[] = [];
  for (const r of rows) {
    const dimVals = r.dimensionValues ?? [];
    const metVals = r.metricValues ?? [];
    const date = ga4DateToIso(dimVals[0]?.value ?? "");
    const searchTerm = (dimVals[1]?.value ?? "").trim();
    const eventCount = Number(metVals[0]?.value ?? 0) | 0;
    if (date && searchTerm) {
      out.push({ date, searchTerm, eventCount });
    }
  }
  return out;
}

/**
 * Serialize sync runs in-process. The scheduled job and a manual admin-triggered
 * sync can otherwise overlap (the manual path bypasses the scheduler's
 * isJobRunning guard), producing two concurrent `running` rows, duplicate OAuth
 * token refreshes, and redundant upserts. In-process guard only; a multi-instance
 * deployment would need a Postgres advisory lock for cross-process exclusion.
 */
let ga4SyncInFlight = false;

export async function syncGa4(): Promise<{
  daysPulled: number;
  rowsInserted: number;
  rowsUpdated: number;
  skipped?: string;
}> {
  if (ga4SyncInFlight) {
    return { daysPulled: 0, rowsInserted: 0, rowsUpdated: 0, skipped: "already running" };
  }
  ga4SyncInFlight = true;
  try {
    return await syncGa4Impl();
  } finally {
    ga4SyncInFlight = false;
  }
}

async function syncGa4Impl(): Promise<{
  daysPulled: number;
  rowsInserted: number;
  rowsUpdated: number;
  skipped?: string;
}> {
  const cred = await loadCredentials();
  if (!cred) {
    return { daysPulled: 0, rowsInserted: 0, rowsUpdated: 0, skipped: "no credentials" };
  }
  if (!cred.propertyId) {
    return { daysPulled: 0, rowsInserted: 0, rowsUpdated: 0, skipped: "missing property id" };
  }

  const isFirstRun = !cred.lastSyncAt;
  const lookback = isFirstRun ? FIRST_RUN_LOOKBACK_DAYS : INCREMENTAL_LOOKBACK_DAYS;

  // GA4 settles within ~24h. Pull through "today - 1" so we don't burn
  // requests on data that's still moving.
  const today = new Date();
  const endDate = new Date(today.getTime() - 1 * 86400000);
  const startDate = new Date(endDate.getTime() - (lookback - 1) * 86400000);
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  const [run] = await db
    .insert(ga4SyncRuns)
    .values({ startedAt: new Date(), status: "running" })
    .returning();

  const oauth = makeOAuthClient();
  oauth.setCredentials({ refresh_token: cred.refreshToken });

  let inserted = 0;
  let updated = 0;
  try {
    const pageRows = await fetchPageMetrics(oauth, cred.propertyId, startStr, endStr);
    const searchRows = await fetchSearchTerms(oauth, cred.propertyId, startStr, endStr);

    const CHUNK = 500;

    // Upsert page metrics.
    for (let i = 0; i < pageRows.length; i += CHUNK) {
      const slice = pageRows.slice(i, i + CHUNK);
      const result: any = await db.execute(sql`
        INSERT INTO ga4_page_metrics
          (date, page, sessions, engaged_sessions, engagement_rate,
           avg_engagement_time, bounces, conversions, fetched_at)
        VALUES ${sql.join(
          slice.map((r) => sql`(
            ${r.date}, ${r.page},
            ${r.sessions}, ${r.engagedSessions},
            ${r.engagementRate.toString()}, ${r.avgEngagementTime.toString()},
            ${r.bounces}, ${r.conversions}, NOW()
          )`),
          sql`, `,
        )}
        ON CONFLICT (date, page) DO UPDATE SET
          sessions = EXCLUDED.sessions,
          engaged_sessions = EXCLUDED.engaged_sessions,
          engagement_rate = EXCLUDED.engagement_rate,
          avg_engagement_time = EXCLUDED.avg_engagement_time,
          bounces = EXCLUDED.bounces,
          conversions = EXCLUDED.conversions,
          fetched_at = NOW()
        RETURNING (xmax = 0) AS inserted
      `);
      const out = (result.rows ?? result) as Array<{ inserted: boolean }>;
      for (const r of out) {
        if (r.inserted) inserted++;
        else updated++;
      }
    }

    // Upsert search terms.
    for (let i = 0; i < searchRows.length; i += CHUNK) {
      const slice = searchRows.slice(i, i + CHUNK);
      const result: any = await db.execute(sql`
        INSERT INTO ga4_search_terms
          (date, search_term, event_count, fetched_at)
        VALUES ${sql.join(
          slice.map((r) => sql`(${r.date}, ${r.searchTerm}, ${r.eventCount}, NOW())`),
          sql`, `,
        )}
        ON CONFLICT (date, search_term) DO UPDATE SET
          event_count = EXCLUDED.event_count,
          fetched_at = NOW()
        RETURNING (xmax = 0) AS inserted
      `);
      const out = (result.rows ?? result) as Array<{ inserted: boolean }>;
      for (const r of out) {
        if (r.inserted) inserted++;
        else updated++;
      }
    }

    // Days pulled = the date range size, not the row count, for parity
    // with the GSC sync. Useful for the System Health card.
    const daysPulled = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);

    await db
      .update(ga4SyncRuns)
      .set({
        status: "success",
        completedAt: new Date(),
        daysPulled,
        rowsInserted: inserted,
        rowsUpdated: updated,
      })
      .where(eq(ga4SyncRuns.id, run.id));
    await db
      .update(ga4Credentials)
      .set({ lastSyncAt: new Date() })
      .where(eq(ga4Credentials.id, cred.id));

    return { daysPulled, rowsInserted: inserted, rowsUpdated: updated };
  } catch (err) {
    await db
      .update(ga4SyncRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        error: err instanceof Error ? err.message : String(err),
      })
      .where(eq(ga4SyncRuns.id, run.id));
    throw err;
  }
}

export async function lastSyncRun() {
  await ensureGa4Tables();
  const [row] = await db
    .select()
    .from(ga4SyncRuns)
    .orderBy(desc(ga4SyncRuns.startedAt))
    .limit(1);
  return row ?? null;
}
