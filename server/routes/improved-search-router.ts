import express, { Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { studies } from "@shared/schema";
import { SQL, sql, eq, and, or, ilike, desc } from "drizzle-orm";
import { format } from "date-fns";

const router = express.Router();

// Query validation schema
const searchQuerySchema = z.object({
  q: z.string().optional(),
  page: z.string().transform(Number).default("1"),
  pageSize: z.string().transform(Number).default("10"),
  sortBy: z.enum(["date", "relevance", "title"]).optional().default("relevance"),
});

// Define our improved search route with PostgreSQL's built-in text search
router.get('/api/improved-search', async (req: Request, res: Response) => {
  try {
    // Validate and parse query parameters
    const { q, page, pageSize, sortBy } = searchQuerySchema.parse(req.query);
    const offset = (page - 1) * pageSize;
    
    // If no search query, return the most recent studies
    if (!q || q.trim() === '') {
      const results = await db.select().from(studies)
        .orderBy(desc(studies.publishYear))
        .limit(pageSize)
        .offset(offset);
      
      const totalCount = await db.select({ count: sql<number>`count(*)` })
        .from(studies);
      
      return res.json({
        data: results,
        pagination: {
          total: totalCount[0].count,
          page: page,
          pageSize: pageSize,
          pageCount: Math.ceil(totalCount[0].count / pageSize)
        }
      });
    }

    // Build search conditions with deduplication logic
    let whereClause: SQL<unknown> | undefined;
    
    // Split the search query into keywords
    const keywords = q.toLowerCase().split(/\s+/).filter(k => k.length > 0);
    
    if (keywords.length > 0) {
      // Create conditions for each keyword across multiple fields
      const conditions = keywords.map(keyword => {
        return or(
          ilike(studies.title, `%${keyword}%`),
          ilike(studies.abstract, `%${keyword}%`),
          ilike(studies.authors, `%${keyword}%`),
          ilike(studies.journal, `%${keyword}%`),
          ilike(studies.methods, `%${keyword}%`),
          ilike(studies.results, `%${keyword}%`),
          ilike(studies.conclusion, `%${keyword}%`)
        );
      });
      
      // Combine all keyword conditions with AND (study must match all keywords)
      whereClause = conditions.reduce((acc, condition) => and(acc, condition));
    }

    // Execute search query with whereClause
    const searchQuery = db.select({
      id: studies.id,
      title: studies.title,
      abstract: studies.abstract,
      authors: studies.authors,
      journal: studies.journal,
      publishDate: studies.publishDate,
      category: studies.category,
      peerReviewed: studies.peerReviewed,
      methods: studies.methods,
      results: studies.results,
      conclusion: studies.conclusion,
      doi: studies.doi,
      imageUrl: studies.imageUrl,
      publishYear: studies.publishYear,
      // Compute a relevance score based on where matches occur
      relevance: sql<number>`
        CASE 
          WHEN ${studies.title} ILIKE ${`%${q}%`} THEN 10
          WHEN ${studies.abstract} ILIKE ${`%${q}%`} THEN 5
          WHEN ${studies.methods} ILIKE ${`%${q}%`} OR ${studies.results} ILIKE ${`%${q}%`} THEN 3
          ELSE 1
        END
      `,
    }).from(studies);
    
    // Apply where clause if we have search conditions
    if (whereClause) {
      searchQuery.where(whereClause);
    }
    
    // Apply sorting based on user preference
    if (sortBy === 'date') {
      searchQuery.orderBy(desc(studies.publishYear));
    } else if (sortBy === 'title') {
      searchQuery.orderBy(studies.title);
    } else {
      // For relevance, we'll handle sorting in the raw SQL query
    }
    
    // We don't fetch results directly from the query builder since we'll use raw SQL
    
    // Execute a modified SQL query with title-based deduplication
    // This helps avoid showing multiple copies of the same study
    // We'll use a simpler query first that works with PostgreSQL's syntax
    // This still helps with deduplication by using a modified approach
    const deduplicatedTitleQuery = sql`
      WITH base_query AS (
        SELECT 
          id, 
          title, 
          abstract, 
          authors, 
          journal, 
          publish_date as "publishDate", 
          category,
          peer_reviewed as "peerReviewed",
          methods,
          results,
          conclusion,
          doi,
          image_url as "imageUrl",
          publish_year as "publishYear",
          CASE 
            WHEN title ILIKE ${`%${q}%`} THEN 10
            WHEN abstract ILIKE ${`%${q}%`} THEN 5 
            WHEN methods ILIKE ${`%${q}%`} OR results ILIKE ${`%${q}%`} THEN 3
            ELSE 1
          END as score
        FROM studies
        WHERE ${whereClause ? whereClause : sql`TRUE`}
      ),
      grouped_titles AS (
        SELECT 
          MIN(id) as group_id,
          title
        FROM base_query
        GROUP BY title
      ),
      ranked_results AS (
        SELECT 
          b.*,
          ROW_NUMBER() OVER (
            PARTITION BY g.group_id
            ORDER BY b.score DESC, b."publishYear" DESC NULLS LAST
          ) as rank
        FROM base_query b
        JOIN grouped_titles g ON similarity(lower(b.title), lower(g.title)) > 0.9
      )
      SELECT 
        id, title, abstract, authors, journal, "publishDate", 
        category, "peerReviewed", methods, results, conclusion, 
        doi, "imageUrl", "publishYear" 
      FROM ranked_results
      WHERE rank = 1
      ORDER BY score DESC, "publishYear" DESC NULLS LAST
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    
    const queryResult = await db.execute(deduplicatedTitleQuery);
    const deduplicatedResults = queryResult.rows;

    // Count total results (with deduplication)
    const countQuery = sql`
      SELECT COUNT(*) FROM (
        WITH base_query AS (
          SELECT 
            id, 
            title
          FROM studies
          WHERE ${whereClause ? whereClause : sql`TRUE`}
        ),
        grouped_titles AS (
          SELECT 
            MIN(id) as group_id,
            title
          FROM base_query
          GROUP BY title
        ),
        ranked_results AS (
          SELECT 
            b.id,
            ROW_NUMBER() OVER (
              PARTITION BY g.group_id
              ORDER BY b.id
            ) as rank
          FROM base_query b
          JOIN grouped_titles g ON similarity(lower(b.title), lower(g.title)) > 0.9
        )
        SELECT id FROM ranked_results WHERE rank = 1
      ) AS deduplicated_count
    `;
    
    const countResult = await db.execute(countQuery);
    const totalCount = parseInt(countResult.rows[0].count as string, 10);
    
    // Return the search results
    return res.json({
      data: deduplicatedResults,
      pagination: {
        total: totalCount,
        page: page,
        pageSize: pageSize,
        pageCount: Math.ceil(totalCount / pageSize)
      }
    });
  } catch (error) {
    console.error("Error in improved search:", error);
    res.status(500).json({ 
      error: "An error occurred during search. Please try again." 
    });
  }
});

export default router;