#!/usr/bin/env node

/**
 * Production Server Starter
 * This file starts the production server after the build process.
 *
 * Note: database migrations are NOT run here. `npm run db:push` runs once
 * per deployment via Railway's preDeployCommand (see railway.toml), which
 * avoids per-instance migration races and boot latency.
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if the built server exists
const distPath = join(__dirname, "dist", "index.js");

if (!existsSync(distPath)) {
  console.error("❌ Production build not found!");
  console.error('Please run "npm run build" first.');
  process.exit(1);
}

// Set production environment
process.env.NODE_ENV = "production";

console.log("🚀 Starting production server...");
console.log(`📁 Server path: ${distPath}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
console.log(
  `🔑 Database: ${process.env.DATABASE_URL ? "Connected" : "Not configured"}`,
);

// Start the production server
const server = spawn("node", [distPath], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
  },
});

let shuttingDown = false;

server.on("error", (error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});

server.on("exit", (code, signal) => {
  if (shuttingDown) {
    if (code === 0) {
      console.log("✅ Server exited cleanly.");
    } else {
      console.error(`⚠️ Server exited during drain with code ${code}, signal ${signal}`);
    }
    process.exit(0);
  }
  if (signal) {
    console.error(`❌ Server terminated by signal ${signal}`);
    process.exit(1);
  }
  if (code !== 0) {
    console.error(`❌ Server exited with code ${code}`);
  }
  process.exit(code ?? 0);
});

// Graceful shutdown: forward the signal to the child and wait for it to
// drain in-flight requests (dist/index.js has its own graceful shutdown).
// A force-exit timeout guards against the child never exiting.
const FORCE_EXIT_TIMEOUT_MS = 30_000;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n🛑 Received ${signal}, sending SIGTERM to server and waiting for it to drain...`);
  server.kill("SIGTERM");
  setTimeout(() => {
    console.error(`❌ Server did not exit within ${FORCE_EXIT_TIMEOUT_MS / 1000}s; forcing exit.`);
    process.exit(1);
  }, FORCE_EXIT_TIMEOUT_MS);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
