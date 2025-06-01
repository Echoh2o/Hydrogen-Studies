import { 
  studies, categories, newsletters, contactMessages, studyReviewQueue,
  type Study, type InsertStudy,
  type Category, type InsertCategory,
  type Newsletter, type InsertNewsletter,
  type InsertContact,
  type StudyReviewQueue, type InsertStudyReviewQueue,
  ReviewStatus
} from "@shared/schema";

import { eq, like, and, or, sql, desc, asc, count, isNull, isNotNull } from "drizzle-orm";
import { db } from "./db";
import { StudyFilters, PaginatedResults, IStorage } from "./storage";

/**
 * Database implementation of the storage interface
 * Note: This implementation focuses on the core study operations for now
 */
export class DatabaseStorage implements Partial<IStorage> {
  // Category cache for better performance
  private categoryCache: Map<string, Category> = new Map();
  private categoryCacheLastUpdate: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

  /**
   * Get paginated and filtered studies
   */
  async getStudies(filters: StudyFilters = {}): Promise<PaginatedResults<Study>> {
    try {
      console.log("Database search with filters:", filters);
      
      // Start building the query with conditions
      let whereConditions = [];
      
      // Apply enhanced multi-field text search
      if (filters.query) {
        const searchTerm = `%${filters.query.toLowerCase()}%`;
        
        // Build comprehensive search across all content fields
        let searchFields = [
          sql`LOWER(${studies.title}) LIKE ${searchTerm}`,
          sql`LOWER(${studies.abstract}) LIKE ${searchTerm}`,
          sql`LOWER(${studies.authors}) LIKE ${searchTerm}`,
          sql`LOWER(${studies.keywords}) LIKE ${searchTerm}`
        ];
        
        // Include rich content fields when available and enabled
        if (filters.searchInMethods !== false) {
          searchFields.push(sql`LOWER(${studies.methods}) LIKE ${searchTerm}`);
        }
        
        if (filters.searchInResults !== false) {
          searchFields.push(sql`LOWER(${studies.results}) LIKE ${searchTerm}`);
        }
        
        if (filters.searchInConclusion !== false) {
          searchFields.push(sql`LOWER(${studies.conclusion}) LIKE ${searchTerm}`);
        }
        
        // Also search in objectives and summary fields
        searchFields.push(
          sql`LOWER(${studies.objective}) LIKE ${searchTerm}`,
          sql`LOWER(${studies.summaryMarkdown}) LIKE ${searchTerm}`
        );
        
        whereConditions.push(or(...searchFields));
      }
      
      // Apply enhanced keyword filter across all content
      if (filters.keyword) {
        const keywordTerm = `%${filters.keyword.toLowerCase()}%`;
        whereConditions.push(
          or(
            sql`LOWER(${studies.title}) LIKE ${keywordTerm}`,
            sql`LOWER(${studies.abstract}) LIKE ${keywordTerm}`,
            sql`LOWER(${studies.keywords}) LIKE ${keywordTerm}`,
            sql`LOWER(${studies.methods}) LIKE ${keywordTerm}`,
            sql`LOWER(${studies.results}) LIKE ${keywordTerm}`,
            sql`LOWER(${studies.conclusion}) LIKE ${keywordTerm}`,
            sql`LOWER(${studies.objective}) LIKE ${keywordTerm}`
          )
        );
      }
      
      // Apply author filter
      if (filters.author) {
        const authorTerm = `%${filters.author.toLowerCase()}%`;
        whereConditions.push(sql`LOWER(${studies.authors}) LIKE ${authorTerm}`);
      }
      
      // Apply year filters
      if (filters.yearFrom) {
        whereConditions.push(sql`${studies.publishYear} >= ${parseInt(filters.yearFrom.toString())}`);
      }
      
      if (filters.yearTo) {
        whereConditions.push(sql`${studies.publishYear} <= ${parseInt(filters.yearTo.toString())}`);
      }
      
      // Apply category filter
      if (filters.category) {
        whereConditions.push(eq(studies.category, filters.category));
      }
      
      // Apply peer review filter
      if (filters.isPeerReviewed === true || filters.peerReviewed === true) {
        whereConditions.push(eq(studies.peerReviewed, true));
      } else if (filters.isPeerReviewed === false || filters.peerReviewed === false) {
        whereConditions.push(eq(studies.peerReviewed, false));
      }
      
      // Apply media filter
      if (filters.hasMedia === true) {
        whereConditions.push(
          or(
            isNotNull(studies.imageUrl),
            isNotNull(studies.videoUrl),
            isNotNull(studies.audioUrl)
          )
        );
      } else if (filters.hasMedia === false) {
        whereConditions.push(
          and(
            isNull(studies.imageUrl),
            isNull(studies.videoUrl),
            isNull(studies.audioUrl)
          )
        );
      }
      
      // Apply date filters
      if (filters.dateFrom) {
        whereConditions.push(sql`${studies.publishDate} >= ${filters.dateFrom}`);
      }
      
      if (filters.dateTo) {
        whereConditions.push(sql`${studies.publishDate} <= ${filters.dateTo}`);
      }
      
      // Build count query to get total records
      const countQuery = db.select({ value: count() }).from(studies);
      if (whereConditions.length > 0) {
        countQuery.where(and(...whereConditions));
      }
      
      // Execute count query
      const countResult = await countQuery;
      const total = countResult[0]?.value || 0;
      
      // Determine pagination
      const page = parseInt(filters.page?.toString() || '1');
      const pageSize = parseInt(filters.pageSize?.toString() || '10');
      const offset = (page - 1) * pageSize;
      
      // Build the main query
      const studiesQuery = db.select().from(studies);
      
      if (whereConditions.length > 0) {
        studiesQuery.where(and(...whereConditions));
      }
      
      // Apply sorting with relevance priority for search queries
      const sortField = filters.sortField || filters.sortBy || 'publishDate';
      const sortOrder = filters.sortOrder || 'desc';
      
      // Map the sort field to the corresponding column
      let sortColumn;
      switch (sortField) {
        case 'title':
          sortColumn = studies.title;
          break;
        case 'authors':
          sortColumn = studies.authors;
          break;
        case 'journal':
          sortColumn = studies.journal;
          break;
        case 'publishYear':
          sortColumn = studies.publishYear;
          break;
        case 'viewCount':
          sortColumn = studies.viewCount;
          break;
        case 'journalPublishDate':
          sortColumn = studies.journalPublishDate;
          break;
        case 'publishDate':
        default:
          sortColumn = studies.publishDate;
      }
      
      // Apply sort direction and pagination
      const data = await studiesQuery
        .orderBy(sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn))
        .limit(pageSize)
        .offset(offset);
      
      return {
        data,
        total,
        page,
        pageSize,
        pageCount: Math.ceil(total / pageSize)
      };
    } catch (error) {
      console.error("Error in database getStudies:", error);
      // Return empty results on error
      return {
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
        pageCount: 0
      };
    }
  }

  /**
   * Get a single study by ID
   */
  async getStudyById(id: number): Promise<Study | undefined> {
    try {
      const result = await db
        .select()
        .from(studies)
        .where(eq(studies.id, id))
        .limit(1);
      
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      console.error(`Error in database getStudyById(${id}):`, error);
      return undefined;
    }
  }

  /**
   * Get a single study by identifier
   */
  async getStudyByIdentifier(identifier: string): Promise<Study | undefined> {
    try {
      // Normalize identifier
      const normalizedIdentifier = identifier.trim().toLowerCase();
      
      // Search in DOI field
      const result = await db
        .select()
        .from(studies)
        .where(sql`LOWER(${studies.doi}) = ${normalizedIdentifier}`)
        .limit(1);
      
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      console.error(`Error in database getStudyByIdentifier(${identifier}):`, error);
      return undefined;
    }
  }

  /**
   * Get latest studies
   */
  async getLatestStudies(limit: number = 3): Promise<Study[]> {
    try {
      const latestStudies = await db
        .select()
        .from(studies)
        .orderBy(desc(studies.publishDate))
        .limit(limit);
      
      return latestStudies;
    } catch (error) {
      console.error("Error in database getLatestStudies:", error);
      return [];
    }
  }

  /**
   * Get studies by title (exact match)
   */
  async getStudiesByTitle(title: string): Promise<Study[]> {
    try {
      const matchedStudies = await db
        .select()
        .from(studies)
        .where(eq(studies.title, title));
      
      return matchedStudies;
    } catch (error) {
      console.error(`Error in database getStudiesByTitle(${title}):`, error);
      return [];
    }
  }

  /**
   * Get studies by partial title match
   */
  async getStudiesByTitlePartial(titlePart: string, limit: number = 20): Promise<Study[]> {
    try {
      const searchTerm = `%${titlePart.toLowerCase()}%`;
      
      const matchedStudies = await db
        .select()
        .from(studies)
        .where(sql`LOWER(${studies.title}) LIKE ${searchTerm}`)
        .limit(limit);
      
      return matchedStudies;
    } catch (error) {
      console.error(`Error in database getStudiesByTitlePartial(${titlePart}):`, error);
      return [];
    }
  }

  /**
   * Get studies by source platform
   */
  async getStudiesBySourcePlatform(platform: string): Promise<Study[]> {
    try {
      const matchedStudies = await db
        .select()
        .from(studies)
        .where(eq(studies.sourcePlatform, platform));
      
      return matchedStudies;
    } catch (error) {
      console.error(`Error in database getStudiesBySourcePlatform(${platform}):`, error);
      return [];
    }
  }

  /**
   * Create a new study
   */
  async createStudy(study: InsertStudy): Promise<Study> {
    try {
      const insertData = {
        ...study,
        createdAt: new Date()
      };
      
      const [insertedStudy] = await db
        .insert(studies)
        .values(insertData)
        .returning();
      
      return insertedStudy;
    } catch (error) {
      console.error("Error in database createStudy:", error);
      throw error;
    }
  }

  /**
   * Update an existing study
   */
  async updateStudy(id: number, updatedFields: Partial<InsertStudy>): Promise<Study> {
    try {
      const [updatedStudy] = await db
        .update(studies)
        .set(updatedFields)
        .where(eq(studies.id, id))
        .returning();
      
      return updatedStudy;
    } catch (error) {
      console.error(`Error in database updateStudy(${id}):`, error);
      throw error;
    }
  }

  /**
   * Delete a study
   */
  async deleteStudy(id: number): Promise<void> {
    try {
      await db
        .delete(studies)
        .where(eq(studies.id, id));
    } catch (error) {
      console.error(`Error in database deleteStudy(${id}):`, error);
      throw error;
    }
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<Category[]> {
    try {
      // Check if we have a fresh cache
      const now = Date.now();
      if (this.categoryCache.size > 0 && now - this.categoryCacheLastUpdate < this.CACHE_TTL) {
        return Array.from(this.categoryCache.values());
      }
      
      // Fetch from database
      const allCategories = await db.select().from(categories);
      
      // Update cache
      this.categoryCache.clear();
      for (const category of allCategories) {
        this.categoryCache.set(category.name, category);
      }
      this.categoryCacheLastUpdate = now;
      
      return allCategories;
    } catch (error) {
      console.error("Error in database getCategories:", error);
      return [];
    }
  }

  /**
   * Get a single category by ID
   */
  async getCategoryById(id: number): Promise<Category | undefined> {
    try {
      // Check cache first
      for (const category of this.categoryCache.values()) {
        if (category.id === id) {
          return category;
        }
      }
      
      // Not in cache, fetch from database
      const result = await db
        .select()
        .from(categories)
        .where(eq(categories.id, id))
        .limit(1);
      
      const category = result.length > 0 ? result[0] : undefined;
      
      // Update cache if found
      if (category) {
        this.categoryCache.set(category.name, category);
      }
      
      return category;
    } catch (error) {
      console.error(`Error in database getCategoryById(${id}):`, error);
      return undefined;
    }
  }

  /**
   * Get a single category by name
   */
  async getCategoryByName(name: string): Promise<Category | undefined> {
    try {
      // Check cache first
      if (this.categoryCache.has(name)) {
        return this.categoryCache.get(name);
      }
      
      // Not in cache, fetch from database
      const result = await db
        .select()
        .from(categories)
        .where(eq(categories.name, name))
        .limit(1);
      
      const category = result.length > 0 ? result[0] : undefined;
      
      // Update cache if found
      if (category) {
        this.categoryCache.set(name, category);
      }
      
      return category;
    } catch (error) {
      console.error(`Error in database getCategoryByName(${name}):`, error);
      return undefined;
    }
  }

  /**
   * Create a new category
   */
  async createCategory(category: InsertCategory): Promise<Category> {
    try {
      const insertData = {
        ...category,
        createdAt: new Date()
      };
      
      const [insertedCategory] = await db
        .insert(categories)
        .values(insertData)
        .returning();
      
      // Update cache
      this.categoryCache.set(insertedCategory.name, insertedCategory);
      
      return insertedCategory;
    } catch (error) {
      console.error("Error in database createCategory:", error);
      throw error;
    }
  }

  /**
   * Subscribe to newsletter
   */
  async subscribeNewsletter(subscription: InsertNewsletter): Promise<Newsletter> {
    try {
      const insertData = {
        ...subscription,
        createdAt: new Date()
      };
      
      const [inserted] = await db
        .insert(newsletters)
        .values(insertData)
        .returning();
      
      return inserted;
    } catch (error) {
      console.error("Error in database subscribeNewsletter:", error);
      throw error;
    }
  }

  /**
   * Submit contact message
   */
  async submitContactMessage(message: InsertContact): Promise<any> {
    try {
      const insertData = {
        ...message,
        createdAt: new Date()
      };
      
      const [inserted] = await db
        .insert(contactMessages)
        .values(insertData)
        .returning();
      
      return inserted;
    } catch (error) {
      console.error("Error in database submitContactMessage:", error);
      throw error;
    }
  }

  /**
   * Check if a study with the given DOI exists
   */
  async checkStudyExists(doi: string): Promise<{ exists: boolean, studyId?: number }> {
    try {
      if (!doi) {
        return { exists: false };
      }
      
      // Normalize DOI for consistent matching
      const normalizedDoi = doi.trim().toLowerCase();
      
      // Check if study exists
      const studyResult = await db
        .select()
        .from(studies)
        .where(sql`LOWER(${studies.doi}) = ${normalizedDoi}`)
        .limit(1);
      
      if (studyResult.length > 0) {
        return { exists: true, studyId: studyResult[0].id };
      }
      
      // Check if study is in review queue
      const queueResult = await db
        .select()
        .from(studyReviewQueue)
        .where(sql`LOWER(${studyReviewQueue.doi}) = ${normalizedDoi}`)
        .limit(1);
      
      if (queueResult.length > 0) {
        return { exists: true };
      }
      
      return { exists: false };
    } catch (error) {
      console.error(`Error in database checkStudyExists(${doi}):`, error);
      return { exists: false };
    }
  }

  /**
   * Save a study to the review queue
   */
  async saveStudyForReview(reviewItem: InsertStudyReviewQueue): Promise<StudyReviewQueue> {
    try {
      const insertData = {
        ...reviewItem,
        savedAt: new Date()
      };
      
      const [inserted] = await db
        .insert(studyReviewQueue)
        .values(insertData)
        .returning();
      
      return inserted;
    } catch (error) {
      console.error("Error in database saveStudyForReview:", error);
      throw error;
    }
  }

  /**
   * Get studies in the review queue
   */
  async getStudyReviewQueue(filters?: { status?: string, userId?: string }): Promise<StudyReviewQueue[]> {
    try {
      let query = db.select().from(studyReviewQueue);
      
      if (filters) {
        const whereConditions = [];
        
        if (filters.status) {
          whereConditions.push(eq(studyReviewQueue.status, filters.status));
        }
        
        if (filters.userId) {
          whereConditions.push(eq(studyReviewQueue.savedByUserId, filters.userId));
        }
        
        if (whereConditions.length > 0) {
          query = query.where(and(...whereConditions));
        }
      }
      
      // Order by saved date (newest first)
      query = query.orderBy(desc(studyReviewQueue.savedAt));
      
      return await query;
    } catch (error) {
      console.error("Error in database getStudyReviewQueue:", error);
      return [];
    }
  }

  /**
   * Get a review queue item by ID
   */
  async getStudyReviewQueueById(id: number): Promise<StudyReviewQueue | undefined> {
    try {
      const result = await db
        .select()
        .from(studyReviewQueue)
        .where(eq(studyReviewQueue.id, id))
        .limit(1);
      
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      console.error(`Error in database getStudyReviewQueueById(${id}):`, error);
      return undefined;
    }
  }

  /**
   * Update a study review status
   */
  async updateStudyReviewStatus(
    id: number, 
    status: string, 
    reviewedByUserId: string, 
    notes?: string
  ): Promise<StudyReviewQueue> {
    try {
      const [updatedItem] = await db
        .update(studyReviewQueue)
        .set({
          status,
          reviewedByUserId,
          reviewNotes: notes,
          reviewedAt: new Date()
        })
        .where(eq(studyReviewQueue.id, id))
        .returning();
      
      return updatedItem;
    } catch (error) {
      console.error(`Error in database updateStudyReviewStatus(${id}):`, error);
      throw error;
    }
  }

  /**
   * Delete a study from the review queue
   */
  async deleteStudyFromReviewQueue(id: number): Promise<void> {
    try {
      await db
        .delete(studyReviewQueue)
        .where(eq(studyReviewQueue.id, id));
    } catch (error) {
      console.error(`Error in database deleteStudyFromReviewQueue(${id}):`, error);
      throw error;
    }
  }
}

// Create a singleton instance of the database storage
export const dbStorage = new DatabaseStorage();