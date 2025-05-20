import { IStorage, PaginatedResults } from './storage';
import { dbAdapter } from './database-adapter';
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
 * Database Storage class
 * Implements the IStorage interface for database operations
 * Falls back to a provided memory storage for unimplemented methods
 */
export class DatabaseStorage implements IStorage {
  // Reference to the memory storage for fallback operations
  private fallbackStorage: IStorage;
  
  constructor(fallbackStorage: IStorage) {
    // Store the provided fallback storage implementation
    this.fallbackStorage = fallbackStorage;
    console.log('DatabaseStorage initialized with database adapter and fallbacks');
  }
  
  // Core study operations - implemented in database
  async getStudies(filters = {}) {
    return await dbAdapter.getStudies(filters);
  }
  
  async getStudyById(id) {
    return await dbAdapter.getStudyById(id);
  }
  
  async getStudyByIdentifier(identifier) {
    return await dbAdapter.getStudyByDoi(identifier);
  }
  
  async getLatestStudies(limit = 3) {
    return await dbAdapter.getLatestStudies(limit);
  }
  
  async getStudiesByTitle(title) {
    return await dbAdapter.getStudiesByTitle(title);
  }
  
  async getStudiesByTitlePartial(titlePart, limit = 20) {
    return await dbAdapter.getStudiesByTitlePartial(titlePart, limit);
  }
  
  async getStudiesBySourcePlatform(platform) {
    return await dbAdapter.getStudiesBySourcePlatform(platform);
  }
  
  async createStudy(study) {
    return await dbAdapter.createStudy(study);
  }
  
  async updateStudy(id, study) {
    return await dbAdapter.updateStudy(id, study);
  }
  
  async deleteStudy(id) {
    return await dbAdapter.deleteStudy(id);
  }
  
  // Category operations - implemented in database
  async getCategories() {
    return await dbAdapter.getCategories();
  }
  
  async getCategoryById(id) {
    return await dbAdapter.getCategoryById(id);
  }
  
  async getCategoryByName(name) {
    return await dbAdapter.getCategoryByName(name);
  }
  
  async createCategory(category) {
    return await dbAdapter.createCategory(category);
  }
  
  // Newsletter operations - implemented in database
  async subscribeNewsletter(subscription) {
    return await dbAdapter.subscribeNewsletter(subscription);
  }
  
  // Contact operations - implemented in database
  async submitContactMessage(message) {
    return await dbAdapter.submitContactMessage(message);
  }
  
  // Study review operations - implemented in database
  async checkStudyExists(doi) {
    return await dbAdapter.checkStudyExists(doi);
  }
  
  async saveStudyForReview(reviewItem) {
    return await dbAdapter.saveStudyForReview(reviewItem);
  }
  
  async getStudyReviewQueue(filters) {
    return await dbAdapter.getStudyReviewQueue(filters);
  }
  
  async getStudyReviewQueueById(id) {
    return await dbAdapter.getStudyReviewQueueById(id);
  }
  
  async updateStudyReviewStatus(id, status, reviewedByUserId, notes) {
    return await dbAdapter.updateStudyReviewStatus(id, status, reviewedByUserId, notes);
  }
  
  async deleteStudyFromReviewQueue(id) {
    return await dbAdapter.deleteStudyFromReviewQueue(id);
  }
  
  // User account operations - fallback to in-memory
  async getUserById(id) {
    console.log('Using in-memory fallback for getUserById');
    return await this.memStorage.getUserById(id);
  }
  
  async getUserByEmail(email) {
    console.log('Using in-memory fallback for getUserByEmail');
    return await this.memStorage.getUserByEmail(email);
  }
  
  async createUser(user) {
    console.log('Using in-memory fallback for createUser');
    return await this.memStorage.createUser(user);
  }
  
  async updateUser(id, user) {
    console.log('Using in-memory fallback for updateUser');
    return await this.memStorage.updateUser(id, user);
  }
  
  async deleteUser(id) {
    console.log('Using in-memory fallback for deleteUser');
    return await this.memStorage.deleteUser(id);
  }
  
  async authenticateUser(email, password) {
    console.log('Using in-memory fallback for authenticateUser');
    return await this.memStorage.authenticateUser(email, password);
  }
  
  // User preferences operations - fallback to in-memory
  async getUserPreferences(userId) {
    console.log('Using in-memory fallback for getUserPreferences');
    return await this.memStorage.getUserPreferences(userId);
  }
  
  async createUserPreferences(preferences) {
    console.log('Using in-memory fallback for createUserPreferences');
    return await this.memStorage.createUserPreferences(preferences);
  }
  
  async updateUserPreferences(id, preferences) {
    console.log('Using in-memory fallback for updateUserPreferences');
    return await this.memStorage.updateUserPreferences(id, preferences);
  }
  
  // Search history operations - fallback to in-memory
  async addSearchHistory(searchHistory) {
    console.log('Using in-memory fallback for addSearchHistory');
    return await this.memStorage.addSearchHistory(searchHistory);
  }
  
  async getUserSearchHistory(userId, limit) {
    console.log('Using in-memory fallback for getUserSearchHistory');
    return await this.memStorage.getUserSearchHistory(userId, limit);
  }
  
  // User study interactions - fallback to in-memory
  async saveStudy(userId, studyId) {
    console.log('Using in-memory fallback for saveStudy');
    return await this.memStorage.saveStudy(userId, studyId);
  }
  
  async unsaveStudy(userId, studyId) {
    console.log('Using in-memory fallback for unsaveStudy');
    return await this.memStorage.unsaveStudy(userId, studyId);
  }
  
  async recordStudyView(userId, studyId) {
    console.log('Using in-memory fallback for recordStudyView');
    return await this.memStorage.recordStudyView(userId, studyId);
  }
  
  async getSavedStudies(userId) {
    console.log('Using in-memory fallback for getSavedStudies');
    return await this.memStorage.getSavedStudies(userId);
  }
  
  async getRecentlyViewedStudies(userId, limit) {
    console.log('Using in-memory fallback for getRecentlyViewedStudies');
    return await this.memStorage.getRecentlyViewedStudies(userId, limit);
  }
  
  // User blog interactions - fallback to in-memory
  async saveBlog(userId, blogId) {
    console.log('Using in-memory fallback for saveBlog');
    return await this.memStorage.saveBlog(userId, blogId);
  }
  
  async unsaveBlog(userId, blogId) {
    console.log('Using in-memory fallback for unsaveBlog');
    return await this.memStorage.unsaveBlog(userId, blogId);
  }
  
  async recordBlogView(userId, blogId) {
    console.log('Using in-memory fallback for recordBlogView');
    return await this.memStorage.recordBlogView(userId, blogId);
  }
  
  async getSavedBlogs(userId) {
    console.log('Using in-memory fallback for getSavedBlogs');
    return await this.memStorage.getSavedBlogs(userId);
  }
  
  async getRecentlyViewedBlogs(userId, limit) {
    console.log('Using in-memory fallback for getRecentlyViewedBlogs');
    return await this.memStorage.getRecentlyViewedBlogs(userId, limit);
  }
  
  // Recommendation system - fallback to in-memory
  async getRecommendedStudies(userId, limit) {
    console.log('Using in-memory fallback for getRecommendedStudies');
    return await this.memStorage.getRecommendedStudies(userId, limit);
  }
  
  async getRecommendedBlogs(userId, limit) {
    console.log('Using in-memory fallback for getRecommendedBlogs');
    return await this.memStorage.getRecommendedBlogs(userId, limit);
  }
  
  // Notification system - fallback to in-memory
  async createNotification(notification) {
    console.log('Using in-memory fallback for createNotification');
    return await this.memStorage.createNotification(notification);
  }
  
  async getUserNotifications(userId, unreadOnly) {
    console.log('Using in-memory fallback for getUserNotifications');
    return await this.memStorage.getUserNotifications(userId, unreadOnly);
  }
  
  async markNotificationAsRead(id) {
    console.log('Using in-memory fallback for markNotificationAsRead');
    return await this.memStorage.markNotificationAsRead(id);
  }
  
  async markAllNotificationsAsRead(userId) {
    console.log('Using in-memory fallback for markAllNotificationsAsRead');
    return await this.memStorage.markAllNotificationsAsRead(userId);
  }
  
  // Sample data initialization
  async initializeSampleData() {
    console.log('Sample data initialization is handled directly in database migrations');
    return;
  }
}

// Create a singleton instance
export const dbStorage = new DatabaseStorage();