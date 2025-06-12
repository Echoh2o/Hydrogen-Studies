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
      const search = typeof req.query.search === 'string' ? req.query.search : '';
      const category = typeof req.query.category === 'string' ? req.query.category : '';
      const limit = typeof req.query.limit === 'string' ? req.query.limit : '50';
      const offset = typeof req.query.offset === 'string' ? req.query.offset : '0';

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

  // Categories API - simplified and working
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

      const formattedCategories = categories.map(cat => ({
        id: cat.category,
        name: cat.category,
        description: `${cat.count} studies available`,
        icon: 'flask',
        count: parseInt(cat.count)
      }));

      res.json(formattedCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // Consumer categories API
  app.get('/api/consumer-categories/counts', async (req, res) => {
    try {
      // Parse consumer categories from JSON field if available
      const consumerCategoriesResults = await sql`
        SELECT consumer_categories, COUNT(*) as count
        FROM studies
        WHERE consumer_categories IS NOT NULL
        AND consumer_categories != ''
        AND consumer_categories != 'null'
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

          if (categories.bodySystem && Array.isArray(categories.bodySystem)) {
            categories.bodySystem.forEach(bs => {
              bodySystemsMap.set(bs, (bodySystemsMap.get(bs) || 0) + count);
            });
          }

          if (categories.condition && Array.isArray(categories.condition)) {
            categories.condition.forEach(cond => {
              conditionsMap.set(cond, (conditionsMap.get(cond) || 0) + count);
            });
          }

          if (categories.lifeStage && Array.isArray(categories.lifeStage)) {
            categories.lifeStage.forEach(ls => {
              lifeStagesMap.set(ls, (lifeStagesMap.get(ls) || 0) + count);
            });
          }
        } catch (e) {
          console.log('Skipping invalid JSON:', row.consumer_categories);
        }
      });

      const data = {
        condition: Array.from(conditionsMap.entries()).map(([name, count]) => ({ name, count: count.toString() })),
        bodySystem: Array.from(bodySystemsMap.entries()).map(([name, count]) => ({ name, count: count.toString() })),
        lifeStage: Array.from(lifeStagesMap.entries()).map(([name, count]) => ({ name, count: count.toString() }))
      };

      res.json({ data });
    } catch (error) {
      console.error('Error fetching consumer categories:', error);
      res.status(500).json({ error: 'Failed to fetch consumer categories' });
    }
  });

  // Search API
  app.get('/api/search', async (req, res) => {
    try {
      const { q, limit = 20, offset = 0 } = req.query;

      if (!q || typeof q !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
      }

      const searchQuery = `%${q.toLowerCase()}%`;
      const limitNum = parseInt(limit);
      const offsetNum = parseInt(offset);

      const studies = await sql`
        SELECT id, title, abstract, authors, journal, publish_date as publishDate, 
               category, doi, image_url as imageUrl, slug
        FROM studies 
        WHERE LOWER(title) LIKE ${searchQuery} OR LOWER(abstract) LIKE ${searchQuery}
        ORDER BY 
          CASE 
            WHEN LOWER(title) LIKE ${searchQuery} THEN 1
            WHEN LOWER(abstract) LIKE ${searchQuery} THEN 2
            ELSE 3
          END,
          publish_date DESC
        LIMIT ${limitNum} OFFSET ${offsetNum}
      `;

      const countResult = await sql`
        SELECT COUNT(*) as total
        FROM studies 
        WHERE LOWER(title) LIKE ${searchQuery} OR LOWER(abstract) LIKE ${searchQuery}
      `;

      return res.json({
        success: true,
        studies: studies,
        total: parseInt(countResult[0].total),
        hasMore: (offsetNum + studies.length) < parseInt(countResult[0].total)
      });
    } catch (error) {
      console.error('Search error:', error);
      return res.status(500).json({
        success: false,
        error: 'Search failed'
      });
    }
  });

  // Consumer categories studies endpoint
  app.get('/api/consumer-categories/studies', async (req, res) => {
    try {
      const { model, category, limit = '20', offset = '0' } = req.query;

      if (!model || !category) {
        return res.status(400).json({ error: 'Model and category are required' });
      }

      let studies;
      const limitNum = parseInt(limit);
      const offsetNum = parseInt(offset);

      if (model === 'condition') {
        studies = await sql`
          SELECT * FROM studies
          WHERE consumer_categories IS NOT NULL
          AND consumer_categories != ''
          AND consumer_categories != 'null'
          AND consumer_categories LIKE ${'%"condition":[%' + category + '%'}
          ORDER BY created_at DESC
          LIMIT ${limitNum} OFFSET ${offsetNum}
        `;
      } else if (model === 'bodySystem') {
        studies = await sql`
          SELECT * FROM studies
          WHERE consumer_categories IS NOT NULL
          AND consumer_categories != ''
          AND consumer_categories != 'null'
          AND consumer_categories LIKE ${'%"bodySystem":[%' + category + '%'}
          ORDER BY created_at DESC
          LIMIT ${limitNum} OFFSET ${offsetNum}
        `;
      } else if (model === 'lifeStage') {
        studies = await sql`
          SELECT * FROM studies
          WHERE consumer_categories IS NOT NULL
          AND consumer_categories != ''
          AND consumer_categories != 'null'
          AND consumer_categories LIKE ${'%"lifeStage":[%' + category + '%'}
          ORDER BY created_at DESC
          LIMIT ${limitNum} OFFSET ${offsetNum}
        `;
      } else {
        return res.status(400).json({ error: 'Invalid model type' });
      }

      res.json(studies);
    } catch (error) {
      console.error('Error fetching consumer category studies:', error);
      res.status(500).json({ error: 'Failed to fetch studies for category' });
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

  // Import route handlers
  const studiesRoutes = await import('./routes/studies-routes');
  const searchRoutes = await import('./routes/simple-search');
  const studyDetailsRoutes = await import('./routes/study-details-routes');

  // API Routes
  app.use('/api', studiesRoutes.default);
  app.use('/api', searchRoutes.default);
  app.use('/api', studyDetailsRoutes.default);

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

  const port = parseInt(process.env.PORT || '3000');
  const server = createServer(app);

  return new Promise((resolve, reject) => {
    const tryPort = (portToTry: number) => {
      server.listen(portToTry, '0.0.0.0', () => {
        const duration = Date.now() - startTime;
        console.log(`✓ Production server running on port ${portToTry} (${duration}ms startup)`);
        resolve({ app, server });
      });

      server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          console.log(`Port ${portToTry} in use, trying ${portToTry + 1}...`);
          server.removeAllListeners('error');
          tryPort(portToTry + 1);
        } else {
          reject(error);
        }
      });
    };

    tryPort(port);
  });
}

// Start production server if this file is run directly
if (process.argv[1] === __filename) {
  createProductionServer().catch(console.error);
}