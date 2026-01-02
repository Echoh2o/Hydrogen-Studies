/**
 * Main Server Entry Point
 * Updated to use stable production configuration with proper error handling
 */

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, count } from "drizzle-orm";
import { blogArticles, studies } from "../shared/schema";

// Security and session imports
import { getSessionMiddleware } from "./session-config";
import { getCorsConfig, validateCorsConfig } from "./cors-config";
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

// Monitoring and utilities
import {
  initializeHealthMonitoring,
  performHealthCheck,
} from "./health-monitoring";
import { handleError } from "./utils/error-handler";
import { qualityAudit } from "./comprehensive-quality-audit";
import {
  searchRateLimiter,
  generalApiRateLimiter,
  aiGenerationRateLimiter,
} from "./rate-limiting";
import testRateLimitEndpoint from "./test-rate-limit-endpoint";
import naturalLanguageSearchRoutes from "./routes/natural-language-search-routes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Initialize database circuit breaker
const dbCircuitBreaker = new DatabaseCircuitBreaker();

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
// Using async middleware wrapper to handle async session config
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

// Comprehensive environment validation
function validateEnvironment() {
  const requiredEnvVars = ["DATABASE_URL"];
  const optionalEnvVars = [
    "OPENAI_API_KEY",
    "SENDGRID_API_KEY",
    "VITE_GA_MEASUREMENT_ID",
  ];
  const missingRequired = [];
  const missingOptional = [];

  // SECURITY: Required variables in production (non-Replit)
  const isReplit = !!process.env.REPL_ID || !!process.env.REPL_SLUG;
  if (process.env.NODE_ENV === "production" && !isReplit) {
    // ADMIN_USER_IDS is now optional - admin features will be disabled if not set
    // requiredEnvVars.push('ADMIN_USER_IDS');  // Made optional to prevent crash
    requiredEnvVars.push("SESSION_SECRET");
    requiredEnvVars.push("ALLOWED_ORIGINS");
  }

  // Check required environment variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missingRequired.push(envVar);
    }
  }

  // Check optional environment variables
  for (const envVar of optionalEnvVars) {
    if (!process.env[envVar]) {
      missingOptional.push(envVar);
    }
  }

  // Additional validation for ADMIN_USER_IDS
  if (process.env.ADMIN_USER_IDS) {
    const adminIds = process.env.ADMIN_USER_IDS.split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (adminIds.length === 0) {
      console.warn(
        "ADMIN_USER_IDS is empty - admin functionality will be disabled",
      );
      // Don't exit, just disable admin features
    } else {
      // Security check: warn about potentially insecure admin IDs
      const insecureIds = ["admin", "1", "root", "administrator"];
      const foundInsecure = adminIds.filter((id) =>
        insecureIds.includes(id.toLowerCase()),
      );
      if (foundInsecure.length > 0) {
        console.warn(
          `WARNING: Found potentially insecure admin IDs: ${foundInsecure.join(", ")}`,
        );
        console.warn(
          "Consider using more secure, unique identifiers for admin users.",
        );
      }
    }
  } else if (process.env.NODE_ENV === "production") {
    // Don't crash in production, just warn
    console.warn(
      "⚠️ ADMIN_USER_IDS not configured in production - admin features disabled",
    );
    console.warn(
      "⚠️ To enable admin features: Deployments → Configuration → Add ADMIN_USER_IDS secret",
    );
  }

  // Validate SESSION_SECRET strength
  if (process.env.SESSION_SECRET) {
    if (process.env.SESSION_SECRET.length < 32) {
      console.error("SESSION_SECRET is too short. Use at least 32 characters.");
      console.error("Generate a secure secret using: openssl rand -hex 32");
      if (process.env.NODE_ENV === "production") {
        process.exit(1);
      }
    }
    if (
      process.env.SESSION_SECRET === "dev-secret-change-me-before-production"
    ) {
      console.error(
        "SESSION_SECRET is using the default value. This is insecure!",
      );
      console.error("Generate a secure secret using: openssl rand -hex 32");
      if (process.env.NODE_ENV === "production") {
        process.exit(1);
      }
    }
  } else if (
    !process.env.SESSION_SECRET &&
    process.env.NODE_ENV !== "production"
  ) {
    console.warn(
      "⚠️  SESSION_SECRET not set. Using default for development only.",
    );
    console.warn(
      "⚠️  Generate a secure secret for production: openssl rand -hex 32",
    );
  }

  // Validate ALLOWED_ORIGINS
  if (process.env.NODE_ENV === "production" && process.env.ALLOWED_ORIGINS) {
    const origins = process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
    for (const origin of origins) {
      try {
        new URL(origin);
      } catch (error) {
        console.error(`Invalid origin in ALLOWED_ORIGINS: ${origin}`);
        console.error(
          "Each origin must be a valid URL (e.g., https://example.com)",
        );
        process.exit(1);
      }
    }
  }

  // Exit if required variables are missing
  if (missingRequired.length > 0) {
    console.error(
      "Missing required environment variables:",
      missingRequired.join(", "),
    );
    console.error(
      "Please ensure all required environment variables are set before starting the server.",
    );
    // ADMIN_USER_IDS is now optional - handled with warnings above
    if (missingRequired.includes("SESSION_SECRET")) {
      console.error(
        "SESSION_SECRET is required in production for secure session management.",
      );
      console.error("Generate a secure secret using: openssl rand -hex 32");
    }
    if (missingRequired.includes("ALLOWED_ORIGINS")) {
      console.error(
        "ALLOWED_ORIGINS is required in production for CORS security.",
      );
      console.error(
        "Set ALLOWED_ORIGINS to a comma-separated list of allowed origins.",
      );
      console.error(
        "Example: ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com",
      );
    }
    process.exit(1);
  }

  // Warn about missing optional variables
  if (missingOptional.length > 0) {
    console.warn(
      "Missing optional environment variables:",
      missingOptional.join(", "),
    );
    console.warn(
      "Some features may not work properly without these variables.",
    );
  }

  // Validate DATABASE_URL format
  try {
    new URL(process.env.DATABASE_URL!);
  } catch (error) {
    console.error(
      "Invalid DATABASE_URL format. Please provide a valid database connection string.",
    );
    process.exit(1);
  }

  console.log("Environment validation completed successfully");
}

validateEnvironment();

// Database connection with retry logic
const sql = neon(process.env.DATABASE_URL!, {
  arrayMode: false,
});
const db = drizzle(sql);

// Test rate limit endpoint - for verification
app.use("/api/test", testRateLimitEndpoint);

// Working API endpoints with rate limiting
app.use("/api/keywords/monitor", keywordMonitorScheduleRoutes); // Keyword monitor schedule routes (more specific first)
app.use("/api/keywords", keywordMonitorRoutes); // Keyword monitor routes
app.use(
  "/api/content-enrichment",
  aiGenerationRateLimiter,
  contentEnrichmentRoutes,
); // Content enrichment routes with strict rate limit
app.use("/api/enrichment", aiGenerationRateLimiter, enrichmentRoutes); // Enrichment routes with strict rate limit
app.use("/api/blogs", blogRoutes); // Blog routes (rate limiting applied inside router)
app.use(
  "/api/blog-recommendations",
  aiGenerationRateLimiter,
  blogRecommendationRoutes,
); // Blog recommendation routes with strict rate limit
app.use("/api/trends", generalApiRateLimiter, trendsRoutes); // Trend detection and analysis routes
app.use("/api/analytics", generalApiRateLimiter, contentAnalyticsRoutes); // Content analytics routes
app.use(
  "/api/review-assistant",
  aiGenerationRateLimiter,
  reviewAssistantRoutes,
); // Review assistant routes with AI rate limiting
app.use(
  "/api/content-optimization",
  aiGenerationRateLimiter,
  contentOptimizationRoutes,
); // Content optimization routes with AI rate limiting
app.use("/api", chatRoutes); // Chat routes - mounted at /api for /api/chat endpoint
app.use("/api/studies", studiesRouter); // Mount the studies router (rate limiting applied inside router)
app.use(explorerRoutes); // Study explorer routes for visualizations
app.use(researchUnifiedRoutes); // Research unified routes

// API Routes Registration
app.use("/api/auth", authRoutes); // Authentication routes (before other protected routes)
app.use("/api/studies", studiesRouter);
app.use("/api/research", researchUnifiedRoutes);
app.use("/api/keyword-monitor", keywordMonitorRoutes);
app.use("/api/keyword-monitor/schedule", keywordMonitorScheduleRoutes);
app.use("/api/content-enrichment", contentEnrichmentRoutes);
app.use("/api/enrichment", enrichmentRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/blog-recommendations", blogRecommendationRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/trends", trendsRoutes);
app.use("/api/analytics", contentAnalyticsRoutes);
app.use("/api/explorer", explorerRoutes);
app.use("/api/review", reviewAssistantRoutes);
app.use("/api/content-optimization", contentOptimizationRoutes);
app.use("/api/natural-language-search", naturalLanguageSearchRoutes);
app.use("/api/multi-format", multiFormatRoutes);
app.use(hydrogenRoutes); // Hydrogen routes (delivery methods, benefits, etc.)
app.use("/api/consumer-categories", consumerCategoriesRoutes); // Consumer categories routes for exploration pages

// Dashboard stats endpoint with comprehensive statistics
app.get(
  "/api/stats/dashboard",
  generalApiRateLimiter,
  asyncHandler(async (req, res, next) => {
    try {
      // Use circuit breaker for database operations
      const stats = await withRetry(
        async () => {
          // Get total blog count
          const [totalResult] = await db
            .select({ count: count() })
            .from(blogArticles);

          // Get published blog count
          const [publishedResult] = await db
            .select({ count: count() })
            .from(blogArticles)
            .where(eq(blogArticles.isPublished, true));

          // Get draft blog count
          const [draftResult] = await db
            .select({ count: count() })
            .from(blogArticles)
            .where(eq(blogArticles.isPublished, false));

          // Get total studies count using SQL query with fallback
          let studiesCount = 0;
          try {
            const result = await sql`SELECT COUNT(*) as count FROM studies`;
            studiesCount = Number(result[0]?.count) || 0;
          } catch (error) {
            console.log("Direct SQL query failed, trying table query");
            try {
              const [studiesResult] = await db
                .select({ count: count() })
                .from(studies);
              studiesCount = studiesResult?.count || 0;
            } catch (tableError) {
              console.log("Table query also failed, using 0");
              studiesCount = 0;
            }
          }

          return {
            totalBlogs: Number(totalResult.count),
            publishedBlogs: Number(publishedResult.count),
            draftBlogs: Number(draftResult.count),
            totalStudies: Number(studiesCount),
            categoriesCount: 8,
            recentImports: 0,
          };
        },
        { maxRetries: 2, retryDelay: 500 },
      );

      res.json(stats);
    } catch (error) {
      // Error is handled by global error handler
      throw new DatabaseError(
        "Failed to fetch dashboard statistics",
        true,
        { endpoint: "/api/stats/dashboard" },
        error as Error,
      );
    }
  }),
);

app.get("/api/categories", generalApiRateLimiter, async (req, res) => {
  try {
    const categories = await sql`
      SELECT category, COUNT(*) as count
      FROM studies
      WHERE category IS NOT NULL AND category != ''
      GROUP BY category
      ORDER BY count DESC
      LIMIT 20
    `;
    res.json(categories);
  } catch (error) {
    console.error("Categories API error:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

app.get("/api/search", searchRateLimiter, async (req, res) => {
  try {
    const query = String(req.query.q || "");
    const limit = Math.min(50, parseInt(String(req.query.limit || "20")));
    const offset = Math.max(0, parseInt(String(req.query.offset || "0")));

    if (!query.trim()) {
      return res.status(400).json({ error: "Search query required" });
    }

    const studies = await sql`
      SELECT id, title, abstract, authors, journal, publish_date, category, doi, image_url, slug
      FROM studies 
      WHERE LOWER(title) LIKE ${"%" + query.toLowerCase() + "%"} 
      OR LOWER(abstract) LIKE ${"%" + query.toLowerCase() + "%"} 
      ORDER BY 
        CASE 
          WHEN LOWER(title) LIKE ${"%" + query.toLowerCase() + "%"} THEN 1
          ELSE 2
        END,
        id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const totalResult = await sql`
      SELECT COUNT(*) as total
      FROM studies 
      WHERE LOWER(title) LIKE ${"%" + query.toLowerCase() + "%"} 
      OR LOWER(abstract) LIKE ${"%" + query.toLowerCase() + "%"} 
    `;

    const total = parseInt(totalResult[0]?.total || "0");

    res.json({
      success: true,
      studies,
      total,
      hasMore: offset + studies.length < total,
    });
  } catch (error) {
    console.error("Search API error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

app.get("/api/studies/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const study = await sql`SELECT * FROM studies WHERE id = ${id}`;

    if (study.length === 0) {
      return res.status(404).json({ error: "Study not found" });
    }

    res.json(study[0]);
  } catch (error) {
    console.error("Study by ID error:", error);
    res.status(500).json({ error: "Failed to fetch study" });
  }
});

// Advanced filtering endpoints
app.get("/api/filters/years", generalApiRateLimiter, async (req, res) => {
  try {
    const years = await sql`
      SELECT publish_year, COUNT(*) as count
      FROM studies
      WHERE publish_year IS NOT NULL
      GROUP BY publish_year
      ORDER BY publish_year DESC
    `;
    res.json(years);
  } catch (error) {
    console.error("Years filter error:", error);
    res.status(500).json({ error: "Failed to fetch years" });
  }
});

app.get("/api/filters/countries", generalApiRateLimiter, async (req, res) => {
  try {
    const countries = await sql`
      SELECT country, COUNT(*) as count
      FROM studies
      WHERE country IS NOT NULL AND country != ''
      GROUP BY country
      ORDER BY count DESC
      LIMIT 20
    `;
    res.json(countries);
  } catch (error) {
    console.error("Countries filter error:", error);
    res.status(500).json({ error: "Failed to fetch countries" });
  }
});

app.get("/api/filters/study-types", generalApiRateLimiter, async (req, res) => {
  try {
    const studyTypes = await sql`
      SELECT study_type, COUNT(*) as count
      FROM studies
      WHERE study_type IS NOT NULL AND study_type != ''
      GROUP BY study_type
      ORDER BY count DESC
    `;
    res.json(studyTypes);
  } catch (error) {
    console.error("Study types filter error:", error);
    res.status(500).json({ error: "Failed to fetch study types" });
  }
});

app.get("/api/filters/journals", generalApiRateLimiter, async (req, res) => {
  try {
    const journals = await sql`
      SELECT journal, COUNT(*) as count
      FROM studies
      WHERE journal IS NOT NULL AND journal != ''
      GROUP BY journal
      ORDER BY count DESC
      LIMIT 30
    `;
    res.json(journals);
  } catch (error) {
    console.error("Journals filter error:", error);
    res.status(500).json({ error: "Failed to fetch journals" });
  }
});

// Database overview endpoint
app.get("/api/overview", generalApiRateLimiter, async (req, res) => {
  try {
    const [totalStudies, categoryCounts, countryCounts, yearRange] =
      await Promise.all([
        sql`SELECT COUNT(*) as count FROM studies`,
        sql`
        SELECT category, COUNT(*) as count
        FROM studies
        WHERE category IS NOT NULL AND category != ''
        GROUP BY category
        ORDER BY count DESC
        LIMIT 10
      `,
        sql`
        SELECT country, COUNT(*) as count
        FROM studies
        WHERE country IS NOT NULL AND country != ''
        GROUP BY country
        ORDER BY count DESC
        LIMIT 10
      `,
        sql`
        SELECT MIN(publish_year) as min_year, MAX(publish_year) as max_year
        FROM studies
        WHERE publish_year IS NOT NULL
      `,
      ]);

    res.json({
      totalStudies: totalStudies[0]?.count || 0,
      categoryCounts,
      countryCounts,
      yearRange: yearRange[0],
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Overview API error:", error);
    res.status(500).json({ error: "Failed to load overview" });
  }
});

// Advanced search with multiple filters
app.get("/api/advanced-search", searchRateLimiter, async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const category = String(req.query.category || "").trim();
    const country = String(req.query.country || "").trim();
    const sort_by = String(req.query.sort_by || "id");
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit || "20"))),
    );
    const offset = Math.max(0, parseInt(String(req.query.offset || "0")));

    let studies = [];
    let countResult: any[] = [];

    // Simple filtering approach that works with Neon
    if (search && category) {
      studies = await sql`
        SELECT id, title, abstract, authors, journal, publish_year, category, 
               country, study_type, sample_size, citation_count, peer_reviewed,
               has_full_text, image_url, doi, plain_language_title
        FROM studies 
        WHERE (title ILIKE ${"%" + search + "%"} OR abstract ILIKE ${"%" + search + "%"}) 
        AND category = ${category}
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      countResult = await sql`
        SELECT COUNT(*) as total FROM studies 
        WHERE (title ILIKE ${"%" + search + "%"} OR abstract ILIKE ${"%" + search + "%"}) 
        AND category = ${category}
      `;
    } else if (search) {
      studies = await sql`
        SELECT id, title, abstract, authors, journal, publish_year, category, 
               country, study_type, sample_size, citation_count, peer_reviewed,
               has_full_text, image_url, doi, plain_language_title
        FROM studies 
        WHERE title ILIKE ${"%" + search + "%"} OR abstract ILIKE ${"%" + search + "%"} 
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      countResult = await sql`
        SELECT COUNT(*) as total FROM studies 
        WHERE title ILIKE ${"%" + search + "%"} OR abstract ILIKE ${"%" + search + "%"} 
      `;
    } else if (category) {
      studies = await sql`
        SELECT id, title, abstract, authors, journal, publish_year, category, 
               country, study_type, sample_size, citation_count, peer_reviewed,
               has_full_text, image_url, doi, plain_language_title
        FROM studies 
        WHERE category = ${category}
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      countResult =
        await sql`SELECT COUNT(*) as total FROM studies WHERE category = ${category}`;
    } else if (country) {
      studies = await sql`
        SELECT id, title, abstract, authors, journal, publish_year, category, 
               country, study_type, sample_size, citation_count, peer_reviewed,
               has_full_text, image_url, doi, plain_language_title
        FROM studies 
        WHERE country = ${country}
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      countResult =
        await sql`SELECT COUNT(*) as total FROM studies WHERE country = ${country}`;
    } else {
      studies = await sql`
        SELECT id, title, abstract, authors, journal, publish_year, category, 
               country, study_type, sample_size, citation_count, peer_reviewed,
               has_full_text, image_url, doi, plain_language_title
        FROM studies 
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      countResult = await sql`SELECT COUNT(*) as total FROM studies`;
    }

    const total = parseInt(countResult[0]?.total || "0");

    res.json({
      studies,
      total,
      hasMore: offset + studies.length < total,
      filters: { search, category, country, sort_by },
    });
  } catch (error) {
    console.error("Advanced search error:", error);
    res.status(500).json({ error: "Advanced search failed" });
  }
});

// Initialize health monitoring
initializeHealthMonitoring();

// Enhanced global error handling with graceful shutdown
let isShuttingDown = false;

async function gracefulShutdown(reason: string, error?: any) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.error(`\n⚠️  Initiating graceful shutdown due to: ${reason}`);
  if (error) {
    console.error("Error details:", error);
  }

  // Give ongoing requests 10 seconds to complete
  const shutdownTimeout = setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);

  try {
    // Close database connections
    console.log("Closing database connections...");
    // await db.destroy(); // If using a pool

    console.log("Graceful shutdown completed");
    clearTimeout(shutdownTimeout);
    process.exit(0);
  } catch (shutdownError) {
    console.error("Error during shutdown:", shutdownError);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  handleError(
    new Error(`Unhandled Rejection: ${reason}`),
    "unhandledRejection",
  );

  // In production, log but don't crash unless it's critical
  if (process.env.NODE_ENV === "production") {
    // Track unhandled rejections
    const error = reason instanceof Error ? reason : new Error(String(reason));
    if (!isOperationalError(error)) {
      gracefulShutdown("Critical unhandled rejection", error);
    }
  } else {
    gracefulShutdown("Unhandled rejection in development", reason);
  }
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  handleError(error, "uncaughtException");

  // Always shutdown on uncaught exceptions as the process is in undefined state
  gracefulShutdown("Uncaught exception", error);
});

// Handle termination signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM received"));
process.on("SIGINT", () => gracefulShutdown("SIGINT received"));

// Test rate limiting endpoint (for verification)
app.get("/api/test-rate-limit", searchRateLimiter, (req, res) => {
  res.json({
    success: true,
    message: "Rate limit test endpoint",
    timestamp: new Date().toISOString(),
  });
});

// Enhanced health check endpoint with detailed status
app.get(
  "/health",
  asyncHandler(async (req, res) => {
    const healthChecks = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      circuitBreaker: dbCircuitBreaker.getState(),
    };

    try {
      // Test database connection with timeout
      const dbHealth = await checkDatabaseHealth(sql, 5000);

      if (!dbHealth.healthy) {
        throw new Error(dbHealth.error || "Database unhealthy");
      }

      res.json({
        status: "healthy",
        ...healthChecks,
        database: {
          status: "connected",
          latency: dbHealth.latency,
        },
      });
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(503).json({
        status: "unhealthy",
        ...healthChecks,
        database: {
          status: "disconnected",
          error: (error as Error).message,
        },
      });
    }
  }),
);

// Quality monitoring endpoints
app.get("/api/admin/quality/monitor", async (req, res) => {
  try {
    const { qualityMonitor } = await import("./quality-assurance-monitor.js");
    const report = qualityMonitor.getQualityReport();
    res.json(report);
  } catch (error) {
    console.error("Quality monitoring failed:", error);
    res.status(500).json({ error: "Quality monitoring unavailable" });
  }
});

app.get("/api/admin/quality/integrity", async (req, res) => {
  try {
    const { dataIntegrityValidator } = await import(
      "./data-integrity-validator.js"
    );
    const validation = await dataIntegrityValidator.validateDataIntegrity();
    res.json(validation);
  } catch (error) {
    console.error("Data integrity validation failed:", error);
    res.status(500).json({ error: "Data integrity validation failed" });
  }
});

app.post("/api/admin/quality/fix-issues", async (req, res) => {
  try {
    const { dataIntegrityValidator } = await import(
      "./data-integrity-validator.js"
    );
    const result = await dataIntegrityValidator.fixCommonIssues();
    res.json(result);
  } catch (error) {
    console.error("Issue fixing failed:", error);
    res.status(500).json({ error: "Failed to fix issues" });
  }
});

app.get("/api/admin/quality/tests", async (req, res) => {
  try {
    const { qualityTests } = await import("./automated-quality-tests.js");
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
  express.static(path.join(__dirname, "..", "public", "uploads")),
);

// 404 handler for API routes
app.use("/api/*", (req, res, next) => {
  next(new NotFoundError("API endpoint"));
});

// Global error handler - MUST be last middleware
app.use(globalErrorHandler);

// Setup server and Vite
async function setupServer() {
  const PORT = parseInt(process.env.PORT || "5000");

  if (process.env.NODE_ENV === "development") {
    // Development mode - use Vite dev server
    const { setupVite } = await import("./vite.js");
    const { createServer } = await import("http");
    const server = createServer(app);
    await setupVite(app, server);

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Marketing homepage: http://localhost:${PORT}/`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } else {
    // Production mode - serve static files
    app.use(express.static(path.join(__dirname, "..", "client", "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "..", "client", "dist", "index.html"));
    });

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Marketing homepage: http://localhost:${PORT}/`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  }
}

setupServer().catch(console.error);
