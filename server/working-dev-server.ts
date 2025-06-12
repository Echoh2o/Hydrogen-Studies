/**
 * Working Development Server
 * Combines API endpoints with proper React app serving
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { neon } from '@neondatabase/serverless';
import { setupVite } from './vite.js';

const app = express();

// CORS and middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database connection
const sql = neon(process.env.DATABASE_URL!);

// Working API endpoints
app.get('/api/studies', async (req, res) => {
  try {
    const search = String(req.query.search || '');
    const category = String(req.query.category || '');
    const limit = Math.min(100, parseInt(String(req.query.limit || '50')));
    const offset = Math.max(0, parseInt(String(req.query.offset || '0')));

    let studies;
    if (search && category) {
      studies = await sql`
        SELECT * FROM studies 
        WHERE (title ILIKE ${'%' + search + '%'} OR abstract ILIKE ${'%' + search + '%'})
        AND category = ${category}
        ORDER BY id DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (search) {
      studies = await sql`
        SELECT * FROM studies 
        WHERE title ILIKE ${'%' + search + '%'} OR abstract ILIKE ${'%' + search + '%'}
        ORDER BY id DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (category) {
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

app.get('/api/search', async (req, res) => {
  try {
    const query = String(req.query.q || '');
    const limit = Math.min(50, parseInt(String(req.query.limit || '20')));
    const offset = Math.max(0, parseInt(String(req.query.offset || '0')));

    if (!query.trim()) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const studies = await sql`
      SELECT id, title, abstract, authors, journal, publish_date, category, doi, image_url, slug
      FROM studies 
      WHERE LOWER(title) LIKE ${'%' + query.toLowerCase() + '%'} 
      OR LOWER(abstract) LIKE ${'%' + query.toLowerCase() + '%'}
      ORDER BY 
        CASE 
          WHEN LOWER(title) LIKE ${'%' + query.toLowerCase() + '%'} THEN 1
          ELSE 2
        END,
        id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const totalResult = await sql`
      SELECT COUNT(*) as total
      FROM studies 
      WHERE LOWER(title) LIKE ${'%' + query.toLowerCase() + '%'} 
      OR LOWER(abstract) LIKE ${'%' + query.toLowerCase() + '%'}
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

app.get('/api/studies/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const study = await sql`SELECT * FROM studies WHERE id = ${id}`;
    
    if (study.length === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }
    
    res.json(study[0]);
  } catch (error) {
    console.error('Study by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch study' });
  }
});

app.get('/health', async (req, res) => {
  try {
    await sql`SELECT 1`;
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      error: 'Database connection failed',
      timestamp: new Date().toISOString() 
    });
  }
});

// Start server
const PORT = parseInt(process.env.PORT || '5000');
const server = createServer(app);

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  
  // Set up Vite middleware for React app
  await setupVite(app, server);
  console.log('React app ready');
});

server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} in use, trying ${PORT + 1}...`);
    const nextPort = PORT + 1;
    server.listen(nextPort, '0.0.0.0', async () => {
      console.log(`Server running on port ${nextPort}`);
      await setupVite(app, server);
      console.log('React app ready');
    });
  } else {
    console.error('Server error:', error);
  }
});