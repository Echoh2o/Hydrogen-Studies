/**
 * Simplified Production Server
 * Handles static files, essential API routes, and SPA routing for deployment
 */

import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createProductionServer() {
  const app = express();
  const startTime = Date.now();

  console.log('Initializing production server...');

  // Validate environment
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for production');
  }

  const sql = neon(process.env.DATABASE_URL);

  // Basic middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // CORS for production
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // Static file serving with correct precedence
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Serve built assets from dist (production assets)
  app.use('/assets', express.static(path.join(process.cwd(), 'dist', 'assets')));

  // Serve built files from dist first (production)
  app.use(express.static(path.join(process.cwd(), 'dist')));

  // Fallback to public directory (development assets)
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Load all API routes
  try {
    console.log('Loading API routes...');

    // Import and use all necessary route modules
    const studiesRoutes = await import('./routes/studies-routes.js');
    const consumerCategoriesRoutes = await import('./routes/consumer-categories-routes.js');
    const advancedSearchRoutes = await import('./routes/advanced-search-routes.js');

    // Mount the routes
    app.use('/api/studies', studiesRoutes.default);
    app.use('/api/consumer-categories', consumerCategoriesRoutes.default);
    app.use('/api/search', advancedSearchRoutes.default);

    console.log('✓ API routes loaded successfully');
  } catch (error) {
    console.error('Error loading API routes:', error);

    // Fallback essential routes
    app.get('/api/studies', async (req, res) => {
      try {
        const studies = await storage.getStudies({});
        res.json(studies);
      } catch (error) {
        console.error('Error fetching studies:', error);
        res.status(500).json({ error: 'Failed to fetch studies' });
      }
    });

    app.get('/api/categories', async (req, res) => {
      try {
        const categories = await storage.getCategories();
        res.json(categories);
      } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
      }
    });

    app.get('/api/consumer-categories/counts', async (req, res) => {
      try {
        const categories = await storage.getConsumerCategories();
        res.json(categories);
      } catch (error) {
        console.error('Error fetching consumer categories:', error);
        res.status(500).json({ error: 'Failed to fetch consumer categories' });
      }
    });
  }

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Root API info
  app.get('/api', (req, res) => {
    res.json({
      name: 'Hydrogen Research Platform API',
      version: '1.0.0',
      status: 'running',
      endpoints: ['/api/studies', '/api/search', '/api/categories', '/health']
    });
  });

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    const distIndexPath = path.join(process.cwd(), 'dist', 'index.html');
    const publicIndexPath = path.join(process.cwd(), 'public', 'index.html');

    // Try dist/index.html first (built version), then fallback to public
    if (existsSync(distIndexPath)) {
      res.sendFile(distIndexPath);
    } else {
      res.sendFile(publicIndexPath);
    }
  });

  // Error handling
  app.use((error: any, req: any, res: any, next: any) => {
    console.error('Production server error:', error);

    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  });

  const port = parseInt(process.env.PORT || '5000');
  const server = createServer(app);

  return new Promise((resolve, reject) => {
    server.listen(port, '0.0.0.0', () => {
      const duration = Date.now() - startTime;
      console.log(`✓ Production server running on port ${port} (${duration}ms startup)`);
      resolve({ app, server });
    });

    server.on('error', reject);
  });
}

// Start production server if this file is run directly
if (process.argv[1] === __filename) {
  createProductionServer().catch(console.error);
}