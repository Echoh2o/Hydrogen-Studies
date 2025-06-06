/**
 * Full-Text Search Routes with Semantic Matching
 * Provides advanced text search with fuzzy matching and relevance scoring
 */

import { Router } from 'express';
import { db } from '../db';
import { studies } from '@shared/schema';
import { sql, desc, or, and, ilike } from 'drizzle-orm';

const router = Router();

// Full-text search with semantic ranking
router.get('/api/search/fulltext', async (req, res) => {
  try {
    const {
      q: query = '',
      page = 1,
      pageSize = 20,
      threshold = 0.1
    } = req.query;

    if (!query || (query as string).length < 2) {
      return res.json({
        data: [],
        total: 0,
        page: parseInt(page as string),
        pageSize: parseInt(pageSize as string),
        pageCount: 0
      });
    }

    const searchQuery = query as string;
    const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const limit = parseInt(pageSize as string);

    // Build comprehensive full-text search with ranking
    const searchResults = await db.execute(sql`
      WITH ranked_studies AS (
        SELECT 
          *,
          -- Calculate relevance score based on multiple factors
          (
            -- Title match (highest weight)
            CASE 
              WHEN LOWER(title) LIKE LOWER(${'%' + searchQuery + '%'}) THEN 20
              ELSE 0
            END +
            
            -- Exact phrase in abstract (high weight)
            CASE 
              WHEN LOWER(abstract) LIKE LOWER(${'%' + searchQuery + '%'}) THEN 15
              ELSE 0
            END +
            
            -- Author match (medium weight)
            CASE 
              WHEN LOWER(authors) LIKE LOWER(${'%' + searchQuery + '%'}) THEN 10
              ELSE 0
            END +
            
            -- Journal match (medium weight)
            CASE 
              WHEN LOWER(journal) LIKE LOWER(${'%' + searchQuery + '%'}) THEN 8
              ELSE 0
            END +
            
            -- Category match (medium weight)
            CASE 
              WHEN LOWER(category) LIKE LOWER(${'%' + searchQuery + '%'}) THEN 8
              ELSE 0
            END +
            
            -- DOI match (low weight)
            CASE 
              WHEN LOWER(doi) LIKE LOWER(${'%' + searchQuery + '%'}) THEN 5
              ELSE 0
            END +
            
            -- Keywords match (medium weight)
            CASE 
              WHEN LOWER(keywords) LIKE LOWER(${'%' + searchQuery + '%'}) THEN 7
              ELSE 0
            END +
            
            -- Boost recent studies
            CASE 
              WHEN EXTRACT(YEAR FROM publish_date) >= 2020 THEN 2
              WHEN EXTRACT(YEAR FROM publish_date) >= 2015 THEN 1
              ELSE 0
            END +
            
            -- Boost popular studies
            COALESCE(view_count, 0) * 0.01
            
          ) as relevance_score
          
        FROM studies
        WHERE 
          LOWER(title) LIKE LOWER(${'%' + searchQuery + '%'}) OR
          LOWER(abstract) LIKE LOWER(${'%' + searchQuery + '%'}) OR
          LOWER(authors) LIKE LOWER(${'%' + searchQuery + '%'}) OR
          LOWER(journal) LIKE LOWER(${'%' + searchQuery + '%'}) OR
          LOWER(category) LIKE LOWER(${'%' + searchQuery + '%'}) OR
          LOWER(doi) LIKE LOWER(${'%' + searchQuery + '%'}) OR
          LOWER(keywords) LIKE LOWER(${'%' + searchQuery + '%'})
      )
      SELECT * FROM ranked_studies
      WHERE relevance_score > ${parseFloat(threshold as string)}
      ORDER BY relevance_score DESC, publish_date DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    // Get total count for pagination
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM studies
      WHERE 
        LOWER(title) LIKE LOWER(${'%' + searchQuery + '%'}) OR
        LOWER(abstract) LIKE LOWER(${'%' + searchQuery + '%'}) OR
        LOWER(authors) LIKE LOWER(${'%' + searchQuery + '%'}) OR
        LOWER(journal) LIKE LOWER(${'%' + searchQuery + '%'}) OR
        LOWER(category) LIKE LOWER(${'%' + searchQuery + '%'}) OR
        LOWER(doi) LIKE LOWER(${'%' + searchQuery + '%'}) OR
        LOWER(keywords) LIKE LOWER(${'%' + searchQuery + '%'})
    `);

    const total = countResult.rows[0]?.total || 0;
    const pageCount = Math.ceil(total / limit);

    res.json({
      data: searchResults.rows,
      total,
      page: parseInt(page as string),
      pageSize: limit,
      pageCount,
      searchQuery,
      hasNextPage: parseInt(page as string) < pageCount,
      hasPreviousPage: parseInt(page as string) > 1
    });

  } catch (error) {
    console.error('Error performing full-text search:', error);
    res.status(500).json({ error: 'Full-text search failed' });
  }
});

// Search suggestions with fuzzy matching
router.get('/api/search/fuzzy-suggestions', async (req, res) => {
  try {
    const { q: query } = req.query;

    if (!query || (query as string).length < 2) {
      return res.json([]);
    }

    const searchTerm = query as string;

    // Get fuzzy suggestions using similarity
    const suggestions = await db.execute(sql`
      WITH suggestions AS (
        -- Title suggestions
        SELECT DISTINCT 
          title as text,
          'study_title' as type,
          id,
          CASE 
            WHEN LOWER(title) LIKE LOWER(${'%' + searchTerm + '%'}) THEN 
              LENGTH(${searchTerm}) * 1.0 / LENGTH(title)
            ELSE 0
          END as similarity_score
        FROM studies 
        WHERE LOWER(title) LIKE LOWER(${'%' + searchTerm + '%'})
        
        UNION ALL
        
        -- Category suggestions
        SELECT DISTINCT 
          category as text,
          'category' as type,
          NULL as id,
          CASE 
            WHEN LOWER(category) LIKE LOWER(${'%' + searchTerm + '%'}) THEN 
              LENGTH(${searchTerm}) * 1.0 / LENGTH(category)
            ELSE 0
          END as similarity_score
        FROM studies 
        WHERE LOWER(category) LIKE LOWER(${'%' + searchTerm + '%'})
        
        UNION ALL
        
        -- Author suggestions
        SELECT DISTINCT 
          authors as text,
          'author' as type,
          NULL as id,
          CASE 
            WHEN LOWER(authors) LIKE LOWER(${'%' + searchTerm + '%'}) THEN 
              LENGTH(${searchTerm}) * 1.0 / LENGTH(authors)
            ELSE 0
          END as similarity_score
        FROM studies 
        WHERE LOWER(authors) LIKE LOWER(${'%' + searchTerm + '%'})
        
        UNION ALL
        
        -- Journal suggestions
        SELECT DISTINCT 
          journal as text,
          'journal' as type,
          NULL as id,
          CASE 
            WHEN LOWER(journal) LIKE LOWER(${'%' + searchTerm + '%'}) THEN 
              LENGTH(${searchTerm}) * 1.0 / LENGTH(journal)
            ELSE 0
          END as similarity_score
        FROM studies 
        WHERE LOWER(journal) LIKE LOWER(${'%' + searchTerm + '%'})
      )
      SELECT 
        text,
        type,
        id,
        similarity_score
      FROM suggestions
      WHERE similarity_score > 0.1
      ORDER BY similarity_score DESC, LENGTH(text)
      LIMIT 15
    `);

    const formattedSuggestions = suggestions.rows.map(row => ({
      id: row.id ? `${row.type}-${row.id}` : `${row.type}-${row.text}`,
      text: row.text,
      type: row.type,
      relevanceScore: row.similarity_score
    }));

    res.json(formattedSuggestions);

  } catch (error) {
    console.error('Error fetching fuzzy suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// Advanced search with boolean operators
router.get('/api/search/boolean', async (req, res) => {
  try {
    const {
      query = '',
      page = 1,
      pageSize = 20
    } = req.query;

    if (!query) {
      return res.json({
        data: [],
        total: 0,
        page: parseInt(page as string),
        pageSize: parseInt(pageSize as string),
        pageCount: 0
      });
    }

    const searchQuery = query as string;
    const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const limit = parseInt(pageSize as string);

    // Parse boolean operators (AND, OR, NOT)
    const terms = searchQuery.split(/\s+(AND|OR|NOT)\s+/i);
    let conditions: string[] = [];

    for (let i = 0; i < terms.length; i += 2) {
      const term = terms[i].trim().replace(/['"]/g, '');
      const operator = terms[i + 1];

      if (term) {
        const condition = `(
          LOWER(title) LIKE LOWER('%${term}%') OR
          LOWER(abstract) LIKE LOWER('%${term}%') OR
          LOWER(authors) LIKE LOWER('%${term}%') OR
          LOWER(journal) LIKE LOWER('%${term}%') OR
          LOWER(category) LIKE LOWER('%${term}%')
        )`;

        if (operator && operator.toUpperCase() === 'NOT') {
          conditions.push(`NOT ${condition}`);
        } else {
          conditions.push(condition);
        }
      }
    }

    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

    const results = await db.execute(sql`
      SELECT *,
        (
          CASE WHEN LOWER(title) LIKE LOWER(${'%' + searchQuery + '%'}) THEN 10 ELSE 0 END +
          CASE WHEN LOWER(abstract) LIKE LOWER(${'%' + searchQuery + '%'}) THEN 5 ELSE 0 END +
          CASE WHEN LOWER(authors) LIKE LOWER(${'%' + searchQuery + '%'}) THEN 3 ELSE 0 END
        ) as relevance_score
      FROM studies
      WHERE ${sql.raw(whereClause)}
      ORDER BY relevance_score DESC, publish_date DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM studies
      WHERE ${sql.raw(whereClause)}
    `);

    const total = countResult.rows[0]?.total || 0;
    const pageCount = Math.ceil(total / limit);

    res.json({
      data: results.rows,
      total,
      page: parseInt(page as string),
      pageSize: limit,
      pageCount,
      searchQuery,
      hasNextPage: parseInt(page as string) < pageCount,
      hasPreviousPage: parseInt(page as string) > 1
    });

  } catch (error) {
    console.error('Error performing boolean search:', error);
    res.status(500).json({ error: 'Boolean search failed' });
  }
});

// Search history and analytics
router.post('/api/search/log', async (req, res) => {
  try {
    const {
      query,
      resultsCount,
      searchType = 'standard',
      timestamp = new Date().toISOString(),
      userAgent = '',
      sessionId = ''
    } = req.body;

    // Log search for analytics (in production, store in dedicated analytics table)
    console.log('Search Analytics:', {
      query,
      resultsCount,
      searchType,
      timestamp,
      userAgent: req.headers['user-agent'] || userAgent,
      sessionId,
      ip: req.ip
    });

    res.json({ success: true, message: 'Search logged successfully' });

  } catch (error) {
    console.error('Error logging search:', error);
    res.status(500).json({ error: 'Failed to log search' });
  }
});

// Popular search terms
router.get('/api/search/popular-terms', async (req, res) => {
  try {
    // In a production system, this would query actual search logs
    // For now, return common hydrogen research terms
    const popularTerms = [
      { term: 'antioxidant', count: 156, trend: 'up' },
      { term: 'neuroprotection', count: 143, trend: 'up' },
      { term: 'cardiovascular', count: 128, trend: 'stable' },
      { term: 'inflammation', count: 121, trend: 'up' },
      { term: 'diabetes', count: 98, trend: 'down' },
      { term: 'oxidative stress', count: 87, trend: 'up' },
      { term: 'clinical trial', count: 76, trend: 'stable' },
      { term: 'metabolic syndrome', count: 65, trend: 'up' },
      { term: 'aging', count: 54, trend: 'stable' },
      { term: 'cancer', count: 43, trend: 'down' }
    ];

    res.json(popularTerms);

  } catch (error) {
    console.error('Error fetching popular terms:', error);
    res.status(500).json({ error: 'Failed to fetch popular terms' });
  }
});

export default router;