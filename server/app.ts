import express from "express";
import helmet from "helmet";
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
import { DatabaseCircuitBreaker } from "./utils/database-wrapper";

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
import seoRoutes from "./routes/seo-routes";
import seoContentFactoryRoutes from "./routes/seo-content-factory-routes";
import shopifyWebhookRoutes from "./routes/shopify-webhook-routes";
import newsletterRoutes from "./routes/newsletter-routes";
import userDashboardRoutes from "./routes/user-dashboard-routes";
import adminSettingsRoutes from "./routes/admin-settings-routes";
import contactRoutes from "./routes/contact-routes";
import pipelineRoutes from "./routes/pipeline-routes";
import imageGenerationRoutes from "./routes/image-generation-routes";
import doiEnhancerRoutes from "./routes/doi-enhancer-routes";

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
} from "./utils/rate-limiting";


const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

// Trust proxy for Railway/Docker deployments (needed for secure cookies behind reverse proxy)
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Initialize database circuit breaker
export const dbCircuitBreaker = new DatabaseCircuitBreaker();

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
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: [
          "'self'",
          "https://www.google-analytics.com",
          "https://api.anthropic.com",
        ],
        frameSrc: ["'none'"],
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

// Secure session middleware with PostgreSQL store
app.use(getSessionMiddleware());
console.log("🔄 Initializing session store with PostgreSQL...");

// CSRF protection middleware
const csrf = csrfProtection({
  ignoreMethods: ["GET", "HEAD", "OPTIONS"],
  ignoreRoutes: [
    "/health",
    "/api/stats",
    "/api/search",
    "/api/categories",
    "/api/filters",
    "/api/overview",
    "/api/studies", // GET requests only
    "/api/admin/quality/monitor",
    "/api/admin/quality/integrity",
    "/api/chat", // Chat endpoint
    "/api/advanced-chat", // Advanced chat endpoint
    "/api/chat/popular-questions", // Popular questions endpoint
    "/api/chat/conversations", // Conversations endpoint
    "/api/chat/feedback", // Feedback endpoint
    "/api/auth/register", // Registration doesn't require CSRF (no session yet)
    "/api/auth/login", // Login doesn't require CSRF (no session yet)
    "/api/auth/logout", // Logout doesn't require CSRF (session being destroyed)
    "/api/auth/forgot-password", // Password reset (no session yet)
    "/api/auth/reset-password", // Password reset (token-verified)
    "/api/client-errors", // Client error reporting (fire-and-forget)
    "/api/import", // Import endpoints (protected by admin auth)
    "/api/blogs", // Blog CRUD (protected by admin auth)
    "/api/content-enrichment", // Content enrichment (protected by admin auth)
    "/api/enrichment", // Enrichment endpoints (protected by admin auth)
    "/api/admin", // Admin endpoints (protected by admin auth)
    "/api/keywords", // Keyword monitor (protected by admin auth)
    "/api/consensus", // Consensus API (protected by admin auth on write endpoints)
    "/api/auth/users", // Admin user creation (protected by admin auth)
    "/api/scraper", // Scraper endpoints (protected by admin auth)
    "/api/studies", // Study endpoints including blog generation (protected by admin auth)
    "/api/seo", // SEO content factory (protected by admin auth)
    "/api/webhooks", // Shopify webhooks (verified by HMAC signature)
    "/api/newsletter", // Public newsletter signup
    "/api/research", // Research import (protected by admin auth)
    "/api/europepmc", // Europe PMC routes (protected by admin auth)
    "/api/semantic-scholar", // Semantic Scholar import (protected by admin auth)
    "/api/crossref", // CrossRef routes (protected by admin auth)
    "/api/multi-format", // Multi-format generation (protected by admin auth)
    "/api/blog-recommendations", // Blog recommendations (protected by admin auth)
    "/api/pipeline", // Research pipeline (protected by admin auth)
    "/api/image-generation", // Image generation (protected by admin auth)
    "/api/content-optimization", // Content optimization (protected by admin auth)
    "/api/consumer-categories", // Consumer categories (protected by admin auth)
    "/api/doi", // DOI enhancer (protected by admin auth)
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
    const [oldestResult] = await database.select({ value: sqlFn`MIN(EXTRACT(YEAR FROM ${studiesTable.publishDate}::date))` }).from(studiesTable).where(sqlFn`${studiesTable.publishDate} IS NOT NULL`);

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
app.use("/api/content-enrichment", aiGenerationRateLimiter, contentEnrichmentRoutes);
app.use("/api/enrichment", aiGenerationRateLimiter, enrichmentRoutes);
app.use("/api/blog-recommendations", aiGenerationRateLimiter, blogRecommendationRoutes);
app.use("/api/trends", generalApiRateLimiter, trendsRoutes);
app.use("/api/analytics", generalApiRateLimiter, contentAnalyticsRoutes);
app.use("/api", chatRoutes);
app.use(explorerRoutes);
app.use("/api/review-assistant", aiGenerationRateLimiter, reviewAssistantRoutes);
app.use("/api/content-optimization", aiGenerationRateLimiter, contentOptimizationRoutes);
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

// Admin monitoring & process control
app.use("/api/admin/monitoring", adminMonitoringRoutes);
app.use("/api/admin", adminMonitoringRoutes); // Mounts /trigger/* and /stop-processes

// Serve public assets
app.use(
  "/images",
  express.static(path.join(__dirname, "..", "public", "images")),
);
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads")),
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
  const statusCode = health.status === "healthy" ? 200 : 503;
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
pool.query("SELECT 1").then(async () => {
  console.log("Database connection verified");
  try {
    const { runMigrations } = await import("./migrations/migration-runner");
    const { addFullTextSearch } = await import("./migrations/add-fulltext-search");
    const { createPipelineTables } = await import("./migrations/pipeline-tables-migration");
    const { createBlogGenerationJobsTable } = await import("./migrations/blog-generation-jobs-migration");
    const { fixUntitledStudies } = await import("./migrations/fix-untitled-studies");
    const { addTldrAndHowToApply } = await import("./migrations/add-tldr-how-to-apply");

    await runMigrations([
      { name: "001_add_fulltext_search", up: addFullTextSearch },
      { name: "002_create_pipeline_tables", up: createPipelineTables },
      { name: "003_create_blog_generation_jobs", up: createBlogGenerationJobsTable },
      { name: "004_fix_untitled_studies", up: fixUntitledStudies },
      { name: "005_add_tldr_how_to_apply", up: addTldrAndHowToApply },
    ]);
  } catch (err: any) {
    console.warn("Migration runner error:", err.message);
  }
}).catch((err: any) => {
  console.error("WARNING: Database connection failed on startup:", err.message);
  console.error("The app will start but DB-dependent features will fail until the connection is restored.");
});

import { jobScheduler } from "./services/job-scheduler";
// Start background jobs
jobScheduler.start();
