import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { Pool } from "@neondatabase/serverless";
import { db } from "./db";

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
  
  // Check if DB schema needs initialization (one-time operation per process)
  const initializeDbSchema = async () => {
    if (schemaInitialized) {
      return;
    }
    
    try {
      // Check for version tracking table first
      const versionTableExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'schema_version'
        );
      `);
      
      if (!versionTableExists.rows?.[0]?.exists) {
        // Create version tracking table if it doesn't exist
        await db.execute(sql`
          CREATE TABLE schema_version (
            id SERIAL PRIMARY KEY,
            version INTEGER NOT NULL,
            migration_name TEXT NOT NULL,
            applied_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
          INSERT INTO schema_version (version, migration_name) 
          VALUES (1, 'initial_schema_version');
        `);
        
        console.log('Applying schema updates for scraper functionality...');
        const { updateSchema } = await import('./schema-update');
        await updateSchema();
        console.log('Schema updates applied successfully');
        
        console.log('Adding health condition and body system fields to studies table...');
        const { updateSchemaWithHealthFields } = await import('./update-health-fields');
        await updateSchemaWithHealthFields();
        console.log('Successfully added health conditions and body systems fields');
        
        console.log('Adding hydrogen research specific fields to studies table...');
        const { addHydrogenResearchFields } = await import('../shared/schema-hydrogen-fields');
        await addHydrogenResearchFields();
        console.log('Successfully added hydrogen research database fields');
        
        console.log('Setting up vector database extension for AI chatbot...');
        const { setupVectorExtension } = await import('./vector-database');
        const vectorExtensionResult = await setupVectorExtension();
        if (vectorExtensionResult) {
          console.log('Vector database extension setup successful');
        } else {
          console.error('Vector database extension setup failed');
        }
        
        // Update version after all migrations
        await db.execute(sql`
          UPDATE schema_version 
          SET version = 2, 
              migration_name = 'complete_setup',
              applied_at = NOW()
          WHERE id = 1
        `);
      } else {
        console.log('Database schema already initialized. Skipping migrations.');
      }
      
      schemaInitialized = true;
      console.log('Successfully initialized database tables for new features');
    } catch (error) {
      console.error('Error initializing database tables:', error);
    }
  };
  
  // Run schema initialization
  await initializeDbSchema();

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
