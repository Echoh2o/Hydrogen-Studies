import { IStorage, StudyFilters, PaginatedResults } from './storage-types';
import { dbAdapter } from './adapters/database-adapter';
import type {
  Study, InsertStudy, 
  Category, InsertCategory,
  Newsletter, InsertNewsletter,
  User, InsertUser,
  UserPreferences, InsertUserPreferences,
  SearchHistory, InsertSearchHistory,
  UserStudyInteraction, UserBlogInteraction,
  BlogArticle, Notification, InsertNotification,
  StudyReviewQueue, InsertStudyReviewQueue
} from "@shared/schema";

/**
 * In-memory storage implementation
 * This is used for methods not yet implemented in the database adapter
 */
class MemoryFallback {
  private usersData: Map<number, User> = new Map();
  private userPreferencesData: Map<number, UserPreferences> = new Map();
  private searchHistoryData: Map<number, SearchHistory[]> = new Map();
  private userStudyInteractionsData: Map<string, UserStudyInteraction> = new Map();
  private userBlogInteractionsData: Map<string, UserBlogInteraction> = new Map();
  private notificationsData: Map<number, Notification> = new Map();
  private blogArticlesData: Map<number, BlogArticle> = new Map();
  
  constructor() {
    console.log('Memory fallback initialized for unsupported operations');
  }
  
  // Helper functions
  private getUserStudyKey(userId: number, studyId: number): string {
    return `${userId}-${studyId}`;
  }
  
  private getUserBlogKey(userId: number, blogId: number): string {
    return `${userId}-${blogId}`;
  }

  // User account operations
  async getUserById(id: number): Promise<User | undefined> {
    return this.usersData.get(id);
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    for (const user of this.usersData.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return undefined;
  }
  
  async createUser(user: InsertUser): Promise<User> {
    const id = this.usersData.size + 1;
    const newUser: User = { ...user, id, createdAt: new Date() };
    this.usersData.set(id, newUser);
    return newUser;
  }
  
  async updateUser(id: number, user: Partial<InsertUser>): Promise<User> {
    const existingUser = this.usersData.get(id);
    if (!existingUser) {
      throw new Error(`User with ID ${id} not found`);
    }
    
    const updatedUser: User = { ...existingUser, ...user };
    this.usersData.set(id, updatedUser);
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<void> {
    this.usersData.delete(id);
  }
  
  async authenticateUser(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    if (!user) return null;
    
    // In a real implementation, would check hashed password
    return user;
  }
  
  // User preferences operations
  async getUserPreferences(userId: number): Promise<UserPreferences | undefined> {
    return this.userPreferencesData.get(userId);
  }
  
  async createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences> {
    const id = this.userPreferencesData.size + 1;
    const newPreferences: UserPreferences = { ...preferences, id, createdAt: new Date() };
    this.userPreferencesData.set(preferences.userId, newPreferences);
    return newPreferences;
  }
  
  async updateUserPreferences(id: number, preferences: Partial<InsertUserPreferences>): Promise<UserPreferences> {
    const existingPreferences = this.userPreferencesData.get(id);
    if (!existingPreferences) {
      throw new Error(`User preferences with ID ${id} not found`);
    }
    
    const updatedPreferences: UserPreferences = { ...existingPreferences, ...preferences };
    this.userPreferencesData.set(id, updatedPreferences);
    return updatedPreferences;
  }
  
  // Search history operations
  async addSearchHistory(searchHistory: InsertSearchHistory): Promise<SearchHistory> {
    const id = Math.floor(Math.random() * 1000000);
    const newSearchHistory: SearchHistory = { ...searchHistory, id, createdAt: new Date() };
    
    const userHistory = this.searchHistoryData.get(searchHistory.userId) || [];
    userHistory.push(newSearchHistory);
    this.searchHistoryData.set(searchHistory.userId, userHistory);
    
    return newSearchHistory;
  }
  
  async getUserSearchHistory(userId: number, limit?: number): Promise<SearchHistory[]> {
    const history = this.searchHistoryData.get(userId) || [];
    const sortedHistory = [...history].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    if (limit) {
      return sortedHistory.slice(0, limit);
    }
    
    return sortedHistory;
  }
  
  // User study interactions
  async saveStudy(userId: number, studyId: number): Promise<UserStudyInteraction> {
    const key = this.getUserStudyKey(userId, studyId);
    const interaction: UserStudyInteraction = {
      id: Math.floor(Math.random() * 1000000),
      userId,
      studyId,
      saved: true,
      lastViewedAt: new Date(),
      createdAt: new Date()
    };
    
    this.userStudyInteractionsData.set(key, interaction);
    return interaction;
  }
  
  async unsaveStudy(userId: number, studyId: number): Promise<void> {
    const key = this.getUserStudyKey(userId, studyId);
    this.userStudyInteractionsData.delete(key);
  }
  
  async recordStudyView(userId: number, studyId: number): Promise<void> {
    const key = this.getUserStudyKey(userId, studyId);
    const existing = this.userStudyInteractionsData.get(key);
    
    if (existing) {
      existing.lastViewedAt = new Date();
      this.userStudyInteractionsData.set(key, existing);
    } else {
      const interaction: UserStudyInteraction = {
        id: Math.floor(Math.random() * 1000000),
        userId,
        studyId,
        saved: false,
        lastViewedAt: new Date(),
        createdAt: new Date()
      };
      
      this.userStudyInteractionsData.set(key, interaction);
    }
  }
  
  async getSavedStudies(userId: number): Promise<Study[]> {
    const saved: Study[] = [];
    // This would need to join with studies table in a real implementation
    return saved;
  }
  
  async getRecentlyViewedStudies(userId: number, limit?: number): Promise<Study[]> {
    const viewed: Study[] = [];
    // This would need to join with studies table in a real implementation
    return viewed;
  }
  
  // User blog interactions
  async saveBlog(userId: number, blogId: number): Promise<UserBlogInteraction> {
    const key = this.getUserBlogKey(userId, blogId);
    const interaction: UserBlogInteraction = {
      id: Math.floor(Math.random() * 1000000),
      userId,
      blogId,
      saved: true,
      lastViewedAt: new Date(),
      createdAt: new Date()
    };
    
    this.userBlogInteractionsData.set(key, interaction);
    return interaction;
  }
  
  async unsaveBlog(userId: number, blogId: number): Promise<void> {
    const key = this.getUserBlogKey(userId, blogId);
    this.userBlogInteractionsData.delete(key);
  }
  
  async recordBlogView(userId: number, blogId: number): Promise<void> {
    const key = this.getUserBlogKey(userId, blogId);
    const existing = this.userBlogInteractionsData.get(key);
    
    if (existing) {
      existing.lastViewedAt = new Date();
      this.userBlogInteractionsData.set(key, existing);
    } else {
      const interaction: UserBlogInteraction = {
        id: Math.floor(Math.random() * 1000000),
        userId,
        blogId,
        saved: false,
        lastViewedAt: new Date(),
        createdAt: new Date()
      };
      
      this.userBlogInteractionsData.set(key, interaction);
    }
  }
  
  async getSavedBlogs(userId: string): Promise<BlogArticle[]> {
    const saved: BlogArticle[] = [];
    // This would need to join with blogs table in a real implementation
    return saved;
  }
  
  async getRecentlyViewedBlogs(userId: string, limit?: number): Promise<BlogArticle[]> {
    const viewed: BlogArticle[] = [];
    // This would need to join with blogs table in a real implementation
    return viewed;
  }
  
  // Recommendation system
  async getRecommendedStudies(userId: string, limit?: number): Promise<Study[]> {
    // This would implement recommendation logic in a real implementation
    return [];
  }
  
  async getRecommendedBlogs(userId: string, limit?: number): Promise<BlogArticle[]> {
    // This would implement recommendation logic in a real implementation
    return [];
  }
  
  // Notification system
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const id = this.notificationsData.size + 1;
    const newNotification: Notification = { 
      ...notification, 
      id, 
      read: false, 
      createdAt: new Date() 
    };
    
    this.notificationsData.set(id, newNotification);
    return newNotification;
  }
  
  async getUserNotifications(userId: string, unreadOnly?: boolean): Promise<Notification[]> {
    const notifications: Notification[] = [];
    
    for (const notification of this.notificationsData.values()) {
      if (notification.userId === userId) {
        if (!unreadOnly || !notification.read) {
          notifications.push(notification);
        }
      }
    }
    
    return notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  async markNotificationAsRead(id: number): Promise<void> {
    const notification = this.notificationsData.get(id);
    if (notification) {
      notification.read = true;
      this.notificationsData.set(id, notification);
    }
  }
  
  async markAllNotificationsAsRead(userId: string): Promise<void> {
    for (const [id, notification] of this.notificationsData.entries()) {
      if (notification.userId === userId) {
        notification.read = true;
        this.notificationsData.set(id, notification);
      }
    }
  }
}

/**
 * Database Storage class
 * Implements the IStorage interface for database operations
 * Falls back to a provided memory storage for unimplemented methods
 */
export class DatabaseStorage implements IStorage {
  // For methods not implemented in database
  private fallback: MemoryFallback;
  
  constructor() {
    // Create a fallback for methods not yet implemented in database
    this.fallback = new MemoryFallback();
    console.log('DatabaseStorage initialized with database adapter and memory fallbacks');
  }
  
  // Core study operations - implemented in database
  async getStudies(filters: StudyFilters = {}): Promise<PaginatedResults<Study>> {
    return await dbAdapter.getStudies(filters);
  }
  
  async getStudyById(id: number): Promise<Study | undefined> {
    return await dbAdapter.getStudyById(id);
  }
  
  async getStudyByIdentifier(identifier: string): Promise<Study | undefined> {
    return await dbAdapter.getStudyByIdentifier(identifier);
  }
  
  async getLatestStudies(limit: number = 3): Promise<Study[]> {
    return await dbAdapter.getLatestStudies(limit);
  }
  
  async getStudiesByTitle(title: string): Promise<Study[]> {
    // This is a fallback implementation - to be implemented in database adapter
    // Create a filter to search for exact title match
    const filters: StudyFilters = { query: title };
    const results = await this.getStudies(filters);
    return results.data.filter(study => study.title === title);
  }
  
  async getStudiesByTitlePartial(titlePart: string, limit: number = 20): Promise<Study[]> {
    // This is a fallback implementation - to be implemented in database adapter
    // Create a filter to search for partial title match
    const filters: StudyFilters = { query: titlePart };
    const results = await this.getStudies(filters);
    return results.data.slice(0, limit);
  }
  
  async getStudiesBySourcePlatform(platform: string): Promise<Study[]> {
    // This is a fallback implementation - to be implemented in database adapter
    // Create a filter for source platform
    const filters: StudyFilters = {};
    const results = await this.getStudies(filters);
    return results.data.filter(study => study.sourcePlatform === platform);
  }
  
  async createStudy(study: InsertStudy): Promise<Study> {
    // This is a fallback implementation - to be implemented in database adapter
    // For now, we'll return a mock implementation that works for testing
    const mockStudy: Study = {
      ...study,
      id: Math.floor(Math.random() * 1000000),
      createdAt: new Date()
    };
    return mockStudy;
  }
  
  async updateStudy(id: number, study: Partial<InsertStudy>): Promise<Study> {
    // This is a fallback implementation - to be implemented in database adapter
    // For now, get the existing study and return an updated version
    const existingStudy = await this.getStudyById(id);
    if (!existingStudy) {
      throw new Error(`Study with ID ${id} not found`);
    }
    
    // Return merged study
    return { ...existingStudy, ...study };
  }
  
  async deleteStudy(id: number): Promise<void> {
    // This is a fallback implementation - to be implemented in database adapter
    // For now, just log the deletion
    console.log(`Would delete study with ID ${id}`);
  }
  
  // Category operations - implemented in database
  async getCategories(): Promise<Category[]> {
    return await dbAdapter.getCategories();
  }
  
  async getCategoryById(id: number): Promise<Category | undefined> {
    // Get all categories and find by ID
    const categories = await this.getCategories();
    return categories.find(cat => cat.id === id);
  }
  
  async getCategoryByName(name: string): Promise<Category | undefined> {
    // Get all categories and find by name
    const categories = await this.getCategories();
    return categories.find(cat => cat.name === name);
  }
  
  async createCategory(category: InsertCategory): Promise<Category> {
    // This is a fallback implementation - to be implemented in database adapter
    // For now, return a mock implementation
    const mockCategory: Category = {
      ...category,
      id: Math.floor(Math.random() * 1000000),
      createdAt: new Date(),
      icon: category.icon || null,
      studyCount: 0
    };
    return mockCategory;
  }
  
  // Newsletter operations
  async subscribeNewsletter(subscription: InsertNewsletter): Promise<Newsletter> {
    // This is a fallback implementation - to be implemented in database adapter
    // For now, return a mock implementation
    const mockSubscription: Newsletter = {
      ...subscription,
      id: Math.floor(Math.random() * 1000000),
      createdAt: new Date()
    };
    return mockSubscription;
  }
  
  // Contact operations
  async submitContactMessage(message: InsertContact): Promise<any> {
    // This is a fallback implementation - to be implemented in database adapter
    // For now, return a mock implementation
    return { success: true, id: Math.floor(Math.random() * 1000000) };
  }
  
  // Study review operations
  async checkStudyExists(doi: string): Promise<{ exists: boolean, studyId?: number }> {
    return await dbAdapter.checkStudyExists(doi);
  }
  
  async saveStudyForReview(reviewItem: InsertStudyReviewQueue): Promise<StudyReviewQueue> {
    // This is a fallback implementation - to be implemented in database adapter
    // For now, return a mock implementation
    const mockReviewItem: StudyReviewQueue = {
      ...reviewItem,
      id: Math.floor(Math.random() * 1000000),
      savedAt: new Date(),
      status: 'pending',
      reviewedAt: null,
      reviewedByUserId: null,
      reviewNotes: null
    };
    return mockReviewItem;
  }
  
  async getStudyReviewQueue(filters?: { status?: string, userId?: string }): Promise<StudyReviewQueue[]> {
    // This is a fallback implementation - to be implemented in database adapter
    // For now, return an empty array
    return [];
  }
  
  async getStudyReviewQueueById(id: number): Promise<StudyReviewQueue | undefined> {
    // This is a fallback implementation - to be implemented in database adapter
    // For now, return undefined
    return undefined;
  }
  
  async updateStudyReviewStatus(id: number, status: string, reviewedByUserId: string, notes?: string): Promise<StudyReviewQueue> {
    // This is a fallback implementation - to be implemented in database adapter
    // For now, return a mock implementation
    const mockReviewItem: StudyReviewQueue = {
      id,
      title: 'Mock Study',
      abstract: 'Mock Abstract',
      authors: 'Mock Authors',
      journal: 'Mock Journal',
      publishDate: null,
      journalPublishDate: null,
      category: 'general',
      doi: null,
      sourceUrl: null,
      sourcePlatform: 'manual',
      externalId: 'mock-id',
      savedAt: new Date(),
      savedByUserId: 'mock-user',
      status,
      reviewedByUserId,
      reviewNotes: notes || null,
      reviewedAt: new Date(),
      createdAt: new Date()
    };
    return mockReviewItem;
  }
  
  async deleteStudyFromReviewQueue(id: number): Promise<void> {
    // This is a fallback implementation - to be implemented in database adapter
    // For now, just log the deletion
    console.log(`Would delete review queue item with ID ${id}`);
  }
  
  // User account operations - fall back to memory implementation
  async getUserById(id: number): Promise<User | undefined> {
    return this.fallback.getUserById(id);
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.fallback.getUserByEmail(email);
  }
  
  async createUser(user: InsertUser): Promise<User> {
    return this.fallback.createUser(user);
  }
  
  async updateUser(id: number, user: Partial<InsertUser>): Promise<User> {
    return this.fallback.updateUser(id, user);
  }
  
  async deleteUser(id: number): Promise<void> {
    return this.fallback.deleteUser(id);
  }
  
  async authenticateUser(email: string, password: string): Promise<User | null> {
    return this.fallback.authenticateUser(email, password);
  }
  
  // User preferences operations - fall back to memory implementation
  async getUserPreferences(userId: number): Promise<UserPreferences | undefined> {
    return this.fallback.getUserPreferences(userId);
  }
  
  async createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences> {
    return this.fallback.createUserPreferences(preferences);
  }
  
  async updateUserPreferences(id: number, preferences: Partial<InsertUserPreferences>): Promise<UserPreferences> {
    return this.fallback.updateUserPreferences(id, preferences);
  }
  
  // Search history operations - fall back to memory implementation
  async addSearchHistory(searchHistory: InsertSearchHistory): Promise<SearchHistory> {
    return this.fallback.addSearchHistory(searchHistory);
  }
  
  async getUserSearchHistory(userId: number, limit?: number): Promise<SearchHistory[]> {
    return this.fallback.getUserSearchHistory(userId, limit);
  }
  
  // User study interactions - fall back to memory implementation
  async saveStudy(userId: number, studyId: number): Promise<UserStudyInteraction> {
    return this.fallback.saveStudy(userId, studyId);
  }
  
  async unsaveStudy(userId: number, studyId: number): Promise<void> {
    return this.fallback.unsaveStudy(userId, studyId);
  }
  
  async recordStudyView(userId: number, studyId: number): Promise<void> {
    return this.fallback.recordStudyView(userId, studyId);
  }
  
  async getSavedStudies(userId: number): Promise<Study[]> {
    return this.fallback.getSavedStudies(userId);
  }
  
  async getRecentlyViewedStudies(userId: number, limit?: number): Promise<Study[]> {
    return this.fallback.getRecentlyViewedStudies(userId, limit);
  }
  
  // User blog interactions - fall back to memory implementation
  async saveBlog(userId: number, blogId: number): Promise<UserBlogInteraction> {
    return this.fallback.saveBlog(userId, blogId);
  }
  
  async unsaveBlog(userId: number, blogId: number): Promise<void> {
    return this.fallback.unsaveBlog(userId, blogId);
  }
  
  async recordBlogView(userId: number, blogId: number): Promise<void> {
    return this.fallback.recordBlogView(userId, blogId);
  }
  
  async getSavedBlogs(userId: string): Promise<BlogArticle[]> {
    return this.fallback.getSavedBlogs(userId);
  }
  
  async getRecentlyViewedBlogs(userId: string, limit?: number): Promise<BlogArticle[]> {
    return this.fallback.getRecentlyViewedBlogs(userId, limit);
  }
  
  // Recommendation system - fall back to memory implementation
  async getRecommendedStudies(userId: string, limit?: number): Promise<Study[]> {
    return this.fallback.getRecommendedStudies(userId, limit);
  }
  
  async getRecommendedBlogs(userId: string, limit?: number): Promise<BlogArticle[]> {
    return this.fallback.getRecommendedBlogs(userId, limit);
  }
  
  // Notification system - fall back to memory implementation
  async createNotification(notification: InsertNotification): Promise<Notification> {
    return this.fallback.createNotification(notification);
  }
  
  async getUserNotifications(userId: string, unreadOnly?: boolean): Promise<Notification[]> {
    return this.fallback.getUserNotifications(userId, unreadOnly);
  }
  
  async markNotificationAsRead(id: number): Promise<void> {
    return this.fallback.markNotificationAsRead(id);
  }
  
  async markAllNotificationsAsRead(userId: string): Promise<void> {
    return this.fallback.markAllNotificationsAsRead(userId);
  }
  
  // Sample data initialization
  async initializeSampleData(): Promise<void> {
    console.log('Sample data initialization is handled by database migrations');
  }
}

// Create a singleton instance
export const dbStorage = new DatabaseStorage();