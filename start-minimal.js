#!/usr/bin/env node

import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = parseInt(process.env.PORT) || 5000;

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Static files
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Database - lazy initialization
let db = null;
const getDB = () => {
  if (!db && process.env.DATABASE_URL) {
    const client = neon(process.env.DATABASE_URL);
    db = drizzle(client);
  }
  return db;
};

// Essential endpoints only
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/consumer-categories/counts', async (req, res) => {
  try {
    const database = getDB();
    if (!database) {
      return res.json({ success: false, data: {} });
    }

    const results = await database.execute(sql`
      SELECT name, study_count as count 
      FROM categories 
      WHERE study_count > 0 
      ORDER BY study_count DESC 
      LIMIT 12
    `);

    const categories = results.rows.map(row => ({
      name: row.name,
      count: row.count
    }));

    res.json({ 
      success: true,
      data: {
        condition: categories.slice(0, 4),
        body_system: categories.slice(4, 8),
        life_stage: categories.slice(8, 12)
      }
    });
  } catch (error) {
    console.error('Categories error:', error);
    res.json({ success: false, data: {} });
  }
});

app.get('/api/search/trending', (req, res) => {
  res.json({ trending: ["hydrogen water", "inflammation", "antioxidant"] });
});

app.get('/api/search/enhanced', async (req, res) => {
  try {
    const database = getDB();
    if (!database) {
      return res.json({ studies: [], total: 0 });
    }

    const { q = '', limit = 20 } = req.query;
    const limitInt = Math.min(parseInt(limit) || 20, 50);

    let whereClause = '';
    if (q && q.trim()) {
      const searchTerm = q.replace(/'/g, "''");
      whereClause = `WHERE title ILIKE '%${searchTerm}%'`;
    }

    const results = await database.execute(sql.raw(`
      SELECT id, title, abstract, authors, journal, category, view_count, slug
      FROM studies
      ${whereClause}
      ORDER BY view_count DESC NULLS LAST
      LIMIT ${limitInt}
    `));

    const studies = results.rows.map(row => ({
      id: row.id,
      title: row.title || 'Untitled Study',
      abstract: row.abstract || '',
      authors: row.authors || '',
      journal: row.journal || '',
      category: row.category || 'General',
      viewCount: row.view_count || 0,
      slug: row.slug
    }));

    res.json({ studies, total: studies.length });
  } catch (error) {
    console.error('Search error:', error);
    res.json({ studies: [], total: 0 });
  }
});

app.get('/api/studies/:id', async (req, res) => {
  try {
    const database = getDB();
    if (!database) {
      return res.status(500).json({ error: 'Database unavailable' });
    }

    const studyId = parseInt(req.params.id);
    if (!studyId) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const results = await database.execute(sql`
      SELECT * FROM studies WHERE id = ${studyId} LIMIT 1
    `);

    if (results.rows.length === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }

    const study = results.rows[0];
    res.json({
      id: study.id,
      title: study.title || 'Untitled Study',
      abstract: study.abstract || '',
      authors: study.authors || '',
      journal: study.journal || '',
      publishDate: study.publish_date || study.journal_publish_date,
      category: study.category || 'General',
      viewCount: study.view_count || 0,
      slug: study.slug,
      doi: study.doi,
      methods: study.methods,
      results: study.results,
      conclusion: study.conclusion
    });
  } catch (error) {
    console.error('Study detail error:', error);
    res.status(500).json({ error: 'Failed to load study' });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  const indexPath = join(distPath, 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('App not built');
  }
});

// Start server with error handling
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Minimal server running on port ${port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} in use`);
    process.exit(1);
  }
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());