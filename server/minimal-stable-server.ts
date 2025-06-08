/**
 * Minimal Stable Server - Maximum performance with minimal complexity
 */

import express from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { Pool } from "@neondatabase/serverless";
import { fastSearch, fastCategoryCounts, fastTrendingSearches, initializeMinimalPerformance, getSimpleStats } from "./minimal-performance-core";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { setupVite } from "./vite";
import { createServer } from "http";
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createMinimalServer() {
  const app = express();
  
  // Essential middleware only
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  // Session with minimal configuration
  if (process.env.DATABASE_URL) {
    const pgStore = connectPg(session);
    app.use(session({
      store: new pgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || 'hydrogen-minimal-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
    }));
  }

  // Static files
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // Performance tracking middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (req.path.startsWith('/api') && duration > 300) {
        console.log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms (SLOW)`);
      }
    });
    next();
  });

  // Core API endpoints with minimal implementation
  app.get('/api/search/enhanced', async (req, res) => {
    try {
      const query = req.query.q as string || '';
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 50);
      const filters = { condition: req.query.condition as string };
      
      const result = await fastSearch(query, filters, page, pageSize);
      res.json(result);
    } catch (error) {
      console.error('Search endpoint error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  app.get('/api/consumer-categories/counts', async (req, res) => {
    try {
      const result = await fastCategoryCounts();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Category counts failed' });
    }
  });

  app.get('/api/categories', async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT consumer_categories as name, COUNT(*) as count 
        FROM studies 
        WHERE consumer_categories IS NOT NULL AND consumer_categories != '' 
        GROUP BY consumer_categories 
        ORDER BY count DESC
      `);
      
      const categories = (result as any).rows || [];
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: 'Categories retrieval failed' });
    }
  });

  app.get('/api/consumer-categories/studies', async (req, res) => {
    try {
      const { model, category } = req.query;
      
      if (!model || !category) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters'
        });
      }

      const categoryName = category as string;
      
      const result = await db.execute(sql`
        SELECT id, title, abstract, authors, journal, journal_publish_date as "publishDate",
               doi, consumer_categories, array_to_string(keywords, ', ') as keywords
        FROM studies 
        WHERE consumer_categories = ${categoryName}
        ORDER BY journal_publish_date DESC NULLS LAST
        LIMIT 50
      `);

      const studies = (result as any).rows || [];
      
      res.json({
        success: true,
        data: studies
      });
    } catch (error) {
      console.error('Error fetching studies by category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch studies'
      });
    }
  });

  app.get('/api/search/trending', async (req, res) => {
    try {
      const trending = await fastTrendingSearches();
      res.json(trending);
    } catch (error) {
      res.status(500).json({ error: 'Trending searches failed' });
    }
  });

  app.get('/api/studies', async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 50);
      const offset = (page - 1) * pageSize;

      const [countResult, studiesResult] = await Promise.all([
        db.execute(sql`SELECT COUNT(*) as total FROM studies`),
        db.execute(sql`
          SELECT id, title, abstract, authors, journal, journal_publish_date,
                 doi, array_to_string(keywords, ', ') as keywords, consumer_categories
          FROM studies 
          ORDER BY journal_publish_date DESC NULLS LAST
          LIMIT ${pageSize} OFFSET ${offset}
        `)
      ]);

      const total = parseInt((countResult as any).rows[0]?.total || '0');
      const studies = (studiesResult as any).rows || [];

      res.json({
        data: studies,
        total,
        page,
        pageSize,
        pageCount: Math.ceil(total / pageSize)
      });
    } catch (error) {
      res.status(500).json({ error: 'Studies retrieval failed' });
    }
  });

  app.get('/api/studies/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid study ID' });
      }

      const result = await db.execute(sql`
        SELECT * FROM studies WHERE id = ${id}
      `);

      const study = (result as any).rows[0];
      if (!study) {
        return res.status(404).json({ error: 'Study not found' });
      }

      res.json(study);
    } catch (error) {
      res.status(500).json({ error: 'Study retrieval failed' });
    }
  });

  // Health check endpoint
  app.get('/health', async (req, res) => {
    try {
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      const dbLatency = Date.now() - start;
      
      const stats = getSimpleStats();
      
      res.json({
        status: 'healthy',
        database: { latency: `${dbLatency}ms` },
        ...stats
      });
    } catch (error) {
      res.status(500).json({ status: 'unhealthy' });
    }
  });

  // Error handling
  app.use((error: any, req: any, res: any, next: any) => {
    console.error('Server error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

// Minimal startup with essential optimizations only
export async function startMinimalServer() {
  console.log('Starting minimal stable server...');
  const startTime = Date.now();

  try {
    // Only run essential database optimizations
    await initializeMinimalPerformance();
    
    // Create and start server
    const app = await createMinimalServer();
    const port = parseInt(process.env.PORT || '5000');

    // Create HTTP server for Vite integration
    const server = createServer(app);
    
    // Setup Vite for frontend serving (after all API routes are defined)
    await setupVite(app, server);

    server.listen(port, '0.0.0.0', () => {
      const duration = Date.now() - startTime;
      console.log(`✓ Minimal server running on port ${port} (${duration}ms startup)`);
    });

    return { app, server };
  } catch (error) {
    console.error('Minimal server startup failed:', error);
    throw error;
  }
}