/**
 * Production-Optimized Server
 * Addresses all production issues: error handling, connection pooling, health monitoring
 */
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "./db";
import { studies } from "../shared/schema.js";
import { eq, and, ilike, or, sql, desc, asc } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enhanced database connection with pooling
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const neonClient = neon(connectionString);

const db = drizzle(neonClient);

// Connection pool health monitoring
let dbHealthy = false;
let lastHealthCheck = new Date();

async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await db
      .select({ count: sql`count(*)` })
      .from(studies)
      .limit(1);
    dbHealthy = true;
    lastHealthCheck = new Date();
    return true;
  } catch (error) {
    console.error("Database health check failed:", error);
    dbHealthy = false;
    return false;
  }
}

// Initialize database health
checkDatabaseHealth();

// Periodic health checks
setInterval(checkDatabaseHealth, 30000); // Every 30 seconds

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
      },
    },
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

app.use(limiter);

// CORS configuration
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://your-domain.com"] // Replace with actual domain
        : true,
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static files with caching
app.use(
  express.static(path.join(__dirname, "..", "public"), {
    maxAge: process.env.NODE_ENV === "production" ? "1d" : "0",
    etag: true,
  }),
);

// Global error handler for unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Don't exit in production, log and continue
});

// Global error handler for uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // Log error and gracefully shutdown in production
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Async error wrapper
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Health check endpoint
app.get(
  "/health",
  asyncHandler(async (req: any, res: any) => {
    const healthStatus = {
      status: dbHealthy ? "healthy" : "degraded",
      database: dbHealthy ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
      lastHealthCheck: lastHealthCheck.toISOString(),
      uptime: process.uptime(),
    };

    res.status(dbHealthy ? 200 : 503).json(healthStatus);
  }),
);

// Enhanced search endpoint with proper error handling
app.get(
  "/api/advanced-search",
  asyncHandler(async (req: any, res: any) => {
    if (!dbHealthy) {
      return res.status(503).json({
        error: "Database temporarily unavailable",
        message: "Please try again in a moment",
      });
    }

    try {
      const {
        search = "",
        category = "",
        country = "",
        minYear = "",
        maxYear = "",
        minCitations = "",
        maxCitations = "",
        minSampleSize = "",
        maxSampleSize = "",
        peerReviewed = "",
        hasFullText = "",
        limit = "20",
        offset = "0",
        sortBy = "citation_count",
        sortOrder = "desc",
      } = req.query;

      const limitNum = Math.min(parseInt(limit as string) || 20, 100);
      const offsetNum = parseInt(offset as string) || 0;

      let query = db.select().from(studies);
      let countQuery = db.select({ count: sql`count(*)` }).from(studies);

      const conditions = [];

      if (search) {
        const searchCondition = or(
          ilike(studies.title, `%${search}%`),
          ilike(studies.abstract, `%${search}%`),
          ilike(studies.plainLanguageTitle, `%${search}%`),
          ilike(studies.methods, `%${search}%`),
          ilike(studies.results, `%${search}%`),
          ilike(studies.conclusion, `%${search}%`),
        );
        conditions.push(searchCondition);
      }

      if (category) {
        conditions.push(ilike(studies.category, `%${category}%`));
      }

      if (country) {
        conditions.push(eq(studies.country, country));
      }

      if (minYear) {
        conditions.push(
          sql`${studies.publishYear} >= ${parseInt(minYear as string)}`,
        );
      }

      if (maxYear) {
        conditions.push(
          sql`${studies.publishYear} <= ${parseInt(maxYear as string)}`,
        );
      }

      if (minCitations) {
        conditions.push(
          sql`${studies.citationCount} >= ${parseInt(minCitations as string)}`,
        );
      }

      if (maxCitations) {
        conditions.push(
          sql`${studies.citationCount} <= ${parseInt(maxCitations as string)}`,
        );
      }

      if (minSampleSize) {
        conditions.push(
          sql`${studies.sampleSize} >= ${parseInt(minSampleSize as string)}`,
        );
      }

      if (maxSampleSize) {
        conditions.push(
          sql`${studies.sampleSize} <= ${parseInt(maxSampleSize as string)}`,
        );
      }

      if (peerReviewed === "true") {
        conditions.push(eq(studies.peerReviewed, true));
      }

      if (hasFullText === "true") {
        conditions.push(
          sql`${studies.fullText} IS NOT NULL AND ${studies.fullText} != ''`,
        );
      }

      if (conditions.length > 0) {
        const whereCondition = and(...conditions);
        query = query.where(whereCondition);
        countQuery = countQuery.where(whereCondition);
      }

      // Add sorting
      const sortColumn =
        studies[sortBy as keyof typeof studies] || studies.citation_count;
      query = query.orderBy(
        sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn),
      );

      // Add pagination
      query = query.limit(limitNum).offset(offsetNum);

      // Execute queries with timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Query timeout")), 10000),
      );

      const [studiesResult, countResult] = (await Promise.race([
        Promise.all([query, countQuery]),
        timeoutPromise,
      ])) as any;

      const total = countResult[0]?.count || 0;

      res.json({
        studies: studiesResult,
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total,
      });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({
        error: "Search failed",
        message: "An error occurred while searching. Please try again.",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }),
);

// Database overview endpoint
app.get(
  "/api/overview",
  asyncHandler(async (req: any, res: any) => {
    if (!dbHealthy) {
      return res.status(503).json({
        error: "Database temporarily unavailable",
      });
    }

    try {
      const [
        totalStudies,
        categoryCounts,
        countryCounts,
        yearRange,
        avgCitations,
      ] = await Promise.all([
        db.select({ count: sql`count(*)` }).from(studies),
        db
          .select({
            category: studies.category,
            count: sql`count(*)`,
          })
          .from(studies)
          .groupBy(studies.category)
          .orderBy(desc(sql`count(*)`)),
        db
          .select({
            country: studies.country,
            count: sql`count(*)`,
          })
          .from(studies)
          .groupBy(studies.country)
          .orderBy(desc(sql`count(*)`))
          .limit(10),
        db
          .select({
            minYear: sql`min(${studies.publish_year})`,
            maxYear: sql`max(${studies.publish_year})`,
          })
          .from(studies),
        db
          .select({
            avgCitations: sql`round(avg(${studies.citation_count}), 2)`,
          })
          .from(studies),
      ]);

      res.json({
        totalStudies: totalStudies[0]?.count || 0,
        categoryCounts,
        countryCounts,
        yearRange: yearRange[0],
        avgCitations: avgCitations[0]?.avgCitations || 0,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Overview error:", error);
      res.status(500).json({
        error: "Failed to load overview",
        message: "Please try again later.",
      });
    }
  }),
);

// Single study endpoint
app.get(
  "/api/studies/:id",
  asyncHandler(async (req: any, res: any) => {
    if (!dbHealthy) {
      return res.status(503).json({
        error: "Database temporarily unavailable",
      });
    }

    try {
      const studyId = parseInt(req.params.id);
      if (isNaN(studyId)) {
        return res.status(400).json({ error: "Invalid study ID" });
      }

      const study = await db
        .select()
        .from(studies)
        .where(eq(studies.id, studyId))
        .limit(1);

      if (study.length === 0) {
        return res.status(404).json({ error: "Study not found" });
      }

      res.json(study[0]);
    } catch (error) {
      console.error("Study fetch error:", error);
      res.status(500).json({
        error: "Failed to load study",
        message: "Please try again later.",
      });
    }
  }),
);

// Default route serves marketing homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "marketing-index.html"));
});

// Catch-all route for SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "marketing-index.html"));
});

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Express error:", err);

  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
    timestamp: new Date().toISOString(),
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  process.exit(0);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Production server running on port ${PORT}`);
  console.log(`Marketing homepage: http://localhost:${PORT}/`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export default app;
