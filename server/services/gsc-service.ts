/**
 * Google Search Console integration.
 *
 * One module owns:
 *   • OAuth client construction (using google-auth-library)
 *   • Persisting and loading the encrypted refresh token
 *   • The Search Console search-analytics query (raw fetch — single endpoint,
 *     no need for the heavyweight `googleapis` package)
 *   • Daily sync orchestration (90-day backfill on first run, then 3-day
 *     incremental thereafter to capture late-settling metrics)
 *
 * Idempotent boot setup creates the schema columns/tables. The cron job in
 * job-scheduler.ts calls `syncSearchConsole()` every 6 hours.
 */

import { OAuth2Client } from "google-auth-library";
import { sql, eq, desc, and } from "drizzle-orm";
import { db } from "../db";
import { gscCredentials, gscQueryMetrics, gscSyncRuns } from "@shared/schema";
import { encryptSecret, decryptSecret, ensureSystemSecretsTable } from "./crypto-secrets";
import { logger } from "../utils/logger";

const TAG = "GscService";

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

/** Site URL passed to the GSC API (e.g. `sc-domain:hydrogenstudies.com`). */
export function gscSiteUrl(): string {
  return process.env.GSC_SITE_URL || "sc-domain:hydrogenstudies.com";
}

/** Build an OAuth client. Used by both the consent flow and the sync service. */
export function makeOAuthClient(): OAuth2Client {
  return new OAuth2Client({
    clientId: requireEnv("GSC_CLIENT_ID"),
    clientSecret: requireEnv("GSC_CLIENT_SECRET"),
    redirectUri: oauthRedirectUri(),
  });
}

/** Resolve the redirect URI from request context (or env override). */
export function oauthRedirectUri(req?: { protocol: string; get(h: string): string | undefined }): string {
  if (process.env.GSC_REDIRECT_URI) return process.env.GSC_REDIRECT_URI;
  if (req) {
    const host = req.get("host");
    return `${req.protocol}://${host}/api/admin/gsc/oauth/callback`;
  }
  return "https://hydrogenstudies.com/api/admin/gsc/oauth/callback";
}

/** OAuth consent URL the admin clicks "Connect" to land at. */
export function buildAuthUrl(state: string, redirectUri: string): string {
  const client = new OAuth2Client({
    clientId: requireEnv("GSC_CLIENT_ID"),
    clientSecret: requireEnv("GSC_CLIENT_SECRET"),
    redirectUri,
  });
  return client.generateAuthUrl({
    access_type: "offline",      // need refresh_token, not just access_token
    prompt: "consent",            // force re-consent so we always receive refresh_token
    scope: [SCOPE],
    state,
  });
}

/** Idempotent schema setup so a fresh deploy can write/read GSC tables. */
let ensurePromise: Promise<void> | null = null;
export function ensureGscTables(): Promise<void> {
  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    try {
      await ensureSystemSecretsTable();
      // Tables are defined in schema.ts; drizzle-kit push handles them on
      // boot. Belt-and-braces ALTER for envs where push didn't run yet.
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS gsc_credentials (
          id serial PRIMARY KEY,
          account_email text NOT NULL,
          site_url text NOT NULL,
          token_ciphertext text NOT NULL,
          scopes text[],
          connected_at timestamp NOT NULL DEFAULT NOW(),
          last_refreshed_at timestamp,
          last_sync_at timestamp
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS gsc_query_metrics (
          id serial PRIMARY KEY,
          date text NOT NULL,
          page text NOT NULL,
          query text NOT NULL,
          impressions integer NOT NULL DEFAULT 0,
          clicks integer NOT NULL DEFAULT 0,
          ctr text NOT NULL DEFAULT '0',
          position text NOT NULL DEFAULT '0',
          fetched_at timestamp NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS gsc_query_metrics_dpq_unique
          ON gsc_query_metrics (date, page, query)
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS gsc_query_metrics_page_date_idx ON gsc_query_metrics (page, date)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS gsc_query_metrics_query_date_idx ON gsc_query_metrics (query, date)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS gsc_query_metrics_date_idx ON gsc_query_metrics (date)`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS gsc_sync_runs (
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
      logger.info("GSC tables ensured", TAG);
    } catch (err) {
      ensurePromise = null;
      logger.error("Failed to ensure GSC tables", err, TAG);
    }
  })();
  return ensurePromise;
}

/** Persist a freshly-issued refresh token + account info. Replaces any prior cred. */
export async function saveCredentials(args: {
  refreshToken: string;
  accountEmail: string;
  scopes: string[];
}): Promise<void> {
  await ensureGscTables();
  const ciphertext = await encryptSecret(args.refreshToken);
  // Single-row design: delete any prior credential, then insert. Avoids
  // ambiguity about which token the sync should use.
  await db.delete(gscCredentials);
  await db.insert(gscCredentials).values({
    accountEmail: args.accountEmail,
    siteUrl: gscSiteUrl(),
    tokenCiphertext: ciphertext,
    scopes: args.scopes,
  });
}

export async function loadCredentials(): Promise<{
  id: number;
  accountEmail: string;
  siteUrl: string;
  refreshToken: string;
  lastSyncAt: Date | null;
  connectedAt: Date;
} | null> {
  await ensureGscTables();
  const [row] = await db.select().from(gscCredentials).orderBy(desc(gscCredentials.id)).limit(1);
  if (!row) return null;
  const refreshToken = await decryptSecret(row.tokenCiphertext);
  return {
    id: row.id,
    accountEmail: row.accountEmail,
    siteUrl: row.siteUrl,
    refreshToken,
    lastSyncAt: row.lastSyncAt,
    connectedAt: row.connectedAt,
  };
}

export async function disconnect(): Promise<void> {
  await ensureGscTables();
  // Best-effort revoke at Google before we drop the row locally.
  try {
    const cred = await loadCredentials();
    if (cred) {
      const client = makeOAuthClient();
      client.setCredentials({ refresh_token: cred.refreshToken });
      await client.revokeCredentials().catch(() => {}); // tolerate revoke errors
    }
  } catch {
    // ignore — local delete is the source of truth
  }
  await db.delete(gscCredentials);
}

// ── Sync ─────────────────────────────────────────────────────────

interface GscRow {
  keys: [string, string, string]; // [page, query, date]
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
}

const ROW_LIMIT = 25000;          // GSC max per request
const MAX_PAGES_PER_DAY = 5;       // 5 × 25k = 125k rows / day; plenty.
const FIRST_RUN_LOOKBACK_DAYS = 90;
const INCREMENTAL_LOOKBACK_DAYS = 3;

/**
 * Run a search-analytics query against the GSC API for a given date.
 * Pages through results until the row limit is exhausted.
 */
async function fetchDay(
  oauth: OAuth2Client,
  siteUrl: string,
  date: string,
): Promise<GscRow[]> {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    siteUrl,
  )}/searchAnalytics/query`;

  const all: GscRow[] = [];
  for (let pageIdx = 0; pageIdx < MAX_PAGES_PER_DAY; pageIdx++) {
    const accessToken = await oauth.getAccessToken();
    if (!accessToken.token) {
      throw new Error("Failed to obtain access token");
    }
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: date,
        endDate: date,
        dimensions: ["page", "query"],
        rowLimit: ROW_LIMIT,
        startRow: pageIdx * ROW_LIMIT,
        dataState: "final",
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`GSC API ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as { rows?: Array<{
      keys: [string, string];
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }> };

    const rows = json.rows ?? [];
    for (const r of rows) {
      all.push({
        keys: [r.keys[0], r.keys[1], date],
        impressions: r.impressions,
        clicks: r.clicks,
        ctr: r.ctr,
        position: r.position,
      });
    }
    if (rows.length < ROW_LIMIT) break; // no more pages
  }
  return all;
}

/**
 * Pull the last N days of GSC data into the local fact table.
 * Idempotent — uses ON CONFLICT to upsert rows for re-pulled dates.
 *
 * @returns the run summary
 */
export async function syncSearchConsole(opts: { force?: boolean } = {}): Promise<{
  daysPulled: number;
  rowsInserted: number;
  rowsUpdated: number;
  skipped?: string;
}> {
  const cred = await loadCredentials();
  if (!cred) {
    return { daysPulled: 0, rowsInserted: 0, rowsUpdated: 0, skipped: "no credentials" };
  }

  // Decide lookback window: first sync (no prior data) → 90 days, otherwise
  // the recent 3 days to capture late-settling metrics.
  const isFirstRun = !cred.lastSyncAt;
  const lookback = isFirstRun ? FIRST_RUN_LOOKBACK_DAYS : INCREMENTAL_LOOKBACK_DAYS;

  // GSC data lags ~2 days. Request through "today - 2" so we don't burn
  // requests on dates that will still change.
  const today = new Date();
  const endDate = new Date(today.getTime() - 2 * 86400000);
  const dates: string[] = [];
  for (let i = 0; i < lookback; i++) {
    const d = new Date(endDate.getTime() - i * 86400000);
    dates.push(d.toISOString().slice(0, 10));
  }

  const [run] = await db
    .insert(gscSyncRuns)
    .values({ startedAt: new Date(), status: "running" })
    .returning();

  const oauth = makeOAuthClient();
  oauth.setCredentials({ refresh_token: cred.refreshToken });

  let inserted = 0;
  let updated = 0;
  try {
    for (const date of dates) {
      const rows = await fetchDay(oauth, cred.siteUrl, date);
      if (rows.length === 0) continue;

      // Insert in chunks to keep the SQL statement size reasonable.
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const result = await db.execute(sql`
          INSERT INTO gsc_query_metrics
            (date, page, query, impressions, clicks, ctr, position, fetched_at)
          VALUES ${sql.join(
            slice.map((r) => sql`(
              ${r.keys[2]},
              ${r.keys[0]},
              ${r.keys[1]},
              ${r.impressions},
              ${r.clicks},
              ${r.ctr.toString()},
              ${r.position.toString()},
              NOW()
            )`),
            sql`, `,
          )}
          ON CONFLICT (date, page, query) DO UPDATE SET
            impressions = EXCLUDED.impressions,
            clicks = EXCLUDED.clicks,
            ctr = EXCLUDED.ctr,
            position = EXCLUDED.position,
            fetched_at = NOW()
          RETURNING (xmax = 0) AS inserted
        `);
        const out = ((result as any).rows ?? result) as Array<{ inserted: boolean }>;
        for (const r of out) {
          if (r.inserted) inserted++;
          else updated++;
        }
      }
    }

    await db
      .update(gscSyncRuns)
      .set({
        status: "success",
        completedAt: new Date(),
        daysPulled: dates.length,
        rowsInserted: inserted,
        rowsUpdated: updated,
      })
      .where(eq(gscSyncRuns.id, run.id));
    await db
      .update(gscCredentials)
      .set({ lastSyncAt: new Date() })
      .where(eq(gscCredentials.id, cred.id));

    return { daysPulled: dates.length, rowsInserted: inserted, rowsUpdated: updated };
  } catch (err) {
    await db
      .update(gscSyncRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        error: err instanceof Error ? err.message : String(err),
      })
      .where(eq(gscSyncRuns.id, run.id));
    throw err;
  }
}

/** Most recent sync run for the System Health card. */
export async function lastSyncRun() {
  await ensureGscTables();
  const [row] = await db
    .select()
    .from(gscSyncRuns)
    .orderBy(desc(gscSyncRuns.startedAt))
    .limit(1);
  return row ?? null;
}
