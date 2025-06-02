/**
 * Deployment optimization - simplified API responses for faster loading
 */
import { sql } from "drizzle-orm";
import { db } from "./db";

// Cache for frequently accessed data
const deploymentCache = new Map<string, { data: any; timestamp: number }>();

export async function getOptimizedStudies(limit: number = 20, offset: number = 0) {
  const cacheKey = `studies_${limit}_${offset}`;
  const cached = deploymentCache.get(cacheKey);
  
  // Return cached data if less than 5 minutes old
  if (cached && Date.now() - cached.timestamp < 300000) {
    return cached.data;
  }

  try {
    const studies = await db.execute(sql`
      SELECT s.id, s.title, s.abstract, s.authors, s.journal, 
             s.publish_date, s.journal_publish_date, s.category, 
             COALESCE(s.view_count, 0) as view_count
      FROM studies s
      ORDER BY s.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const result = {
      studies: studies.rows.map(row => ({
        id: row.id,
        title: row.title,
        abstract: row.abstract,
        authors: row.authors,
        journal: row.journal,
        publishDate: row.publish_date || row.journal_publish_date,
        category: row.category,
        viewCount: row.view_count || 0,
        tags: [],
        relatedStudies: []
      })),
      total: studies.rows.length
    };

    deploymentCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error('Error fetching optimized studies:', error);
    return { studies: [], total: 0 };
  }
}

export async function getOptimizedTags() {
  const cacheKey = 'tags_trending';
  const cached = deploymentCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < 600000) {
    return cached.data;
  }

  try {
    const tags = await db.execute(sql`
      SELECT t.name, COUNT(st.study_id) as usage_count
      FROM tags t
      INNER JOIN study_tags st ON t.id = st.tag_id
      GROUP BY t.id, t.name
      ORDER BY usage_count DESC
      LIMIT 10
    `);

    const result = {
      trending: tags.rows.map(row => row.name)
    };

    deploymentCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error('Error fetching optimized tags:', error);
    return { trending: [] };
  }
}

export async function getOptimizedCategories() {
  const cacheKey = 'categories_list';
  const cached = deploymentCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < 600000) {
    return cached.data;
  }

  try {
    const categories = await db.execute(sql`
      SELECT category, COUNT(*) as count
      FROM studies
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
      LIMIT 20
    `);

    const result = {
      categories: categories.rows.map(row => ({
        name: row.category,
        count: row.count
      }))
    };

    deploymentCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error('Error fetching optimized categories:', error);
    return { categories: [] };
  }
}