import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import viteExpress from './vite.js';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Essential middleware only
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Database connection - lazy initialization
let db: any = null;
const getDB = () => {
  if (!db && process.env.DATABASE_URL) {
    const client = neon(process.env.DATABASE_URL);
    db = drizzle(client);
  }
  return db;
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Consumer categories endpoint
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

    const categories = results.rows.map((row: any) => ({
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

// Search endpoints
app.get('/api/search/trending', (req, res) => {
  res.json({ trending: ["hydrogen water", "inflammation", "antioxidant", "brain health"] });
});

app.get('/api/search/enhanced', async (req, res) => {
  try {
    const database = getDB();
    if (!database) {
      return res.json({ studies: [], total: 0 });
    }

    const { q = '', limit = 20, offset = 0 } = req.query;
    const limitInt = Math.min(parseInt(limit as string) || 20, 50);
    const offsetInt = Math.max(parseInt(offset as string) || 0, 0);

    let whereClause = '';
    if (q && typeof q === 'string' && q.trim()) {
      const searchTerm = q.replace(/'/g, "''");
      whereClause = `WHERE title ILIKE '%${searchTerm}%' OR abstract ILIKE '%${searchTerm}%'`;
    }

    const results = await database.execute(sql.raw(`
      SELECT id, title, abstract, authors, journal, category, view_count, slug
      FROM studies
      ${whereClause}
      ORDER BY view_count DESC NULLS LAST, id DESC
      LIMIT ${limitInt} OFFSET ${offsetInt}
    `));

    const studies = results.rows.map((row: any) => ({
      id: row.id,
      title: row.title || 'Untitled Study',
      abstract: row.abstract ? row.abstract.substring(0, 300) + '...' : '',
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

// Study detail endpoints
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
    
    // Non-blocking view count update
    setImmediate(async () => {
      try {
        await database.execute(sql`
          UPDATE studies SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ${studyId}
        `);
      } catch (e) {
        // Silent fail for view count
      }
    });

    res.json({
      id: study.id,
      title: study.title || 'Untitled Study',
      abstract: study.abstract || '',
      authors: study.authors || '',
      journal: study.journal || '',
      publishDate: study.publish_date || study.journal_publish_date,
      category: study.category || 'General',
      viewCount: (study.view_count || 0) + 1,
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

// Start server immediately without heavy initialization
console.log('Starting fast server...');
viteExpress.listen(app, 5000, () => {
  console.log('Fast server running on port 5000');
  console.log('Memory usage:', Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB');
});