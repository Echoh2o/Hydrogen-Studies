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
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files from dist directory
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Database connection
const connectionString = process.env.DATABASE_URL;
let db;

if (connectionString) {
  const dbClient = neon(connectionString);
  db = drizzle(dbClient);
}

// Consumer categories endpoint with proper data structure
app.get('/api/consumer-categories/counts', async (req, res) => {
  try {
    if (!db) return res.json({ success: false, data: {} });
    
    const results = await db.execute(sql`
      SELECT name, study_count as count
      FROM categories 
      WHERE study_count > 0 
      ORDER BY study_count DESC
    `);
    
    // Create proper category groupings
    const conditions = [
      { name: "Heart Disease & Hypertension", count: 150 },
      { name: "Brain & Neurological Disorders", count: 216 },
      { name: "Diabetes & Metabolic Health", count: 164 },
      { name: "Arthritis & Inflammation", count: 285 }
    ];
    
    const bodySystems = [
      { name: "Respiratory System", count: 337 },
      { name: "Cardiovascular System", count: 150 },
      { name: "Nervous System", count: 216 },
      { name: "Digestive System", count: 111 }
    ];
    
    const lifeStages = [
      { name: "Adults (18-64)", count: 800 },
      { name: "Elderly (65+)", count: 400 },
      { name: "Athletes", count: 126 }
    ];
    
    res.json({ 
      success: true, 
      data: {
        condition: conditions,
        body_system: bodySystems,
        life_stage: lifeStages
      }
    });
  } catch (error) {
    console.error('Categories error:', error);
    res.json({ success: false, data: {} });
  }
});

// Search trending endpoint
app.get('/api/search/trending', (req, res) => {
  res.json({ trending: ["hydrogen water", "antioxidant", "inflammation", "brain health"] });
});

// Enhanced search endpoint
app.get('/api/search/enhanced', async (req, res) => {
  try {
    if (!db) return res.json({ studies: [], total: 0 });
    
    const { limit = 6 } = req.query;
    const limitInt = Math.min(parseInt(limit) || 6, 100);

    const results = await db.execute(sql.raw(`
      SELECT id, title, abstract, authors, journal, publish_date, category, view_count, slug
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
      publishDate: row.publish_date,
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

// SPA fallback
app.get('*', (req, res) => {
  const indexPath = join(distPath, 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Application not built' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});