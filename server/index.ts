/**
 * Main Server Entry Point
 * Refactored to minimal setup, delegating app configuration to app.ts
 */

import { validateEnvironment } from "./config/env";
// Validate environment before anything else
validateEnvironment();

import { app } from "./app";
import { log } from "./vite";
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

    app.use(express.static(staticPath));

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
      server.close(() => {
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

setupServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
