/**
 * Simple Development Server for React App
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// CORS and middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database connection
const sql = neon(process.env.DATABASE_URL!);

// API Routes
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

// Advanced search endpoint
app.get('/api/advanced-search', async (req, res) => {
  try {
    const search = String(req.query.search || '');
    const category = String(req.query.category || '');
    const country = String(req.query.country || '');
    const limit = Math.min(50, parseInt(String(req.query.limit || '20')));
    const offset = Math.max(0, parseInt(String(req.query.offset || '0')));

    let studies;
    let countResult;
    
    if (search && category) {
      studies = await sql`
        SELECT id, title, abstract, authors, journal, publish_year, category, 
               country, study_type, sample_size, citation_count, peer_reviewed,
               has_full_text, image_url, doi, plain_language_title
        FROM studies 
        WHERE (title ILIKE ${'%' + search + '%'} OR abstract ILIKE ${'%' + search + '%'})
        AND category = ${category}
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      countResult = await sql`
        SELECT COUNT(*) as total FROM studies 
        WHERE (title ILIKE ${'%' + search + '%'} OR abstract ILIKE ${'%' + search + '%'})
        AND category = ${category}
      `;
    } else if (search) {
      studies = await sql`
        SELECT id, title, abstract, authors, journal, publish_year, category, 
               country, study_type, sample_size, citation_count, peer_reviewed,
               has_full_text, image_url, doi, plain_language_title
        FROM studies 
        WHERE title ILIKE ${'%' + search + '%'} OR abstract ILIKE ${'%' + search + '%'}
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      countResult = await sql`
        SELECT COUNT(*) as total FROM studies 
        WHERE title ILIKE ${'%' + search + '%'} OR abstract ILIKE ${'%' + search + '%'}
      `;
    } else if (category) {
      studies = await sql`
        SELECT id, title, abstract, authors, journal, publish_year, category, 
               country, study_type, sample_size, citation_count, peer_reviewed,
               has_full_text, image_url, doi, plain_language_title
        FROM studies 
        WHERE category = ${category}
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      countResult = await sql`SELECT COUNT(*) as total FROM studies WHERE category = ${category}`;
    } else if (country) {
      studies = await sql`
        SELECT id, title, abstract, authors, journal, publish_year, category, 
               country, study_type, sample_size, citation_count, peer_reviewed,
               has_full_text, image_url, doi, plain_language_title
        FROM studies 
        WHERE country = ${country}
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      countResult = await sql`SELECT COUNT(*) as total FROM studies WHERE country = ${country}`;
    } else {
      studies = await sql`
        SELECT id, title, abstract, authors, journal, publish_year, category, 
               country, study_type, sample_size, citation_count, peer_reviewed,
               has_full_text, image_url, doi, plain_language_title
        FROM studies 
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      countResult = await sql`SELECT COUNT(*) as total FROM studies`;
    }
    
    const total = parseInt(countResult[0]?.total || '0');
    
    res.json({
      studies,
      total,
      hasMore: (offset + studies.length) < total,
      filters: { search, category, country }
    });
    
  } catch (error) {
    console.error('Advanced search error:', error);
    res.status(500).json({ error: 'Advanced search failed' });
  }
});

app.get('/health', async (req, res) => {
  try {
    await sql`SELECT 1`;
    res.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ status: 'unhealthy', database: 'disconnected' });
  }
});

// Start with Vite dev server in dev mode
if (process.env.NODE_ENV === 'development') {
  // Import and start Vite dev server
  import('vite').then(({ createServer }) => {
    createServer({
      server: { 
        port: 3000,
        proxy: {
          '/api': {
            target: 'http://localhost:5000',
            changeOrigin: true
          }
        }
      }
    }).then(viteServer => {
      viteServer.listen();
      console.log('Vite dev server running on http://localhost:3000');
    });
  });
}

const PORT = parseInt(process.env.PORT || '5000');

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  if (process.env.NODE_ENV === 'development') {
    console.log('Visit http://localhost:3000 for the React app');
  }
});