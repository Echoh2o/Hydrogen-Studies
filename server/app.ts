import express from "express";
import helmet from "helmet";
import compression from "compression";
import crypto from "crypto";
// @ts-ignore - no type declarations available
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
// Security and session imports
import { getSessionMiddleware } from "./config/session-config";
import { getCorsConfig, validateCorsConfig } from "./config/cors-config";
import {
  csrfProtection,
  csrfToken,
  addCsrfToResponse,
} from "./csrf-protection";

// Error handling imports
import {
  globalErrorHandler,
  requestIdMiddleware,
  errorRecoveryMiddleware,
  timeoutMiddleware,
} from "./utils/error-handler";
import {
  errorReportingMiddleware,
  errorReportingHandler,
} from "./utils/error-reporting";
import { NotFoundError } from "./utils/app-errors";
import { db } from "./db";
import { studies, gscCredentials, gscSyncRuns, ga4Credentials, ga4SyncRuns } from "@shared/schema";
import { and, desc, eq, sql } from "drizzle-orm";

// Route imports
import authRoutes from "./routes/auth-routes";
import { requireAdmin } from "./auth";
import studiesRouter from "./routes/studies-router";
import researchUnifiedRoutes from "./routes/research-unified-routes";
import keywordMonitorRoutes from "./routes/keyword-monitor-routes";
import keywordMonitorScheduleRoutes from "./routes/keyword-monitor-schedule-routes";
import contentEnrichmentRoutes from "./routes/content-enrichment-routes";
import enrichmentRoutes from "./routes/enrichment-routes";
import blogRoutes from "./routes/blog-routes";
import blogRecommendationRoutes from "./routes/blog-recommendation-routes";
import chatRoutes from "./routes/chat-routes";
import trendsRoutes from "./routes/trends-routes";
import contentAnalyticsRoutes from "./routes/content-analytics-routes";
import explorerRoutes from "./routes/explorer-routes";
import reviewAssistantRoutes from "./routes/review-assistant-routes";
import adminMonitoringRoutes from "./routes/admin-monitoring-routes";
import contentOptimizationRoutes from "./routes/content-optimization-routes";
import multiFormatRoutes from "./routes/multi-format-routes";
import hydrogenRoutes from "./routes/hydrogen-routes";
import consumerCategoriesRoutes from "./routes/consumer-categories-routes";
import naturalLanguageSearchRoutes from "./routes/natural-language-search-routes";
import importRoutes from "./routes/import-routes";
import europePmcRoutes from "./routes/europepmc-routes";
import crossRefRoutes from "./routes/crossref-routes";
import consensusRoutes from "./routes/consensus-routes";
import unifiedSearchRoutes from "./routes/unified-search-routes";
import scraperRoutes from "./routes/scraper-routes";
import seoRoutes, { seoAdminRouter } from "./routes/seo-routes";
import seoContentFactoryRoutes from "./routes/seo-content-factory-routes";
import shopifyWebhookRoutes from "./routes/shopify-webhook-routes";
import newsletterRoutes from "./routes/newsletter-routes";
import userDashboardRoutes from "./routes/user-dashboard-routes";
import adminSettingsRoutes from "./routes/admin-settings-routes";
import adminLinkRoutes from "./routes/admin-link-routes";
import adminRedirectRoutes from "./routes/admin-redirect-routes";
import contactRoutes from "./routes/contact-routes";
import pipelineRoutes from "./routes/pipeline-routes";
import imageGenerationRoutes from "./routes/image-generation-routes";
import doiEnhancerRoutes from "./routes/doi-enhancer-routes";
import learnStatsRoutes from "./routes/learn-stats-routes";

// New Controllers
import { searchController } from "./controllers/search-controller";
import { adminController } from "./controllers/admin-controller";
import { categoriesController } from "./controllers/categories-controller";

// Monitoring and utilities
import {
  initializeHealthMonitoring,
  performHealthCheck,
} from "./utils/health-monitoring";
import { qualityAudit } from "./utils/comprehensive-quality-audit";
import {
  searchRateLimiter,
  generalApiRateLimiter,
  aiGenerationRateLimiter,
  aiSearchRateLimiter,
  nlSuggestionsRateLimiter,
  skipForAdmin,
} from "./utils/rate-limiting";


const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

// Trust proxy for Railway/Docker deployments (needed for secure cookies behind reverse proxy)
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Security headers via helmet (CSP, HSTS, X-Frame-Options, etc.)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "https://www.googletagmanager.com",
          "https://www.google-analytics.com",
          "https://analytics.ahrefs.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: [
          "'self'",
          "https://www.google-analytics.com",
          "https://api.anthropic.com",
          "https://analytics.ahrefs.com",
        ],
        // youtube-nocookie.com is the privacy-respecting embed host that
        // doesn't set a tracking cookie until the user clicks play. Used
        // by the optional YouTube embed on blog posts (Phase C).
        frameSrc: ["'self'", "https://www.youtube-nocookie.com", "https://www.youtube.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests:
          process.env.NODE_ENV === "production" ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);

// HTTP compression (gzip) — mounted right after helmet so every downstream
// response is covered: search/API JSON, sitemaps, robots.txt, and SSR HTML.
// Static hashed chunks can additionally be served pre-compressed via
// vite-plugin-compression + express-static-gzip if that is wired up later.
app.use(compression());

// Redirect middleware — must be very early (before routes) to intercept 301/302s
import { redirectMiddleware, log404, ensureRedirectIndexes } from "./services/redirect-service";
app.use(redirectMiddleware());
// Fire-and-forget: enables pg_trgm, creates GIN trigram indexes, and
// adds not_found_log.suggestions (idempotent). Safe to swallow — the
// suggestion engine tolerates missing indexes via fallback seq-scans.
ensureRedirectIndexes().catch(() => {});

// Dynamic redirect: /study/id%2F{number} or /study/id/{number} → /study/{slug}
// Single-hop 301 — resolves slug from DB to avoid redirect chains
const idSlugCache = new Map<number, string>(); // bounded cache: id → slug (max 2000 entries)
const ID_SLUG_CACHE_MAX = 2000;
async function resolveStudySlug(studyId: number): Promise<string | null> {
  const cached = idSlugCache.get(studyId);
  if (cached) return cached;
  try {
    const [study] = await db.select({ slug: studies.slug }).from(studies).where(eq(studies.id, studyId)).limit(1);
    if (study?.slug && !study.slug.startsWith("id/")) {
      if (idSlugCache.size >= ID_SLUG_CACHE_MAX) {
        // Evict oldest entry
        const firstKey = idSlugCache.keys().next().value;
        if (firstKey !== undefined) idSlugCache.delete(firstKey);
      }
      idSlugCache.set(studyId, study.slug);
      return study.slug;
    }
  } catch {}
  return null;
}
app.use(async (req, res, next) => {
  if (req.method !== "GET") return next();
  // Match /study/id%2F{number} (Express doesn't decode %2F in paths)
  const encodedMatch = req.path.match(/^\/study\/id%2[Ff](\d+)$/);
  if (encodedMatch) {
    const slug = await resolveStudySlug(parseInt(encodedMatch[1]));
    return res.redirect(301, slug ? `/study/${slug}` : `/study/id/${encodedMatch[1]}`);
  }
  next();
});
app.get("/study/id/:id(\\d+)", async (req, res, next) => {
  const slug = await resolveStudySlug(parseInt(req.params.id));
  if (slug) return res.redirect(301, `/study/${slug}`);
  next();
});

// Request tracking, error reporting, and recovery middleware
app.use(requestIdMiddleware);
app.use(errorReportingMiddleware());
app.use(errorRecoveryMiddleware);
app.use(timeoutMiddleware(30000)); // 30 second timeout

// Cookie parser for CSRF tokens
app.use(cookieParser());

// Secure CORS configuration
validateCorsConfig();
app.use(cors(getCorsConfig()));

// Body parsing middleware — capture raw body for webhook HMAC verification
app.use(express.json({
  limit: "2mb",
  verify: (req: any, _res, buf) => {
    if (req.originalUrl?.startsWith("/api/webhooks/")) {
      req.rawBody = buf;
    }
  },
}));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Dynamic SEO routes (sitemaps, robots.txt) — must be before CSRF and session
app.use(seoRoutes);

// Liveness + readiness probe for external uptime monitors (Railway, UptimeRobot,
// Datadog). Public, no auth, no CSRF. Returns 200 when the DB is reachable and
// every connected sync has run successfully in the last 24h; 503 otherwise so a
// stuck cron surfaces as an alert instead of silently rotting.
//
// Hardened against being a DoS amplifier on an unauthenticated endpoint:
//  - the whole probe is bounded by HEALTH_PROBE_TIMEOUT_MS (returns 503 rather
//    than holding a pool connection open indefinitely under DB stress)
//  - results are cached for HEALTH_CACHE_MS so a flood collapses to one DB round-trip
const HEALTH_STALE_MS = 24 * 60 * 60 * 1000; // a sync that hasn't succeeded in 24h is stale
const HEALTH_RUNNING_STUCK_MS = 60 * 60 * 1000; // a run still 'running' after 1h is stuck
const HEALTH_PROBE_TIMEOUT_MS = 3000;
const HEALTH_CACHE_MS = 10 * 1000;

type HealthSync = { connected: boolean; lastSync: string | null; ageMinutes: number | null };
type HealthOut = {
  status: "ok" | "degraded";
  db: "ok" | "fail";
  gsc: HealthSync;
  ga4: HealthSync;
  note?: string;
};

let healthCache: { at: number; out: HealthOut } | null = null;

// Evaluate one sync's health from its credential + sync-run tables. Looks at the
// latest run of ANY status (to catch a sync stuck in 'running' or whose most
// recent attempt 'failed') as well as the latest successful run.
async function evaluateSyncHealth(
  credTable: any,
  runTable: any,
  now: number,
): Promise<{ sync: HealthSync; degraded: boolean }> {
  const sync: HealthSync = { connected: false, lastSync: null, ageMinutes: null };
  try {
    const [cred] = await db.select().from(credTable).limit(1);
    if (!cred) return { sync, degraded: false };
    sync.connected = true;

    const [latestAny] = await db
      .select()
      .from(runTable)
      .orderBy(desc(runTable.startedAt))
      .limit(1);
    const [latestSuccess] = await db
      .select()
      .from(runTable)
      .where(eq(runTable.status, "success"))
      .orderBy(desc(runTable.startedAt))
      .limit(1);

    const lastSuccess: Date | null =
      latestSuccess?.completedAt ?? latestSuccess?.startedAt ?? null;
    sync.lastSync = lastSuccess ? lastSuccess.toISOString() : null;
    sync.ageMinutes = lastSuccess ? Math.round((now - lastSuccess.getTime()) / 60000) : null;

    let degraded = false;
    if (!lastSuccess || now - lastSuccess.getTime() > HEALTH_STALE_MS) degraded = true;
    // Most recent attempt failed (and there's no newer success) → degraded.
    if (latestAny?.status === "failed") degraded = true;
    // A run wedged in 'running' for over an hour → degraded.
    if (
      latestAny?.status === "running" &&
      latestAny.startedAt &&
      now - new Date(latestAny.startedAt).getTime() > HEALTH_RUNNING_STUCK_MS
    ) {
      degraded = true;
    }
    return { sync, degraded };
  } catch {
    // Sync-runs tables missing in fresh dev DBs — don't fail the probe for that.
    return { sync, degraded: false };
  }
}

async function computeHealth(): Promise<HealthOut> {
  const out: HealthOut = {
    status: "ok",
    db: "ok",
    gsc: { connected: false, lastSync: null, ageMinutes: null },
    ga4: { connected: false, lastSync: null, ageMinutes: null },
  };

  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    out.db = "fail";
    out.status = "degraded";
    return out;
  }

  const now = Date.now();
  const [gsc, ga4] = await Promise.all([
    evaluateSyncHealth(gscCredentials, gscSyncRuns, now),
    evaluateSyncHealth(ga4Credentials, ga4SyncRuns, now),
  ]);
  out.gsc = gsc.sync;
  out.ga4 = ga4.sync;
  if (gsc.degraded || ga4.degraded) out.status = "degraded";
  return out;
}

app.get("/healthz", async (_req, res) => {
  if (healthCache && Date.now() - healthCache.at < HEALTH_CACHE_MS) {
    return res.status(healthCache.out.status === "ok" ? 200 : 503).json(healthCache.out);
  }

  const timeout = new Promise<HealthOut>((resolve) =>
    setTimeout(
      () =>
        resolve({
          status: "degraded",
          db: "fail",
          gsc: { connected: false, lastSync: null, ageMinutes: null },
          ga4: { connected: false, lastSync: null, ageMinutes: null },
          note: "probe timed out",
        }),
      HEALTH_PROBE_TIMEOUT_MS,
    ),
  );

  const out = await Promise.race([computeHealth(), timeout]);
  healthCache = { at: Date.now(), out };
  res.status(out.status === "ok" ? 200 : 503).json(out);
});

// Shopify App Proxy SSR routes — public HTML pages, no CSRF/session needed
// Mounted at /proxy — Shopify App Proxy forwards echowater.com/tools/hydrogen-research/* → /proxy/*
import proxyRoutes from "./routes/proxy-routes";
import rateLimit from "express-rate-limit";

/**
 * Shopify App Proxy HMAC signature verification middleware.
 * Shopify signs every proxied request with HMAC-SHA256 using the app's shared secret.
 * If SHOPIFY_APP_SECRET is not set, verification is skipped (local dev).
 * Embed routes (/proxy/embed/*) are exempt — they are meant for third-party embedding.
 */
function shopifyProxyAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  // Embed routes are public — skip HMAC verification
  if (req.path.startsWith("/embed")) {
    return next();
  }

  const secret = process.env.SHOPIFY_APP_SECRET;
  if (!secret) {
    // Fail CLOSED in production: a prod deploy with the secret unset (rotation,
    // fresh environment) must not serve the whole /proxy surface unverified.
    // Only skip verification in non-production for local dev convenience.
    if (process.env.NODE_ENV === "production") {
      console.error("SHOPIFY_APP_SECRET is unset in production — rejecting /proxy request");
      return res.status(503).send("Service unavailable");
    }
    return next();
  }

  const { signature, ...params } = req.query as Record<string, string>;
  if (!signature) {
    return res.status(401).send("Unauthorized");
  }

  const sortedMessage = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("");

  const computed = crypto
    .createHmac("sha256", secret)
    .update(sortedMessage)
    .digest("hex");

  // Timing-safe comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature, "utf8");
  const computedBuffer = Buffer.from(computed, "utf8");

  if (
    sigBuffer.length === computedBuffer.length &&
    crypto.timingSafeEqual(sigBuffer, computedBuffer)
  ) {
    return next();
  }

  return res.status(401).send("Unauthorized");
}

const proxyRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // 60 req/min per IP for HTML pages
  standardHeaders: true,
  legacyHeaders: false,
});
const proxyExportRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5, // 5 CSV downloads per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/proxy/export", proxyExportRateLimiter);
app.use("/proxy", shopifyProxyAuth, proxyRateLimiter, proxyRoutes);

// Secure session middleware with PostgreSQL store
app.use(getSessionMiddleware());
console.log("🔄 Initializing session store with PostgreSQL...");

// CSRF protection middleware
const csrf = csrfProtection({
  ignoreMethods: ["GET", "HEAD", "OPTIONS"],
    // Only routes that genuinely cannot present a CSRF token belong here:
    // public/no-session endpoints, server-to-server callbacks (HMAC-verified),
    // and GET-only read APIs (GET is already exempt via ignoreMethods, listed
    // for clarity). Admin/state-changing namespaces are deliberately NOT
    // ignored — the client attaches the X-CSRF-Token header to every
    // same-origin mutation via the fetch interceptor (client/src/lib/csrf.ts).
    //
    // Matching is EXACT unless an entry ends with "/" — a trailing slash is an
    // explicit wildcard that exempts the whole subtree (see isCsrfExempt in
    // server/csrf-protection.ts). Bare prefixes no longer silently exempt
    // sibling paths (e.g. "/api/search" no longer exempts /api/search/save or
    // the AI endpoints under /api/search/*).
  ignoreRoutes: [
    "/health",
    // GET-only public reads (exempt by method anyway; exact-matched for clarity):
    "/api/stats",
    "/api/search",
    "/api/categories",
    "/api/filters",
    "/api/overview",
    // Public / no-session endpoints (exact paths):
    "/api/chat", // Public chat POST (no auth session)
    "/api/advanced-chat",
    "/api/auth/register", // No session yet
    "/api/auth/login", // No session yet
    "/api/auth/logout", // Session being destroyed
    "/api/auth/forgot-password", // No session yet
    "/api/auth/reset-password", // Token-verified, no session
    "/api/client-errors", // Fire-and-forget (navigator.sendBeacon, can't set headers)
    "/api/newsletter/subscribe", // Public newsletter signup
    // Server-to-server (not browser-originated, verified by other means).
    // Trailing "/" = explicit subtree wildcard:
    "/api/webhooks/", // Shopify webhooks (HMAC-verified)
    "/proxy/", // Shopify App Proxy SSR (HMAC-verified)
  ],
});

// Apply CSRF protection
app.use(csrf);
app.use(csrfToken());

// Add CSRF token to API responses
app.use((req, res, next) => {
  if (req.method === "GET" && req.path.startsWith("/api/")) {
    addCsrfToResponse(req, res);
  }
  next();
});

// --- API Routes ---

// Authentication
app.use("/api/auth", authRoutes);

// Core Entities
app.use("/api/studies", studiesRouter);
app.use("/api/categories", categoriesController.router);
app.use("/api/blogs", blogRoutes);

// Search
app.use("/api", searchController.router); // Mounts /advanced-search, /search, etc.
// Natural-language search invokes Claude per request — throttle the public
// AI endpoints per-IP before mounting the router (which defines full paths).
app.use(
  [
    "/api/search/natural-language",
    "/api/search/parse-query",
    "/api/search/correct-query",
    "/api/search/detect-intent",
    "/api/search/batch",
  ],
  aiSearchRateLimiter,
);
// Typeahead suggestions also call Claude but fire per keystroke — dedicated
// limiter instance so suggestion traffic can't drain the shared search
// budget used by core search reads (same 30/min ceiling, separate bucket).
app.use("/api/search/nl-suggestions", nlSuggestionsRateLimiter);
app.use(naturalLanguageSearchRoutes);

// Public site stats (no auth — cached for 5 minutes)
let cachedStats: any = null;
let cachedStatsTime = 0;
app.get("/api/public-stats", generalApiRateLimiter, async (req, res) => {
  try {
    const now = Date.now();
    if (cachedStats && now - cachedStatsTime < 5 * 60 * 1000) {
      return res.json(cachedStats);
    }
    const { db: database } = await import("./db");
    const { studies: studiesTable } = await import("@shared/schema");
    const { count: countFn, countDistinct, sql: sqlFn } = await import("drizzle-orm");

    const [totalResult] = await database.select({ value: countFn() }).from(studiesTable);
    const [countryResult] = await database.select({ value: countDistinct(studiesTable.country) }).from(studiesTable);
    const [peerReviewedResult] = await database.select({ value: countFn() }).from(studiesTable).where(sqlFn`${studiesTable.peerReviewed} = true`);
    const [humanResult] = await database.select({ value: countFn() }).from(studiesTable).where(sqlFn`LOWER(${studiesTable.studyType}) LIKE '%human%' OR LOWER(${studiesTable.studyType}) LIKE '%clinical%'`);
    const [oldestResult] = await database.select({ value: sqlFn`MIN(${studiesTable.publishYear})` }).from(studiesTable).where(sqlFn`${studiesTable.publishYear} IS NOT NULL AND ${studiesTable.publishYear} > 1900`);

    const totalStudies = Number(totalResult?.value || 0);
    const countries = Number(countryResult?.value || 0);
    const peerReviewed = Number(peerReviewedResult?.value || 0);
    const humanTrials = Number(humanResult?.value || 0);
    const oldestYear = Number(oldestResult?.value || 2007);
    const yearsOfResearch = new Date().getFullYear() - oldestYear;
    const peerReviewedPct = totalStudies > 0 ? Math.round((peerReviewed / totalStudies) * 100) : 0;

    cachedStats = {
      success: true,
      totalStudies,
      countries,
      peerReviewed,
      peerReviewedPct,
      humanTrials,
      yearsOfResearch,
      oldestYear,
    };
    cachedStatsTime = now;
    res.json(cachedStats);
  } catch (error) {
    console.error("Public stats error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

// Admin & Stats
app.use("/api/admin", adminController.router);
// Admin controller has /dashboard-stats, /status, /tagging...
// We also need to map legacy paths if frontend depends on them:
// /api/stats/dashboard -> adminController.getDashboardStats
app.get("/api/stats/dashboard", generalApiRateLimiter, (req, res, next) => {
    // Forward to admin controller logic manually or rely on new path?
    // Let's rely on new path /api/admin/dashboard-stats if possible, 
    // but to avoid breaking frontend, we can re-route or duplicate logic?
    // Better: keep legacy path routed to controller method if exposed public?
    // adminController is class instance.
    // We cannot access private method.
    // The AdminController mounts /dashboard-stats.
    // So /api/admin/dashboard-stats works.
    // For legacy support:
    res.redirect("/api/admin/dashboard-stats"); 
});

// Research & Content
// Mount without prefix — routes define full paths like /api/research/search
app.use(researchUnifiedRoutes);
app.use("/api/content-enrichment", requireAdmin, aiGenerationRateLimiter, contentEnrichmentRoutes);
app.use("/api/enrichment", requireAdmin, aiGenerationRateLimiter, enrichmentRoutes);
app.use("/api/blog-recommendations", aiGenerationRateLimiter, blogRecommendationRoutes);
app.use("/api/learn-stats", generalApiRateLimiter, learnStatsRoutes);
app.use("/api/trends", generalApiRateLimiter, trendsRoutes);
app.use("/api/analytics", generalApiRateLimiter, contentAnalyticsRoutes);
// Chat endpoints are the #1 API cost driver — strict rate limit
const chatRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 20, // 20 chat queries per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: "Chat rate limit exceeded. Please try again later.",
  skip: skipForAdmin,
});
app.use("/api/chat", chatRateLimiter);
app.use("/api/advanced-chat", chatRateLimiter);
app.use("/api", chatRoutes);
app.use(explorerRoutes);
app.use("/api/review-assistant", aiGenerationRateLimiter, reviewAssistantRoutes);
app.use("/api/content-optimization", requireAdmin, aiGenerationRateLimiter, contentOptimizationRoutes);
app.use("/api/multi-format", multiFormatRoutes);
app.use(hydrogenRoutes);
app.use("/api/consumer-categories", consumerCategoriesRoutes);
app.use("/api/keywords", keywordMonitorRoutes);
app.use("/api/keywords/monitor", keywordMonitorScheduleRoutes);
app.use("/api/import", requireAdmin, importRoutes);
app.use(europePmcRoutes);
app.use("/api/crossref", crossRefRoutes);
app.use("/api/consensus", consensusRoutes);
app.use("/api/unified-search", unifiedSearchRoutes);
app.use("/api/scraper", scraperRoutes);

// SEO Content Factory (admin-only)
app.use("/api/seo", seoContentFactoryRoutes);

// SEO Admin routes (blog publish, SEO field population)
app.use("/api/seo", seoAdminRouter);

// DOI Enhancer (admin-only)
app.use("/api/doi", requireAdmin, doiEnhancerRoutes);

// Public weekly research digest endpoint
app.get("/api/public/this-week", generalApiRateLimiter, async (req, res) => {
  try {
    const { getLatestDigest, getDigestArchive, getDigestBySlug } = await import("./services/research-digest-generator");
    const slug = req.query.slug as string;
    if (slug) {
      const digest = await getDigestBySlug(slug);
      if (!digest) return res.status(404).json({ error: "Digest not found" });
      return res.json({ digest });
    }
    const latest = await getLatestDigest();
    const archive = await getDigestArchive(10, 0);
    res.json({ latest, archive });
  } catch (error) {
    res.status(500).json({ error: "Failed to get digest" });
  }
});

// Public internal links endpoint (for "Related Content" sidebar on study/blog pages)
app.get("/api/internal-links/:type/:id", async (req, res) => {
  try {
    const { getLinksFor } = await import("./services/internal-linking-engine");
    const contentId = parseInt(req.params.id);
    if (isNaN(contentId)) return res.status(400).json({ error: "Invalid ID" });
    const links = await getLinksFor(req.params.type, contentId);
    res.json({ links });
  } catch (error) {
    res.status(500).json({ error: "Failed to get links" });
  }
});

// Fire-and-forget analytics sinks (prevent 404 noise in logs)
app.post("/api/search/analytics", (req, res) => res.json({ ok: true }));
app.post("/api/studies/analytics", (req, res) => res.json({ ok: true }));

// Journal Date Updater (admin)
app.get("/api/admin/journal-date-stats", generalApiRateLimiter, requireAdmin, async (req, res) => {
  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    const result = await db.execute(sql`
      SELECT
        count(*) FILTER (WHERE journal_publish_date IS NOT NULL AND journal_publish_date != '') as with_date,
        count(*) FILTER (WHERE journal_publish_date IS NULL OR journal_publish_date = '') as without_date,
        count(*) as total
      FROM studies
    `);
    const row: any = result.rows?.[0] || (result as any)[0] || {};
    const total = Number(row.total) || 0;
    const withDate = Number(row.with_date) || 0;
    const withoutDate = Number(row.without_date) || 0;

    // Fetch recently updated studies with journal dates
    const recentResult = await db.execute(sql`
      SELECT title, journal_publish_date, doi
      FROM studies
      WHERE journal_publish_date IS NOT NULL AND journal_publish_date != ''
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 5
    `);
    const recentRows: any[] = recentResult.rows || recentResult || [];

    res.json({
      success: true,
      stats: {
        totalStudies: total,
        studiesWithDate: withDate,
        studiesNeedingDate: withoutDate,
        percentComplete: total > 0 ? Math.round((withDate / total) * 100) : 0,
        recentlyUpdated: recentRows.map((r: any) => ({
          title: r.title,
          journalPublishDate: r.journal_publish_date,
          doi: r.doi,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get journal date stats" });
  }
});

app.post("/api/admin/update-journal-dates", generalApiRateLimiter, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Number(req.body.limit) || 50, 200);
    const { updateJournalPublicationDates } = await import("./services/journal-date-updater");
    const result = await updateJournalPublicationDates(limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, totalUpdated: 0, failedDois: [], message: "Failed to process journal dates" });
  }
});

// Quality Monitoring — protected with admin auth
app.get("/api/admin/quality/monitor", generalApiRateLimiter, requireAdmin, async (req, res) => {
  try {
    const { qualityMonitor } = await import("./utils/quality-assurance-monitor");
    const report = qualityMonitor.getQualityReport();
    res.json(report);
  } catch (error) {
    console.error("Quality monitoring failed:", error);
    res.status(500).json({ error: "Quality monitoring unavailable" });
  }
});

app.get("/api/admin/quality/integrity", generalApiRateLimiter, requireAdmin, async (req, res) => {
  try {
    const { dataIntegrityValidator } = await import("./data-integrity-validator");
    const validation = await dataIntegrityValidator.validateDataIntegrity();
    res.json(validation);
  } catch (error) {
    console.error("Data integrity validation failed:", error);
    res.status(500).json({ error: "Data integrity validation failed" });
  }
});

app.post("/api/admin/quality/fix-issues", generalApiRateLimiter, requireAdmin, async (req, res) => {
  try {
    const { dataIntegrityValidator } = await import("./data-integrity-validator");
    const result = await dataIntegrityValidator.fixCommonIssues();
    res.json(result);
  } catch (error) {
    console.error("Issue fixing failed:", error);
    res.status(500).json({ error: "Failed to fix issues" });
  }
});

app.get("/api/admin/quality/tests", generalApiRateLimiter, requireAdmin, async (req, res) => {
  try {
    const { qualityTests } = await import("./automated-quality-tests");
    const results = await qualityTests.runAllTests();
    res.json(results);
  } catch (error) {
    console.error("Quality tests failed:", error);
    res.status(500).json({ error: "Quality tests failed" });
  }
});

// Shopify webhooks (no auth — verified by HMAC signature)
app.use("/api/webhooks/shopify", shopifyWebhookRoutes);

// Newsletter signup (public, no auth required)
app.use("/api/newsletter", newsletterRoutes);

// Contact form (public POST, admin GET)
app.use("/api/contact", contactRoutes);

// User dashboard (authenticated customers)
app.use("/api/me", userDashboardRoutes);

// Admin settings
app.use("/api/admin/settings", adminSettingsRoutes);

// Admin link management
app.use("/api/admin/links", adminLinkRoutes);

// Admin redirect & 404 management
app.use("/api/admin/redirects", adminRedirectRoutes);

// Research Intelligence Pipeline (admin-only)
app.use("/api/pipeline", pipelineRoutes);

// Image Generation (admin-only)
app.use("/api/image-generation", requireAdmin, imageGenerationRoutes);

// Legacy image generation path (used by StudyPage "Generate Image" button)
app.post("/api/images/generate/:studyId", requireAdmin, async (req, res) => {
  try {
    const studyId = Number(req.params.studyId);
    if (!studyId || isNaN(studyId)) {
      return res.status(400).json({ success: false, message: "Invalid study ID" });
    }
    const { generateImageForStudy } = await import("./services/image-generator");
    const result = await generateImageForStudy(studyId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Image generation failed" });
  }
});

// Google Search Console integration. Includes the OAuth callback, which is
// itself unauthenticated (relies on the signed state cookie); the rest of
// the routes are gated by requireAdmin per-route.
//
// MUST be mounted BEFORE the /api/admin catch-all below — adminMonitoringRoutes
// has router.use(requireAdmin) at the top, so if Express hits that catch-all
// first, the OAuth redirect from Google gets rejected before it can be handled.
import adminGscRoutes from "./routes/admin-gsc-routes";
app.use("/api/admin/gsc", adminGscRoutes);

// Google Analytics 4 integration. Same OAuth-callback constraint as GSC —
// must be mounted BEFORE the /api/admin catch-all below.
import adminGa4Routes from "./routes/admin-ga4-routes";
app.use("/api/admin/ga4", adminGa4Routes);

// Content consolidation (corpus pruning: cluster/report/execute). Own
// requireAdmin at router top; mounted before the /api/admin catch-all.
import consolidationRoutes from "./routes/consolidation-routes";
app.use("/api/admin/consolidation", consolidationRoutes);

// Shopify blog syndication (push reviewed articles into echowater's native
// blog). requireAdmin at router top; no-ops until store env vars exist.
import syndicationRoutes from "./routes/syndication-routes";
app.use("/api/admin/syndication", syndicationRoutes);

// Admin monitoring & process control
app.use("/api/admin/monitoring", adminMonitoringRoutes);
app.use("/api/admin", adminMonitoringRoutes); // Mounts /trigger/* and /stop-processes

// Serve public assets
app.use(
  "/images",
  express.static(path.join(__dirname, "..", "public", "images")),
);
// Serve uploaded images from database (with filesystem fallback for legacy)
app.use("/uploads", async (req, res, next) => {
  const key = req.path.replace(/^\//, ""); // strip leading slash
  try {
    const { getStoredImage } = await import("./utils/storage");
    const image = await getStoredImage(key);
    if (image) {
      // Never let the browser sniff a different type, and only serve raster
      // images inline. Anything else (SVG, HTML masquerading as an image)
      // could execute as same-origin script if rendered inline, so force a
      // download with a generic type instead.
      const ct = (image.contentType || "").toLowerCase();
      const inlineSafe = /^image\/(png|jpe?g|gif|webp|avif)$/.test(ct);
      res.setHeader("X-Content-Type-Options", "nosniff");
      if (inlineSafe) {
        res.setHeader("Content-Type", ct);
      } else {
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", "attachment");
      }
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.send(image.data);
    }
  } catch {
    // DB not ready or table doesn't exist yet — fall through
  }
  // Fallback to filesystem for legacy images
  next();
});
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"), {
    setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
  }),
);

// Client error reporting endpoint (receives errors from frontend error-tracking.ts)
app.post("/api/client-errors", (req, res) => {
  const body = req.body;
  if (body && typeof body === "object") {
    // Only log safe, expected fields — never log raw user input
    const safeReport = {
      message: typeof body.message === "string" ? body.message.slice(0, 500) : "unknown",
      source: typeof body.source === "string" ? body.source.slice(0, 200) : undefined,
      lineno: typeof body.lineno === "number" ? body.lineno : undefined,
      colno: typeof body.colno === "number" ? body.colno : undefined,
      url: typeof body.url === "string" ? body.url.slice(0, 300) : undefined,
      timestamp: typeof body.timestamp === "string" ? body.timestamp : new Date().toISOString(),
    };
    console.warn("[CLIENT ERROR]", JSON.stringify(safeReport));
  }
  res.status(204).end();
});

// Health check endpoints for load balancers (before error handlers)

// Full health check (database, memory, request stats)
app.get("/health", async (req, res) => {
  const health = await performHealthCheck();
  // Railway's healthcheck points here — a dead database MUST fail it so Railway
  // stops routing to this instance. performHealthCheck only degrades status at
  // 2+ errors, so a DB-down (a single error) would otherwise still report 200.
  // Gate on DB connectivity directly (performHealthCheck already runs a
  // lightweight `SELECT 1 FROM studies LIMIT 1` ping). Only hard connectivity
  // loss returns 503 — slow latency or memory pressure alone don't, so a
  // transient blip won't trigger restart loops.
  const statusCode =
    health.status === "healthy" && health.database.connected ? 200 : 503;
  res.status(statusCode).json(health);
});

// Liveness probe — is the process alive? (lightweight, no DB call)
app.get("/health/live", (req, res) => {
  res.status(200).json({ status: "alive", uptime: process.uptime() });
});

// Readiness probe — can the server accept requests? (checks DB connectivity)
app.get("/health/ready", async (req, res) => {
  const health = await performHealthCheck();
  if (health.database.connected) {
    res.status(200).json({ status: "ready", dbLatency: health.database.latency });
  } else {
    res.status(503).json({ status: "not_ready", reason: "database unavailable" });
  }
});

// 404 handler for API routes
app.use("/api/*", (req, res, next) => {
  next(new NotFoundError("API endpoint"));
});

// 404 logging — moved to index.ts SPA catch-all so only truly unmatched paths are logged

// Error reporting handler — captures unexpected errors before responding
app.use(errorReportingHandler());
// Sentry error handler - captures errors before globalErrorHandler
import { Sentry } from "./utils/sentry";
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Global error handler - MUST be last middleware
app.use(globalErrorHandler);

// Initialize health monitoring
initializeHealthMonitoring();

// Verify database connectivity on startup, then run versioned migrations
import { pool } from "./db";
// NOTE: server/__tests__/admin-route-guards.test.ts intercepts this exact
// probe text ("SELECT 1") and never settles it, so this migration/exit chain
// stays inert under supertest — keep that test's db mock in sync if this changes.
pool.query("SELECT 1").then(async () => {
  console.log("Database connection verified");
  try {
    const { runMigrations } = await import("./migrations/migration-runner");
    const { addFullTextSearch } = await import("./migrations/add-fulltext-search");
    const { createPipelineTables } = await import("./migrations/pipeline-tables-migration");
    const { createBlogGenerationJobsTable } = await import("./migrations/blog-generation-jobs-migration");
    const { fixUntitledStudies } = await import("./migrations/fix-untitled-studies");
    const { addTldrAndHowToApply } = await import("./migrations/add-tldr-how-to-apply");
    const { addProxyResearchFields } = await import("./migrations/add-proxy-research-fields");
    const { seedHealthConditions } = await import("./migrations/seed-health-conditions");
    const { backfillSlugsAndHumanTrials } = await import("./migrations/backfill-slugs-and-human-trials");
    const { addStudySummaryFields } = await import("./migrations/add-study-summary-fields");
    const { addRedirectSystem } = await import("./migrations/add-redirect-system");
    const { addDeletedStudiesLedger } = await import("./migrations/add-deleted-studies-ledger");
    const { addContentGenerationQueue } = await import("./migrations/add-content-generation-queue");
    const { runStoredImagesMigration } = await import("./migrations/add-stored-images");
    const { applyFkOnDeletePolicies } = await import("./migrations/add-fk-on-delete-policies");
    const { dropLegacyPasswordColumn } = await import("./migrations/drop-legacy-password-column");
    const { addStudiesDoiIndex } = await import("./migrations/add-studies-doi-index");
    const { addRetractionCheckTracking } = await import("./migrations/add-retraction-check-tracking");
    const { addAuditTrackingFields } = await import("./migrations/add-audit-tracking-fields");
    const { addSyndicationFields } = await import("./migrations/add-syndication-fields");

    await runMigrations([
      { name: "001_add_fulltext_search", up: addFullTextSearch },
      { name: "002_create_pipeline_tables", up: createPipelineTables },
      { name: "003_create_blog_generation_jobs", up: createBlogGenerationJobsTable },
      { name: "004_fix_untitled_studies", up: fixUntitledStudies },
      { name: "005_add_tldr_how_to_apply", up: addTldrAndHowToApply },
      { name: "006_add_proxy_research_fields", up: addProxyResearchFields },
      { name: "007_seed_health_conditions", up: seedHealthConditions },
      { name: "008_backfill_slugs_and_human_trials", up: backfillSlugsAndHumanTrials },
      { name: "009_add_study_summary_fields", up: addStudySummaryFields },
      { name: "010_add_redirect_system", up: addRedirectSystem },
      { name: "011_add_deleted_studies_ledger", up: addDeletedStudiesLedger },
      { name: "012_add_content_generation_queue", up: addContentGenerationQueue },
      { name: "013_add_stored_images", up: runStoredImagesMigration },
      { name: "014_fk_on_delete_policies", up: applyFkOnDeletePolicies },
      { name: "015_drop_legacy_password_column", up: dropLegacyPasswordColumn },
      { name: "016_add_studies_doi_index", up: addStudiesDoiIndex },
      { name: "017_add_retraction_check_tracking", up: addRetractionCheckTracking },
      { name: "018_add_audit_tracking_fields", up: addAuditTrackingFields },
      { name: "019_add_syndication_fields", up: addSyndicationFields },
    ]);

    // Recover orphaned "processing" jobs — items whose worker crashed/restarted
    // mid-run. Done after migrations so the relevant tables are guaranteed
    // to exist. Non-fatal if it fails: background workers will keep running
    // (they just won't pick up the orphans until a manual reset).
    try {
      const { resetStaleProcessingJobs } = await import("./services/stale-job-recovery");
      await resetStaleProcessingJobs();
    } catch (err: any) {
      console.warn("Stale-job recovery skipped:", err?.message ?? err);
    }
  } catch (err: any) {
    console.error("FATAL: Migration failed:", err.message);
    console.error("Shutting down — fix the migration and redeploy.");
    process.exit(1);
  }
}).catch((err: any) => {
  console.error("FATAL: Database connection failed on startup:", err.message);
  console.error("Shutting down — check DATABASE_URL and database availability.");
  process.exit(1);
});

import { jobScheduler } from "./services/job-scheduler";
// Ensure scoring-related columns exist (idempotent) before background jobs
// or the review-queue-insert path write to them on new deployments.
import { ensureScoringColumns } from "./services/study-scoring-service";
import { ensureBlogLifecycleColumns, recoverStuckBlogJobs } from "./services/blog-lifecycle";
ensureScoringColumns().catch(() => {});
// Blog publishing pipeline: ensure schema, then recover any jobs that were
// running when the server last shut down (set to 'paused' for admin to
// resume manually — auto-resume would just re-crash on poison input).
ensureBlogLifecycleColumns()
  .then(() => recoverStuckBlogJobs())
  .catch(() => {});

// Image backfill: clear placeholder URLs from legacy rows so the
// auto-backfill cron can find them. Runs once on boot, idempotent.
import { cleanupPlaceholderImageRows } from "./services/image-backfill";
cleanupPlaceholderImageRows().catch(() => {});
// Start background jobs
jobScheduler.start();
