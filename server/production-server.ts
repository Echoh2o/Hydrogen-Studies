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
        benefit = '',
        condition = '',
        limit = '50',
        offset = '0'
      } = req.query;

      const studies = await sql`
        SELECT s.*, 
               array_agg(DISTINCT sc.category) FILTER (WHERE sc.category IS NOT NULL) as categories,
               array_agg(DISTINCT sb.benefit) FILTER (WHERE sb.benefit IS NOT NULL) as benefits
        FROM studies s
        LEFT JOIN study_categories sc ON s.id = sc.study_id
        LEFT JOIN study_benefits sb ON s.id = sb.study_id
        WHERE (${search} = '' OR s.title ILIKE ${'%' + search + '%'} OR s.plain_language_summary ILIKE ${'%' + search + '%'})
          AND (${category} = '' OR sc.category = ${category})
          AND (${benefit} = '' OR sb.benefit = ${benefit})
          AND (${condition} = '' OR s.condition ILIKE ${'%' + condition + '%'})
        GROUP BY s.id
        ORDER BY s.created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
      
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
        FROM study_categories
        GROUP BY category
        ORDER BY count DESC
      `;
      res.json(categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // Consumer categories API
  app.get('/api/consumer-categories/counts', async (req, res) => {
    try {
      const results = await sql`
        SELECT 
          'body_systems' as type,
          body_system as name,
          COUNT(*) as count
        FROM studies 
        WHERE body_system IS NOT NULL 
        GROUP BY body_system
        
        UNION ALL
        
        SELECT 
          'conditions' as type,
          condition as name,
          COUNT(*) as count
        FROM studies 
        WHERE condition IS NOT NULL 
        GROUP BY condition
        
        UNION ALL
        
        SELECT 
          'life_stages' as type,
          life_stage as name,
          COUNT(*) as count
        FROM studies 
        WHERE life_stage IS NOT NULL 
        GROUP BY life_stage
        
        ORDER BY count DESC
      `;
      
      const categorized = {
        body_systems: results.filter(r => r.type === 'body_systems'),
        conditions: results.filter(r => r.type === 'conditions'),
        life_stages: results.filter(r => r.type === 'life_stages')
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
      
      let whereClause = `WHERE 1=1`;
      const params = [];
      
      if (q) {
        whereClause += ` AND (s.title ILIKE $${params.length + 1} OR s.plain_language_summary ILIKE $${params.length + 1})`;
        params.push(`%${q}%`);
      }
      
      if (parsedFilters.category) {
        whereClause += ` AND sc.category = $${params.length + 1}`;
        params.push(parsedFilters.category);
      }
      
      const studies = await sql`
        SELECT s.*, 
               array_agg(DISTINCT sc.category) FILTER (WHERE sc.category IS NOT NULL) as categories
        FROM studies s
        LEFT JOIN study_categories sc ON s.id = sc.study_id
        ${sql.unsafe(whereClause)}
        GROUP BY s.id
        ORDER BY s.created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
      
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