/**
 * Tag-based Search and Filtering Routes
 * Provides API endpoints for tag-based content discovery
 */

import { Request, Response } from "express";
import { db } from "./db";
import { studies, tags, studyTags, tagCategories } from "@shared/schema";
import { eq, desc, ilike, sql, and, inArray } from "drizzle-orm";

/**
 * Get all available tags with usage counts
 */
export async function getAllTags(req: Request, res: Response) {
  try {
    const { category, limit = 50 } = req.query;
    
    let query = db
      .select({
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
        category: tags.category,
        description: tags.description,
        color: tags.color,
        usageCount: tags.usageCount
      })
      .from(tags)
      .orderBy(desc(tags.usageCount))
      .limit(parseInt(limit as string));

    if (category) {
      query = query.where(eq(tags.category, category as string));
    }

    const allTags = await query;
    
    res.json({
      success: true,
      tags: allTags,
      total: allTags.length
    });
  } catch (error) {
    console.error('Error getting all tags:', error);
    res.status(500).json({ message: 'Failed to retrieve tags' });
  }
}

/**
 * Get tag categories with counts
 */
export async function getTagCategories(req: Request, res: Response) {
  try {
    const categories = await db
      .select({
        id: tagCategories.id,
        name: tagCategories.name,
        slug: tagCategories.slug,
        description: tagCategories.description,
        color: tagCategories.color,
        sortOrder: tagCategories.sortOrder,
        tagCount: sql<number>`COUNT(${tags.id})::int`
      })
      .from(tagCategories)
      .leftJoin(tags, eq(tags.category, tagCategories.slug))
      .groupBy(
        tagCategories.id,
        tagCategories.name,
        tagCategories.slug,
        tagCategories.description,
        tagCategories.color,
        tagCategories.sortOrder
      )
      .orderBy(tagCategories.sortOrder);

    res.json({
      success: true,
      categories: categories.map(cat => ({
        ...cat,
        tagCount: cat.tagCount || 0
      }))
    });
  } catch (error) {
    console.error('Error getting tag categories:', error);
    res.status(500).json({ message: 'Failed to retrieve tag categories' });
  }
}

/**
 * Search studies by tags
 */
export async function searchStudiesByTags(req: Request, res: Response) {
  try {
    const { 
      tagIds, 
      tagNames, 
      category, 
      limit = 20, 
      offset = 0,
      matchType = 'any' // 'any' or 'all'
    } = req.query;

    let tagIdsArray: number[] = [];

    // Handle tag IDs
    if (tagIds) {
      const ids = Array.isArray(tagIds) ? tagIds : [tagIds];
      tagIdsArray = ids.map(id => parseInt(id as string)).filter(id => !isNaN(id));
    }

    // Handle tag names (convert to IDs)
    if (tagNames) {
      const names = Array.isArray(tagNames) ? tagNames : [tagNames];
      const tagsByName = await db
        .select({ id: tags.id })
        .from(tags)
        .where(inArray(tags.name, names as string[]));
      
      tagIdsArray.push(...tagsByName.map(t => t.id));
    }

    // Handle category filter
    if (category && tagIdsArray.length === 0) {
      const tagsInCategory = await db
        .select({ id: tags.id })
        .from(tags)
        .where(eq(tags.category, category as string));
      
      tagIdsArray = tagsInCategory.map(t => t.id);
    }

    if (tagIdsArray.length === 0) {
      return res.json({
        success: true,
        studies: [],
        total: 0,
        tags: []
      });
    }

    // Build the query based on match type
    let studyQuery;
    
    if (matchType === 'all') {
      // Find studies that have ALL specified tags
      studyQuery = db
        .select({
          id: studies.id,
          title: studies.title,
          abstract: studies.abstract,
          authors: studies.authors,
          journal: studies.journal,
          publishDate: studies.publishDate,
          category: studies.category,
          imageUrl: studies.imageUrl,
          viewCount: studies.viewCount
        })
        .from(studies)
        .innerJoin(studyTags, eq(studyTags.studyId, studies.id))
        .where(inArray(studyTags.tagId, tagIdsArray))
        .groupBy(
          studies.id,
          studies.title,
          studies.abstract,
          studies.authors,
          studies.journal,
          studies.publishDate,
          studies.category,
          studies.imageUrl,
          studies.viewCount
        )
        .having(sql`COUNT(DISTINCT ${studyTags.tagId}) = ${tagIdsArray.length}`)
        .orderBy(desc(studies.viewCount))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));
    } else {
      // Find studies that have ANY of the specified tags
      studyQuery = db
        .selectDistinct({
          id: studies.id,
          title: studies.title,
          abstract: studies.abstract,
          authors: studies.authors,
          journal: studies.journal,
          publishDate: studies.publishDate,
          category: studies.category,
          imageUrl: studies.imageUrl,
          viewCount: studies.viewCount
        })
        .from(studies)
        .innerJoin(studyTags, eq(studyTags.studyId, studies.id))
        .where(inArray(studyTags.tagId, tagIdsArray))
        .orderBy(desc(studies.viewCount))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));
    }

    const matchedStudies = await studyQuery;

    // Get tags for the matched studies
    const studyIds = matchedStudies.map(s => s.id);
    let studyTagsData = [];
    
    if (studyIds.length > 0) {
      studyTagsData = await db
        .select({
          studyId: studyTags.studyId,
          tagId: tags.id,
          tagName: tags.name,
          tagCategory: tags.category,
          tagColor: tags.color,
          confidence: studyTags.confidence,
          source: studyTags.source
        })
        .from(studyTags)
        .innerJoin(tags, eq(tags.id, studyTags.tagId))
        .where(inArray(studyTags.studyId, studyIds))
        .orderBy(desc(studyTags.confidence));
    }

    // Group tags by study
    const studiesWithTags = matchedStudies.map(study => ({
      ...study,
      tags: studyTagsData
        .filter(st => st.studyId === study.id)
        .map(st => ({
          id: st.tagId,
          name: st.tagName,
          category: st.tagCategory,
          color: st.tagColor,
          confidence: st.confidence,
          source: st.source
        }))
    }));

    // Get total count for pagination
    const totalCountQuery = matchType === 'all' 
      ? db
          .select({ count: sql<number>`COUNT(DISTINCT ${studies.id})::int` })
          .from(studies)
          .innerJoin(studyTags, eq(studyTags.studyId, studies.id))
          .where(inArray(studyTags.tagId, tagIdsArray))
          .groupBy(studies.id)
          .having(sql`COUNT(DISTINCT ${studyTags.tagId}) = ${tagIdsArray.length}`)
      : db
          .select({ count: sql<number>`COUNT(DISTINCT ${studies.id})::int` })
          .from(studies)
          .innerJoin(studyTags, eq(studyTags.studyId, studies.id))
          .where(inArray(studyTags.tagId, tagIdsArray));

    const [totalResult] = await totalCountQuery;
    const total = totalResult?.count || 0;

    // Get the tags that were searched for
    const searchedTags = await db
      .select({
        id: tags.id,
        name: tags.name,
        category: tags.category,
        color: tags.color
      })
      .from(tags)
      .where(inArray(tags.id, tagIdsArray));

    res.json({
      success: true,
      studies: studiesWithTags,
      total,
      searchedTags,
      matchType,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: parseInt(offset as string) + parseInt(limit as string) < total
      }
    });

  } catch (error) {
    console.error('Error searching studies by tags:', error);
    res.status(500).json({ message: 'Failed to search studies by tags' });
  }
}

/**
 * Get related tags based on co-occurrence with specified tags
 */
export async function getRelatedTags(req: Request, res: Response) {
  try {
    const { tagIds, limit = 10 } = req.query;
    
    if (!tagIds) {
      return res.status(400).json({ message: 'Tag IDs are required' });
    }

    const ids = Array.isArray(tagIds) ? tagIds : [tagIds];
    const tagIdsArray = ids.map(id => parseInt(id as string)).filter(id => !isNaN(id));

    if (tagIdsArray.length === 0) {
      return res.json({ success: true, relatedTags: [] });
    }

    // Find studies that have the specified tags
    const studiesWithTags = await db
      .selectDistinct({ studyId: studyTags.studyId })
      .from(studyTags)
      .where(inArray(studyTags.tagId, tagIdsArray));

    const studyIds = studiesWithTags.map(s => s.studyId);

    if (studyIds.length === 0) {
      return res.json({ success: true, relatedTags: [] });
    }

    // Find other tags that co-occur with these studies
    const relatedTags = await db
      .select({
        id: tags.id,
        name: tags.name,
        category: tags.category,
        color: tags.color,
        coOccurrenceCount: sql<number>`COUNT(${studyTags.studyId})::int`
      })
      .from(tags)
      .innerJoin(studyTags, eq(studyTags.tagId, tags.id))
      .where(
        and(
          inArray(studyTags.studyId, studyIds),
          sql`${tags.id} NOT IN (${tagIdsArray.join(',')})`
        )
      )
      .groupBy(tags.id, tags.name, tags.category, tags.color)
      .orderBy(sql`COUNT(${studyTags.studyId}) DESC`)
      .limit(parseInt(limit as string));

    res.json({
      success: true,
      relatedTags
    });

  } catch (error) {
    console.error('Error getting related tags:', error);
    res.status(500).json({ message: 'Failed to get related tags' });
  }
}

/**
 * Get popular tags by category
 */
export async function getPopularTagsByCategory(req: Request, res: Response) {
  try {
    const { limit = 5 } = req.query;
    
    const popularTags = await db
      .select({
        category: tags.category,
        tags: sql<any[]>`json_agg(
          json_build_object(
            'id', ${tags.id},
            'name', ${tags.name},
            'usageCount', ${tags.usageCount},
            'color', ${tags.color}
          ) ORDER BY ${tags.usageCount} DESC
        )`
      })
      .from(tags)
      .where(sql`${tags.usageCount} > 0`)
      .groupBy(tags.category);

    // Limit tags per category
    const limitedTags = popularTags.map(cat => ({
      category: cat.category,
      tags: (cat.tags || []).slice(0, parseInt(limit as string))
    }));

    res.json({
      success: true,
      popularTagsByCategory: limitedTags
    });

  } catch (error) {
    console.error('Error getting popular tags by category:', error);
    res.status(500).json({ message: 'Failed to get popular tags by category' });
  }
}