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

  // Create essential API routes directly
  console.log('Setting up essential API routes...');

  // Studies API
  app.get('/api/studies', async (req, res) => {
    try {
      const {
        search = '',
        category = '',
        limit = '50',
        offset = '0'
      } = req.query;

      let baseQuery = sql`SELECT * FROM studies`;
      let conditions = [];

      if (search) {
        conditions.push(sql`(title ILIKE ${'%' + search + '%'} OR abstract ILIKE ${'%' + search + '%'})`);
      }

      if (category) {
        conditions.push(sql`category = ${category}`);
      }

      let studies;
      if (conditions.length > 0) {
        const whereClause = conditions.reduce((acc, condition) => sql`${acc} AND ${condition}`);
        studies = await sql`
          SELECT * FROM studies
          WHERE ${whereClause}
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
        `;
      } else {
        studies = await sql`
          SELECT * FROM studies
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
        `;
      }

      res.json(studies);
    } catch (error) {
      console.error('Error fetching studies:', error);
      res.status(500).json({ error: 'Failed to fetch studies' });
    }
  });

  // Categories API
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await sql`
        SELECT category, COUNT(*) as count
        FROM studies
        WHERE category IS NOT NULL
        GROUP BY category
        ORDER BY count DESC
      `;
      res.json(categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // Consumer categories endpoint
  app.get('/api/consumer-categories/counts', async (req, res) => {
    try {
      // Use existing category data from studies table
      const categoryResults = await sql`
        SELECT category, COUNT(*) as count
        FROM studies
        WHERE category IS NOT NULL
        GROUP BY category
        ORDER BY count DESC
      `;

      // Parse consumer categories from JSON field if available
      const consumerCategoriesResults = await sql`
        SELECT consumer_categories, COUNT(*) as count
        FROM studies
        WHERE consumer_categories IS NOT NULL
        GROUP BY consumer_categories
      `;

      // Process the consumer categories JSON
      const bodySystemsMap = new Map();
      const conditionsMap = new Map();
      const lifeStagesMap = new Map();

      consumerCategoriesResults.forEach(row => {
        try {
          const categories = JSON.parse(row.consumer_categories);
          const count = parseInt(row.count);

          if (categories.bodySystem) {
            categories.bodySystem.forEach(bs => {
              bodySystemsMap.set(bs, (bodySystemsMap.get(bs) || 0) + count);
            });
          }

          if (categories.condition) {
            categories.condition.forEach(cond => {
              conditionsMap.set(cond, (conditionsMap.get(cond) || 0) + count);
            });
          }

          if (categories.lifeStage) {
            categories.lifeStage.forEach(ls => {
              lifeStagesMap.set(ls, (lifeStagesMap.get(ls) || 0) + count);
            });
          }
        } catch (e) {
          // Skip invalid JSON
        }
      });

      const categorized = {
        body_systems: Array.from(bodySystemsMap.entries()).map(([name, count]) => ({ name, count })),
        conditions: Array.from(conditionsMap.entries()).map(([name, count]) => ({ name, count })),
        life_stages: Array.from(lifeStagesMap.entries()).map(([name, count]) => ({ name, count })),
        categories: categoryResults // Include traditional categories
      };

      res.json(categorized);
    } catch (error) {
      console.error('Error fetching consumer categories:', error);
      res.status(500).json({ error: 'Failed to fetch consumer categories' });
    }
  });

  // Search API
  app.get('/api/search', async (req, res) => {
    try {
      const { q = '', filters = '{}', limit = '20', offset = '0' } = req.query;
      const parsedFilters = JSON.parse(filters as string);

      let conditions = [];

      if (q) {
        conditions.push(sql`(title ILIKE ${'%' + q + '%'} OR abstract ILIKE ${'%' + q + '%'})`);
      }

      if (parsedFilters.category) {
        conditions.push(sql`category = ${parsedFilters.category}`);
      }

      let studies;
      if (conditions.length > 0) {
        const whereClause = conditions.reduce((acc, condition) => sql`${acc} AND ${condition}`);
        studies = await sql`
          SELECT * FROM studies
          WHERE ${whereClause}
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
        `;
      } else {
        studies = await sql`
          SELECT * FROM studies
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
        `;
      }

      res.json({ studies, total: studies.length });
    } catch (error) {
      console.error('Error in search:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  console.log('✓ Essential API routes configured');

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