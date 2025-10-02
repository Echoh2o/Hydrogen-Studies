import type {
  Study,
  InsertStudy,
  Category,
  InsertCategory,
  Newsletter,
  InsertNewsletter,
  InsertContact,
  User,
  InsertUser,
  UserPreferences,
  InsertUserPreferences,
  SearchHistory,
  InsertSearchHistory,
  UserStudyInteraction,
  UserBlogInteraction,
  BlogArticle,
  Notification,
  InsertNotification,
  StudyReviewQueue,
  InsertStudyReviewQueue,
} from "@shared/schema";

// Interface for study filters
export interface StudyFilters {
  // Basic search filters
  query?: string;
  keyword?: string;
  author?: string;
  yearFrom?: string;
  yearTo?: string;
  category?: string;

  // Enhanced UI filters
  isPeerReviewed?: boolean | null;
  hasHealthImplications?: boolean | null;
  hasMedia?: boolean | null;
  dateFrom?: string;
  dateTo?: string;

  // Pagination and sorting
  page?: number | string;
  pageSize?: number | string;
  sortField?: string;
  sortOrder?: "asc" | "desc";
  sortBy?: string; // Legacy support

  // Advanced filters
  healthConditions?: string[];
  bodySystems?: string[];
  studyType?: string[];
  country?: string[];
  region?: string[];
  journal?: string[];
  hasFullText?: boolean;

  // New enhanced search filters
  tags?: string[];
  enrichmentStatus?: "basic" | "partial" | "complete";
  useFuzzyMatch?: boolean;
  searchInMethods?: boolean;
  searchInResults?: boolean;
  searchInConclusion?: boolean;
  searchInSimplified?: boolean;
  excludeTerms?: string[];

  // For compatibility with existing code
  peerReviewed?: boolean;
}

// Interface for paginated results
export interface PaginatedResults<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

// Storage interface definition
export interface IStorage {
  // Studies operations
  getStudies(filters?: StudyFilters): Promise<PaginatedResults<Study>>;
  getStudyById(id: number): Promise<Study | undefined>;
  getStudyByIdentifier(identifier: string): Promise<Study | undefined>;
  getLatestStudies(limit?: number): Promise<Study[]>;
  getStudiesByTitle(title: string): Promise<Study[]>;
  getStudiesByTitlePartial(titlePart: string, limit?: number): Promise<Study[]>;
  getStudiesBySourcePlatform(platform: string): Promise<Study[]>;
  createStudy(study: InsertStudy): Promise<Study>;
  updateStudy(id: number, study: Partial<InsertStudy>): Promise<Study>;
  deleteStudy(id: number): Promise<void>;

  // Categories operations
  getCategories(): Promise<Category[]>;
  getCategoryById(id: number): Promise<Category | undefined>;
  getCategoryByName(name: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;

  // Newsletter operations
  subscribeNewsletter(subscription: InsertNewsletter): Promise<Newsletter>;

  // Contact operations
  submitContactMessage(message: InsertContact): Promise<any>;

  // User account operations
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  authenticateUser(email: string, password: string): Promise<User | null>;

  // User preferences operations
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  createUserPreferences(
    preferences: InsertUserPreferences,
  ): Promise<UserPreferences>;
  updateUserPreferences(
    id: number,
    preferences: Partial<InsertUserPreferences>,
  ): Promise<UserPreferences>;

  // Search history operations
  addSearchHistory(searchHistory: InsertSearchHistory): Promise<SearchHistory>;
  getUserSearchHistory(
    userId: string,
    limit?: number,
  ): Promise<SearchHistory[]>;

  // User study interactions
  saveStudy(userId: string, studyId: number): Promise<UserStudyInteraction>;
  unsaveStudy(userId: string, studyId: number): Promise<void>;
  recordStudyView(userId: string, studyId: number): Promise<void>;
  getSavedStudies(userId: string): Promise<Study[]>;
  getRecentlyViewedStudies(userId: string, limit?: number): Promise<Study[]>;

  // User blog interactions
  saveBlog(userId: string, blogId: number): Promise<UserBlogInteraction>;
  unsaveBlog(userId: string, blogId: number): Promise<void>;
  recordBlogView(userId: string, blogId: number): Promise<void>;
  getSavedBlogs(userId: string): Promise<BlogArticle[]>;
  getRecentlyViewedBlogs(
    userId: string,
    limit?: number,
  ): Promise<BlogArticle[]>;

  // Recommendation system
  getRecommendedStudies(userId: string, limit?: number): Promise<Study[]>;
  getRecommendedBlogs(userId: string, limit?: number): Promise<BlogArticle[]>;

  // Notification system
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(
    userId: string,
    unreadOnly?: boolean,
  ): Promise<Notification[]>;
  markNotificationAsRead(id: number): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;

  // Study review queue
  saveStudyForReview(
    reviewItem: InsertStudyReviewQueue,
  ): Promise<StudyReviewQueue>;
  getStudyReviewQueue(filters?: {
    status?: string;
    userId?: string;
  }): Promise<StudyReviewQueue[]>;
  getStudyReviewQueueById(id: number): Promise<StudyReviewQueue | undefined>;
  updateStudyReviewStatus(
    id: number,
    status: string,
    reviewedByUserId: string,
    notes?: string,
  ): Promise<StudyReviewQueue>;
  deleteStudyFromReviewQueue(id: number): Promise<void>;
  checkStudyExists(doi: string): Promise<{ exists: boolean; studyId?: number }>;

  // Sample data initialization
  initializeSampleData(): Promise<void>;
}
