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
const port = 5001; // Use different port

// Set production environment
process.env.NODE_ENV = 'production';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files from dist directory
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  console.log(`✅ Serving static files from: ${distPath}`);
} else {
  console.error(`❌ Build directory not found: ${distPath}`);
}

// Database connection
const connectionString = process.env.DATABASE_URL;
let db;

if (connectionString) {
  const dbClient = neon(connectionString);
  db = drizzle(dbClient);
  console.log('✅ Database connection established');
} else {
  console.warn('⚠️ No DATABASE_URL found, using fallback routes');
}

// Consumer categories endpoint - simplified
app.get('/api/consumer-categories/counts', async (req, res) => {
  try {
    if (!db) return res.json({ success: false, data: {} });
    
    const results = await db.execute(sql`
      SELECT 
        c.id,
        c.name,
        c.description,
        c.icon,
        'default' as color,
        c.study_count as count
      FROM categories c
      WHERE c.study_count > 0
      ORDER BY c.study_count DESC
    `);
    
    // Organize by category type
    const data = {
      condition: results.rows.slice(0, 8).map(row => ({
        name: row.name,
        count: row.count
      })),
      body_system: results.rows.slice(8, 16).map(row => ({
        name: row.name,
        count: row.count
      })),
      life_stage: results.rows.slice(16, 20).map(row => ({
        name: row.name,
        count: row.count
      }))
    };
    
    console.log('Categories response:', JSON.stringify(data, null, 2));
    res.json({ success: true, data });
  } catch (error) {
    console.error('Consumer categories error:', error);
    res.json({ success: false, data: {} });
  }
});

// Search trending endpoint
app.get('/api/search/trending', (req, res) => {
  res.json({ trending: ["hydrogen water", "antioxidant", "inflammation", "brain health"] });
});

// Enhanced search endpoint - minimal
app.get('/api/search/enhanced', async (req, res) => {
  try {
    if (!db) return res.json({ studies: [], total: 0 });
    
    const { limit = 6 } = req.query;
    const limitInt = Math.min(parseInt(limit) || 6, 100);

    const results = await db.execute(sql.raw(`
      SELECT 
        id, title, abstract, authors, journal, 
        publish_date, journal_publish_date, category,
        consumer_categories, image_url, image_alt,
        view_count, slug
      FROM studies
      WHERE title IS NOT NULL AND title != ''
      ORDER BY view_count DESC, id DESC
      LIMIT ${limitInt}
    `));

    const studies = results.rows.map((row) => ({
      id: row.id,
      title: row.title || 'Untitled Study',
      abstract: row.abstract || '',
      authors: row.authors || '',
      journal: row.journal || '',
      publishDate: row.publish_date || row.journal_publish_date,
      category: row.category || 'General',
      consumerCategories: row.consumer_categories,
      imageUrl: row.image_url,
      imageAlt: row.image_alt,
      viewCount: row.view_count || 0,
      slug: row.slug
    }));

    res.json({
      studies,
      total: studies.length,
      facets: { tags: [], journals: [], years: [] },
      suggestions: [],
      trending: []
    });
  } catch (error) {
    console.error('Enhanced search error:', error);
    res.status(500).json({ 
      error: 'Search failed',
      studies: [],
      total: 0
    });
  }
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  const indexPath = join(distPath, 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ 
      error: 'Application not built. Run npm run build first.',
      path: indexPath,
      exists: existsSync(indexPath)
    });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Test server running on port ${port}`);
  console.log(`📁 Static files: ${distPath}`);
});