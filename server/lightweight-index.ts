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

// Essential middleware only
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Static file serving
const distPath = join(__dirname, '../dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath, { maxAge: '1h' }));
}

// Database setup - no heavy operations on startup
let db: any = null;
const initDB = () => {
  if (!db && process.env.DATABASE_URL) {
    try {
      const client = neon(process.env.DATABASE_URL);
      db = drizzle(client);
    } catch (error) {
      console.error('DB init error:', error);
    }
  }
  return db;
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Consumer categories - simplified
app.get('/api/consumer-categories/counts', async (req, res) => {
  try {
    const database = initDB();
    if (!database) {
      return res.json({ success: false, data: {} });
    }

    const results = await database.execute(sql`
      SELECT name, study_count as count 
      FROM categories 
      WHERE study_count > 0 
      ORDER BY study_count DESC 
      LIMIT 15
    `);

    const categories = results.rows.map((row: any) => ({
      name: row.name,
      count: row.count
    }));

    res.json({ 
      success: true,
      data: {
        condition: categories.slice(0, 6),
        body_system: categories.slice(6, 12),
        life_stage: categories.slice(12, 15)
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
    const database = initDB();
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
    const database = initDB();
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

// SPA fallback
app.get('*', (req, res) => {
  const indexPath = join(distPath, 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'App not built' });
  }
});

// Error handling
app.use((error: any, req: any, res: any, next: any) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal error' });
});

// Graceful startup and shutdown
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});

server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} in use, trying ${port + 1}`);
    setTimeout(() => {
      server.listen(port + 1, '0.0.0.0');
    }, 1000);
  }
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});

export default app;