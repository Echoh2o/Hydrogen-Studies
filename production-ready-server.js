/**
 * Production-Ready Server with Fixed API Responses
 * Addresses all frontend-backend connectivity issues
 */

import express from 'express';
import { neon } from '@neondatabase/serverless';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/dist')));

// Database connection
const database = neon(process.env.DATABASE_URL);

// Fixed studies endpoint with proper response format
app.get('/api/studies', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const category = req.query.category;
    
    let whereClause = 'WHERE title IS NOT NULL AND abstract IS NOT NULL';
    let queryParams = [];
    
    if (category && category !== 'all') {
      whereClause += ' AND category ILIKE $' + (queryParams.length + 1);
      queryParams.push(`%${category}%`);
    }
    
    const query = `
      SELECT id, title, abstract, authors, journal, publish_date as publishDate, 
             category, image_url as imageUrl, view_count as viewCount, slug, doi, study_type as studyType
      FROM studies 
      ${whereClause}
      ORDER BY id DESC 
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;
    
    queryParams.push(limit, offset);
    
    const result = await database(query, queryParams);
    const studies = result.map(row => ({
      id: row.id,
      title: row.title,
      abstract: row.abstract,
      authors: row.authors,
      journal: row.journal,
      publishDate: row.publishdate,
      category: row.category,
      imageUrl: row.imageurl,
      viewCount: row.view_count || 0,
      slug: row.slug,
      doi: row.doi,
      studyType: row.studytype
    }));

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM studies ${whereClause}`;
    const countParams = queryParams.slice(0, -2); // Remove limit and offset
    const countResult = await database(countQuery, countParams);
    const total = parseInt(countResult[0]?.total || 0);

    // Return properly formatted response for frontend
    res.json({ 
      data: studies, 
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      pageCount: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Studies API error:', error.message);
    res.status(500).json({ error: 'Failed to load studies', data: [], total: 0 });
  }
});

// Fixed categories endpoint
app.get('/api/categories', async (req, res) => {
  try {
    const result = await database(`
      SELECT id, name, description, study_count as studyCount, slug, icon
      FROM categories 
      WHERE study_count > 0 
      ORDER BY study_count DESC
    `);
    
    res.json(result);
  } catch (error) {
    console.error('Categories API error:', error.message);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

// Fixed condition-specific studies endpoint
app.get('/api/studies/condition/:condition', async (req, res) => {
  try {
    const condition = req.params.condition;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const query = `
      SELECT id, title, abstract, authors, journal, publish_date as publishDate, 
             category, image_url as imageUrl, view_count as viewCount, slug, doi, study_type as studyType
      FROM studies 
      WHERE (category ILIKE $1 OR consumer_categories ILIKE $1)
        AND title IS NOT NULL AND abstract IS NOT NULL
      ORDER BY id DESC 
      LIMIT $2 OFFSET $3
    `;
    
    const result = await database(query, [`%${condition}%`, limit, offset]);
    const studies = result.map(row => ({
      id: row.id,
      title: row.title,
      abstract: row.abstract,
      authors: row.authors,
      journal: row.journal,
      publishDate: row.publishdate,
      category: row.category,
      imageUrl: row.imageurl,
      viewCount: row.view_count || 0,
      slug: row.slug,
      doi: row.doi,
      studyType: row.studytype
    }));

    // Get total count for this condition
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM studies 
      WHERE (category ILIKE $1 OR consumer_categories ILIKE $1)
        AND title IS NOT NULL AND abstract IS NOT NULL
    `;
    const countResult = await database(countQuery, [`%${condition}%`]);
    const total = parseInt(countResult[0]?.total || 0);

    res.json({ 
      data: studies, 
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      pageCount: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Condition studies error:', error.message);
    res.status(500).json({ error: 'Failed to load studies for condition', data: [], total: 0 });
  }
});

// Individual study details with proper format
app.get('/api/studies/:id', async (req, res) => {
  try {
    const studyId = parseInt(req.params.id);
    const result = await database(`
      SELECT * FROM studies WHERE id = $1
    `, [studyId]);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }
    
    const study = result[0];
    res.json({
      id: study.id,
      title: study.title,
      abstract: study.abstract,
      authors: study.authors,
      journal: study.journal,
      publishDate: study.publish_date,
      doi: study.doi,
      category: study.category,
      methods: study.methods,
      results: study.results,
      conclusion: study.conclusion,
      keywords: study.keywords || [],
      imageUrl: study.image_url,
      viewCount: study.view_count || 0
    });
  } catch (error) {
    console.error('Study details error:', error.message);
    res.status(500).json({ error: 'Failed to load study details' });
  }
});

// Recent studies for homepage
app.get('/api/recent-studies', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    
    const query = `
      SELECT id, title, abstract, authors, journal, publish_date as publishDate, 
             category, image_url as imageUrl, slug, 
             EXTRACT(YEAR FROM publish_date::date)::int as year
      FROM studies 
      WHERE title IS NOT NULL AND abstract IS NOT NULL
      ORDER BY id DESC 
      LIMIT $1
    `;
    
    const result = await database(query, [limit]);
    const studies = result.map(row => ({
      id: row.id,
      title: row.title,
      abstract: row.abstract,
      authors: row.authors,
      journal: row.journal,
      publishDate: row.publishdate,
      category: row.category,
      imageUrl: row.imageurl,
      slug: row.slug,
      year: row.year
    }));
    
    res.json(studies);
  } catch (error) {
    console.error('Recent studies error:', error.message);
    res.status(500).json({ message: 'Failed to fetch recent studies' });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

// Start server with port fallback
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Production server running on port ${PORT} with fixed API responses`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} in use, trying ${PORT + 1}`);
    app.listen(PORT + 1, '0.0.0.0', () => {
      console.log(`Production server running on port ${PORT + 1} with fixed API responses`);
    });
  } else {
    console.error('Server error:', err);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

export default app;