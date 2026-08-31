/**
 * Main Server Entry Point
 * Refactored to minimal setup, delegating app configuration to app.ts
 */

import { initSentry, Sentry } from "./utils/sentry";
// Initialize Sentry before anything else so it captures all errors
initSentry();

import { validateEnvironment } from "./config/env";
// Validate environment before anything else
validateEnvironment();

import { initErrorReporting, reportError } from "./utils/error-reporting";
// Initialize error reporting early (before app setup)
initErrorReporting();

import { app } from "./app";
import { log } from "./vite";
import { pool } from "./db";
import { jobScheduler } from "./services/job-scheduler";
import { stopHealthMonitoring } from "./utils/health-monitoring";
import { seoBotMiddleware, prewarmBotCache, isBot } from "./middleware/seo-bot-middleware";
import { generalApiRateLimiter } from "./utils/rate-limiting";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Setup server and Vite
async function setupServer() {
  const PORT = parseInt(process.env.PORT || "5000");

  if (process.env.NODE_ENV === "development") {
    // Development mode - use Vite dev server
    const { setupVite } = await import("./vite");
    const { createServer } = await import("http");
    const server = createServer(app);
    await setupVite(app, server);

    server.listen(PORT, "0.0.0.0", () => {
      log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } else {
    // Production mode - serve static files from dist/public (Vite output)
    const staticPath = path.join(__dirname, "public");

    if (!fs.existsSync(staticPath)) {
      console.error(`Static files path not found: ${staticPath}`);
    }

    // Never serve client source maps publicly. They are uploaded to Sentry at
    // build time (vite.config.ts) for de-minified stack traces, but must not be
    // downloadable. Build-time deletion proved unreliable under Railway's
    // Railpack builder, so block at request time — independent of what ends up
    // on disk.
    app.use((req, res, next) => {
      if (req.path.endsWith(".map")) {
        res.status(404).end();
        return;
      }
      next();
    });

    // Rate-limit bot requests before the SEO middleware runs any DB renders.
    // isBot() trusts the User-Agent, so a spoofed crawler UA could otherwise
    // drive unlimited unauthenticated per-request DB renders (uncached 404s on
    // /study/<random>) and evict prewarmed LRU entries. Bots tolerate 429s;
    // humans are unaffected (limiter only engages for bot GETs).
    //
    // SCOPE (audit 2026-08-31): only DB-backed page renders are limited.
    // Previously EVERY non-API bot GET counted against the 100/min/IP bucket —
    // including robots.txt, the 5,000+ URL sitemap set, hashed /assets/ JS/CSS,
    // and images that Googlebot's renderer fetches under the same UA/IP. Legit
    // crawlers burned the budget on cheap static files, got 429'd on real
    // pages, and backed off crawling — directly suppressing indexation. The
    // paths exempted here are static/streamed (no per-request DB render), so
    // they aren't the DoS vector this limiter exists for.
    const BOT_LIMIT_EXEMPT_RE =
      /^\/(robots\.txt|llms\.txt|sitemap[^/]*\.xml|rss[^/]*\.xml|feed\.xml|rss\/|assets\/|images\/|favicon\.ico|logo\.png|manifest\.webmanifest)/;
    app.use((req, res, next) => {
      if (
        req.method === "GET" &&
        !req.path.startsWith("/api/") &&
        !BOT_LIMIT_EXEMPT_RE.test(req.path) &&
        !/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|webp|avif)$/i.test(req.path) &&
        isBot(req.headers["user-agent"] || "")
      ) {
        return generalApiRateLimiter(req, res, next);
      }
      next();
    });

    // SEO bot middleware — inject correct meta tags for crawlers BEFORE static files
    app.use(seoBotMiddleware(staticPath));

    // Hashed assets (JS/CSS) — immutable, cache for 1 year
    app.use(
      "/assets",
      express.static(path.join(staticPath, "assets"), {
        maxAge: "1y",
        immutable: true,
      }),
    );

    // Serve remaining static files (favicon, manifest, etc.) — short cache, revalidate
    app.use(express.static(staticPath, {
      maxAge: "1h",
      index: false, // Don't serve index.html for directory requests — SPA fallback handles that
    }));

    // SPA fallback — serve index.html for all non-API GET requests
    // Log 404s only for paths that don't match known SPA routes
    const knownSpaRoutes = /^\/(study|studies|blog|explore-by-|hydrogen-for|learn|admin|search|advanced-search|about|benefits|contact|products|recommendations|privacy|terms|insights|research-analytics|login|register|my-dashboard|this-week|recent)\b/;
    app.get("*", (req, res) => {
      // Log paths that aren't known SPA routes — these are likely real 404s
      if (!knownSpaRoutes.test(req.path) && req.path !== "/") {
        import("./services/redirect-service").then(({ log404 }) => {
          log404(req.path, req.get("referer")).catch(() => {});
        }).catch(() => {});
      }

      const indexPath = path.join(staticPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(500).send("index.html not found. Build may have failed.");
      }
    });

    const server = app.listen(PORT, "0.0.0.0", () => {
      const formattedTime = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      console.log(`${formattedTime} [express] Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);

      // Pre-warm bot cache after server is ready (non-blocking)
      prewarmBotCache(staticPath).catch((err) =>
        console.error("[SEO Bot] Pre-warm failed:", err)
      );
    });

    // Graceful shutdown for container deployments (Railway, Docker, etc.)
    let isShuttingDown = false;
    const shutdown = async (signal: string) => {
      if (isShuttingDown) return; // Prevent double shutdown
      isShuttingDown = true;
      console.log(`Received ${signal}. Shutting down gracefully...`);

      // Hard deadline: if graceful drain/close hangs, force-exit. Armed first so
      // it covers every path below.
      setTimeout(() => {
        console.error("Forced shutdown after 30s timeout.");
        process.exit(1);
      }, 30000).unref();

      stopHealthMonitoring();

      // Stop accepting new connections immediately; existing ones finish
      // naturally. Resolves once all in-flight HTTP connections have drained.
      const connectionsClosed = new Promise<void>((resolve) => {
        server.close(() => {
          console.log("All connections closed.");
          resolve();
        });
      });

      // In parallel, signal background jobs to stop and await in-flight work
      // (bounded ~20s) so we never close the DB pool under a mid-write job.
      // Abort-aware jobs (content queue) release claimed items back to 'pending'
      // on this signal instead of stalling until the 90-min stale threshold.
      const jobsDrained = jobScheduler.drain(20000).catch((err) => {
        console.error("Error draining job scheduler:", err);
      });

      // Only close the pool once BOTH connections and jobs have settled.
      await Promise.all([connectionsClosed, jobsDrained]);
      try { await pool.end(); } catch {}
      console.log("Database pool closed. Shutdown complete.");
      process.exit(0);
    };

    process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
    process.on("SIGINT", () => { void shutdown("SIGINT"); });
  }
}

// Catch unhandled rejections — log and report
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled promise rejection:", reason);
  reportError(reason instanceof Error ? reason : new Error(String(reason)), {
    tags: { source: "unhandledRejection" },
  });
  if (reason instanceof Error) Sentry.captureException(reason);
});

// Catch uncaught exceptions — log, report, but only exit for truly fatal errors
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  reportError(error, { tags: { source: "uncaughtException" } });
  Sentry.captureException(error);
  // Only exit for fatal system-level errors; request-level errors are survivable
  if (
    error.message?.includes("EACCES") ||
    error.message?.includes("EADDRINUSE") ||
    error.message?.includes("out of memory")
  ) {
    console.error("Fatal system error — shutting down.");
    process.exit(1);
  }
  // For other errors, log and continue — the server can recover
  console.error("Server continuing after non-fatal uncaught exception.");
});

setupServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
