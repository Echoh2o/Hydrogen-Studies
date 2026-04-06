import { db } from "../db";
import {
  studies, seoMetadata, contentAnalytics, userEngagement, contentInsights,
  contentVersions, updateNotifications, updateHistory, contentRelationships,
  smartLinks, contentDependencies, blogGenerationJobs, reviewRecommendations,
  deletedStudies,
  type Study, type InsertStudy,
} from "@shared/schema";
import { eq, or, sql, desc, asc, and, count, isNull, isNotNull, inArray } from "drizzle-orm";
import { logger } from "../utils/logger";

// Track whether full-text search is available (set after first successful/failed query)
let ftsAvailable: boolean | null = null;
async function checkFtsAvailable(): Promise<boolean> {
  if (ftsAvailable !== null) return ftsAvailable;
  try {
    await db.execute(sql`SELECT search_vector FROM studies LIMIT 0`);
    ftsAvailable = true;
  } catch {
    ftsAvailable = false;
  }
  return ftsAvailable;
}

export interface StudyFilters {
  query?: string;
  keyword?: string;
  author?: string;
  yearFrom?: string | number;
  yearTo?: string | number;
  category?: string;
  isPeerReviewed?: boolean | string | null;
  hasHealthImplications?: boolean | string | null;
  hasMedia?: boolean | string | null;
  dateFrom?: string;
  dateTo?: string;
  page?: number | string;
  pageSize?: number | string;
  sortField?: string;
  sortOrder?: "asc" | "desc";
  sortBy?: string;
  peerReviewed?: boolean;
  [key: string]: any;
}

export interface PaginatedResults<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface DeletionPreview {
  studyId: number;
  studyTitle: string;
  relatedCounts: Record<string, number>;
  totalRelatedRecords: number;
}

export class StudyService {
  async getStudies(filters: StudyFilters = {}): Promise<PaginatedResults<Study>> {
    try {
      const whereConditions = [];

      // Full-text search using PostgreSQL tsvector/tsquery when available,
      // with LIKE fallback when search_vector column doesn't exist
      const searchTerm = filters.query || filters.search;
      let useRelevanceSort = false;
      let tsQueryString = "";
      if (searchTerm) {
        const sanitized = searchTerm.trim().replace(/[^\w\s-]/g, " ");
        const words = sanitized.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 2);

        if (words.length > 0) {
          const hasFts = await checkFtsAvailable();

          if (hasFts) {
            // Full-text search with relevance ranking and stemming
            tsQueryString = words.join(" | ");
            whereConditions.push(
              sql`search_vector @@ to_tsquery('english', ${tsQueryString})`
            );
            useRelevanceSort = true;
          } else {
            // Fallback: LIKE matching with OR logic across words
            const wordConditions = words.map((word: string) => {
              const term = `%${word}%`;
              return or(
                sql`LOWER(${studies.title}) LIKE ${term}`,
                sql`LOWER(${studies.abstract}) LIKE ${term}`
              );
            });
            whereConditions.push(or(...wordConditions));
          }
        }
      }

      // Keyword filter
      if (filters.keyword) {
        const keywordTerm = `%${filters.keyword.toLowerCase()}%`;
        whereConditions.push(
          or(
            sql`LOWER(${studies.title}) LIKE ${keywordTerm}`,
            sql`LOWER(${studies.abstract}) LIKE ${keywordTerm}`
          )
        );
      }

      // Author filter
      if (filters.author) {
        const authorTerm = `%${filters.author.toLowerCase()}%`;
        whereConditions.push(sql`LOWER(${studies.authors}) LIKE ${authorTerm}`);
      }

      // Year filters
      if (filters.yearFrom) {
         // Handle string or number input safely
         const year = parseInt(filters.yearFrom.toString());
         if (!isNaN(year)) {
           whereConditions.push(sql`${studies.publishYear} >= ${year}`);
         }
      }
      if (filters.yearTo) {
         const year = parseInt(filters.yearTo.toString());
         if (!isNaN(year)) {
           whereConditions.push(sql`${studies.publishYear} <= ${year}`);
         }
      }

      // Category filter
      if (filters.category) {
        whereConditions.push(sql`LOWER(${studies.category}) LIKE ${`%${filters.category.toLowerCase()}%`}`);
      }

      // Country filter
      if (filters.country) {
        whereConditions.push(sql`LOWER(${studies.country}) LIKE ${`%${filters.country.toLowerCase()}%`}`);
      }

      // Study type filter (human/clinical)
      if (filters.studyType) {
        const st = filters.studyType.toLowerCase();
        if (st === "human") {
          whereConditions.push(sql`(LOWER(${studies.studyType}) LIKE '%human%' OR LOWER(${studies.studyType}) LIKE '%clinical%')`);
        }
      }

      // Peer review filter
      if (filters.isPeerReviewed === true || filters.peerReviewed === true || filters.isPeerReviewed === 'true') {
        whereConditions.push(eq(studies.peerReviewed, true));
      } else if (filters.isPeerReviewed === false || filters.peerReviewed === false || filters.isPeerReviewed === 'false') {
        whereConditions.push(eq(studies.peerReviewed, false));
      }

      // Media filter
      if (filters.hasMedia === true || filters.hasMedia === 'true') {
        whereConditions.push(
          or(
            isNotNull(studies.imageUrl),
            isNotNull(studies.videoUrl),
            isNotNull(studies.audioUrl)
          )
        );
      } else if (filters.hasMedia === false || filters.hasMedia === 'false') {
        whereConditions.push(
          and(
            isNull(studies.imageUrl),
            isNull(studies.videoUrl),
            isNull(studies.audioUrl)
          )
        );
      }
      


      // Date filters
      if (filters.dateFrom) {
        whereConditions.push(sql`${studies.publishDate} >= ${filters.dateFrom}`);
      }
      if (filters.dateTo) {
        whereConditions.push(sql`${studies.publishDate} <= ${filters.dateTo}`);
      }

      // Build WHERE clause
      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      // Count query
      const countResult = whereClause
        ? await db.select({ value: count() }).from(studies).where(whereClause)
        : await db.select({ value: count() }).from(studies);
      const total = countResult[0]?.value || 0;

      // Pagination
      const page = Math.max(1, parseInt(filters.page?.toString() || "1", 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(filters.limit?.toString() || filters.pageSize?.toString() || "20", 10)));
      const offset = (page - 1) * pageSize;

      // Sorting — use relevance ranking when full-text search is active
      const sortField = filters.sortField || filters.sortBy || "publishDate";
      const sortOrder = filters.sortOrder === "asc" ? "asc" : "desc";
      const userRequestedSort = filters.sortField || filters.sortBy;

      let orderByClause;

      if (useRelevanceSort && !userRequestedSort && tsQueryString) {
        // Default to relevance ranking for search queries
        orderByClause = sql`ts_rank(search_vector, to_tsquery('english', ${tsQueryString})) DESC`;
      } else {
        let sortColumn;
        if (sortField === "date") sortColumn = studies.publishDate;
        else if (sortField === "title") sortColumn = studies.title;
        else if (sortField === "author") sortColumn = studies.authors;
        else if (sortField === "journal") sortColumn = studies.journal;
        else if (sortField === "publishYear") sortColumn = studies.publishYear;
        else if (sortField === "viewCount") sortColumn = studies.viewCount;
        else if (sortField === "journalPublishDate") sortColumn = studies.journalPublishDate;
        else sortColumn = studies.id;
        orderByClause = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);
      }

      // Main query - build complete chain
      const data = whereClause
        ? await db.select().from(studies).where(whereClause).orderBy(orderByClause).limit(pageSize).offset(offset)
        : await db.select().from(studies).orderBy(orderByClause).limit(pageSize).offset(offset);

      return {
        data,
        total,
        page,
        pageSize: pageSize, // Normalized page size
        pageCount: Math.ceil(total / pageSize),
      };
    } catch (error) {
      console.error("Error in StudyService.getStudies:", error);
      throw error;
    }
  }

  async getStudyById(id: number): Promise<Study | undefined> {
    const result = await db
      .select()
      .from(studies)
      .where(eq(studies.id, id))
      .limit(1);
    const study = result[0];
    
    // Note: imageUrl stays null if no image exists.
    // Frontend handles placeholder display. Injecting placehold.co URLs
    // here would prevent the image generator from detecting missing images.
    
    return study;
  }

  async getStudyBySlug(slug: string): Promise<Study | undefined> {
    // Normalize non-breaking hyphens (U+2011) and other dash variants to regular hyphens
    const normalizedSlug = slug.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\uFE58\uFE63\uFF0D]/g, "-");
    const result = await db
        .select()
        .from(studies)
        .where(eq(studies.slug, normalizedSlug))
        .limit(1);
    return result[0];
  }

  async getStudyByIdentifier(identifier: string): Promise<Study | undefined> {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const result = await db
      .select()
      .from(studies)
      .where(sql`LOWER(${studies.doi}) = ${normalizedIdentifier}`)
      .limit(1);
    return result[0];
  }
  
  async getLatestStudies(limit: number = 20): Promise<Study[]> {
     return await db.select()
        .from(studies)
        .orderBy(desc(studies.id))
        .limit(limit);
  }

  async createStudy(study: InsertStudy): Promise<Study> {
    const [insertedStudy] = await db
      .insert(studies)
      .values({ ...study, createdAt: new Date() })
      .returning();

    // Fire-and-forget: enqueue for content generation pipeline
    try {
      const { enqueueStudy } = await import("./content-generation-worker");
      enqueueStudy(insertedStudy.id).catch((err) => {
        logger.warn(`Failed to enqueue study ${insertedStudy.id} for content generation: ${err.message}`, "StudyService");
      });
    } catch (err: any) {
      logger.warn(`Failed to import content-generation-worker: ${err.message}`, "StudyService");
    }

    return insertedStudy;
  }

  async updateStudy(id: number, study: Partial<InsertStudy>): Promise<Study> {
    const [updatedStudy] = await db
      .update(studies)
      .set(study)
      .where(eq(studies.id, id))
      .returning();
    return updatedStudy;
  }

  async getDeletionPreview(studyId: number): Promise<DeletionPreview | null> {
    const study = await this.getStudyById(studyId);
    if (!study) return null;

    const results = await Promise.allSettled([
      db.select({ value: count() }).from(seoMetadata).where(and(eq(seoMetadata.entityType, "study"), eq(seoMetadata.entityId, studyId))),
      db.select({ value: count() }).from(contentAnalytics).where(and(eq(contentAnalytics.contentType, "study"), eq(contentAnalytics.contentId, studyId))),
      db.select({ value: count() }).from(userEngagement).where(and(eq(userEngagement.contentType, "study"), eq(userEngagement.contentId, studyId))),
      db.select({ value: count() }).from(contentInsights).where(and(eq(contentInsights.contentType, "study"), eq(contentInsights.contentId, studyId))),
      db.select({ value: count() }).from(contentVersions).where(and(eq(contentVersions.contentType, "study"), eq(contentVersions.contentId, studyId))),
      db.select({ value: count() }).from(contentRelationships).where(
        or(
          and(eq(contentRelationships.sourceType, "study"), eq(contentRelationships.sourceId, studyId)),
          and(eq(contentRelationships.targetType, "study"), eq(contentRelationships.targetId, studyId)),
        ),
      ),
      db.select({ value: count() }).from(smartLinks).where(
        or(
          and(eq(smartLinks.fromType, "study"), eq(smartLinks.fromId, studyId)),
          and(eq(smartLinks.toType, "study"), eq(smartLinks.toId, studyId)),
        ),
      ),
      db.select({ value: count() }).from(updateNotifications).where(and(eq(updateNotifications.contentType, "study"), eq(updateNotifications.contentId, studyId))),
      db.select({ value: count() }).from(updateHistory).where(and(eq(updateHistory.contentType, "study"), eq(updateHistory.contentId, studyId))),
      db.select({ value: count() }).from(contentDependencies).where(and(eq(contentDependencies.dependencyType, "study"), eq(contentDependencies.dependencyId, studyId))),
    ]);

    const extractCount = (r: PromiseSettledResult<{ value: number }[]>) =>
      r.status === "fulfilled" ? (r.value[0]?.value ?? 0) : 0;

    const relatedCounts = {
      seoMetadata: extractCount(results[0]),
      contentAnalytics: extractCount(results[1]),
      userEngagement: extractCount(results[2]),
      contentInsights: extractCount(results[3]),
      contentVersions: extractCount(results[4]),
      contentRelationships: extractCount(results[5]),
      smartLinks: extractCount(results[6]),
      updateNotifications: extractCount(results[7]),
      updateHistory: extractCount(results[8]),
      contentDependencies: extractCount(results[9]),
    };

    const totalRelatedRecords = Object.values(relatedCounts).reduce((a, b) => a + b, 0);

    return {
      studyId,
      studyTitle: study.title || `Study #${studyId}`,
      relatedCounts,
      totalRelatedRecords,
    };
  }

  private async cleanupSoftReferences(studyId: number): Promise<string[]> {
    const warnings: string[] = [];

    // Direct deletes for contentType/entityType pattern tables
    const deleteOps: { name: string; fn: () => Promise<unknown> }[] = [
      { name: "seoMetadata", fn: () => db.delete(seoMetadata).where(and(eq(seoMetadata.entityType, "study"), eq(seoMetadata.entityId, studyId))) },
      { name: "contentAnalytics", fn: () => db.delete(contentAnalytics).where(and(eq(contentAnalytics.contentType, "study"), eq(contentAnalytics.contentId, studyId))) },
      { name: "userEngagement", fn: () => db.delete(userEngagement).where(and(eq(userEngagement.contentType, "study"), eq(userEngagement.contentId, studyId))) },
      { name: "contentInsights", fn: () => db.delete(contentInsights).where(and(eq(contentInsights.contentType, "study"), eq(contentInsights.contentId, studyId))) },
      { name: "contentVersions", fn: () => db.delete(contentVersions).where(and(eq(contentVersions.contentType, "study"), eq(contentVersions.contentId, studyId))) },
      { name: "updateNotifications", fn: () => db.delete(updateNotifications).where(and(eq(updateNotifications.contentType, "study"), eq(updateNotifications.contentId, studyId))) },
      { name: "updateHistory", fn: () => db.delete(updateHistory).where(and(eq(updateHistory.contentType, "study"), eq(updateHistory.contentId, studyId))) },
      {
        name: "contentRelationships",
        fn: () => db.delete(contentRelationships).where(
          or(
            and(eq(contentRelationships.sourceType, "study"), eq(contentRelationships.sourceId, studyId)),
            and(eq(contentRelationships.targetType, "study"), eq(contentRelationships.targetId, studyId)),
          ),
        ),
      },
      {
        name: "smartLinks",
        fn: () => db.delete(smartLinks).where(
          or(
            and(eq(smartLinks.fromType, "study"), eq(smartLinks.fromId, studyId)),
            and(eq(smartLinks.toType, "study"), eq(smartLinks.toId, studyId)),
          ),
        ),
      },
      { name: "contentDependencies", fn: () => db.delete(contentDependencies).where(and(eq(contentDependencies.dependencyType, "study"), eq(contentDependencies.dependencyId, studyId))) },
    ];

    for (const op of deleteOps) {
      try {
        await op.fn();
      } catch (err: any) {
        warnings.push(`Failed to clean ${op.name}: ${err.message}`);
      }
    }

    // Array scrubbing — remove studyId from integer[] columns
    const arrayOps: { name: string; query: ReturnType<typeof sql> }[] = [
      { name: "blogGenerationJobs.studyIds", query: sql`UPDATE blog_generation_jobs SET study_ids = array_remove(study_ids, ${studyId}) WHERE ${studyId} = ANY(study_ids)` },
      { name: "reviewRecommendations.relatedStudyIds", query: sql`UPDATE review_recommendations SET related_study_ids = array_remove(related_study_ids, ${studyId}) WHERE ${studyId} = ANY(related_study_ids)` },
      { name: "reviewRecommendations.contradictsStudyIds", query: sql`UPDATE review_recommendations SET contradicts_study_ids = array_remove(contradicts_study_ids, ${studyId}) WHERE ${studyId} = ANY(contradicts_study_ids)` },
    ];

    for (const op of arrayOps) {
      try {
        await db.execute(op.query);
      } catch (err: any) {
        warnings.push(`Failed to scrub ${op.name}: ${err.message}`);
      }
    }

    return warnings;
  }

  async deleteStudy(id: number, deletedBy?: string, reason?: string): Promise<{ success: boolean; studyId: number; studyTitle: string; warnings: string[] } | null> {
    const study = await this.getStudyById(id);
    if (!study) return null;

    const warnings = await this.cleanupSoftReferences(id);

    // Record in deleted_studies ledger before removing the row
    try {
      await db.insert(deletedStudies).values({
        originalStudyId: id,
        title: study.title || "",
        doi: study.doi || null,
        authors: study.authors || null,
        journal: study.journal || null,
        publishYear: study.publishYear ?? null,
        deletedBy: deletedBy || null,
        reason: reason || null,
      });
    } catch (err: any) {
      warnings.push(`Failed to record deletion in ledger: ${err.message}`);
    }

    await db.delete(studies).where(eq(studies.id, id));

    logger.info(`Study deleted: ${study.title}`, "StudyService", {
      studyId: id,
      studyTitle: study.title || "",
      deletedBy: deletedBy || "unknown",
      warnings: warnings.length > 0 ? warnings.join("; ") : undefined,
    } as Record<string, unknown>);

    return { success: true, studyId: id, studyTitle: study.title || `Study #${id}`, warnings };
  }

  async bulkDeleteStudies(studyIds: number[], deletedBy?: string, reason?: string): Promise<{ deleted: number[]; failed: { id: number; error: string }[]; warnings: string[] }> {
    if (studyIds.length > 100) {
      throw new Error("Cannot delete more than 100 studies at once");
    }

    const deleted: number[] = [];
    const failed: { id: number; error: string }[] = [];
    const allWarnings: string[] = [];

    for (const id of studyIds) {
      try {
        const result = await this.deleteStudy(id, deletedBy, reason);
        if (result) {
          deleted.push(id);
          allWarnings.push(...result.warnings);
        } else {
          failed.push({ id, error: "Study not found" });
        }
      } catch (err: any) {
        failed.push({ id, error: err.message });
      }
    }

    return { deleted, failed, warnings: allWarnings };
  }
  
  // Analytics / Trends Methods
  
  async getResearchTrends() {
    // Yearly publication trends
    const yearlyResult = await db.execute(sql`
        SELECT
        publish_year as year,
        COUNT(*) as count
      FROM studies
      WHERE publish_year IS NOT NULL
        AND publish_year >= 2000
      GROUP BY publish_year
      ORDER BY publish_year
    `);
    
    // Category distribution (body_systems is text[] so use array_to_string)
    const categoryResult = await db.execute(sql`
       SELECT
        CASE
          WHEN body_systems IS NOT NULL AND array_length(body_systems, 1) > 0 THEN array_to_string(body_systems, ', ')
          WHEN category IS NOT NULL AND category != '' THEN category
          WHEN title ILIKE '%cardiovascular%' OR title ILIKE '%heart%' THEN 'Cardiovascular'
          WHEN title ILIKE '%brain%' OR title ILIKE '%neuro%' THEN 'Neurological'
          WHEN title ILIKE '%diabetes%' OR title ILIKE '%metabolic%' THEN 'Metabolic'
          WHEN title ILIKE '%inflammation%' OR title ILIKE '%immune%' THEN 'Immune'
          WHEN title ILIKE '%cancer%' OR title ILIKE '%tumor%' THEN 'Cancer'
          WHEN title ILIKE '%exercise%' OR title ILIKE '%athletic%' THEN 'Exercise'
          ELSE 'General Health'
        END as category_name,
        COUNT(*) as count
      FROM studies
      GROUP BY category_name
      ORDER BY count DESC
      LIMIT 10
    `);
    
    return {
        yearlyTrends: yearlyResult.rows.map((row: any) => ({
             year: parseInt(row.year),
             count: parseInt(row.count)
        })),
        categoryTrends: categoryResult.rows.map((row: any) => ({
             category: row.category_name || "General Health",
             count: parseInt(row.count)
        }))
    };
  }
  
  async getHealthOutcomes() {
    // body_systems is text[] — use array_to_string() instead of ILIKE directly on array
    const [cardioResult, nervousResult, metabolicResult, immuneResult] =
      await Promise.all([
        db.execute(sql`SELECT COUNT(*) as studies FROM studies WHERE array_to_string(body_systems, ' ') ILIKE '%Cardiovascular%' OR 'cardiovascular' = ANY(keywords) OR 'heart' = ANY(keywords) OR 'blood pressure' = ANY(keywords) OR title ILIKE '%cardiovascular%' OR title ILIKE '%heart%' OR abstract ILIKE '%cardiovascular%' OR abstract ILIKE '%cardioprotect%'`),
        db.execute(sql`SELECT COUNT(*) as studies FROM studies WHERE array_to_string(body_systems, ' ') ILIKE '%Nervous%' OR 'brain' = ANY(keywords) OR 'neurological' = ANY(keywords) OR 'cognitive' = ANY(keywords) OR title ILIKE '%brain%' OR title ILIKE '%neuro%' OR abstract ILIKE '%neurological%' OR abstract ILIKE '%neuroprotect%'`),
        db.execute(sql`SELECT COUNT(*) as studies FROM studies WHERE array_to_string(body_systems, ' ') ILIKE '%Metabolic%' OR 'diabetes' = ANY(keywords) OR 'metabolism' = ANY(keywords) OR 'glucose' = ANY(keywords) OR title ILIKE '%metabolic%' OR title ILIKE '%diabetes%' OR abstract ILIKE '%metabolism%' OR abstract ILIKE '%glucose%'`),
        db.execute(sql`SELECT COUNT(*) as studies FROM studies WHERE array_to_string(body_systems, ' ') ILIKE '%Immune%' OR 'immune' = ANY(keywords) OR 'inflammation' = ANY(keywords) OR 'oxidative' = ANY(keywords) OR title ILIKE '%immune%' OR title ILIKE '%inflammation%' OR abstract ILIKE '%antioxidant%' OR abstract ILIKE '%anti-inflammatory%'`)
      ]);

      const parseCount = (res: any) => parseInt(res.rows[0]?.studies || 0);
      
      return {
          cardiovascular: {
            studies: parseCount(cardioResult),
            outcomes: [{
                condition: "Cardiovascular Health",
                studyCount: parseCount(cardioResult),
                positiveOutcomes: Math.floor(parseCount(cardioResult) * 0.8),
                bodySystem: "Cardiovascular",
                effectSize: "medium",
                commonBenefits: ["Reduced oxidative stress", "Improved circulation", "Cardioprotective effects"]
            }]
          },
          nervous: {
            studies: parseCount(nervousResult),
            outcomes: [{
                condition: "Neurological Health",
                studyCount: parseCount(nervousResult),
                positiveOutcomes: Math.floor(parseCount(nervousResult) * 0.75),
                bodySystem: "Nervous",
                effectSize: "large",
                commonBenefits: ["Neuroprotection", "Improved cognition", "Reduced brain inflammation"]
            }]
          },
          metabolic: {
            studies: parseCount(metabolicResult),
            outcomes: [{
                condition: "Metabolic Health",
                studyCount: parseCount(metabolicResult),
                positiveOutcomes: Math.floor(parseCount(metabolicResult) * 0.7),
                bodySystem: "Metabolic",
                effectSize: "medium",
                commonBenefits: ["Better glucose control", "Metabolic protection", "Enhanced energy metabolism"]
            }]
          },
          immune: {
            studies: parseCount(immuneResult),
            outcomes: [{
                condition: "Immune Function",
                studyCount: parseCount(immuneResult),
                positiveOutcomes: Math.floor(parseCount(immuneResult) * 0.85),
                bodySystem: "Immune",
                effectSize: "large",
                commonBenefits: ["Reduced inflammation", "Enhanced antioxidant activity", "Immune system support"]
            }]
          }
      };
  }
  async getStudiesByTitlePartial(query: string, limit: number = 50): Promise<Study[]> {
    return await db
      .select()
      .from(studies)
      .where(sql`LOWER(${studies.title}) LIKE ${`%${query.toLowerCase()}%`}`)
      .limit(limit);
  }

  async checkStudyExists(identifier: string): Promise<{ exists: boolean; studyId?: number }> {
    // Check DOI
    const doiResult = await db
      .select({ id: studies.id })
      .from(studies)
      .where(eq(studies.doi, identifier))
      .limit(1);
    
    if (doiResult.length > 0) {
      return { exists: true, studyId: doiResult[0].id };
    }

    return { exists: false };
  }

  /**
   * Check if a study was previously deleted, by DOI or exact title match.
   * Returns the deletion record if found, null otherwise.
   */
  async checkPreviouslyDeleted(title: string, doi?: string | null): Promise<{
    id: number;
    originalStudyId: number;
    title: string;
    doi: string | null;
    deletedBy: string | null;
    deletedAt: Date;
    reason: string | null;
  } | null> {
    // Check by DOI first (strongest identifier)
    if (doi) {
      const byDoi = await db
        .select()
        .from(deletedStudies)
        .where(eq(deletedStudies.doi, doi))
        .limit(1);
      if (byDoi.length > 0) return byDoi[0];
    }

    // Fallback: exact title match (case-insensitive)
    if (title) {
      const byTitle = await db
        .select()
        .from(deletedStudies)
        .where(sql`LOWER(${deletedStudies.title}) = ${title.toLowerCase().trim()}`)
        .limit(1);
      if (byTitle.length > 0) return byTitle[0];
    }

    return null;
  }

  async batchCheckExistingStudies(dois: string[], titles: string[]): Promise<{ doiMap: Map<string, number>; titleMap: Map<string, number> }> {
    const doiMap = new Map<string, number>();
    const titleMap = new Map<string, number>();

    // Batch DOI check
    if (dois.length > 0) {
      const doiResults = await db.select({ id: studies.id, doi: studies.doi }).from(studies).where(inArray(studies.doi, dois));
      for (const r of doiResults) {
        if (r.doi) doiMap.set(r.doi, r.id);
      }
    }

    // Batch title check — fetch all existing titles and compare in JS
    // This avoids problematic large IN clauses with 1000+ params
    if (titles.length > 0) {
      const lowerTitles = new Set(titles.map(t => t.toLowerCase().trim()));
      const allStudies = await db.select({ id: studies.id, title: studies.title }).from(studies);
      for (const r of allStudies) {
        const lower = String(r.title).toLowerCase().trim();
        if (lowerTitles.has(lower)) {
          titleMap.set(lower, r.id);
        }
      }
    }

    return { doiMap, titleMap };
  }

  async batchCheckDeletedStudies(dois: string[], titles: string[]): Promise<{ doiMap: Map<string, { deletedBy: string | null; deletedAt: Date }>; titleMap: Map<string, { deletedBy: string | null; deletedAt: Date }> }> {
    const doiMap = new Map<string, { deletedBy: string | null; deletedAt: Date }>();
    const titleMap = new Map<string, { deletedBy: string | null; deletedAt: Date }>();

    // Fast path: if deleted_studies table is empty, skip entirely
    const countResult = await db.select({ value: count() }).from(deletedStudies);
    if ((countResult[0]?.value ?? 0) === 0) {
      return { doiMap, titleMap };
    }

    if (dois.length > 0) {
      const doiResults = await db.select().from(deletedStudies).where(inArray(deletedStudies.doi, dois));
      for (const r of doiResults) {
        if (r.doi) doiMap.set(r.doi, { deletedBy: r.deletedBy, deletedAt: r.deletedAt });
      }
    }

    if (titles.length > 0) {
      // Fetch all deleted entries and compare in JS — table is small
      const lowerTitles = new Set(titles.map(t => t.toLowerCase().trim()));
      const allDeleted = await db.select().from(deletedStudies);
      for (const r of allDeleted) {
        const lower = String(r.title).toLowerCase().trim();
        if (lowerTitles.has(lower)) {
          titleMap.set(lower, { deletedBy: r.deletedBy, deletedAt: r.deletedAt });
        }
      }
    }

    return { doiMap, titleMap };
  }

  async getDeletedStudies(page: number = 1, pageSize: number = 20): Promise<PaginatedResults<any>> {
    const offset = (page - 1) * pageSize;
    const countResult = await db.select({ value: count() }).from(deletedStudies);
    const total = countResult[0]?.value || 0;
    const data = await db.select().from(deletedStudies).orderBy(desc(deletedStudies.deletedAt)).limit(pageSize).offset(offset);
    return { data, total, page, pageSize, pageCount: Math.ceil(total / pageSize) };
  }

  async removeFromDeletionLedger(id: number): Promise<boolean> {
    const result = await db.delete(deletedStudies).where(eq(deletedStudies.id, id));
    return (result as any).rowCount > 0;
  }

  async bulkRemoveFromDeletionLedger(ids: number[]): Promise<{ removed: number }> {
    const result = await db.delete(deletedStudies).where(inArray(deletedStudies.id, ids));
    return { removed: (result as any).rowCount || 0 };
  }

  // Enhanced Search Methods
  
  async advancedSearch(filters: StudyFilters): Promise<{ studies: Study[], total: number, hasMore: boolean }> {
      const results = await this.getStudies(filters);
      return {
          studies: results.data,
          total: results.total,
          hasMore: (results.page * results.pageSize) < results.total
      };
  }

  async getSearchSuggestions(query: string, limit: number = 10): Promise<string[]> {
       if (!query || query.length < 2) return [];
       
       const suggestions = await db.execute(sql`
        SELECT DISTINCT name 
        FROM tags 
        WHERE name ILIKE ${"%" + query + "%"}
        ORDER BY name
        LIMIT ${limit}
      `);
      
      return suggestions.rows.map((row: any) => row.name);
  }

  async getTrendingTopics(limit: number = 10): Promise<string[]> {
      const trending = await db.execute(sql`
        SELECT t.name, COUNT(st.study_id) as usage_count
        FROM tags t
        INNER JOIN study_tags st ON t.id = st.tag_id
        GROUP BY t.id, t.name
        ORDER BY usage_count DESC
        LIMIT ${limit}
      `);

      return trending.rows.map((row: any) => row.name);
  }

  async getRelatedStudies(studyId: number, category: string, limit: number = 8): Promise<any[]> {
      return await db.select({
          id: studies.id,
          title: studies.title,
          plainLanguageTitle: studies.plainLanguageTitle,
          journal: studies.journal,
          publishDate: studies.publishDate,
          journalPublishDate: studies.journalPublishDate,
          slug: studies.slug,
          category: studies.category,
        })
        .from(studies)
        .where(
          sql`${studies.id} != ${studyId} AND (
          ${studies.category} = ${category} OR 
          ${studies.title} ILIKE '%acne%' OR 
          ${studies.title} ILIKE '%skin%' OR 
          ${studies.abstract} ILIKE '%dermatological%'
        )`
        )
        .limit(limit);
  }

  async recordView(studyId: number): Promise<void> {
      await db.execute(sql`
        UPDATE studies 
        SET view_count = COALESCE(view_count, 0) + 1
        WHERE id = ${studyId}
      `);
  }



  async getFilterStats() {
      const [years, countries, studyTypes, journals] = await Promise.all([
          db.execute(sql`
            SELECT publish_year, COUNT(*) as count
            FROM studies
            WHERE publish_year IS NOT NULL
            GROUP BY publish_year
            ORDER BY publish_year DESC
          `),
          db.execute(sql`
            SELECT country, COUNT(*) as count
            FROM studies
            WHERE country IS NOT NULL AND country != ''
            GROUP BY country
            ORDER BY count DESC
            LIMIT 20
          `),
          db.execute(sql`
            SELECT study_type, COUNT(*) as count
            FROM studies
            WHERE study_type IS NOT NULL AND study_type != ''
            GROUP BY study_type
            ORDER BY count DESC
          `),
          db.execute(sql`
            SELECT journal, COUNT(*) as count
            FROM studies
            WHERE journal IS NOT NULL AND journal != ''
            GROUP BY journal
            ORDER BY count DESC
            LIMIT 30
          `)
      ]);

      return {
          years: years.rows,
          countries: countries.rows,
          studyTypes: studyTypes.rows,
          journals: journals.rows
      };
  }

  async getOverview() {
      const [totalStudies, categoryCounts, countryCounts, yearRange] =
      await Promise.all([
        db.execute(sql`SELECT COUNT(*) as count FROM studies`),
        db.execute(sql`
        SELECT category, COUNT(*) as count
        FROM studies
        WHERE category IS NOT NULL AND category != ''
        GROUP BY category
        ORDER BY count DESC
        LIMIT 10
      `),
        db.execute(sql`
        SELECT country, COUNT(*) as count
        FROM studies
        WHERE country IS NOT NULL AND country != ''
        GROUP BY country
        ORDER BY count DESC
        LIMIT 10
      `),
        db.execute(sql`
        SELECT MIN(publish_year) as min_year, MAX(publish_year) as max_year
        FROM studies
        WHERE publish_year IS NOT NULL
      `),
      ]);

    return {
      totalStudies: parseInt(String(totalStudies.rows[0]?.count || '0')),
      categoryCounts: categoryCounts.rows,
      countryCounts: countryCounts.rows,
      yearRange: yearRange.rows[0],
      lastUpdated: new Date().toISOString(),
    };
  }
  async getStudyInsights(studyId: number) {
      if (!db.query.seoMetadata) return null;
      const result = await db.query.seoMetadata.findFirst({
        where: (seo, { eq, and }) => and(
            eq(seo.entityType, 'study'),
            eq(seo.entityId, studyId)
        )
      });
      return result;
  }
}

export const studyService = new StudyService();
