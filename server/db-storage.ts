import { db } from './db';
import { IStorage, StudyFilters } from './storage';
import { 
  studies, 
  categories, 
  newsletters, 
  users,
  userPreferences,
  notifications,
  searchHistory,
  userStudyInteractions,
  blogArticles,
  studyReviewQueue,
  contactMessages,
  ReviewStatus,
  type Study, 
  type Category, 
  type Newsletter, 
  type InsertStudy, 
  type InsertCategory, 
  type InsertNewsletter,
  type InsertContact,
  type User,
  type UserPreferences,
  type InsertUser,
  type InsertUserPreferences,
  type Notification,
  type InsertNotification,
  type SearchHistory,
  type InsertSearchHistory,
  type UserStudyInteraction,
  type InsertUserStudyInteraction,
  type UserBlogInteraction,
  type InsertUserBlogInteraction,
  type BlogArticle,
  type InsertBlogArticle,
  type StudyReviewQueue,
  type InsertStudyReviewQueue,
} from "@shared/schema";
import { eq, like, and, or, desc, asc, sql, not, isNull, between } from 'drizzle-orm';

export class DatabaseStorage implements IStorage {
  private categoryCache: Map<string, Category> = new Map();
  private categoryCacheLastUpdate: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

  async getStudies(filters: StudyFilters = {}): Promise<Study[]> {
    try {
      let query = db.select().from(studies);

      // Apply filters
      const conditions = [];

      if (filters.query) {
        const queryLower = `%${filters.query.toLowerCase()}%`;
        conditions.push(
          or(
            sql`LOWER(${studies.title}) LIKE ${queryLower}`,
            sql`LOWER(${studies.abstract}) LIKE ${queryLower}`,
            sql`LOWER(${studies.authors}) LIKE ${queryLower}`,
            sql`LOWER(${studies.journal}) LIKE ${queryLower}`,
            sql`LOWER(${studies.category}) LIKE ${queryLower}`
          )
        );
      }

      if (filters.keyword) {
        const keywordLower = `%${filters.keyword.toLowerCase()}%`;
        conditions.push(
          or(
            sql`LOWER(${studies.title}) LIKE ${keywordLower}`,
            sql`LOWER(${studies.abstract}) LIKE ${keywordLower}`
          )
        );
      }

      if (filters.author) {
        const authorLower = `%${filters.author.toLowerCase()}%`;
        conditions.push(sql`LOWER(${studies.authors}) LIKE ${authorLower}`);
      }

      if (filters.yearFrom) {
        const yearFrom = parseInt(filters.yearFrom.toString());
        if (!isNaN(yearFrom)) {
          conditions.push(sql`${studies.publishYear} >= ${yearFrom}`);
        }
      }

      if (filters.yearTo) {
        const yearTo = parseInt(filters.yearTo.toString());
        if (!isNaN(yearTo)) {
          conditions.push(sql`${studies.publishYear} <= ${yearTo}`);
        }
      }

      if (filters.category && filters.category !== 'all') {
        conditions.push(sql`LOWER(${studies.category}) = ${filters.category.toLowerCase()}`);
      }

      if (filters.peerReviewed || filters.isPeerReviewed) {
        conditions.push(eq(studies.peerReviewed, true));
      }

      if (filters.hasMedia) {
        conditions.push(
          or(
            not(isNull(studies.imageUrl)),
            not(isNull(studies.videoUrl)),
            not(isNull(studies.audioUrl))
          )
        );
      }

      if (filters.dateFrom) {
        try {
          const dateFrom = new Date(filters.dateFrom);
          conditions.push(sql`${studies.publishDate} >= ${dateFrom.toISOString().substring(0, 10)}`);
        } catch (e) {
          console.error('Invalid dateFrom filter:', e);
        }
      }

      if (filters.dateTo) {
        try {
          const dateTo = new Date(filters.dateTo);
          conditions.push(sql`${studies.publishDate} <= ${dateTo.toISOString().substring(0, 10)}`);
        } catch (e) {
          console.error('Invalid dateTo filter:', e);
        }
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      // Apply sorting
      if (filters.sortField && filters.sortOrder) {
        switch (filters.sortField) {
          case 'publishDate':
            query = query.orderBy(filters.sortOrder === 'asc' ? asc(studies.publishDate) : desc(studies.publishDate));
            break;
          case 'title':
            query = query.orderBy(filters.sortOrder === 'asc' ? asc(studies.title) : desc(studies.title));
            break;
          case 'journalPublishDate':
            query = query.orderBy(filters.sortOrder === 'asc' ? asc(studies.journalPublishDate) : desc(studies.journalPublishDate));
            break;
          case 'journal':
            query = query.orderBy(filters.sortOrder === 'asc' ? asc(studies.journal) : desc(studies.journal));
            break;
        }
      } else if (filters.sortBy) {
        switch (filters.sortBy) {
          case 'date':
            query = query.orderBy(desc(studies.publishDate));
            break;
          case 'title':
            query = query.orderBy(asc(studies.title));
            break;
          case 'journalDate':
            query = query.orderBy(desc(studies.journalPublishDate));
            break;
          default:
            query = query.orderBy(desc(studies.publishDate));
        }
      } else {
        // Default sort by date (newest first)
        query = query.orderBy(desc(studies.publishDate));
      }

      // Apply pagination
      if (filters.page && filters.pageSize) {
        const page = parseInt(filters.page.toString());
        const pageSize = parseInt(filters.pageSize.toString());
        
        if (!isNaN(page) && !isNaN(pageSize)) {
          const offset = (page - 1) * pageSize;
          query = query.limit(pageSize).offset(offset);
        }
      }

      return await query;
    } catch (error) {
      console.error('Error fetching studies:', error);
      throw error;
    }
  }

  async getStudyById(id: number): Promise<Study | undefined> {
    try {
      const [study] = await db.select().from(studies).where(eq(studies.id, id));
      return study;
    } catch (error) {
      console.error(`Error fetching study with id ${id}:`, error);
      throw error;
    }
  }

  async getStudyByIdentifier(identifier: string): Promise<Study | undefined> {
    try {
      // Look for study with matching DOI
      const normalizedIdentifier = identifier.trim().toLowerCase();
      const [study] = await db
        .select()
        .from(studies)
        .where(
          or(
            sql`LOWER(${studies.doi}) = ${normalizedIdentifier}`,
            sql`LOWER(${studies.pmid}) = ${normalizedIdentifier}`,
            sql`LOWER(${studies.pmcid}) = ${normalizedIdentifier}`
          )
        );
      
      return study;
    } catch (error) {
      console.error(`Error fetching study by identifier ${identifier}:`, error);
      throw error;
    }
  }

  async getStudiesByTitle(title: string): Promise<Study[]> {
    try {
      const normalizedTitle = title.trim().toLowerCase();
      return await db
        .select()
        .from(studies)
        .where(sql`LOWER(${studies.title}) LIKE ${`%${normalizedTitle}%`}`);
    } catch (error) {
      console.error(`Error fetching studies by title ${title}:`, error);
      throw error;
    }
  }

  async getStudiesBySourcePlatform(platform: string): Promise<Study[]> {
    try {
      const normalizedPlatform = platform.trim().toLowerCase();
      return await db
        .select()
        .from(studies)
        .where(sql`LOWER(${studies.sourcePlatform}) = ${normalizedPlatform}`);
    } catch (error) {
      console.error(`Error fetching studies by platform ${platform}:`, error);
      throw error;
    }
  }

  async getLatestStudies(limit: number = 3): Promise<Study[]> {
    try {
      return await db
        .select()
        .from(studies)
        .orderBy(desc(studies.publishDate))
        .limit(limit);
    } catch (error) {
      console.error('Error fetching latest studies:', error);
      throw error;
    }
  }

  async createStudy(insertStudy: InsertStudy): Promise<Study> {
    try {
      const [study] = await db
        .insert(studies)
        .values(insertStudy)
        .returning();
      
      return study;
    } catch (error) {
      console.error('Error creating study:', error);
      throw error;
    }
  }

  async updateStudy(id: number, partialStudy: Partial<InsertStudy>): Promise<Study> {
    try {
      const [updatedStudy] = await db
        .update(studies)
        .set(partialStudy)
        .where(eq(studies.id, id))
        .returning();
      
      if (!updatedStudy) {
        throw new Error(`Study with id ${id} not found`);
      }
      
      return updatedStudy;
    } catch (error) {
      console.error(`Error updating study with id ${id}:`, error);
      throw error;
    }
  }

  async deleteStudy(id: number): Promise<void> {
    try {
      await db.delete(studies).where(eq(studies.id, id));
    } catch (error) {
      console.error(`Error deleting study with id ${id}:`, error);
      throw error;
    }
  }

  async getCategories(): Promise<Category[]> {
    try {
      // Check if we have a valid cache
      const now = Date.now();
      if (this.categoryCache.size > 0 && now - this.categoryCacheLastUpdate < this.CACHE_TTL) {
        return Array.from(this.categoryCache.values());
      }
      
      // Fetch fresh data
      const categoriesData = await db.select().from(categories);
      
      // Update cache
      this.categoryCache.clear();
      for (const category of categoriesData) {
        this.categoryCache.set(category.id.toString(), category);
      }
      this.categoryCacheLastUpdate = now;
      
      return categoriesData;
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  }

  async getCategoryById(id: number): Promise<Category | undefined> {
    try {
      // Check cache first
      const cachedCategory = this.categoryCache.get(id.toString());
      if (cachedCategory) {
        return cachedCategory;
      }
      
      const [category] = await db.select().from(categories).where(eq(categories.id, id));
      
      // Update cache if found
      if (category) {
        this.categoryCache.set(id.toString(), category);
      }
      
      return category;
    } catch (error) {
      console.error(`Error fetching category with id ${id}:`, error);
      throw error;
    }
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    try {
      const normalizedName = name.trim().toLowerCase();
      
      // Check cache first
      for (const category of this.categoryCache.values()) {
        if (category.name.toLowerCase() === normalizedName) {
          return category;
        }
      }
      
      const [category] = await db
        .select()
        .from(categories)
        .where(sql`LOWER(${categories.name}) = ${normalizedName}`);
      
      // Update cache if found
      if (category) {
        this.categoryCache.set(category.id.toString(), category);
      }
      
      return category;
    } catch (error) {
      console.error(`Error fetching category with name ${name}:`, error);
      throw error;
    }
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    try {
      const [category] = await db
        .insert(categories)
        .values(insertCategory)
        .returning();
      
      // Update cache
      this.categoryCache.set(category.id.toString(), category);
      
      return category;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  async subscribeNewsletter(insertNewsletter: InsertNewsletter): Promise<Newsletter> {
    try {
      const [newsletter] = await db
        .insert(newsletters)
        .values(insertNewsletter)
        .returning();
      
      return newsletter;
    } catch (error) {
      console.error('Error subscribing to newsletter:', error);
      throw error;
    }
  }

  async submitContactMessage(message: InsertContact): Promise<any> {
    try {
      const [contactMessage] = await db
        .insert(contactMessages)
        .values(message)
        .returning();
      
      return contactMessage;
    } catch (error) {
      console.error('Error submitting contact message:', error);
      throw error;
    }
  }

  async getUserById(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error(`Error fetching user with id ${id}:`, error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(sql`LOWER(${users.email}) = ${email.toLowerCase()}`);
      
      return user;
    } catch (error) {
      console.error(`Error fetching user with email ${email}:`, error);
      throw error;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      const [newUser] = await db
        .insert(users)
        .values(user)
        .returning();
      
      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set(user)
        .where(eq(users.id, id))
        .returning();
      
      if (!updatedUser) {
        throw new Error(`User with id ${id} not found`);
      }
      
      return updatedUser;
    } catch (error) {
      console.error(`Error updating user with id ${id}:`, error);
      throw error;
    }
  }

  async deleteUser(id: number): Promise<void> {
    try {
      await db.delete(users).where(eq(users.id, id));
    } catch (error) {
      console.error(`Error deleting user with id ${id}:`, error);
      throw error;
    }
  }

  async authenticateUser(email: string, password: string): Promise<User | null> {
    // This is just a stub - actual implementation would verify password hash
    try {
      const user = await this.getUserByEmail(email);
      if (!user) return null;
      
      // Password verification would happen here
      
      return user;
    } catch (error) {
      console.error(`Error authenticating user with email ${email}:`, error);
      return null;
    }
  }

  async getUserPreferences(userId: number): Promise<UserPreferences | undefined> {
    try {
      const [preferences] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId));
      
      return preferences;
    } catch (error) {
      console.error(`Error fetching preferences for user ${userId}:`, error);
      throw error;
    }
  }

  async createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences> {
    try {
      const [newPreferences] = await db
        .insert(userPreferences)
        .values(preferences)
        .returning();
      
      return newPreferences;
    } catch (error) {
      console.error('Error creating user preferences:', error);
      throw error;
    }
  }

  async updateUserPreferences(id: number, preferences: Partial<InsertUserPreferences>): Promise<UserPreferences> {
    try {
      const [updatedPreferences] = await db
        .update(userPreferences)
        .set(preferences)
        .where(eq(userPreferences.id, id))
        .returning();
      
      if (!updatedPreferences) {
        throw new Error(`User preferences with id ${id} not found`);
      }
      
      return updatedPreferences;
    } catch (error) {
      console.error(`Error updating user preferences with id ${id}:`, error);
      throw error;
    }
  }

  async addSearchHistory(searchHistory: InsertSearchHistory): Promise<SearchHistory> {
    try {
      const [newSearch] = await db
        .insert(searchHistory)
        .values(searchHistory)
        .returning();
      
      return newSearch;
    } catch (error) {
      console.error('Error adding search history:', error);
      throw error;
    }
  }

  async getUserSearchHistory(userId: number, limit: number = 20): Promise<SearchHistory[]> {
    try {
      return await db
        .select()
        .from(searchHistory)
        .where(eq(searchHistory.userId, userId))
        .orderBy(desc(searchHistory.searchDate))
        .limit(limit);
    } catch (error) {
      console.error(`Error fetching search history for user ${userId}:`, error);
      throw error;
    }
  }

  async saveStudy(userId: number, studyId: number): Promise<UserStudyInteraction> {
    try {
      // Check if interaction exists
      const [existingInteraction] = await db
        .select()
        .from(userStudyInteractions)
        .where(
          and(
            eq(userStudyInteractions.userId, userId),
            eq(userStudyInteractions.studyId, studyId)
          )
        );
      
      if (existingInteraction) {
        // Update existing interaction
        const [updatedInteraction] = await db
          .update(userStudyInteractions)
          .set({ 
            isSaved: true,
            lastViewed: new Date().toISOString()
          })
          .where(
            and(
              eq(userStudyInteractions.userId, userId),
              eq(userStudyInteractions.studyId, studyId)
            )
          )
          .returning();
        
        return updatedInteraction;
      } else {
        // Create new interaction
        const [newInteraction] = await db
          .insert(userStudyInteractions)
          .values({
            userId: userId.toString(),
            studyId,
            isSaved: true,
            viewCount: 1,
            lastViewed: new Date().toISOString()
          })
          .returning();
        
        return newInteraction;
      }
    } catch (error) {
      console.error(`Error saving study ${studyId} for user ${userId}:`, error);
      throw error;
    }
  }

  async unsaveStudy(userId: number, studyId: number): Promise<void> {
    try {
      await db
        .update(userStudyInteractions)
        .set({ isSaved: false })
        .where(
          and(
            eq(userStudyInteractions.userId, userId),
            eq(userStudyInteractions.studyId, studyId)
          )
        );
    } catch (error) {
      console.error(`Error unsaving study ${studyId} for user ${userId}:`, error);
      throw error;
    }
  }

  async recordStudyView(userId: number, studyId: number): Promise<void> {
    try {
      // Check if interaction exists
      const [existingInteraction] = await db
        .select()
        .from(userStudyInteractions)
        .where(
          and(
            eq(userStudyInteractions.userId, userId),
            eq(userStudyInteractions.studyId, studyId)
          )
        );
      
      if (existingInteraction) {
        // Update existing interaction
        await db
          .update(userStudyInteractions)
          .set({ 
            viewCount: existingInteraction.viewCount + 1,
            lastViewed: new Date().toISOString()
          })
          .where(
            and(
              eq(userStudyInteractions.userId, userId),
              eq(userStudyInteractions.studyId, studyId)
            )
          );
      } else {
        // Create new interaction
        await db
          .insert(userStudyInteractions)
          .values({
            userId: userId.toString(),
            studyId,
            isSaved: false,
            viewCount: 1,
            lastViewed: new Date().toISOString()
          });
      }
    } catch (error) {
      console.error(`Error recording study view ${studyId} for user ${userId}:`, error);
      throw error;
    }
  }

  async getSavedStudies(userId: number): Promise<Study[]> {
    try {
      // Join userStudyInteractions with studies table
      return await db
        .select({
          id: studies.id,
          title: studies.title,
          abstract: studies.abstract,
          authors: studies.authors,
          journal: studies.journal,
          publishDate: studies.publishDate,
          journalPublishDate: studies.journalPublishDate,
          category: studies.category,
          methods: studies.methods,
          results: studies.results,
          conclusion: studies.conclusion,
          doi: studies.doi,
          pdfUrl: studies.pdfUrl,
          citationUrl: studies.citationUrl,
          peerReviewed: studies.peerReviewed,
          imageUrl: studies.imageUrl,
          imageAlt: studies.imageAlt,
          videoUrl: studies.videoUrl,
          audioUrl: studies.audioUrl,
          autoGeneratedImage: studies.autoGeneratedImage,
          objective: studies.objective,
          methodsShort: studies.methodsShort,
          resultsShort: studies.resultsShort,
          conclusionShort: studies.conclusionShort,
          summaryMarkdown: studies.summaryMarkdown,
          publishYear: studies.publishYear,
          country: studies.country,
          region: studies.region,
          createdAt: studies.createdAt
        })
        .from(studies)
        .innerJoin(
          userStudyInteractions,
          and(
            eq(studies.id, userStudyInteractions.studyId),
            eq(userStudyInteractions.userId, userId),
            eq(userStudyInteractions.isSaved, true)
          )
        )
        .orderBy(desc(userStudyInteractions.lastViewed));
    } catch (error) {
      console.error(`Error fetching saved studies for user ${userId}:`, error);
      throw error;
    }
  }

  async getRecentlyViewedStudies(userId: number, limit: number = 10): Promise<Study[]> {
    try {
      // Join userStudyInteractions with studies table
      return await db
        .select({
          id: studies.id,
          title: studies.title,
          abstract: studies.abstract,
          authors: studies.authors,
          journal: studies.journal,
          publishDate: studies.publishDate,
          journalPublishDate: studies.journalPublishDate,
          category: studies.category,
          methods: studies.methods,
          results: studies.results,
          conclusion: studies.conclusion,
          doi: studies.doi,
          pdfUrl: studies.pdfUrl,
          citationUrl: studies.citationUrl,
          peerReviewed: studies.peerReviewed,
          imageUrl: studies.imageUrl,
          imageAlt: studies.imageAlt,
          videoUrl: studies.videoUrl,
          audioUrl: studies.audioUrl,
          autoGeneratedImage: studies.autoGeneratedImage,
          objective: studies.objective,
          methodsShort: studies.methodsShort,
          resultsShort: studies.resultsShort,
          conclusionShort: studies.conclusionShort,
          summaryMarkdown: studies.summaryMarkdown,
          publishYear: studies.publishYear,
          country: studies.country,
          region: studies.region,
          createdAt: studies.createdAt
        })
        .from(studies)
        .innerJoin(
          userStudyInteractions,
          and(
            eq(studies.id, userStudyInteractions.studyId),
            eq(userStudyInteractions.userId, userId)
          )
        )
        .orderBy(desc(userStudyInteractions.lastViewed))
        .limit(limit);
    } catch (error) {
      console.error(`Error fetching recently viewed studies for user ${userId}:`, error);
      throw error;
    }
  }

  async saveBlog(userId: number, blogId: number): Promise<UserBlogInteraction> {
    try {
      // Check if interaction exists
      const [existingInteraction] = await db
        .select()
        .from(userBlogInteractions)
        .where(
          and(
            eq(userBlogInteractions.userId, userId),
            eq(userBlogInteractions.blogId, blogId)
          )
        );
      
      if (existingInteraction) {
        // Update existing interaction
        const [updatedInteraction] = await db
          .update(userBlogInteractions)
          .set({ 
            isSaved: true,
            lastViewed: new Date().toISOString()
          })
          .where(
            and(
              eq(userBlogInteractions.userId, userId),
              eq(userBlogInteractions.blogId, blogId)
            )
          )
          .returning();
        
        return updatedInteraction;
      } else {
        // Create new interaction
        const [newInteraction] = await db
          .insert(userBlogInteractions)
          .values({
            userId,
            blogId,
            isSaved: true,
            viewCount: 1,
            lastViewed: new Date().toISOString()
          })
          .returning();
        
        return newInteraction;
      }
    } catch (error) {
      console.error(`Error saving blog ${blogId} for user ${userId}:`, error);
      throw error;
    }
  }

  async unsaveBlog(userId: number, blogId: number): Promise<void> {
    try {
      await db
        .update(userBlogInteractions)
        .set({ isSaved: false })
        .where(
          and(
            eq(userBlogInteractions.userId, userId),
            eq(userBlogInteractions.blogId, blogId)
          )
        );
    } catch (error) {
      console.error(`Error unsaving blog ${blogId} for user ${userId}:`, error);
      throw error;
    }
  }

  async recordBlogView(userId: number, blogId: number): Promise<void> {
    try {
      // Check if interaction exists
      const [existingInteraction] = await db
        .select()
        .from(userBlogInteractions)
        .where(
          and(
            eq(userBlogInteractions.userId, userId),
            eq(userBlogInteractions.blogId, blogId)
          )
        );
      
      if (existingInteraction) {
        // Update existing interaction
        await db
          .update(userBlogInteractions)
          .set({ 
            viewCount: existingInteraction.viewCount + 1,
            lastViewed: new Date().toISOString()
          })
          .where(
            and(
              eq(userBlogInteractions.userId, userId),
              eq(userBlogInteractions.blogId, blogId)
            )
          );
      } else {
        // Create new interaction
        await db
          .insert(userBlogInteractions)
          .values({
            userId,
            blogId,
            isSaved: false,
            viewCount: 1,
            lastViewed: new Date().toISOString()
          });
      }
    } catch (error) {
      console.error(`Error recording blog view ${blogId} for user ${userId}:`, error);
      throw error;
    }
  }

  async getSavedBlogs(userId: number): Promise<BlogArticle[]> {
    try {
      // Join userBlogInteractions with blogArticles table
      return await db
        .select()
        .from(blogArticles)
        .innerJoin(
          userBlogInteractions,
          and(
            eq(blogArticles.id, userBlogInteractions.blogId),
            eq(userBlogInteractions.userId, userId),
            eq(userBlogInteractions.isSaved, true)
          )
        )
        .orderBy(desc(userBlogInteractions.lastViewed));
    } catch (error) {
      console.error(`Error fetching saved blogs for user ${userId}:`, error);
      throw error;
    }
  }

  async getRecentlyViewedBlogs(userId: number, limit: number = 10): Promise<BlogArticle[]> {
    try {
      // Join userBlogInteractions with blogArticles table
      return await db
        .select()
        .from(blogArticles)
        .innerJoin(
          userBlogInteractions,
          and(
            eq(blogArticles.id, userBlogInteractions.blogId),
            eq(userBlogInteractions.userId, userId)
          )
        )
        .orderBy(desc(userBlogInteractions.lastViewed))
        .limit(limit);
    } catch (error) {
      console.error(`Error fetching recently viewed blogs for user ${userId}:`, error);
      throw error;
    }
  }

  // Basic implementation of recommendation system
  async getRecommendedStudies(userId: number, limit: number = 5): Promise<Study[]> {
    try {
      // Get user's recently viewed studies to find categories of interest
      const recentStudies = await this.getRecentlyViewedStudies(userId, 10);
      
      if (recentStudies.length === 0) {
        // If no viewing history, return latest studies
        return this.getLatestStudies(limit);
      }
      
      // Extract categories of interest
      const categories = recentStudies.map(study => study.category);
      const uniqueCategories = [...new Set(categories)];
      
      // Find studies in those categories, excluding recently viewed ones
      const recentIds = recentStudies.map(study => study.id);
      
      const recommendedStudies = await db
        .select()
        .from(studies)
        .where(
          and(
            sql`${studies.category} IN (${uniqueCategories.join(',')})`,
            sql`${studies.id} NOT IN (${recentIds.join(',')})`
          )
        )
        .orderBy(desc(studies.publishDate))
        .limit(limit);
      
      return recommendedStudies;
    } catch (error) {
      console.error(`Error getting recommended studies for user ${userId}:`, error);
      // Fallback to latest studies on error
      return this.getLatestStudies(limit);
    }
  }

  // Basic implementation of blog recommendations
  async getRecommendedBlogs(userId: number, limit: number = 5): Promise<BlogArticle[]> {
    try {
      // Get user's recently viewed blogs
      const recentBlogs = await this.getRecentlyViewedBlogs(userId, 10);
      
      if (recentBlogs.length === 0) {
        // If no viewing history, return latest blogs
        return db
          .select()
          .from(blogArticles)
          .orderBy(desc(blogArticles.createdAt))
          .limit(limit);
      }
      
      // Extract types of interest
      const types = recentBlogs.map(blog => blog.type);
      const uniqueTypes = [...new Set(types)];
      
      // Find blogs of those types, excluding recently viewed ones
      const recentIds = recentBlogs.map(blog => blog.id);
      
      const recommendedBlogs = await db
        .select()
        .from(blogArticles)
        .where(
          and(
            sql`${blogArticles.type} IN (${uniqueTypes.join(',')})`,
            sql`${blogArticles.id} NOT IN (${recentIds.join(',')})`
          )
        )
        .orderBy(desc(blogArticles.createdAt))
        .limit(limit);
      
      return recommendedBlogs;
    } catch (error) {
      console.error(`Error getting recommended blogs for user ${userId}:`, error);
      // Fallback to latest blogs on error
      return db
        .select()
        .from(blogArticles)
        .orderBy(desc(blogArticles.createdAt))
        .limit(limit);
    }
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    try {
      const [newNotification] = await db
        .insert(notifications)
        .values(notification)
        .returning();
      
      return newNotification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  async getUserNotifications(userId: number, unreadOnly: boolean = false): Promise<Notification[]> {
    try {
      let query = db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt));
      
      if (unreadOnly) {
        query = query.where(eq(notifications.isRead, false));
      }
      
      return await query;
    } catch (error) {
      console.error(`Error fetching notifications for user ${userId}:`, error);
      throw error;
    }
  }

  async markNotificationAsRead(id: number): Promise<void> {
    try {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, id));
    } catch (error) {
      console.error(`Error marking notification ${id} as read:`, error);
      throw error;
    }
  }

  async markAllNotificationsAsRead(userId: number): Promise<void> {
    try {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, userId));
    } catch (error) {
      console.error(`Error marking all notifications as read for user ${userId}:`, error);
      throw error;
    }
  }

  async initializeSampleData(): Promise<void> {
    console.log('Initializing sample data in database...');
    
    try {
      await this.initializeSampleCategories();
      await this.initializeSampleStudies();
      console.log('Sample data initialized successfully');
    } catch (error) {
      console.error('Error initializing sample data:', error);
      throw error;
    }
  }

  private async initializeSampleCategories(): Promise<void> {
    // Check if categories already exist
    const existingCategories = await db.select().from(categories);
    if (existingCategories.length > 0) {
      console.log('Categories already exist, skipping initialization');
      return;
    }
    
    // Create sample categories
    const sampleCategories: InsertCategory[] = [
      {
        name: 'General',
        description: 'General research on molecular hydrogen and its health effects',
        iconName: 'flask',
        color: '#3498db',
        studyCount: 0
      },
      {
        name: 'Neurological',
        description: 'Research focusing on hydrogen effects on brain and nervous system',
        iconName: 'brain',
        color: '#9b59b6',
        studyCount: 0
      },
      {
        name: 'Cardiovascular',
        description: 'Studies on hydrogen benefits for heart and circulatory system',
        iconName: 'heart',
        color: '#e74c3c',
        studyCount: 0
      },
      {
        name: 'Metabolic',
        description: 'Research on hydrogen effects on metabolism and metabolic disorders',
        iconName: 'microscope',
        color: '#2ecc71',
        studyCount: 0
      },
      {
        name: 'Inflammation',
        description: 'Studies focusing on anti-inflammatory properties of hydrogen',
        iconName: 'fire',
        color: '#e67e22',
        studyCount: 0
      },
      {
        name: 'Athletic Performance',
        description: 'Research on hydrogen benefits for exercise and recovery',
        iconName: 'running',
        color: '#1abc9c',
        studyCount: 0
      },
      {
        name: 'Dermatological',
        description: 'Studies on hydrogen effects on skin health and conditions',
        iconName: 'user',
        color: '#f1c40f',
        studyCount: 0
      },
      {
        name: 'Gastrointestinal',
        description: 'Research on hydrogen benefits for digestive system',
        iconName: 'utensils',
        color: '#d35400',
        studyCount: 0
      }
    ];
    
    // Insert categories
    await db.insert(categories).values(sampleCategories);
  }

  private async initializeSampleStudies(): Promise<void> {
    // Check if studies already exist
    const existingStudies = await db.select().from(studies);
    if (existingStudies.length > 0) {
      console.log('Studies already exist, skipping initialization');
      return;
    }
    
    // Sample studies will be added here
    // For brevity, we'll add just a few sample studies
    const sampleStudies: InsertStudy[] = [
      {
        title: 'Molecular hydrogen improves obesity and diabetes by inducing hepatic FGF21 and stimulating energy metabolism in db/db mice',
        abstract: 'Hydrogen has been reported to have a therapeutic potential in various diseases. However, the diseases in which hydrogen is applicable for clinically remain unclear. In this study, we investigated the role of hydrogen in obesity and type 2 diabetes.',
        authors: 'Naomi Kamimura, Kiyomi Nishimaki, Ikuroh Ohsawa, Shigeo Ohta',
        journal: 'Obesity',
        publishDate: '2021-01-15',
        journalPublishDate: '2011-07-01',
        category: 'Metabolic',
        methods: 'Db/db mice were treated with hydrogen-rich water for 6 weeks.',
        results: 'Hydrogen treatment improved obesity and diabetes by stimulating energy metabolism through the induction of hepatic FGF21.',
        conclusion: 'These results suggest the potential benefit of hydrogen in treating metabolic diseases.',
        doi: '10.1038/oby.2011.6',
        peerReviewed: true,
        publishYear: 2011,
        summaryMarkdown: '# Molecular hydrogen improves obesity and diabetes\n\nThis study demonstrates that hydrogen-rich water can improve obesity and diabetes markers in mice through stimulation of energy metabolism and induction of hepatic FGF21.'
      },
      {
        title: 'Hydrogen-rich water decreases serum LDL-cholesterol levels and improves HDL function in patients with potential metabolic syndrome',
        abstract: 'Metabolic syndrome is characterized by cardiometabolic risk factors that include obesity, insulin resistance, hypertension and dyslipidemia. Dyslipidemia is characterized by elevated LDL and decreased HDL. This study examined the effects of consuming hydrogen-rich water on serum lipid profiles in patients with potential metabolic syndrome.',
        authors: 'Guohua Song, Min Li, Hongchao Sang, Liyuan Zhang, Xuejun Li, Shucun Qin',
        journal: 'Journal of Lipid Research',
        publishDate: '2021-02-10',
        journalPublishDate: '2013-07-01',
        category: 'Cardiovascular',
        methods: 'Patients with potential metabolic syndrome consumed hydrogen-rich water for 10 weeks.',
        results: 'Drinking hydrogen-rich water decreased serum total and LDL-cholesterol and improved HDL functions.',
        conclusion: 'The findings suggest that hydrogen-rich water might be promising to improve the dyslipidemia and reduce cardiovascular risks.',
        doi: '10.1194/jlr.M036640',
        peerReviewed: true,
        publishYear: 2013,
        summaryMarkdown: '# Hydrogen-rich water improves lipid profiles\n\nThis study found that consuming hydrogen-rich water can decrease LDL-cholesterol levels and improve HDL function in patients with potential metabolic syndrome, suggesting cardiovascular benefits.'
      },
      {
        title: 'Hydrogen-rich water for improvements of mood, anxiety, and autonomic nerve function in daily life',
        abstract: 'The effects of hydrogen-rich water on mood, anxiety, and autonomic nerve function were investigated in this study. Volunteers were evaluated for their mood and anxiety levels before and after consuming hydrogen-rich water for 4 weeks.',
        authors: 'Kei Mizuno, Akihiro T Sasaki, Kyoko Ebisu, Kanako Tajima, Sayaka Kajimoto, Junichi Kuratsune, Hirohiko Kuratsune, Yasuyoshi Watanabe',
        journal: 'Medical Gas Research',
        publishDate: '2021-03-20',
        journalPublishDate: '2017-12-01',
        category: 'Neurological',
        methods: 'Twenty-six adult volunteers drank 600 mL of hydrogen-rich water per day for 4 weeks.',
        results: 'Drinking hydrogen-rich water improved mood, anxiety, and autonomic nerve function.',
        conclusion: 'Hydrogen-rich water may have potential as a safe and effective intervention for improving mood, anxiety, and autonomic nerve function.',
        doi: '10.4103/2045-9912.222448',
        peerReviewed: true,
        publishYear: 2017,
        summaryMarkdown: '# Hydrogen-rich water improves mood and anxiety\n\nThis study shows that drinking hydrogen-rich water daily can lead to improvements in mood, anxiety levels, and autonomic nerve function in healthy adults.'
      }
    ];
    
    // Insert studies
    await db.insert(studies).values(sampleStudies);
    
    // Update category counts
    const categoryStudyCounts = new Map<string, number>();
    for (const study of sampleStudies) {
      const category = study.category;
      categoryStudyCounts.set(category, (categoryStudyCounts.get(category) || 0) + 1);
    }
    
    // Update each category with the correct study count
    for (const [categoryName, count] of categoryStudyCounts.entries()) {
      const category = await this.getCategoryByName(categoryName);
      if (category) {
        await db
          .update(categories)
          .set({ studyCount: count })
          .where(eq(categories.id, category.id));
      }
    }
  }

  // Study review queue methods for two-tier approval system
  async saveStudyForReview(reviewItem: InsertStudyReviewQueue): Promise<StudyReviewQueue> {
    try {
      const [savedItem] = await db
        .insert(studyReviewQueue)
        .values({
          ...reviewItem,
          savedAt: new Date(),
          reviewedAt: null
        })
        .returning();
      
      return savedItem;
    } catch (error) {
      console.error('Error saving study for review:', error);
      throw error;
    }
  }
  
  async getStudyReviewQueue(filters: {status?: string, userId?: string} = {}): Promise<StudyReviewQueue[]> {
    try {
      let query = db.select().from(studyReviewQueue);
      
      const conditions = [];
      
      if (filters.status) {
        conditions.push(eq(studyReviewQueue.status, filters.status));
      }
      
      if (filters.userId) {
        conditions.push(
          or(
            eq(studyReviewQueue.savedByUserId, filters.userId),
            eq(studyReviewQueue.reviewedByUserId, filters.userId)
          )
        );
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      // Sort by newest first
      query = query.orderBy(desc(studyReviewQueue.savedAt));
      
      return await query;
    } catch (error) {
      console.error('Error fetching study review queue:', error);
      throw error;
    }
  }
  
  async getStudyReviewQueueById(id: number): Promise<StudyReviewQueue | undefined> {
    try {
      const [reviewItem] = await db
        .select()
        .from(studyReviewQueue)
        .where(eq(studyReviewQueue.id, id));
      
      return reviewItem;
    } catch (error) {
      console.error(`Error fetching review item with id ${id}:`, error);
      throw error;
    }
  }
  
  async updateStudyReviewStatus(
    id: number, 
    status: string, 
    reviewedByUserId: string, 
    notes?: string
  ): Promise<StudyReviewQueue> {
    try {
      // Get the existing review item first to preserve reviewNotes
      const [existingItem] = await db
        .select()
        .from(studyReviewQueue)
        .where(eq(studyReviewQueue.id, id));
      
      if (!existingItem) {
        throw new Error(`Review item with id ${id} not found`);
      }
      
      const reviewedAt = new Date();
      
      // Prepare the updated notes field
      let updatedNotes = existingItem.reviewNotes || '';
      if (notes) {
        updatedNotes = updatedNotes 
          ? `${updatedNotes}\n\nREVIEW NOTES (${reviewedAt.toISOString()}):\n${notes}` 
          : `REVIEW NOTES (${reviewedAt.toISOString()}):\n${notes}`;
      }
      
      // Update the item
      const [updatedItem] = await db
        .update(studyReviewQueue)
        .set({
          status,
          reviewedByUserId,
          reviewedAt,
          reviewNotes: updatedNotes
        })
        .where(eq(studyReviewQueue.id, id))
        .returning();
      
      if (!updatedItem) {
        throw new Error(`Failed to update review item with id ${id}`);
      }
      
      return updatedItem;
    } catch (error) {
      console.error(`Error updating review status for item ${id}:`, error);
      throw error;
    }
  }
  
  async deleteStudyFromReviewQueue(id: number): Promise<void> {
    try {
      await db
        .delete(studyReviewQueue)
        .where(eq(studyReviewQueue.id, id));
    } catch (error) {
      console.error(`Error deleting review item with id ${id}:`, error);
      throw error;
    }
  }
  
  async checkStudyExists(doi: string): Promise<{exists: boolean, studyId?: number}> {
    try {
      if (!doi) {
        return { exists: false };
      }
      
      const normalizedDoi = doi.toLowerCase().trim();
      
      // Check if the study exists in the main studies table
      const [existingStudy] = await db
        .select({ id: studies.id })
        .from(studies)
        .where(sql`LOWER(TRIM(${studies.doi})) = ${normalizedDoi}`);
      
      if (existingStudy) {
        return { exists: true, studyId: existingStudy.id };
      }
      
      // Also check the review queue for pending studies with the same DOI
      const [pendingStudy] = await db
        .select({ id: studyReviewQueue.id })
        .from(studyReviewQueue)
        .where(
          and(
            sql`LOWER(TRIM(${studyReviewQueue.doi})) = ${normalizedDoi}`,
            eq(studyReviewQueue.status, 'pending')
          )
        );
      
      if (pendingStudy) {
        return { exists: true };
      }
      
      return { exists: false };
    } catch (error) {
      console.error(`Error checking if study with DOI ${doi} exists:`, error);
      throw error;
    }
  }
}