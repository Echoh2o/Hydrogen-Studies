import express from 'express';
import { db } from '../db';
import { studies } from '@shared/schema';
import { sql, eq, and, or, ilike, desc, asc } from 'drizzle-orm';

const router = express.Router();

interface SearchFilters {
  query?: string;
  healthConditions?: string[];
  bodySystems?: string[];
  studyTypes?: string[];
  yearRange?: { start: number; end: number };
  hasFullText?: boolean;
  hasImages?: boolean;
  hasConclusion?: boolean;
  sortBy?: 'relevance' | 'date' | 'title';
  page?: number;
  limit?: number;
}

interface SearchResult {
  studies: any[];
  totalCount: number;
  facets: {
    healthConditions: Array<{ name: string; count: number }>;
    bodySystems: Array<{ name: string; count: number }>;
    studyTypes: Array<{ name: string; count: number }>;
    years: Array<{ year: number; count: number }>;
  };
  searchMetadata: {
    query: string;
    totalResults: number;
    searchTime: number;
    page: number;
    totalPages: number;
  };
}

/**
 * Advanced search endpoint with faceted filtering and relevance scoring
 */
router.post('/search', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const filters: SearchFilters = req.body;
    const {
      query = '',
      healthConditions = [],
      bodySystems = [],
      studyTypes = [],
      yearRange,
      hasFullText,
      hasImages,
      hasConclusion,
      sortBy = 'relevance',
      page = 1,
      limit = 20
    } = filters;

    // Build base query with relevance scoring
    let baseQuery = db
      .select({
        ...studies,
        // Relevance score calculation
        relevanceScore: sql<number>`0 AS relevance_score`
      })
      .from(studies);

    // Apply search conditions
    const conditions = [];

    // Text search with ranking
    if (query.trim()) {
      conditions.push(
        or(
          ilike(studies.title, `%${query}%`),
          ilike(studies.abstract, `%${query}%`),
          ilike(studies.authors, `%${query}%`)
        )
      );
    }

    // Skip health conditions and body systems filters for now - they'll be enabled once enrichment completes

    // Study types filter
    if (studyTypes.length > 0) {
      const studyTypesFilter = studyTypes.map(type => 
        ilike(studies.studyType, `%${type}%`)
      );
      conditions.push(or(...studyTypesFilter));
    }

    // Year range filter
    if (yearRange) {
      conditions.push(
        and(
          sql`EXTRACT(YEAR FROM publication_date) >= ${yearRange.start}`,
          sql`EXTRACT(YEAR FROM publication_date) <= ${yearRange.end}`
        )
      );
    }

    // Data completeness filters using correct field names
    if (hasImages === true) {
      conditions.push(sql`image_url IS NOT NULL AND image_url != ''`);
    }
    if (hasConclusion === true) {
      conditions.push(sql`conclusion IS NOT NULL AND conclusion != ''`);
    }

    // Apply all conditions
    if (conditions.length > 0) {
      baseQuery = baseQuery.where(and(...conditions));
    }

    // Apply sorting
    switch (sortBy) {
      case 'relevance':
        if (query.trim()) {
          baseQuery = baseQuery.orderBy(desc(sql`relevance_score`), desc(studies.publicationDate));
        } else {
          baseQuery = baseQuery.orderBy(desc(studies.publicationDate));
        }
        break;
      case 'date':
        baseQuery = baseQuery.orderBy(desc(studies.publicationDate));
        break;
      case 'title':
        baseQuery = baseQuery.orderBy(asc(studies.title));
        break;
    }

    // Get total count for pagination
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(studies);
    
    if (conditions.length > 0) {
      countQuery.where(and(...conditions));
    }
    
    const [{ count: totalCount }] = await countQuery;

    // Apply pagination
    const offset = (page - 1) * limit;
    const searchResults = await baseQuery.limit(limit).offset(offset);

    // Get facets for filtering UI
    const facets = await getFacets(conditions);

    const searchTime = Date.now() - startTime;
    const totalPages = Math.ceil(totalCount / limit);

    const result: SearchResult = {
      studies: searchResults,
      totalCount,
      facets,
      searchMetadata: {
        query,
        totalResults: totalCount,
        searchTime,
        page,
        totalPages
      }
    };

    res.json(result);

  } catch (error) {
    console.error('Advanced search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get search suggestions for autocomplete
 */
router.get('/suggestions', async (req, res) => {
  try {
    const { q = '', type = 'all' } = req.query;
    
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.json({ suggestions: [] });
    }

    const suggestions: string[] = [];

    // Get suggestions from different fields based on type
    if (type === 'all' || type === 'conditions') {
      const conditionSuggestions = await db
        .select({ 
          suggestion: sql<string>`DISTINCT unnest(health_conditions) as suggestion` 
        })
        .from(studies)
        .where(sql`unnest(health_conditions) ILIKE ${'%' + q + '%'}`)
        .limit(5);
      
      suggestions.push(...conditionSuggestions.map(s => s.suggestion));
    }

    if (type === 'all' || type === 'keywords') {
      const keywordSuggestions = await db
        .select({ 
          suggestion: sql<string>`DISTINCT unnest(keywords) as suggestion` 
        })
        .from(studies)
        .where(sql`unnest(keywords) ILIKE ${'%' + q + '%'}`)
        .limit(5);
      
      suggestions.push(...keywordSuggestions.map(s => s.suggestion));
    }

    // Remove duplicates and limit results
    const uniqueSuggestions = [...new Set(suggestions)].slice(0, 10);

    res.json({ suggestions: uniqueSuggestions });

  } catch (error) {
    console.error('Suggestions error:', error);
    res.json({ suggestions: [] });
  }
});

/**
 * Get facets for the current search
 */
async function getFacets(conditions: any[]) {
  try {
    // Health conditions facets
    const healthConditionsQuery = db
      .select({
        name: sql<string>`unnest(health_conditions) as name`,
        count: sql<number>`count(*) as count`
      })
      .from(studies);
    
    if (conditions.length > 0) {
      healthConditionsQuery.where(and(...conditions));
    }

    const healthConditionsFacets = await healthConditionsQuery
      .groupBy(sql`unnest(health_conditions)`)
      .orderBy(desc(sql`count(*)`))
      .limit(20);

    // Body systems facets
    const bodySystemsQuery = db
      .select({
        name: sql<string>`unnest(body_systems) as name`,
        count: sql<number>`count(*) as count`
      })
      .from(studies);
    
    if (conditions.length > 0) {
      bodySystemsQuery.where(and(...conditions));
    }

    const bodySystemsFacets = await bodySystemsQuery
      .groupBy(sql`unnest(body_systems)`)
      .orderBy(desc(sql`count(*)`))
      .limit(20);

    // Study types facets
    const studyTypesQuery = db
      .select({
        name: studies.studyType,
        count: sql<number>`count(*) as count`
      })
      .from(studies)
      .where(sql`study_type IS NOT NULL`);
    
    if (conditions.length > 0) {
      studyTypesQuery.where(and(...conditions));
    }

    const studyTypesFacets = await studyTypesQuery
      .groupBy(studies.studyType)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // Year facets
    const yearFacetsQuery = db
      .select({
        year: sql<number>`EXTRACT(YEAR FROM publication_date) as year`,
        count: sql<number>`count(*) as count`
      })
      .from(studies)
      .where(sql`publication_date IS NOT NULL`);
    
    if (conditions.length > 0) {
      yearFacetsQuery.where(and(...conditions));
    }

    const yearFacets = await yearFacetsQuery
      .groupBy(sql`EXTRACT(YEAR FROM publication_date)`)
      .orderBy(desc(sql`year`))
      .limit(20);

    return {
      healthConditions: healthConditionsFacets.filter(f => f.name),
      bodySystems: bodySystemsFacets.filter(f => f.name),
      studyTypes: studyTypesFacets.filter(f => f.name),
      years: yearFacets.filter(f => f.year)
    };

  } catch (error) {
    console.error('Facets error:', error);
    return {
      healthConditions: [],
      bodySystems: [],
      studyTypes: [],
      years: []
    };
  }
}

/**
 * Get popular search terms
 */
router.get('/popular-terms', async (req, res) => {
  try {
    const popularConditions = await db
      .select({
        term: sql<string>`unnest(health_conditions) as term`,
        count: sql<number>`count(*) as count`
      })
      .from(studies)
      .groupBy(sql`unnest(health_conditions)`)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    const popularKeywords = await db
      .select({
        term: sql<string>`unnest(keywords) as term`,
        count: sql<number>`count(*) as count`
      })
      .from(studies)
      .groupBy(sql`unnest(keywords)`)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    res.json({
      popularConditions: popularConditions.filter(p => p.term),
      popularKeywords: popularKeywords.filter(p => p.term)
    });

  } catch (error) {
    console.error('Popular terms error:', error);
    res.json({
      popularConditions: [],
      popularKeywords: []
    });
  }
});

export default router;