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

  // Consumer categories endpoint - real data from database
  app.get('/api/consumer-categories/counts', async (req, res) => {
    try {
      const results = await db.execute(sql`
        SELECT 
          c.id,
          c.name,
          c.description,
          c.icon,
          c.color,
          c.count
        FROM consumer_categories c
        WHERE c.count > 0
        ORDER BY c.count DESC
      `);
      
      res.json(results.rows);
    } catch (error) {
      console.error('Consumer categories error:', error);
      res.json([]);
    }
  });

  // Legacy categories endpoint
  app.get('/api/tags/categories', async (req, res) => {
    try {
      const results = await db.execute(sql`
        SELECT 
          c.name,
          c.count
        FROM consumer_categories c
        WHERE c.count > 0
        ORDER BY c.count DESC
        LIMIT 10
      `);
      
      const categories = results.rows.map((row: any) => ({
        name: row.name,
        count: row.count
      }));
      
      res.json({ categories });
    } catch (error) {
      console.error('Categories error:', error);
      res.json({ categories: [] });
    }
  });

  // Enhanced search endpoint with full functionality
  app.get('/api/search/enhanced', async (req, res) => {
    try {
      const { 
        q = '', 
        limit = 20, 
        offset = 0, 
        category = '',
        condition = '',
        bodySystem = '',
        lifeStage = ''
      } = req.query;
      
      const limitInt = Math.min(parseInt(limit as string) || 20, 100);
      const offsetInt = parseInt(offset as string) || 0;

      let whereClause = '';
      const conditions = [];
      
      if (q && typeof q === 'string' && q.trim()) {
        conditions.push(`(
          title ILIKE '%${q.replace(/'/g, "''")}%' OR 
          abstract ILIKE '%${q.replace(/'/g, "''")}%' OR 
          authors ILIKE '%${q.replace(/'/g, "''")}%'
        )`);
      }
      
      if (category && typeof category === 'string') {
        conditions.push(`category ILIKE '%${category.replace(/'/g, "''")}%'`);
      }

      if (condition && typeof condition === 'string') {
        conditions.push(`consumer_categories->>'condition' ILIKE '%${condition.replace(/'/g, "''")}%'`);
      }

      if (bodySystem && typeof bodySystem === 'string') {
        conditions.push(`consumer_categories->>'bodySystem' ILIKE '%${bodySystem.replace(/'/g, "''")}%'`);
      }

      if (lifeStage && typeof lifeStage === 'string') {
        conditions.push(`consumer_categories->>'lifeStage' ILIKE '%${lifeStage.replace(/'/g, "''")}%'`);
      }
      
      if (conditions.length > 0) {
        whereClause = `WHERE ${conditions.join(' AND ')}`;
      }

      const results = await db.execute(sql.raw(`
        SELECT 
          id, title, abstract, authors, journal, 
          publish_date, journal_publish_date, category,
          consumer_categories, image_url, image_alt,
          view_count, slug
        FROM studies
        ${whereClause}
        ORDER BY 
          CASE WHEN title IS NOT NULL AND title != '' THEN 0 ELSE 1 END,
          view_count DESC,
          id DESC
        LIMIT ${limitInt} OFFSET ${offsetInt}
      `));

      const totalResult = await db.execute(sql.raw(`
        SELECT COUNT(*) as total
        FROM studies
        ${whereClause}
      `));

      const studies = results.rows.map((row: any) => ({
        id: row.id,
        title: row.title || 'Untitled Study',
        abstract: row.abstract || '',
        authors: row.authors || '',
        journal: row.journal || '',
        publishDate: row.publish_date || row.journal_publish_date,
        category: row.category || 'General',
        consumerCategories: row.consumer_categories,
        imageUrl: row.image_url,
        imageAlt: row.image_alt,
        viewCount: row.view_count || 0,
        slug: row.slug,
        relevanceScore: 1.0,
        tags: [],
        relatedStudies: []
      }));

      res.json({
        studies,
        total: parseInt(totalResult.rows[0]?.total || 0),
        facets: { tags: [], journals: [], years: [] },
        suggestions: [],
        trending: ["hydrogen water", "antioxidant", "inflammation", "brain health"]
      });
    } catch (error) {
      console.error('Enhanced search error:', error);
      res.status(500).json({ 
        error: 'Search failed',
        studies: [],
        total: 0,
        facets: { tags: [], journals: [], years: [] },
        suggestions: [],
        trending: []
      });
    }
  });
}