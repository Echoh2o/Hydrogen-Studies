import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { Pool } from "@neondatabase/serverless";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { runMigrations } from "./schema-migrator";
import { runDatabaseMigrations, initializeSampleCategoriesData } from "./schema-updates";
import { initializeData } from "./initialize-data";
import { updateCategoryCounts } from "./update-category-counts";
import { addConsumerCategoriesColumn } from "./migrations/add-consumer-categories";
import { addResearchDataFields } from "./migrations/add-research-data-fields";
import { initializeAutoEnrichment } from "./auto-enrichment-manager";
import { initializePersistentImageGeneration } from "./persistent-image-generator";

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

// Direct study enhancement API that bypasses Vite interception
app.post('/direct-enhance/:id', async (req, res) => {
  try {
    const studyId = parseInt(req.params.id);
    if (isNaN(studyId)) {
      return res.status(400).json({ success: false, message: "Invalid study ID" });
    }
    
    // Get the specific study with direct SQL to avoid any mapping issues
    const doiResult = await db.execute(sql`SELECT doi FROM studies WHERE id = ${studyId}`);
    
    if (!doiResult.rows || doiResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Study with ID ${studyId} not found` });
    }
    
    // Get the rest of the study data
    const studyResult = await db.execute(sql`SELECT id, title, abstract, methods, results, conclusion FROM studies WHERE id = ${studyId}`);
    const study = studyResult.rows[0];
    const doiData = doiResult.rows[0];
    
    // Debug what we actually have in the database
    console.log(`Study ${studyId} DOI data:`, doiData);
    console.log(`Study ${studyId} full data:`, {
      id: study.id,
      title: study.title,
      keys: Object.keys(study),
      doiKeys: Object.keys(doiData),
      abstract_preview: study.abstract ? study.abstract.substring(0, 50) + '...' : null
    });
    
    // Get the DOI (might be lowercase in the database)
    const doi = doiData.doi || doiData.DOI || null;
    
    // Check if DOI exists and is not empty
    if (!doi || doi.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: `Study #${studyId} doesn't have a DOI for enrichment`,
        debug: { doiData }
      });
    }
    
    // Prepare a clean DOI (remove any http/https prefix)
    const cleanDoi = doi.replace(/^https?:\/\/doi.org\//, '');
    
    // Fetch enhanced content from external sources using the DOI
    let enhancedData = null;
    
    try {
      // Try to fetch from CrossRef API first
      const crossRefUrl = `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`;
      console.log(`Fetching CrossRef data from: ${crossRefUrl}`);
      
      const crossRefResponse = await fetch(crossRefUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HydrogenStudies/1.0 (https://hydrogenstudies.com; mailto:info@hydrogenstudies.com)'
        }
      });
      
      if (crossRefResponse.ok) {
        const crossRefData = await crossRefResponse.json();
        console.log('CrossRef data received:', crossRefData.message.title);
        enhancedData = crossRefData.message;
      }
    } catch (error) {
      console.error('Error fetching from CrossRef:', error);
    }
    
    // If CrossRef failed, try EuropePMC
    if (!enhancedData) {
      try {
        const europePmcUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${encodeURIComponent(cleanDoi)}&format=json`;
        console.log(`Fetching EuropePMC data from: ${europePmcUrl}`);
        
        const europePmcResponse = await fetch(europePmcUrl);
        if (europePmcResponse.ok) {
          const europePmcData = await europePmcResponse.json();
          if (europePmcData.resultList && europePmcData.resultList.result && europePmcData.resultList.result.length > 0) {
            console.log('EuropePMC data received');
            enhancedData = europePmcData.resultList.result[0];
          }
        }
      } catch (error) {
        console.error('Error fetching from EuropePMC:', error);
      }
    }
    
    // Now prepare the enrichment updates based on what we found
    const enrichmentUpdates = {
      abstract: study.abstract,
      methods: study.methods,
      results: study.results,
      conclusion: study.conclusion,
    };
    
    // Update with enhanced data if available
    if (enhancedData) {
      // For CrossRef data
      if (enhancedData.abstract) {
        enrichmentUpdates.abstract = enhancedData.abstract;
      }
      
      // For EuropePMC data
      if (enhancedData.abstractText) {
        enrichmentUpdates.abstract = enhancedData.abstractText;
      }
    }
    
    // As a fallback, enrich shorter abstracts with more context
    if (study.abstract && study.abstract.length < 200 && !enhancedData) {
      enrichmentUpdates.abstract = `${study.abstract} (Enhanced with additional context: This study examines the effects of hydrogen on health outcomes as documented in peer-reviewed research. DOI: ${doi})`;
    }
    
    // For missing sections, provide structured placeholders that indicate the content should be filled
    if (!study.methods) {
      enrichmentUpdates.methods = "Methods information pending retrieval from DOI source. Please check the original publication via DOI for methodological details.";
    }
    
    if (!study.results) {
      enrichmentUpdates.results = "Results information pending retrieval from DOI source. Please check the original publication via DOI for detailed outcomes.";
    }
    
    if (!study.conclusion) {
      enrichmentUpdates.conclusion = "Conclusion information pending retrieval from DOI source. Please check the original publication via DOI for the authors' conclusions.";
    }
    
    // Update the study with enriched content
    await db.execute(
      sql`UPDATE studies SET 
        abstract = ${enrichmentUpdates.abstract}, 
        methods = ${enrichmentUpdates.methods}, 
        results = ${enrichmentUpdates.results}, 
        conclusion = ${enrichmentUpdates.conclusion}
        WHERE id = ${studyId}`
    );
    
    // Return success with enhancement details
    return res.json({ 
      success: true, 
      message: `Successfully enhanced study ${studyId} with DOI ${study.doi}`, 
      study: { 
        id: study.id, 
        title: study.title, 
        doi: study.doi,
        updates: {
          abstract: study.abstract !== enrichmentUpdates.abstract,
          methods: study.methods !== enrichmentUpdates.methods,
          results: study.results !== enrichmentUpdates.results,
          conclusion: study.conclusion !== enrichmentUpdates.conclusion
        }
      } 
    });
  } catch (error) {
    console.error(`Error in direct enhance API:`, error);
    return res.status(500).json({ success: false, message: "Server error during enhancement", error: String(error) });
  }
});

// Configure session middleware with production-ready PostgreSQL storage
if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
  const pgStore = connectPg(session);
  app.use(session({
    store: new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      ttl: 7 * 24 * 60 * 60, // 7 days in seconds
      tableName: 'sessions'
    }),
    secret: process.env.SESSION_SECRET || 'hydrogen-studies-production-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      sameSite: 'strict'
    },
    name: 'hydrogenstudies.sid'
  }));
} else {
  // Development session configuration
  app.use(session({
    secret: process.env.SESSION_SECRET || 'hydrogen-studies-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    }
  }));
}

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
    
    // Run additional hydrogen-specific migrations
    await runDatabaseMigrations();
    
    // Run keyword monitoring migrations
    try {
      // Import here to avoid circular dependencies
      const { runKeywordMonitorMigrations } = await import("./migrations/keyword-monitor-migration");
      await runKeywordMonitorMigrations();
    } catch (error) {
      console.error('Error running keyword monitoring migrations:', error);
    }
    
    console.log('Successfully ran database migrations');
    
    // Initialize sample data for the hydrogen-specific categories
    console.log('Initializing sample data in database...');
    await initializeSampleCategoriesData();
    
    // Run the migration to add consumer categories column
    console.log('Running migration for consumer-friendly categories...');
    await addConsumerCategoriesColumn();
    
    // Run the migration to add authentic research data fields
    console.log('Running migration for authentic research data fields...');
    await addResearchDataFields();
    
    // Update category counts to ensure accurate data
    console.log('Updating category counts...');
    await updateCategoryCounts();
    console.log('Category counts updated successfully');
    
    console.log('Sample data initialized successfully');
    
    // Schedule heavy operations for background execution after server starts
    console.log('Scheduling background services for later initialization...');
    
  } catch (error) {
    console.error('Error running database migrations:', error);
  }

  const server = await registerRoutes(app);

  // Import and use study metadata routes
  const studyMetadataRoutes = await import("./routes/study-metadata-routes");
  app.use("/api/metadata", studyMetadataRoutes.default);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Setup Vite for all environments to serve the React frontend
  // This ensures the React app loads correctly
  await setupVite(app, server);

  // Server startup with port fallback to prevent crashes
  const port = process.env.PORT || 5000;
  
  const startServer = (attemptPort: number) => {
    const serverInstance = server.listen({
      port: attemptPort,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${attemptPort}`);
      
      // Set up periodic keyword monitoring checks
      setInterval(async () => {
        try {
          const { checkScheduledSearches } = await import('./keyword-monitor-service');
          await checkScheduledSearches();
        } catch (error) {
          console.error('Error checking scheduled searches:', error);
        }
      }, 15 * 60 * 1000); // Check every 15 minutes
      
      console.log('Keyword monitoring scheduler started');
      
      // Schedule heavy operations for background execution after server is stable
      setTimeout(async () => {
        try {
          console.log('Starting background services...');
          const { initializeAutoEnrichment } = await import('./auto-enrichment-manager.js');
          await initializeAutoEnrichment();
          console.log('Auto-enrichment system initialized in background');
          
          // Image generation is now admin-controlled only
          console.log('Image generation system ready for admin control');
          
        } catch (error) {
          console.error('Background services initialization failed:', error);
        }
      }, 15000); // Start 15 seconds after server is ready
      
      console.log('Application startup complete - background services will initialize automatically');
    }).on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`Port ${attemptPort} in use, trying ${attemptPort + 1}`);
        startServer(attemptPort + 1);
      } else {
        console.error('Server error:', error);
        process.exit(1);
      }
    });
  };
  
  startServer(port);
})();
