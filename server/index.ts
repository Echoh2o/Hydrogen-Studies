/**
 * Main Server Entry Point
 * Refactored to minimal setup, delegating app configuration to app.ts
 */

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

    console.log(`Static files path: ${staticPath}`);
    console.log(`Static path exists: ${fs.existsSync(staticPath)}`);
    if (fs.existsSync(staticPath)) {
      console.log(`index.html exists: ${fs.existsSync(path.join(staticPath, "index.html"))}`);
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
    const shutdown = (signal: string) => {
      console.log(`Received ${signal}. Shutting down gracefully...`);
      jobScheduler.stop();
      stopHealthMonitoring();
      server.close(async () => {
        try { await pool.end(); } catch {}
        console.log("Server closed.");
        process.exit(0);
      });
      // Force exit after 10 seconds if graceful shutdown hangs
      setTimeout(() => {
        console.error("Forced shutdown after timeout.");
        process.exit(1);
      }, 10000);
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
});

// Catch uncaught exceptions — log, report, but only exit for truly fatal errors
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  reportError(error, { tags: { source: "uncaughtException" } });
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
