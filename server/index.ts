import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { Pool } from "@neondatabase/serverless";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { runMigrations } from "./schema-migrator";

// Check for required environment variables
if (!process.env.SESSION_SECRET) {
  console.warn("Warning: SESSION_SECRET environment variable not set. Using a default value for development.");
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve uploaded images from uploads directory
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'uploads');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/uploads', express.static(uploadsDir));

// Configure session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'hydrogen-studies-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
  }
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  
  // Skip capturing full response bodies to improve performance
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Only log essential information: method, path, status code, and duration
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // Only log detailed response in development mode
      if (process.env.NODE_ENV === 'development' && duration > 500) {
        logLine += ` (SLOW)`;
      }
      
      log(logLine);
    }
  });

  next();
});

(async () => {
  // Track schema version in memory to avoid running migrations repeatedly
  let schemaInitialized = false;
  
  // Run database migrations to ensure schema is up to date
  try {
    console.log('Running database migrations...');
    await runMigrations();
    console.log('Successfully ran database migrations');
  } catch (error) {
    console.error('Error running database migrations:', error);
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
