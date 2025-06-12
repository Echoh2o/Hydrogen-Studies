/**
 * Working Development Server
 * Serves API endpoints and static React app
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// Advanced filtering endpoints
app.get('/api/filters/years', async (req, res) => {
  try {
    const years = await sql`
      SELECT publish_year, COUNT(*) as count
      FROM studies
      WHERE publish_year IS NOT NULL
      GROUP BY publish_year
      ORDER BY publish_year DESC
    `;
    res.json(years);
  } catch (error) {
    console.error('Years filter error:', error);
    res.status(500).json({ error: 'Failed to fetch years' });
  }
});

app.get('/api/filters/countries', async (req, res) => {
  try {
    const countries = await sql`
      SELECT country, COUNT(*) as count
      FROM studies
      WHERE country IS NOT NULL AND country != ''
      GROUP BY country
      ORDER BY count DESC
      LIMIT 20
    `;
    res.json(countries);
  } catch (error) {
    console.error('Countries filter error:', error);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

app.get('/api/filters/study-types', async (req, res) => {
  try {
    const studyTypes = await sql`
      SELECT study_type, COUNT(*) as count
      FROM studies
      WHERE study_type IS NOT NULL AND study_type != ''
      GROUP BY study_type
      ORDER BY count DESC
    `;
    res.json(studyTypes);
  } catch (error) {
    console.error('Study types filter error:', error);
    res.status(500).json({ error: 'Failed to fetch study types' });
  }
});

app.get('/api/filters/journals', async (req, res) => {
  try {
    const journals = await sql`
      SELECT journal, COUNT(*) as count
      FROM studies
      WHERE journal IS NOT NULL AND journal != ''
      GROUP BY journal
      ORDER BY count DESC
      LIMIT 30
    `;
    res.json(journals);
  } catch (error) {
    console.error('Journals filter error:', error);
    res.status(500).json({ error: 'Failed to fetch journals' });
  }
});

// Advanced search with multiple filters
app.get('/api/advanced-search', async (req, res) => {
  try {
    const {
      search = '',
      category = '',
      year_from = '',
      year_to = '',
      country = '',
      study_type = '',
      journal = '',
      peer_reviewed = '',
      has_full_text = '',
      min_sample_size = '',
      sort_by = 'id',
      sort_order = 'DESC',
      limit = '20',
      offset = '0'
    } = req.query;

    let conditions = [];
    let params = [];
    
    // Text search
    if (search) {
      conditions.push(`(title ILIKE $${params.length + 1} OR abstract ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    
    // Category filter
    if (category) {
      conditions.push(`category = $${params.length + 1}`);
      params.push(category);
    }
    
    // Year range
    if (year_from) {
      conditions.push(`publish_year >= $${params.length + 1}`);
      params.push(parseInt(year_from));
    }
    if (year_to) {
      conditions.push(`publish_year <= $${params.length + 1}`);
      params.push(parseInt(year_to));
    }
    
    // Country filter
    if (country) {
      conditions.push(`country = $${params.length + 1}`);
      params.push(country);
    }
    
    // Study type filter
    if (study_type) {
      conditions.push(`study_type = $${params.length + 1}`);
      params.push(study_type);
    }
    
    // Journal filter
    if (journal) {
      conditions.push(`journal = $${params.length + 1}`);
      params.push(journal);
    }
    
    // Peer reviewed filter
    if (peer_reviewed === 'true') {
      conditions.push(`peer_reviewed = true`);
    } else if (peer_reviewed === 'false') {
      conditions.push(`peer_reviewed = false`);
    }
    
    // Has full text filter
    if (has_full_text === 'true') {
      conditions.push(`has_full_text = true`);
    }
    
    // Sample size filter
    if (min_sample_size) {
      conditions.push(`sample_size >= $${params.length + 1}`);
      params.push(parseInt(min_sample_size));
    }
    
    // Build WHERE clause
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Validate sort options
    const validSortColumns = ['id', 'publish_year', 'citation_count', 'sample_size', 'title'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'id';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // Build and execute query
    const queryText = `
      SELECT id, title, abstract, authors, journal, publish_year, category, 
             country, study_type, sample_size, citation_count, peer_reviewed,
             has_full_text, image_url, doi, plain_language_title
      FROM studies 
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    
    params.push(parseInt(limit), parseInt(offset));
    
    const studies = await sql.unsafe(queryText, params);
    
    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total FROM studies ${whereClause}`;
    const countResult = await sql.unsafe(countQuery, params.slice(0, -2));
    const total = parseInt(countResult[0]?.total || '0');
    
    res.json({
      studies,
      total,
      hasMore: (parseInt(offset) + studies.length) < total,
      filters: {
        search, category, year_from, year_to, country, study_type, journal,
        peer_reviewed, has_full_text, min_sample_size, sort_by, sort_order
      }
    });
    
  } catch (error) {
    console.error('Advanced search error:', error);
    res.status(500).json({ error: 'Advanced search failed' });
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

// Serve modern homepage directly for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'modern-homepage.html'));
});

// Serve assets
app.use('/assets', express.static(path.join(__dirname, '..', 'client', 'assets')));

// All other routes serve the modern homepage
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'modern-homepage.html'));
});

// Start server
const PORT = parseInt(process.env.PORT || '5000');

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});