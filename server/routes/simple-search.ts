import express from 'express';
import { db } from '../db';
import { studies } from '@shared/schema';
import { ilike, or, desc, sql } from 'drizzle-orm';

const router = express.Router();

// Simple search endpoint that works with your database structure
router.post('/search', async (req, res) => {
  try {
    const { query = '', page = 1, limit = 20 } = req.body;
    const offset = (page - 1) * limit;

    let searchQuery = db.select().from(studies);

    // Add text search if query provided
    if (query.trim()) {
      searchQuery = searchQuery.where(
        or(
          ilike(studies.title, `%${query}%`),
          ilike(studies.abstract, `%${query}%`),
          ilike(studies.authors, `%${query}%`)
        )
      );
    }

    // Get total count
    const totalResults = await searchQuery;
    const totalCount = totalResults.length;

    // Get paginated results
    const results = await searchQuery
      .orderBy(desc(studies.id))
      .limit(limit)
      .offset(offset);

    // Return search results in expected format
    res.json({
      studies: results,
      totalCount,
      facets: {
        healthConditions: [],
        bodySystems: [],
        studyTypes: [],
        years: []
      },
      searchMetadata: {
        query,
        totalResults: totalCount,
        searchTime: 0,
        page,
        totalPages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      error: 'Search failed',
      studies: [],
      totalCount: 0,
      facets: {
        healthConditions: [],
        bodySystems: [],
        studyTypes: [],
        years: []
      },
      searchMetadata: {
        query: '',
        totalResults: 0,
        searchTime: 0,
        page: 1,
        totalPages: 0
      }
    });
  }
});

// Suggestions endpoint
router.get('/suggestions', async (req, res) => {
  try {
    const { q = '' } = req.query;
    
    if (!q || q.length < 2) {
      return res.json([]);
    }

    const suggestions = await db
      .select({ title: studies.title })
      .from(studies)
      .where(ilike(studies.title, `%${q}%`))
      .limit(5);

    res.json(suggestions.map(s => s.title));
  } catch (error) {
    console.error('Suggestions error:', error);
    res.json([]);
  }
});

// Popular terms endpoint
router.get('/popular-terms', async (req, res) => {
  try {
    res.json([
      'hydrogen water',
      'antioxidant effects',
      'inflammation',
      'oxidative stress',
      'neuroprotection',
      'cardiovascular',
      'diabetes',
      'exercise performance'
    ]);
  } catch (error) {
    console.error('Popular terms error:', error);
    res.json([]);
  }
});

export default router;