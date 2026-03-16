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
import { seoBotMiddleware } from "./middleware/seo-bot-middleware";
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

    // Other static files — cache for 1 hour, revalidate
    app.use(express.static(staticPath, { maxAge: "1h" }));
    // Serve static assets with long-term caching (Vite adds content hashes to filenames)
    app.use(express.static(staticPath, {
      maxAge: "1y",
      immutable: true,
      index: false, // Don't serve index.html for directory requests — SPA fallback handles that
    }));

    // SPA fallback — serve index.html for all non-API GET requests
    app.get("*", (req, res) => {
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
    });

    // Graceful shutdown for container deployments (Railway, Docker, etc.)
    let isShuttingDown = false;
    const shutdown = (signal: string) => {
      if (isShuttingDown) return; // Prevent double shutdown
      isShuttingDown = true;
      console.log(`Received ${signal}. Shutting down gracefully...`);

      // Stop accepting new connections and background work
      jobScheduler.stop();
      stopHealthMonitoring();

      // Stop accepting new connections; existing ones finish naturally
      server.close(async () => {
        console.log("All connections closed.");
        try { await pool.end(); } catch {}
        console.log("Database pool closed. Shutdown complete.");
        process.exit(0);
      });

      // Give in-flight requests time to complete before force exit
      setTimeout(() => {
        console.error("Forced shutdown after 15s timeout.");
        process.exit(1);
      }, 15000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
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
