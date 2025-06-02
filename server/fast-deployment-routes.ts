/**
 * Fast deployment routes - minimal database calls for reliable deployment
 */
import { sql } from "drizzle-orm";
import { db } from "./db";
import type { Express } from "express";

export function setupFastDeploymentRoutes(app: Express) {
  // Ultra-fast trending endpoint with minimal data
  app.get('/api/search/trending', async (req, res) => {
    try {
      res.json({
        trending: ["hydrogen water", "antioxidant", "inflammation", "brain health", "exercise recovery"]
      });
    } catch (error) {
      res.json({ trending: [] });
    }
  });

  // Fast categories endpoint
  app.get('/api/tags/categories', async (req, res) => {
    try {
      res.json({
        categories: [
          { name: "Brain Health", count: 34 },
          { name: "Anti-Inflammatory", count: 21 },
          { name: "Cardiovascular", count: 18 },
          { name: "Athletic Performance", count: 15 }
        ]
      });
    } catch (error) {
      res.json({ categories: [] });
    }
  });

  // Simplified search for deployment
  app.get('/api/search/enhanced', async (req, res) => {
    try {
      const { limit = 20, offset = 0 } = req.query;
      const limitInt = parseInt(limit as string) || 20;
      const offsetInt = parseInt(offset as string) || 0;

      const results = await db.execute(sql`
        SELECT id, title, abstract, authors, journal, 
               publish_date, journal_publish_date, category
        FROM studies
        ORDER BY id DESC
        LIMIT ${limitInt} OFFSET ${offsetInt}
      `);

      const studies = results.rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        abstract: row.abstract,
        authors: row.authors,
        journal: row.journal,
        publishDate: row.publish_date || row.journal_publish_date,
        category: row.category,
        viewCount: 0,
        relevanceScore: 1.0,
        tags: [],
        relatedStudies: []
      }));

      res.json({
        studies,
        total: studies.length,
        facets: { tags: [], journals: [], years: [] },
        suggestions: [],
        trending: []
      });
    } catch (error) {
      console.error('Fast search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });
}