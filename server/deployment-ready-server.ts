/**
 * Deployment-Ready Production Server
 * Type-safe server optimized for Replit deployment
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

  console.log('Initializing deployment-ready server...');

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

  // Static file serving
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  app.use('/assets', express.static(path.join(process.cwd(), 'dist', 'assets')));
  app.use(express.static(path.join(process.cwd(), 'dist')));
  app.use(express.static(path.join(process.cwd(), 'public')));

  // API Routes
  console.log('Setting up API routes...');

  // Studies endpoint
  app.get('/api/studies', async (req, res) => {
    try {
      const search = String(req.query.search || '');
      const category = String(req.query.category || '');
      const limitStr = String(req.query.limit || '50');
      const offsetStr = String(req.query.offset || '0');
      
      const limit = Math.max(1, Math.min(100, parseInt(limitStr) || 50));
      const offset = Math.max(0, parseInt(offsetStr) || 0);

      let studies;
      if (search.trim() && category.trim()) {
        studies = await sql`
          SELECT * FROM studies 
          WHERE (title ILIKE ${'%' + search + '%'} OR abstract ILIKE ${'%' + search + '%'})
          AND category = ${category}
          ORDER BY id DESC 
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (search.trim()) {
        studies = await sql`
          SELECT * FROM studies 
          WHERE title ILIKE ${'%' + search + '%'} OR abstract ILIKE ${'%' + search + '%'}
          ORDER BY id DESC 
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (category.trim()) {
        studies = await sql`
          SELECT * FROM studies 
          WHERE category = ${category}
          ORDER BY id DESC 
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        studies = await sql`
          SELECT * FROM studies 
          ORDER BY id DESC 
          LIMIT ${limit} OFFSET ${offset}
        `;
      }

      res.json(studies);
    } catch (error) {
      console.error('Studies API error:', error);
      res.status(500).json({ error: 'Failed to fetch studies' });
    }
  });

  // Categories endpoint
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await sql`
        SELECT category, COUNT(*) as count
        FROM studies
        WHERE category IS NOT NULL AND category != ''
        GROUP BY category
        ORDER BY count DESC
        LIMIT 20
      `;
      res.json(categories);
    } catch (error) {
      console.error('Categories API error:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // Search endpoint
  app.get('/api/search', async (req, res) => {
    try {
      const query = String(req.query.q || '');
      const limitStr = String(req.query.limit || '20');
      const offsetStr = String(req.query.offset || '0');
      
      const limit = Math.max(1, Math.min(50, parseInt(limitStr) || 20));
      const offset = Math.max(0, parseInt(offsetStr) || 0);

      if (!query.trim()) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const searchPattern = `%${query.toLowerCase()}%`;
      
      const studies = await sql`
        SELECT id, title, abstract, authors, journal, publish_date, category, doi, image_url, slug
        FROM studies 
        WHERE LOWER(title) LIKE ${searchPattern} OR LOWER(abstract) LIKE ${searchPattern}
        ORDER BY 
          CASE 
            WHEN LOWER(title) LIKE ${searchPattern} THEN 1
            ELSE 2
          END,
          publish_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const totalResult = await sql`
        SELECT COUNT(*) as total
        FROM studies 
        WHERE LOWER(title) LIKE ${searchPattern} OR LOWER(abstract) LIKE ${searchPattern}
      `;

      const total = parseInt(totalResult[0]?.total || '0');

      res.json({
        success: true,
        studies,
        total,
        hasMore: (offset + studies.length) < total
      });
    } catch (error) {
      console.error('Search API error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // Database overview endpoint
  app.get('/api/database/overview', async (req, res) => {
    try {
      const totalStudies = await sql`SELECT COUNT(*) as count FROM studies`;
      const categoryCounts = await sql`
        SELECT category, COUNT(*) as count 
        FROM studies 
        WHERE category IS NOT NULL 
        GROUP BY category 
        ORDER BY count DESC 
        LIMIT 10
      `;

      res.json({
        totalStudies: parseInt(totalStudies[0]?.count || '0'),
        categories: categoryCounts.map(cat => ({
          name: cat.category,
          count: parseInt(cat.count || '0')
        }))
      });
    } catch (error) {
      console.error('Database overview error:', error);
      res.status(500).json({ error: 'Failed to fetch database overview' });
    }
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      port: process.env.PORT || '3000'
    });
  });

  // API info
  app.get('/api', (req, res) => {
    res.json({
      name: 'Hydrogen Research Platform API',
      version: '1.0.0',
      status: 'running',
      endpoints: ['/api/studies', '/api/search', '/api/categories', '/health']
    });
  });

  // SPA fallback
  app.get('*', (req, res) => {
    const distIndexPath = path.join(process.cwd(), 'dist', 'index.html');
    const publicIndexPath = path.join(process.cwd(), 'public', 'index.html');

    if (existsSync(distIndexPath)) {
      res.sendFile(distIndexPath);
    } else if (existsSync(publicIndexPath)) {
      res.sendFile(publicIndexPath);
    } else {
      res.status(404).json({ error: 'Application not built' });
    }
  });

  // Error handling
  app.use((error: any, req: any, res: any, next: any) => {
    console.error('Server error:', error);
    if (res.headersSent) {
      return next(error);
    }
    res.status(500).json({
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  });

  // Server startup with port flexibility
  const preferredPort = parseInt(process.env.PORT || '3000');
  const server = createServer(app);

  return new Promise<{app: express.Application, server: any}>((resolve, reject) => {
    const tryPort = (portToTry: number) => {
      server.listen(portToTry, '0.0.0.0', () => {
        const duration = Date.now() - startTime;
        console.log(`Production server running on port ${portToTry} (${duration}ms startup)`);
        resolve({ app, server });
      });

      server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE' && portToTry < preferredPort + 10) {
          console.log(`Port ${portToTry} in use, trying ${portToTry + 1}...`);
          server.removeAllListeners('error');
          tryPort(portToTry + 1);
        } else {
          reject(error);
        }
      });
    };

    tryPort(preferredPort);
  });
}

// Direct execution support
if (process.argv[1] === __filename) {
  createProductionServer().catch(console.error);
}