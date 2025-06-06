/**
 * Advanced Search Routes with Intelligent Ranking
 * Provides comprehensive search functionality with multiple filters
 */

import { Router } from 'express';
import { db } from '../db';
import { studies, categories } from '@shared/schema';
import { sql, eq, and, or, ilike, gte, lte, desc, asc } from 'drizzle-orm';

const router = Router();

// Advanced search with multiple filters
router.get('/api/search/advanced', async (req, res) => {
  try {
    const {
      query = '',
      categories: categoryFilter = '',
      yearStart,
      yearEnd,
      studyTypes = '',
      hasFullText,
      hasDOI,
      sortBy = 'relevance',
      sortOrder = 'desc',
      page = 1,
      pageSize = 20
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const limit = parseInt(pageSize as string);

    // Build dynamic WHERE conditions
    const conditions = [];

    // Text search across multiple fields
    if (query) {
      conditions.push(
        or(
          ilike(studies.title, `%${query}%`),
          ilike(studies.abstract, `%${query}%`),
          ilike(studies.authors, `%${query}%`),
          ilike(studies.journal, `%${query}%`),
          ilike(studies.category, `%${query}%`)
        )
      );
    }

    // Category filter
    if (categoryFilter) {
      const categoryList = (categoryFilter as string).split(',').map(c => c.trim());
      conditions.push(
        or(...categoryList.map(cat => ilike(studies.category, `%${cat}%`)))
      );
    }

    // Year range filter
    if (yearStart) {
      conditions.push(gte(sql`EXTRACT(YEAR FROM ${studies.publishDate})`, parseInt(yearStart as string)));
    }
    if (yearEnd) {
      conditions.push(lte(sql`EXTRACT(YEAR FROM ${studies.publishDate})`, parseInt(yearEnd as string)));
    }

    // Study type filter
    if (studyTypes) {
      const typeList = (studyTypes as string).split(',').map(t => t.trim());
      conditions.push(
        or(...typeList.map(type => ilike(studies.category, `%${type}%`)))
      );
    }

    // Full text availability
    if (hasFullText === 'true') {
      conditions.push(sql`${studies.fullTextAvailable} = true`);
    }

    // DOI availability
    if (hasDOI === 'true') {
      conditions.push(sql`${studies.doi} IS NOT NULL AND ${studies.doi} != ''`);
    }

    // Build ORDER BY clause
    let orderBy;
    const direction = sortOrder === 'asc' ? asc : desc;

    switch (sortBy) {
      case 'date':
        orderBy = direction(studies.publishDate);
        break;
      case 'title':
        orderBy = direction(studies.title);
        break;
      case 'citations':
        orderBy = direction(sql`COALESCE(${studies.citations}, 0)`);
        break;
      case 'views':
        orderBy = direction(sql`COALESCE(${studies.viewCount}, 0)`);
        break;
      case 'relevance':
      default:
        // Calculate relevance score based on multiple factors
        if (query) {
          orderBy = desc(sql`
            (CASE 
              WHEN LOWER(${studies.title}) LIKE LOWER(${'%' + query + '%'}) THEN 10
              ELSE 0
            END) +
            (CASE 
              WHEN LOWER(${studies.abstract}) LIKE LOWER(${'%' + query + '%'}) THEN 5
              ELSE 0
            END) +
            (CASE 
              WHEN LOWER(${studies.authors}) LIKE LOWER(${'%' + query + '%'}) THEN 3
              ELSE 0
            END) +
            COALESCE(${studies.viewCount}, 0) * 0.01 +
            COALESCE(${studies.citations}, 0) * 0.1
          `);
        } else {
          orderBy = desc(sql`COALESCE(${studies.viewCount}, 0) + COALESCE(${studies.citations}, 0) * 10`);
        }
        break;
    }

    // Execute search query
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [searchResults, countResult] = await Promise.all([
      db.select()
        .from(studies)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      
      db.select({ count: sql<number>`count(*)` })
        .from(studies)
        .where(whereClause)
    ]);

    const total = countResult[0]?.count || 0;
    const pageCount = Math.ceil(total / limit);

    res.json({
      data: searchResults,
      total,
      page: parseInt(page as string),
      pageSize: limit,
      pageCount,
      hasNextPage: parseInt(page as string) < pageCount,
      hasPreviousPage: parseInt(page as string) > 1,
      filters: {
        query,
        categories: categoryFilter,
        yearStart,
        yearEnd,
        studyTypes,
        hasFullText,
        hasDOI,
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    console.error('Error performing advanced search:', error);
    res.status(500).json({ error: 'Advanced search failed' });
  }
});

// Search suggestions endpoint
router.get('/api/search/suggestions', async (req, res) => {
  try {
    const { q: query } = req.query;

    if (!query || (query as string).length < 2) {
      return res.json([]);
    }

    const searchTerm = query as string;

    // Get suggestions from multiple sources
    const [studyTitles, categoryNames, authorNames, journalNames] = await Promise.all([
      // Study titles
      db.execute(sql`
        SELECT DISTINCT title as text, 'study' as type, id
        FROM studies 
        WHERE LOWER(title) LIKE LOWER(${'%' + searchTerm + '%'})
        ORDER BY LENGTH(title)
        LIMIT 5
      `),
      
      // Categories
      db.execute(sql`
        SELECT DISTINCT category as text, 'category' as type, COUNT(*) as study_count
        FROM studies 
        WHERE LOWER(category) LIKE LOWER(${'%' + searchTerm + '%'})
        GROUP BY category
        ORDER BY COUNT(*) DESC
        LIMIT 3
      `),
      
      // Authors
      db.execute(sql`
        SELECT DISTINCT authors as text, 'author' as type, COUNT(*) as study_count
        FROM studies 
        WHERE LOWER(authors) LIKE LOWER(${'%' + searchTerm + '%'})
        GROUP BY authors
        ORDER BY COUNT(*) DESC
        LIMIT 3
      `),
      
      // Journals
      db.execute(sql`
        SELECT DISTINCT journal as text, 'journal' as type, COUNT(*) as study_count
        FROM studies 
        WHERE LOWER(journal) LIKE LOWER(${'%' + searchTerm + '%'})
        GROUP BY journal
        ORDER BY COUNT(*) DESC
        LIMIT 3
      `)
    ]);

    const suggestions = [
      ...studyTitles.rows.map(row => ({
        id: `study-${row.id}`,
        text: row.text,
        type: row.type
      })),
      ...categoryNames.rows.map(row => ({
        id: `category-${row.text}`,
        text: row.text,
        type: row.type,
        studyCount: row.study_count
      })),
      ...authorNames.rows.slice(0, 2).map(row => ({
        id: `author-${row.text}`,
        text: row.text,
        type: row.type,
        studyCount: row.study_count
      })),
      ...journalNames.rows.slice(0, 2).map(row => ({
        id: `journal-${row.text}`,
        text: row.text,
        type: row.type,
        studyCount: row.study_count
      }))
    ];

    res.json(suggestions);

  } catch (error) {
    console.error('Error fetching search suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// Filter options endpoint
router.get('/api/search/filter-options', async (req, res) => {
  try {
    const [categoriesData, studyTypes, yearRange] = await Promise.all([
      // Categories with study counts
      db.execute(sql`
        SELECT category, COUNT(*) as study_count
        FROM studies 
        WHERE category IS NOT NULL AND category != ''
        GROUP BY category
        ORDER BY COUNT(*) DESC
        LIMIT 20
      `),
      
      // Study types (extracted from categories/titles)
      db.execute(sql`
        SELECT 
          'Clinical Trial' as type, COUNT(*) as count
        FROM studies 
        WHERE LOWER(category) LIKE '%clinical%' OR LOWER(title) LIKE '%clinical%'
        UNION ALL
        SELECT 
          'Meta-Analysis' as type, COUNT(*) as count
        FROM studies 
        WHERE LOWER(category) LIKE '%meta%' OR LOWER(title) LIKE '%meta%'
        UNION ALL
        SELECT 
          'Animal Study' as type, COUNT(*) as count
        FROM studies 
        WHERE LOWER(category) LIKE '%animal%' OR LOWER(title) LIKE '%animal%'
        UNION ALL
        SELECT 
          'In Vitro Study' as type, COUNT(*) as count
        FROM studies 
        WHERE LOWER(category) LIKE '%vitro%' OR LOWER(title) LIKE '%vitro%'
        ORDER BY count DESC
      `),
      
      // Year range
      db.execute(sql`
        SELECT 
          MIN(EXTRACT(YEAR FROM publish_date)) as min_year,
          MAX(EXTRACT(YEAR FROM publish_date)) as max_year
        FROM studies 
        WHERE publish_date IS NOT NULL
      `)
    ]);

    const filterOptions = {
      categories: categoriesData.rows.map(row => ({
        id: row.category,
        name: row.category,
        studyCount: row.study_count
      })),
      studyTypes: studyTypes.rows.filter(row => row.count > 0),
      yearRange: {
        min: yearRange.rows[0]?.min_year || 1990,
        max: yearRange.rows[0]?.max_year || new Date().getFullYear()
      }
    };

    res.json(filterOptions);

  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({ error: 'Failed to fetch filter options' });
  }
});

// Search analytics endpoint
router.post('/api/search/analytics', async (req, res) => {
  try {
    const { query, resultsCount, selectedStudyId, timestamp } = req.body;

    // Log search analytics for improving search quality
    console.log('Search Analytics:', {
      query,
      resultsCount,
      selectedStudyId,
      timestamp
    });

    // In a production system, you would store this in a dedicated analytics table
    res.json({ success: true, message: 'Analytics recorded' });

  } catch (error) {
    console.error('Error recording search analytics:', error);
    res.status(500).json({ error: 'Failed to record analytics' });
  }
});

export default router;