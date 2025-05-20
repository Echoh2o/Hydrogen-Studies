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
      // Default to relevance
      searchQuery.orderBy(desc(sql<number>`relevance`));
    }
    
    // Fetch results with pagination
    const results = await searchQuery
      .limit(pageSize)
      .offset(offset);
    
    // Execute a raw SQL query to deduplicate studies based on title similarity
    // This helps avoid showing multiple copies of the same study
    const deduplicatedTitleQuery = sql`
      WITH ranked_results AS (
        SELECT 
          r.*,
          ROW_NUMBER() OVER (
            PARTITION BY similarity(lower(title), lower(title)) > 0.9
            ORDER BY 
              CASE 
                WHEN title ILIKE ${`%${q}%`} THEN 10
                WHEN abstract ILIKE ${`%${q}%`} THEN 5
                ELSE 1
              END DESC
          ) as rank
        FROM (${searchQuery}) r
      )
      SELECT * FROM ranked_results WHERE rank = 1
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    
    const queryResult = await db.execute(deduplicatedTitleQuery);
    const deduplicatedResults = queryResult.rows;

    // Count total results (with deduplication)
    const countQuery = sql`
      SELECT COUNT(*) FROM (
        WITH ranked_results AS (
          SELECT 
            r.*,
            ROW_NUMBER() OVER (
              PARTITION BY similarity(lower(title), lower(title)) > 0.9
              ORDER BY id
            ) as rank
          FROM studies r
          WHERE
            ${whereClause ? whereClause : sql`TRUE`}
        )
        SELECT * FROM ranked_results WHERE rank = 1
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