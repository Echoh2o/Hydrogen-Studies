/**
 * Simplified Production Server
 * Handles static files, essential API routes, and SPA routing for deployment
 */

import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
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

  // Static file serving
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  
  // Serve built assets from dist
  app.use('/assets', express.static(path.join(process.cwd(), 'dist', 'assets')));
  
  // Serve static files from public
  app.use(express.static(path.join(process.cwd(), 'public')));
  
  // Serve built files from dist as fallback
  app.use(express.static(path.join(process.cwd(), 'dist')));

  // Essential API endpoints for production

  // Health check
  app.get('/health', async (req, res) => {
    try {
      const start = Date.now();
      await sql('SELECT 1');
      const dbLatency = Date.now() - start;

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: { latency: `${dbLatency}ms` },
        environment: 'production'
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: 'Database connection failed'
      });
    }
  });

  // Studies API
  app.get('/api/studies', async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 12, 50);
      const offset = (page - 1) * limit;

      const result = await sql`
        SELECT id, title, abstract, consumer_categories as category, image_url, journal_publish_date as publication_date, 
               authors, journal, doi, array_to_string(keywords, ', ') as keywords, slug
        FROM studies 
        ORDER BY id 
        LIMIT ${limit} OFFSET ${offset}`;

      const countResult = await sql`SELECT COUNT(*) as count FROM studies`;

      res.json({
        studies: (result as any).rows || [],
        total: (countResult as any).rows?.[0]?.count || 0,
        page,
        limit,
        totalPages: Math.ceil(((countResult as any).rows?.[0]?.count || 0) / limit)
      });
    } catch (error) {
      console.error('Studies API error:', error);
      res.status(500).json({ error: 'Failed to fetch studies' });
    }
  });

  // Single study API
  app.get('/api/studies/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      const result = await sql`SELECT * FROM studies WHERE id = ${id}`;

      const study = (result as any).rows?.[0];

      if (!study) {
        return res.status(404).json({ error: 'Study not found' });
      }

      res.json(study);
    } catch (error) {
      console.error('Study API error:', error);
      res.status(500).json({ error: 'Failed to fetch study' });
    }
  });

  // Search API
  app.get('/api/search', async (req, res) => {
    try {
      const query = req.query.q as string || '';
      const category = req.query.category as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 12, 50);
      const offset = (page - 1) * limit;

      // Query logic is handled in the next section with proper SQL calls

      let result, countResult;

      if (query && category) {
        result = await sql(`
          SELECT id, title, abstract, category, image_url, publication_date,
                 authors, journal, doi, health_conditions, delivery_method
          FROM studies 
          WHERE (title ILIKE $1 OR abstract ILIKE $1) AND category = $2
          ORDER BY id 
          LIMIT $3 OFFSET $4
        `, [`%${query}%`, category, limit, offset]);

        countResult = await sql(`
          SELECT COUNT(*) as count FROM studies 
          WHERE (title ILIKE $1 OR abstract ILIKE $1) AND category = $2
        `, [`%${query}%`, category]);
      } else if (query) {
        result = await sql(`
          SELECT id, title, abstract, category, image_url, publication_date,
                 authors, journal, doi, health_conditions, delivery_method
          FROM studies 
          WHERE title ILIKE $1 OR abstract ILIKE $1
          ORDER BY id 
          LIMIT $2 OFFSET $3
        `, [`%${query}%`, limit, offset]);

        countResult = await sql(`
          SELECT COUNT(*) as count FROM studies 
          WHERE title ILIKE $1 OR abstract ILIKE $1
        `, [`%${query}%`]);
      } else if (category) {
        result = await sql(`
          SELECT id, title, abstract, category, image_url, publication_date,
                 authors, journal, doi, health_conditions, delivery_method
          FROM studies 
          WHERE category = $1
          ORDER BY id 
          LIMIT $2 OFFSET $3
        `, [category, limit, offset]);

        countResult = await sql('SELECT COUNT(*) as count FROM studies WHERE category = $1', [category]);
      } else {
        result = await sql(`
          SELECT id, title, abstract, category, image_url, publication_date,
                 authors, journal, doi, health_conditions, delivery_method
          FROM studies 
          ORDER BY id 
          LIMIT $1 OFFSET $2
        `, [limit, offset]);

        countResult = await sql('SELECT COUNT(*) as count FROM studies');
      }

      res.json({
        studies: (result as any).rows || [],
        total: (countResult as any).rows?.[0]?.count || 0,
        page,
        limit,
        query,
        category
      });
    } catch (error) {
      console.error('Search API error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // Categories API
  app.get('/api/categories', async (req, res) => {
    try {
      const result = await sql(`
        SELECT category, COUNT(*) as count 
        FROM studies 
        WHERE category IS NOT NULL 
        GROUP BY category 
        ORDER BY count DESC
      `);

      res.json((result as any).rows || []);
    } catch (error) {
      console.error('Categories API error:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
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
    if (require('fs').existsSync(distIndexPath)) {
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