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
      console.log('Fetching consumer categories...');
      
      // Get basic category counts from studies table
      const categoryResults = await sql`
        SELECT category, COUNT(*) as count
        FROM studies
        WHERE category IS NOT NULL
        GROUP BY category
        ORDER BY count DESC
      `;

      console.log(`Found ${categoryResults.length} basic categories`);

      // Try to get consumer categories from JSON field
      let consumerCategoriesResults = [];
      try {
        consumerCategoriesResults = await sql`
          SELECT consumer_categories, COUNT(*) as count
          FROM studies
          WHERE consumer_categories IS NOT NULL AND consumer_categories != ''
          GROUP BY consumer_categories
        `;
        console.log(`Found ${consumerCategoriesResults.length} consumer category entries`);
      } catch (e) {
        console.warn('Consumer categories field not available, using basic categories');
      }

      // Process the consumer categories JSON
      const conditionsMap = new Map();
      const bodySystemsMap = new Map();
      const lifeStagesMap = new Map();

      consumerCategoriesResults.forEach(row => {
        try {
          const categories = JSON.parse(row.consumer_categories);
          const count = parseInt(row.count);

          if (categories.condition && Array.isArray(categories.condition)) {
            categories.condition.forEach(cond => {
              conditionsMap.set(cond, (conditionsMap.get(cond) || 0) + count);
            });
          }

          if (categories.bodySystem && Array.isArray(categories.bodySystem)) {
            categories.bodySystem.forEach(bs => {
              bodySystemsMap.set(bs, (bodySystemsMap.get(bs) || 0) + count);
            });
          }

          if (categories.lifeStage && Array.isArray(categories.lifeStage)) {
            categories.lifeStage.forEach(ls => {
              lifeStagesMap.set(ls, (lifeStagesMap.get(ls) || 0) + count);
            });
          }
        } catch (e) {
          console.warn('Failed to parse consumer categories JSON:', e.message);
        }
      });

      // If no consumer categories found, create some from basic categories
      if (conditionsMap.size === 0) {
        console.log('No consumer categories found, creating from basic categories');
        categoryResults.forEach(cat => {
          const categoryName = cat.category;
          const count = parseInt(cat.count);
          
          // Map basic categories to conditions
          if (categoryName.toLowerCase().includes('brain') || categoryName.toLowerCase().includes('neuro')) {
            conditionsMap.set('Neurological', (conditionsMap.get('Neurological') || 0) + count);
          } else if (categoryName.toLowerCase().includes('heart') || categoryName.toLowerCase().includes('cardio')) {
            conditionsMap.set('Cardiovascular', (conditionsMap.get('Cardiovascular') || 0) + count);
          } else if (categoryName.toLowerCase().includes('lung') || categoryName.toLowerCase().includes('respiratory')) {
            conditionsMap.set('Respiratory', (conditionsMap.get('Respiratory') || 0) + count);
          } else if (categoryName.toLowerCase().includes('metabolic') || categoryName.toLowerCase().includes('diabetes')) {
            conditionsMap.set('Metabolic', (conditionsMap.get('Metabolic') || 0) + count);
          } else if (categoryName.toLowerCase().includes('inflammation')) {
            conditionsMap.set('Inflammation', (conditionsMap.get('Inflammation') || 0) + count);
          } else {
            conditionsMap.set(categoryName, count);
          }
        });
      }

      const response = {
        data: {
          condition: Array.from(conditionsMap.entries())
            .map(([name, count]) => ({ name, count: count.toString() }))
            .sort((a, b) => parseInt(b.count) - parseInt(a.count)),
          bodySystem: Array.from(bodySystemsMap.entries())
            .map(([name, count]) => ({ name, count: count.toString() }))
            .sort((a, b) => parseInt(b.count) - parseInt(a.count)),
          lifeStage: Array.from(lifeStagesMap.entries())
            .map(([name, count]) => ({ name, count: count.toString() }))
            .sort((a, b) => parseInt(b.count) - parseInt(a.count))
        }
      };

      console.log(`Returning ${response.data.condition.length} conditions, ${response.data.bodySystem.length} body systems, ${response.data.lifeStage.length} life stages`);
      
      res.json(response);
    } catch (error) {
      console.error('Error fetching consumer categories:', error);
      res.status(500).json({ error: 'Failed to fetch consumer categories', details: error.message });
    }
  });

  // Search API
  app.get('/api/search', async (req, res) => {
    try {
      const { q = '', filters = '{}', limit = '20', offset = '0' } = req.query;
      
      if (!q || q.trim() === '') {
        return res.json({ studies: [], total: 0 });
      }

      const searchTerm = q.trim();
      console.log(`Search request for: "${searchTerm}"`);

      const studies = await sql`
        SELECT * FROM studies
        WHERE title ILIKE ${'%' + searchTerm + '%'} 
           OR abstract ILIKE ${'%' + searchTerm + '%'}
        ORDER BY created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;

      console.log(`Found ${studies.length} studies for search "${searchTerm}"`);

      res.json({ 
        studies, 
        total: studies.length,
        query: searchTerm 
      });
    } catch (error) {
      console.error('Error in search:', error);
      res.status(500).json({ error: 'Search failed', details: error.message });
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