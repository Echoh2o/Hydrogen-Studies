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
          "'unsafe-inline'",
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

// Request tracking and error recovery middleware
app.use(requestIdMiddleware);
app.use(errorRecoveryMiddleware);
app.use(timeoutMiddleware(30000)); // 30 second timeout

// Cookie parser for CSRF tokens
app.use(cookieParser());

// Secure CORS configuration
validateCorsConfig();
app.use(cors(getCorsConfig()));

// Body parsing middleware
app.use(express.json({ limit: "2mb" }));
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
app.use("/api/natural-language-search", naturalLanguageSearchRoutes);

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
app.use("/api/explorer", explorerRoutes);
app.use("/api/review", aiGenerationRateLimiter, reviewAssistantRoutes); // or /api/review-assistant
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

// Quality Monitoring — protected with admin auth
app.get("/api/admin/quality/monitor", requireAdmin, async (req, res) => {
  try {
    const { qualityMonitor } = await import("./utils/quality-assurance-monitor");
    const report = qualityMonitor.getQualityReport();
    res.json(report);
  } catch (error) {
    console.error("Quality monitoring failed:", error);
    res.status(500).json({ error: "Quality monitoring unavailable" });
  }
});

app.get("/api/admin/quality/integrity", requireAdmin, async (req, res) => {
  try {
    const { dataIntegrityValidator } = await import("./data-integrity-validator");
    const validation = await dataIntegrityValidator.validateDataIntegrity();
    res.json(validation);
  } catch (error) {
    console.error("Data integrity validation failed:", error);
    res.status(500).json({ error: "Data integrity validation failed" });
  }
});

app.post("/api/admin/quality/fix-issues", requireAdmin, async (req, res) => {
  try {
    const { dataIntegrityValidator } = await import("./data-integrity-validator");
    const result = await dataIntegrityValidator.fixCommonIssues();
    res.json(result);
  } catch (error) {
    console.error("Issue fixing failed:", error);
    res.status(500).json({ error: "Failed to fix issues" });
  }
});

app.get("/api/admin/quality/tests", requireAdmin, async (req, res) => {
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

// User dashboard (authenticated customers)
app.use("/api/me", userDashboardRoutes);

// Admin settings
app.use("/api/admin/settings", adminSettingsRoutes);

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
  if (process.env.NODE_ENV === "production") {
    console.warn("[CLIENT ERROR]", JSON.stringify(req.body));
  }
  res.status(204).end();
});

// Health check endpoint for load balancers (before error handlers)
app.get("/health", async (req, res) => {
  const health = await performHealthCheck();
  const statusCode = health.status === "healthy" ? 200 : 503;
  res.status(statusCode).json(health);
});

// 404 handler for API routes
app.use("/api/*", (req, res, next) => {
  next(new NotFoundError("API endpoint"));
});

// Global error handler - MUST be last middleware
app.use(globalErrorHandler);

// Initialize health monitoring
initializeHealthMonitoring();

// Verify database connectivity on startup
import { pool } from "./db";
pool.query("SELECT 1").then(() => {
  console.log("Database connection verified");
}).catch((err: any) => {
  console.error("WARNING: Database connection failed on startup:", err.message);
  console.error("The app will start but DB-dependent features will fail until the connection is restored.");
});

import { jobScheduler } from "./services/job-scheduler";
// Start background jobs
jobScheduler.start();
