import express from "express";
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

// Enhanced error handling imports
import {
  globalErrorHandler,
  requestIdMiddleware,
  errorRecoveryMiddleware,
  timeoutMiddleware,
  asyncHandler,
  isOperationalError,
} from "./utils/error-handler";
import {
  AppError,
  ErrorFactory,
  NotFoundError,
  DatabaseError,
  ErrorCode,
} from "./utils/app-errors";
import {
  DatabaseCircuitBreaker,
  checkDatabaseHealth,
  withRetry,
} from "./utils/database-wrapper";

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
import contentOptimizationRoutes from "./routes/content-optimization-routes";
import multiFormatRoutes from "./routes/multi-format-routes";
import hydrogenRoutes from "./routes/hydrogen-routes";
import consumerCategoriesRoutes from "./routes/consumer-categories-routes";
import naturalLanguageSearchRoutes from "./routes/natural-language-search-routes";

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
import testRateLimitEndpoint from "./test-rate-limit-endpoint";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

// Trust proxy for Railway/Docker deployments (needed for secure cookies behind reverse proxy)
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Initialize database circuit breaker
export const dbCircuitBreaker = new DatabaseCircuitBreaker();

// Request tracking and error recovery middleware
app.use(requestIdMiddleware);
app.use(errorRecoveryMiddleware);
app.use(timeoutMiddleware(30000)); // 30 second timeout

// Cookie parser for CSRF tokens
app.use(cookieParser());

// Secure CORS configuration
validateCorsConfig();
app.use(cors(getCorsConfig()));

// Body parsing middleware with error handling
app.use(
  express.json({
    limit: "50mb",
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf.toString());
      } catch (error) {
        throw new AppError(
          "Invalid JSON in request body",
          400,
          ErrorCode.BAD_REQUEST,
        );
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

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

// Test rate limit endpoint - for verification
app.use("/api/test", testRateLimitEndpoint);

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
app.use("/api/research", researchUnifiedRoutes);
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

// Serve public assets
app.use(
  "/images",
  express.static(path.join(__dirname, "..", "public", "images")),
);
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads")),
);

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

import { jobScheduler } from "./services/job-scheduler";
// Start background jobs
jobScheduler.start();
