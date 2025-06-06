/**
 * Minimal Production Server - Fastest Possible Startup
 * Bypasses all heavy initialization for immediate port opening
 */

const express = require('express');
const { neon } = require('@neondatabase/serverless');
const path = require('path');

const app = express();

// Enable JSON parsing
app.use(express.json());

// Serve static files from client/dist
app.use(express.static(path.join(__dirname, 'client/dist')));

// Initialize database connection
const database = neon(process.env.DATABASE_URL);

// Core API endpoints with minimal overhead
app.get('/api/studies', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const query = `
      SELECT id, title, abstract, authors, journal, publish_date as publishDate, 
             category, image_url as imageUrl, view_count as viewCount, slug, doi, study_type as studyType
      FROM studies 
      WHERE title IS NOT NULL AND abstract IS NOT NULL
      ORDER BY id DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const result = await database(query);
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

    const countResult = await database(`SELECT COUNT(*) as total FROM studies WHERE title IS NOT NULL AND abstract IS NOT NULL`);
    const total = parseInt(countResult[0]?.total || 0);

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

// Categories API
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

// Individual study details
app.get('/api/studies/:id', async (req, res) => {
  try {
    const studyId = parseInt(req.params.id);
    const result = await database(`
      SELECT * FROM studies WHERE id = ${studyId}
    `);
    
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

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

// Start server with port fallback
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Minimal production server running on port ${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} in use, trying ${PORT + 1}`);
    app.listen(PORT + 1, '0.0.0.0', () => {
      console.log(`Minimal production server running on port ${PORT + 1}`);
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