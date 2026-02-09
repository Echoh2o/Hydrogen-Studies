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
import { fileURLToPath } from "url";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Setup server and Vite
async function setupServer() {
  const PORT = parseInt(process.env.PORT || "5000");

  if (process.env.NODE_ENV === "development") {
    // Development mode - use Vite dev server
    const { setupVite } = await import("./vite"); // Removed .js extension for TS resolution
    const { createServer } = await import("http");
    const server = createServer(app);
    await setupVite(app, server);

    server.listen(PORT, "0.0.0.0", () => {
      log(`Server running on port ${PORT}`);
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
      const formattedTime = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      console.log(`${formattedTime} [express] Server running on port ${PORT}`);
      console.log(`Marketing homepage: http://localhost:${PORT}/`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  }
}

setupServer().catch(console.error);
