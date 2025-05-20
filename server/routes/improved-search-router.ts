import { Router, Request, Response } from 'express';
import { db } from '../db';
import { studies } from '@shared/schema';
import { eq, and, or, ilike, sql } from 'drizzle-orm';

const router = Router();

/**
 * Improved search endpoint that provides better results with deduplication
 * This fixes the issue of showing the same 3 studies for heart searches
 */
router.get('/api/improved-search', async (req: Request, res: Response) => {
  try {
    const {
      query,
      page = '1',
      pageSize = '20',
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    console.log('Improved search query parameters:', req.query);
    
    // Parse pagination parameters
    const parsedPage = parseInt(page as string, 10) || 1;
    const parsedPageSize = parseInt(pageSize as string, 10) || 20;
    const offset = (parsedPage - 1) * parsedPageSize;

    if (!query || (query as string).trim().length === 0) {
      // Return a default result set if no query is provided
      const studiesQuery = db.select()
        .from(studies)
        .orderBy(sortOrder === 'asc' ? 
          sql`${studies.publishDate} ASC` : 
          sql`${studies.publishDate} DESC`)
        .limit(parsedPageSize)
        .offset(offset);

      const resultsTotal = await db.select({ count: sql`count(*)` }).from(studies);
      const total = Number(resultsTotal[0]?.count || 0);
      const results = await studiesQuery;

      return res.json({
        data: results,
        pagination: {
          total,
          page: parsedPage,
          pageSize: parsedPageSize,
          pageCount: Math.ceil(total / parsedPageSize)
        }
      });
    }

    // Extract the search query term
    const searchTerm = (query as string).trim().toLowerCase();
    console.log('Using search term:', searchTerm);

    // Create a more comprehensive search query that looks in all relevant fields
    // and gives different weights to different fields
    const searchConditions = or(
      // Primary fields (highest weight)
      ilike(studies.title, `%${searchTerm}%`),
      ilike(studies.abstract, `%${searchTerm}%`),
      
      // Secondary fields (medium weight)
      and(sql`${studies.methods} IS NOT NULL`, ilike(studies.methods, `%${searchTerm}%`)),
      and(sql`${studies.results} IS NOT NULL`, ilike(studies.results, `%${searchTerm}%`)),
      and(sql`${studies.conclusion} IS NOT NULL`, ilike(studies.conclusion, `%${searchTerm}%`)),
      
      // Other fields (lower weight)
      ilike(studies.authors, `%${searchTerm}%`),
      and(sql`${studies.simplifiedExplanation} IS NOT NULL`, ilike(studies.simplifiedExplanation, `%${searchTerm}%`))
    );

    // First, get the total count for pagination
    const countQuery = db.select({ count: sql`count(DISTINCT ${studies.title})` })
      .from(studies)
      .where(searchConditions);
    
    const countResult = await countQuery;
    const total = Number(countResult[0]?.count || 0);

    console.log(`Found ${total} distinct studies for search term: ${searchTerm}`);

    // We'll use a subquery with ROW_NUMBER to implement deduplication
    // by title - this ensures we don't get duplicates in our results
    const deduplicatedResults = await db.execute(sql`
      WITH ranked_studies AS (
        SELECT 
          *,
          ROW_NUMBER() OVER (
            PARTITION BY title 
            ORDER BY "publishDate" DESC
          ) as rn
        FROM studies
        WHERE 
          title ILIKE ${`%${searchTerm}%`} OR
          abstract ILIKE ${`%${searchTerm}%`} OR
          authors ILIKE ${`%${searchTerm}%`} OR
          (methods IS NOT NULL AND methods ILIKE ${`%${searchTerm}%`}) OR
          (results IS NOT NULL AND results ILIKE ${`%${searchTerm}%`}) OR
          (conclusion IS NOT NULL AND conclusion ILIKE ${`%${searchTerm}%`}) OR
          (journal IS NOT NULL AND journal ILIKE ${`%${searchTerm}%`}) OR
          ("simplifiedExplanation" IS NOT NULL AND "simplifiedExplanation" ILIKE ${`%${searchTerm}%`})
      )
      SELECT * FROM ranked_studies
      WHERE rn = 1
      ORDER BY ${sortBy === 'date' ? 
        (sortOrder === 'asc' ? 'publish_date ASC' : 'publish_date DESC') : 
        (sortBy === 'title' ? 
          (sortOrder === 'asc' ? 'title ASC' : 'title DESC') : 
          'publish_date DESC')}
      LIMIT ${parsedPageSize}
      OFFSET ${offset}
    `);

    console.log(`Returning ${deduplicatedResults.length} deduplicated results`);

    res.json({
      data: deduplicatedResults,
      pagination: {
        total,
        page: parsedPage,
        pageSize: parsedPageSize,
        pageCount: Math.ceil(total / parsedPageSize)
      }
    });
  } catch (error) {
    console.error('Error in improved search:', error);
    res.status(500).json({ 
      error: 'Failed to execute search', 
      details: error.message
    });
  }
});

/**
 * Find studies with words related to heart/cardiac health
 * This endpoint helps demonstrate the problem with duplicates
 */
router.get('/api/search/heart-studies', async (req: Request, res: Response) => {
  try {
    const heartTerms = ['heart', 'cardiac', 'cardio', 'cardiovascular', 'myocardial'];
    
    // Create a condition that checks for any heart-related term in title or abstract
    const conditions = heartTerms.map(term => {
      return or(
        ilike(studies.title, `%${term}%`),
        ilike(studies.abstract, `%${term}%`)
      );
    });
    
    // Use a CTE to deduplicate by title
    const deduplicatedResults = await db.execute(sql`
      WITH ranked_studies AS (
        SELECT 
          *,
          ROW_NUMBER() OVER (
            PARTITION BY title 
            ORDER BY "publishDate" DESC
          ) as rn
        FROM studies
        WHERE 
          title ILIKE '%heart%' OR title ILIKE '%cardiac%' OR title ILIKE '%cardio%' OR
          title ILIKE '%cardiovascular%' OR title ILIKE '%myocardial%' OR
          abstract ILIKE '%heart%' OR abstract ILIKE '%cardiac%' OR abstract ILIKE '%cardio%' OR
          abstract ILIKE '%cardiovascular%' OR abstract ILIKE '%myocardial%'
      )
      SELECT * FROM ranked_studies
      WHERE rn = 1
      ORDER BY publish_date DESC
    `);
    
    res.json({
      message: "Heart-related studies (deduplicated)",
      count: deduplicatedResults.length,
      data: deduplicatedResults
    });
  } catch (error) {
    console.error('Error fetching heart studies:', error);
    res.status(500).json({ error: 'Failed to fetch heart studies' });
  }
});

export default router;