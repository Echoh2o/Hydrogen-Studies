import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@shared/schema";
import {
  eq,
  like,
  and,
  or,
  sql,
  desc,
  asc,
  count,
  isNull,
  isNotNull,
} from "drizzle-orm";

// Configure Neon connection for WebSockets
neonConfig.webSocketConstructor = ws;

// Database tables
import {
  studies,
  categories,
  newsletters,
  contactMessages,
  studyReviewQueue,
  type Study,
  type InsertStudy,
  type Category,
  type InsertCategory,
  type Newsletter,
  type InsertNewsletter,
  type InsertContact,
  type StudyReviewQueue,
  type InsertStudyReviewQueue,
} from "@shared/schema";

// Create a database connection pool
export const getPool = () => {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not set. Database operations will not work.");
    return null;
  }

  return new Pool({ connectionString: process.env.DATABASE_URL });
};

// Create a Drizzle ORM instance with our schema
export const getDb = () => {
  const pool = getPool();
  if (!pool) return null;

  return drizzle(pool, { schema });
};

// Store a single instance to avoid creating multiple connections
let _dbInstance = null;

export const getDbInstance = () => {
  if (!_dbInstance) {
    _dbInstance = getDb();
  }
  return _dbInstance;
};

// Interface for study filters
export interface StudyFilters {
  query?: string;
  keyword?: string;
  author?: string;
  yearFrom?: string | number;
  yearTo?: string | number;
  category?: string;
  isPeerReviewed?: boolean | null;
  hasHealthImplications?: boolean | null;
  hasMedia?: boolean | null;
  dateFrom?: string;
  dateTo?: string;
  page?: number | string;
  pageSize?: number | string;
  sortField?: string;
  sortOrder?: "asc" | "desc";
  sortBy?: string;
  peerReviewed?: boolean;
  [key: string]: any; // Allow additional properties for flexibility
}

// Interface for paginated results
export interface PaginatedResults<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/**
 * Database adapter class providing core database operations
 */
export class DatabaseAdapter {
  private db;

  // Category cache for better performance
  private categoryCache: Map<string, Category> = new Map();
  private categoryCacheLastUpdate: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

  constructor() {
    this.db = getDbInstance();
    console.log("Database adapter initialized:", !!this.db);
  }

  /**
   * Get paginated and filtered studies
   */
  async getStudies(
    filters: StudyFilters = {},
  ): Promise<PaginatedResults<Study>> {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }

      // Start building the query with conditions
      let whereConditions = [];

      // Apply basic text search
      if (filters.query) {
        const searchTerm = `%${filters.query.toLowerCase()}%`;
        whereConditions.push(
          or(
            sql`LOWER(${studies.title}) LIKE ${searchTerm}`,
            sql`LOWER(${studies.abstract}) LIKE ${searchTerm}`,
            sql`LOWER(${studies.authors}) LIKE ${searchTerm}`,
          ),
        );
      }

      // Apply keyword filter
      if (filters.keyword) {
        const keywordTerm = `%${filters.keyword.toLowerCase()}%`;
        whereConditions.push(
          or(
            sql`LOWER(${studies.title}) LIKE ${keywordTerm}`,
            sql`LOWER(${studies.abstract}) LIKE ${keywordTerm}`,
          ),
        );
      }

      // Apply author filter
      if (filters.author) {
        const authorTerm = `%${filters.author.toLowerCase()}%`;
        whereConditions.push(sql`LOWER(${studies.authors}) LIKE ${authorTerm}`);
      }

      // Apply year filters
      if (filters.yearFrom) {
        whereConditions.push(
          sql`${studies.publishYear} >= ${parseInt(filters.yearFrom.toString())}`,
        );
      }

      if (filters.yearTo) {
        whereConditions.push(
          sql`${studies.publishYear} <= ${parseInt(filters.yearTo.toString())}`,
        );
      }

      // Apply category filter
      if (filters.category) {
        whereConditions.push(eq(studies.category, filters.category));
      }

      // Apply peer review filter
      if (filters.isPeerReviewed === true || filters.peerReviewed === true) {
        whereConditions.push(eq(studies.peerReviewed, true));
      } else if (
        filters.isPeerReviewed === false ||
        filters.peerReviewed === false
      ) {
        whereConditions.push(eq(studies.peerReviewed, false));
      }

      // Apply media filter
      if (filters.hasMedia === true) {
        whereConditions.push(
          or(
            isNotNull(studies.imageUrl),
            isNotNull(studies.videoUrl),
            isNotNull(studies.audioUrl),
          ),
        );
      } else if (filters.hasMedia === false) {
        whereConditions.push(
          and(
            isNull(studies.imageUrl),
            isNull(studies.videoUrl),
            isNull(studies.audioUrl),
          ),
        );
      }

      // Apply date filters
      if (filters.dateFrom) {
        whereConditions.push(
          sql`${studies.publishDate} >= ${filters.dateFrom}`,
        );
      }

      if (filters.dateTo) {
        whereConditions.push(sql`${studies.publishDate} <= ${filters.dateTo}`);
      }

      // Build count query to get total records
      const countQuery = this.db.select({ value: count() }).from(studies);
      if (whereConditions.length > 0) {
        countQuery.where(and(...whereConditions));
      }

      // Execute count query
      const countResult = await countQuery;
      const total = countResult[0]?.value || 0;

      // Determine pagination
      const page = parseInt(filters.page?.toString() || "1", 10);
      const pageSize = parseInt(filters.pageSize?.toString() || "10", 10);
      const offset = (page - 1) * pageSize;

      // Build the main query
      let mainQuery = this.db.select().from(studies);
      if (whereConditions.length > 0) {
        mainQuery = mainQuery.where(and(...whereConditions));
      }

      // Apply sorting
      const sortField = filters.sortField || filters.sortBy || "publishDate";
      const sortOrder = filters.sortOrder || "desc";

      // Map the sort field to the corresponding column
      let sortColumn;
      switch (sortField) {
        case "title":
          sortColumn = studies.title;
          break;
        case "authors":
          sortColumn = studies.authors;
          break;
        case "journal":
          sortColumn = studies.journal;
          break;
        case "publishYear":
          sortColumn = studies.publishYear;
          break;
        case "viewCount":
          sortColumn = studies.viewCount;
          break;
        case "journalPublishDate":
          sortColumn = studies.journalPublishDate;
          break;
        case "publishDate":
        default:
          sortColumn = studies.publishDate;
      }

      // Apply sort direction
      if (sortOrder === "asc") {
        mainQuery = mainQuery.orderBy(asc(sortColumn));
      } else {
        mainQuery = mainQuery.orderBy(desc(sortColumn));
      }

      // Apply pagination
      mainQuery = mainQuery.limit(pageSize).offset(offset);

      // Execute main query
      const data = await mainQuery;

      return {
        data,
        total,
        page,
        pageSize,
        pageCount: Math.ceil(total / pageSize),
      };
    } catch (error) {
      console.error("Error in database getStudies:", error);
      // Return empty results on error
      return {
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
        pageCount: 0,
      };
    }
  }

  /**
   * Get a single study by ID
   */
  async getStudyById(id: number): Promise<Study | undefined> {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }

      const result = await this.db
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
   * Get a single study by identifier (DOI)
   */
  async getStudyByIdentifier(identifier: string): Promise<Study | undefined> {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }

      // Normalize DOI
      const normalizedIdentifier = identifier.trim().toLowerCase();

      const result = await this.db
        .select()
        .from(studies)
        .where(sql`LOWER(${studies.doi}) = ${normalizedIdentifier}`)
        .limit(1);

      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      console.error(
        `Error in database getStudyByIdentifier(${identifier}):`,
        error,
      );
      return undefined;
    }
  }

  /**
   * Get latest studies
   */
  async getLatestStudies(limit: number = 3): Promise<Study[]> {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }

      const latestStudies = await this.db
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
   * Get all categories
   */
  async getCategories(): Promise<Category[]> {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }

      // Check if we have a fresh cache
      const now = Date.now();
      if (
        this.categoryCache.size > 0 &&
        now - this.categoryCacheLastUpdate < this.CACHE_TTL
      ) {
        return Array.from(this.categoryCache.values());
      }

      // Fetch from database
      const allCategories = await this.db.select().from(categories);

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
   * Check if a study with the given DOI exists
   */
  async checkStudyExists(
    doi: string,
  ): Promise<{ exists: boolean; studyId?: number }> {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }

      if (!doi) {
        return { exists: false };
      }

      // Normalize DOI for consistent matching
      const normalizedDoi = doi.trim().toLowerCase();

      // Check if study exists
      const studyResult = await this.db
        .select({ id: studies.id })
        .from(studies)
        .where(sql`LOWER(${studies.doi}) = ${normalizedDoi}`)
        .limit(1);

      if (studyResult.length > 0) {
        return { exists: true, studyId: studyResult[0].id };
      }

      // Check if study is in review queue
      const queueResult = await this.db
        .select({ id: studyReviewQueue.id })
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
}

// Export a singleton instance
export const dbAdapter = new DatabaseAdapter();
