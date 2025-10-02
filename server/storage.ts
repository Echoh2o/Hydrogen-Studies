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

export interface PaginatedResults<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

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
  getUserById(id: string): Promise<any | undefined>;
  getUserByEmail(email: string): Promise<any | undefined>;
  createUser(user: any): Promise<any>;
  updateUser(id: string, user: any): Promise<any>;
  deleteUser(id: string): Promise<void>;
  authenticateUser(email: string, password: string): Promise<any | null>;

  // User preferences operations
  getUserPreferences(userId: string): Promise<any | undefined>;
  createUserPreferences(preferences: any): Promise<any>;
  updateUserPreferences(id: number, preferences: any): Promise<any>;

  // Search history operations
  addSearchHistory(searchHistory: any): Promise<any>;
  getUserSearchHistory(userId: string, limit?: number): Promise<any[]>;

  // User study interactions
  saveStudy(userId: string, studyId: number): Promise<any>;
  unsaveStudy(userId: string, studyId: number): Promise<void>;
  recordStudyView(userId: string, studyId: number): Promise<void>;
  getSavedStudies(userId: string): Promise<Study[]>;
  getRecentlyViewedStudies(userId: string, limit?: number): Promise<Study[]>;

  // User blog interactions
  saveBlog(userId: string, blogId: number): Promise<any>;
  unsaveBlog(userId: string, blogId: number): Promise<void>;
  recordBlogView(userId: string, blogId: number): Promise<void>;
  getSavedBlogs(userId: string): Promise<any[]>;
  getRecentlyViewedBlogs(userId: string, limit?: number): Promise<any[]>;

  // Recommendation system
  getRecommendedStudies(userId: string, limit?: number): Promise<Study[]>;
  getRecommendedBlogs(userId: string, limit?: number): Promise<any[]>;

  // Notification system
  createNotification(notification: any): Promise<any>;
  getUserNotifications(userId: string, unreadOnly?: boolean): Promise<any[]>;
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

export class MemStorage implements IStorage {
  private studiesData: Map<number, Study>;
  private categoriesData: Map<number, Category>;
  private newslettersData: Map<number, Newsletter>;
  private contactMessagesData: Map<number, any>;
  private reviewQueueData: Map<number, StudyReviewQueue>;
  private studyCurrentId: number;
  private categoryCurrentId: number;
  private newsletterCurrentId: number;
  private contactMessageCurrentId: number;
  private reviewQueueCurrentId: number;

  constructor() {
    this.studiesData = new Map();
    this.categoriesData = new Map();
    this.newslettersData = new Map();
    this.contactMessagesData = new Map();
    this.reviewQueueData = new Map();
    this.studyCurrentId = 0;
    this.categoryCurrentId = 0;
    this.newsletterCurrentId = 0;
    this.contactMessageCurrentId = 0;
    this.reviewQueueCurrentId = 0;

    // Initialize with sample data if needed
    this.initializeSampleData();
  }

  async getStudies(
    filters: StudyFilters = {},
  ): Promise<PaginatedResults<Study>> {
    let filteredStudies = Array.from(this.studiesData.values());

    // Apply comprehensive text search across all relevant fields
    if (filters.query) {
      const lowerQuery = filters.query.toLowerCase();
      filteredStudies = filteredStudies.filter((study) => {
        // Always search in these primary fields
        const inTitle =
          study.title?.toLowerCase().includes(lowerQuery) || false;
        const inAbstract =
          study.abstract?.toLowerCase().includes(lowerQuery) || false;
        const inAuthors =
          study.authors?.toLowerCase().includes(lowerQuery) || false;

        // Search in additional fields if they exist
        const inMethods =
          study.methods?.toLowerCase().includes(lowerQuery) || false;
        const inResults =
          study.results?.toLowerCase().includes(lowerQuery) || false;
        const inConclusion =
          study.conclusion?.toLowerCase().includes(lowerQuery) || false;
        const inJournal =
          study.journal?.toLowerCase().includes(lowerQuery) || false;
        const inSimplifiedExplanation =
          study.simplifiedExplanation?.toLowerCase().includes(lowerQuery) ||
          false;

        // Also search in keywords, tags, and other metadata
        const inKeywords = Array.isArray(study.keywords)
          ? study.keywords.some((k) => k.toLowerCase().includes(lowerQuery))
          : false;

        const inTags = Array.isArray(study.tags)
          ? study.tags.some((t) => t.toLowerCase().includes(lowerQuery))
          : false;

        // Return true if the query is found in any field
        return (
          inTitle ||
          inAbstract ||
          inAuthors ||
          inMethods ||
          inResults ||
          inConclusion ||
          inJournal ||
          inSimplifiedExplanation ||
          inKeywords ||
          inTags
        );
      });
    }

    // Apply keyword filter
    if (filters.keyword) {
      const lowerKeyword = filters.keyword.toLowerCase();
      filteredStudies = filteredStudies.filter(
        (study) =>
          study.title.toLowerCase().includes(lowerKeyword) ||
          study.abstract.toLowerCase().includes(lowerKeyword),
      );
    }

    // Apply author filter
    if (filters.author) {
      const lowerAuthor = filters.author.toLowerCase();
      filteredStudies = filteredStudies.filter((study) =>
        study.authors.toLowerCase().includes(lowerAuthor),
      );
    }

    // Apply year filters
    if (filters.yearFrom) {
      const yearFrom = parseInt(filters.yearFrom);
      filteredStudies = filteredStudies.filter(
        (study) => study.publishYear && study.publishYear >= yearFrom,
      );
    }

    if (filters.yearTo) {
      const yearTo = parseInt(filters.yearTo);
      filteredStudies = filteredStudies.filter(
        (study) => study.publishYear && study.publishYear <= yearTo,
      );
    }

    // Apply category filter
    if (filters.category) {
      filteredStudies = filteredStudies.filter(
        (study) => study.category === filters.category,
      );
    }

    // Apply peer review filter
    if (filters.isPeerReviewed === true || filters.peerReviewed === true) {
      filteredStudies = filteredStudies.filter(
        (study) => study.peerReviewed === true,
      );
    } else if (
      filters.isPeerReviewed === false ||
      filters.peerReviewed === false
    ) {
      filteredStudies = filteredStudies.filter(
        (study) => study.peerReviewed === false,
      );
    }

    // Apply health implications filter
    if (filters.hasHealthImplications === true) {
      filteredStudies = filteredStudies.filter(
        (study) => study.hasHealthImplications === true,
      );
    } else if (filters.hasHealthImplications === false) {
      filteredStudies = filteredStudies.filter(
        (study) => study.hasHealthImplications === false,
      );
    }

    // Apply media filter
    if (filters.hasMedia === true) {
      filteredStudies = filteredStudies.filter(
        (study) =>
          study.imageUrl !== null ||
          study.videoUrl !== null ||
          study.audioUrl !== null,
      );
    } else if (filters.hasMedia === false) {
      filteredStudies = filteredStudies.filter(
        (study) =>
          study.imageUrl === null &&
          study.videoUrl === null &&
          study.audioUrl === null,
      );
    }

    // Apply date filters
    if (filters.dateFrom) {
      const dateFrom = new Date(filters.dateFrom).getTime();
      filteredStudies = filteredStudies.filter(
        (study) => new Date(study.publishDate).getTime() >= dateFrom,
      );
    }

    if (filters.dateTo) {
      const dateTo = new Date(filters.dateTo).getTime();
      filteredStudies = filteredStudies.filter(
        (study) => new Date(study.publishDate).getTime() <= dateTo,
      );
    }

    // Sort the results
    const sortField = filters.sortField || filters.sortBy || "publishDate";
    const sortOrder = filters.sortOrder || "desc";

    filteredStudies.sort((a, b) => {
      if (sortField === "publishYear") {
        if (a.publishYear === b.publishYear) return 0;
        if (sortOrder === "asc") {
          return a.publishYear < b.publishYear ? -1 : 1;
        } else {
          return b.publishYear < a.publishYear ? -1 : 1;
        }
      }

      if (sortField === "publishDate") {
        const aDate = new Date(a.publishDate).getTime();
        const bDate = new Date(b.publishDate).getTime();
        return sortOrder === "asc" ? aDate - bDate : bDate - aDate;
      }

      if (sortField === "title") {
        return sortOrder === "asc"
          ? a.title.localeCompare(b.title)
          : b.title.localeCompare(a.title);
      }

      if (sortField === "authors") {
        return sortOrder === "asc"
          ? a.authors.localeCompare(b.authors)
          : b.authors.localeCompare(a.authors);
      }

      // Default to publishDate sort
      const aDate = new Date(a.publishDate).getTime();
      const bDate = new Date(b.publishDate).getTime();
      return sortOrder === "asc" ? aDate - bDate : bDate - aDate;
    });

    // Apply pagination
    const page = parseInt(filters.page?.toString() || "1");
    const pageSize = parseInt(filters.pageSize?.toString() || "10");
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedStudies = filteredStudies.slice(startIndex, endIndex);

    return {
      data: paginatedStudies,
      total: filteredStudies.length,
      page,
      pageSize,
      pageCount: Math.ceil(filteredStudies.length / pageSize),
    };
  }

  async getStudyById(id: number): Promise<Study | undefined> {
    return this.studiesData.get(id);
  }

  async getStudyByIdentifier(identifier: string): Promise<Study | undefined> {
    for (const study of this.studiesData.values()) {
      if (study.doi && study.doi.toLowerCase() === identifier.toLowerCase()) {
        return study;
      }
    }
    return undefined;
  }

  async getStudyDoi(id: number): Promise<any> {
    const study = await this.getStudyById(id);
    return { doi: study?.doi || null };
  }

  async getStudiesByTitle(title: string): Promise<Study[]> {
    const result: Study[] = [];
    for (const study of this.studiesData.values()) {
      if (study.title === title) {
        result.push(study);
      }
    }
    return result;
  }

  async getStudiesByTitlePartial(
    titlePart: string,
    limit: number = 20,
  ): Promise<Study[]> {
    const lowerTitlePart = titlePart.toLowerCase();
    const result: Study[] = [];

    for (const study of this.studiesData.values()) {
      if (study.title.toLowerCase().includes(lowerTitlePart)) {
        result.push(study);
        if (result.length >= limit) {
          break;
        }
      }
    }

    return result;
  }

  async getStudiesBySourcePlatform(platform: string): Promise<Study[]> {
    const result: Study[] = [];
    for (const study of this.studiesData.values()) {
      if (study.sourcePlatform === platform) {
        result.push(study);
      }
    }
    return result;
  }

  async getLatestStudies(limit: number = 20): Promise<Study[]> {
    const studies = Array.from(this.studiesData.values());

    studies.sort((a, b) => {
      const aDate = new Date(a.publishDate).getTime();
      const bDate = new Date(b.publishDate).getTime();
      return bDate - aDate;
    });

    return studies.slice(0, limit);
  }

  async createStudy(insertStudy: InsertStudy): Promise<Study> {
    const id = ++this.studyCurrentId;
    const createdAt = new Date();

    const study: Study = { ...insertStudy, id, createdAt };
    this.studiesData.set(id, study);

    return study;
  }

  async updateStudy(
    id: number,
    partialStudy: Partial<InsertStudy>,
  ): Promise<Study> {
    const existingStudy = this.studiesData.get(id);
    if (!existingStudy) {
      throw new Error(`Study with ID ${id} not found`);
    }

    const updatedStudy: Study = {
      ...existingStudy,
      ...partialStudy,
    };

    this.studiesData.set(id, updatedStudy);

    return updatedStudy;
  }

  async deleteStudy(id: number): Promise<void> {
    this.studiesData.delete(id);
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    for (const category of this.categoriesData.values()) {
      if (category.name === name) {
        return category;
      }
    }
    return undefined;
  }

  async getCategories(): Promise<Category[]> {
    return Array.from(this.categoriesData.values());
  }

  async getCategoryById(id: number): Promise<Category | undefined> {
    return this.categoriesData.get(id);
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const id = ++this.categoryCurrentId;
    const createdAt = new Date();

    const category: Category = {
      ...insertCategory,
      id,
      createdAt,
      icon: insertCategory.icon || null,
      studyCount: 0,
    };
    this.categoriesData.set(id, category);

    return category;
  }

  async subscribeNewsletter(
    insertNewsletter: InsertNewsletter,
  ): Promise<Newsletter> {
    const id = ++this.newsletterCurrentId;
    const createdAt = new Date();

    const newsletter: Newsletter = { ...insertNewsletter, id, createdAt };
    this.newslettersData.set(id, newsletter);

    return newsletter;
  }

  async submitContactMessage(insertContact: InsertContact): Promise<any> {
    const id = ++this.contactMessageCurrentId;
    const createdAt = new Date();

    const message = { ...insertContact, id, createdAt };
    this.contactMessagesData.set(id, message);

    return message;
  }

  async checkStudyExists(
    doi: string,
  ): Promise<{ exists: boolean; studyId?: number }> {
    if (!doi) {
      return { exists: false };
    }

    const lowerDoi = doi.toLowerCase();

    // Check in studies data
    for (const study of this.studiesData.values()) {
      if (study.doi && study.doi.toLowerCase() === lowerDoi) {
        return { exists: true, studyId: study.id };
      }
    }

    // Check in review queue
    for (const item of this.reviewQueueData.values()) {
      if (item.doi && item.doi.toLowerCase() === lowerDoi) {
        return { exists: true };
      }
    }

    return { exists: false };
  }

  async saveStudyForReview(
    reviewItem: InsertStudyReviewQueue,
  ): Promise<StudyReviewQueue> {
    const id = ++this.reviewQueueCurrentId;
    const savedAt = new Date();

    const item: StudyReviewQueue = {
      ...reviewItem,
      id,
      savedAt,
      status: "pending",
      reviewedByUserId: null,
      reviewNotes: null,
      reviewedAt: null,
      createdAt: new Date(),
    };
    this.reviewQueueData.set(id, item);

    return item;
  }

  async getStudyReviewQueue(filters?: {
    status?: string;
    userId?: string;
  }): Promise<StudyReviewQueue[]> {
    let result = Array.from(this.reviewQueueData.values());

    if (filters) {
      if (filters.status) {
        result = result.filter((item) => item.status === filters.status);
      }

      if (filters.userId) {
        result = result.filter((item) => item.savedByUserId === filters.userId);
      }
    }

    // Sort by saved date (newest first)
    result.sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime());

    return result;
  }

  async getStudyReviewQueueById(
    id: number,
  ): Promise<StudyReviewQueue | undefined> {
    return this.reviewQueueData.get(id);
  }

  async updateStudyReviewStatus(
    id: number,
    status: string,
    reviewedByUserId: string,
    notes?: string,
  ): Promise<StudyReviewQueue> {
    const queueItem = this.reviewQueueData.get(id);
    if (!queueItem) {
      throw new Error(`Review queue item with ID ${id} not found`);
    }

    const updatedItem: StudyReviewQueue = {
      ...queueItem,
      status,
      reviewedByUserId,
      reviewNotes: notes || null,
      reviewedAt: new Date(),
    };

    this.reviewQueueData.set(id, updatedItem);

    return updatedItem;
  }

  async deleteStudyFromReviewQueue(id: number): Promise<void> {
    this.reviewQueueData.delete(id);
  }

  async initializeSampleData(): Promise<void> {
    await this.initializeSampleCategories();
    await this.initializeSampleStudies();
  }

  private async initializeSampleCategories(): Promise<void> {
    // Only initialize if empty
    if (this.categoriesData.size === 0) {
      await this.createCategory({
        name: "General",
        description: "General hydrogen health studies",
        icon: null,
      });

      await this.createCategory({
        name: "Neurological",
        description: "Studies related to brain and neurological effects",
        icon: null,
      });

      await this.createCategory({
        name: "Cardiovascular",
        description: "Heart and circulation related studies",
        icon: null,
      });

      await this.createCategory({
        name: "Metabolic",
        description: "Studies on metabolic disorders and functions",
        icon: null,
      });

      await this.createCategory({
        name: "Sports Performance",
        description: "Athletic performance and recovery studies",
        icon: null,
      });
    }
  }

  private async initializeSampleStudies(): Promise<void> {
    // Only initialize if empty
    if (this.studiesData.size === 0) {
      await this.createStudy({
        title: "Molecular hydrogen attenuates neuropathic pain in mice",
        abstract:
          "This study investigated the effects of molecular hydrogen on neuropathic pain in a mouse model.",
        authors: "Kawaguchi M, Satoh Y, Otsubo Y, Kazama T",
        journal: "Journal of Pain Research",
        publishDate: "2022-04-15",
        journalPublishDate: null,
        category: "Neurological",
        doi: "10.2147/JPR.S123528",
        methods:
          "Mouse model with sciatic nerve injury treated with hydrogen-rich water for 8 weeks",
        results:
          "Reduction in pain behavior and inflammatory markers in hydrogen group",
        conclusion:
          "Molecular hydrogen shows promise for treating neuropathic pain",
        url: "https://example.com/study1",
        peerReviewed: true,
        publication: null,
        publishYear: 2022,
        healthCondition: "Neuropathic pain",
        intervention: "Hydrogen-rich water",
        population: "Mouse model",
        viewCount: 124,
        sourceUrl: "https://example.com/source1",
        sourcePlatform: "PubMed",
        imageUrl: null,
        videoUrl: null,
        audioUrl: null,
        externalId: "S123528",
        simplifiedExplanation:
          "This research suggests that hydrogen water reduced pain in mice with nerve damage.",
        tags: [
          "neuropathic pain",
          "mouse model",
          "inflammation",
          "hydrogen water",
        ],
      });

      await this.createStudy({
        title:
          "Hydrogen gas improves survival rate and organ damage in a rat model of cardiac arrest",
        abstract:
          "This study evaluated the effects of hydrogen gas inhalation on survival and organ damage after cardiac arrest.",
        authors: "Johnson K, Smith AB, Chen ZJ, Williams R",
        journal: "Critical Care Medicine",
        publishDate: "2023-01-10",
        journalPublishDate: null,
        category: "Cardiovascular",
        doi: "10.1097/CCM.0000000123456",
        methods:
          "Rat model of cardiac arrest with hydrogen gas inhalation treatment",
        results:
          "Improved survival rates and reduced organ damage in hydrogen group",
        conclusion:
          "Hydrogen gas shows protective effects after cardiac arrest",
        url: "https://example.com/study2",
        peerReviewed: true,
        publication: null,
        publishYear: 2023,
        healthCondition: "Cardiac arrest",
        intervention: "Hydrogen gas inhalation",
        population: "Rat model",
        viewCount: 87,
        sourceUrl: "https://example.com/source2",
        sourcePlatform: "ScienceDirect",
        imageUrl: "https://example.com/image2.jpg",
        videoUrl: null,
        audioUrl: null,
        externalId: "CCM123456",
        simplifiedExplanation:
          "This study found that rats who inhaled hydrogen gas after cardiac arrest had better survival rates and less organ damage.",
        tags: [
          "cardiac arrest",
          "hydrogen inhalation",
          "organ protection",
          "survival rate",
        ],
      });

      await this.createStudy({
        title:
          "Effects of hydrogen-rich water on exercise performance and recovery",
        abstract:
          "This randomized controlled trial investigated the effects of hydrogen-rich water consumption on exercise performance and recovery in athletes.",
        authors: "Miller P, Garcia T, Thompson E",
        journal: "Journal of Sports Science and Medicine",
        publishDate: "2022-09-22",
        journalPublishDate: null,
        category: "Sports Performance",
        doi: "10.10.5550/jssm.2022.456",
        methods:
          "Double-blind RCT with 30 athletes consuming either hydrogen-rich or placebo water for 2 weeks",
        results:
          "Improved recovery markers and reduced muscle soreness in hydrogen group",
        conclusion:
          "Hydrogen-rich water may enhance recovery after intensive exercise",
        url: "https://example.com/study3",
        peerReviewed: true,
        publication: null,
        publishYear: 2022,
        healthCondition: "Exercise-induced muscle damage",
        intervention: "Hydrogen-rich water",
        population: "Athletes",
        viewCount: 235,
        sourceUrl: "https://example.com/source3",
        sourcePlatform: "SportsMed",
        imageUrl: "https://example.com/image3.jpg",
        videoUrl: "https://example.com/video3.mp4",
        audioUrl: null,
        externalId: "JSSM456",
        simplifiedExplanation:
          "Athletes who drank hydrogen-rich water for two weeks showed better recovery and less muscle soreness after intense workouts compared to those drinking regular water.",
        tags: [
          "exercise",
          "recovery",
          "athletes",
          "hydrogen water",
          "muscle soreness",
        ],
      });
    }
  }

  // User account operations - minimal implementation
  async getUserById(id: string): Promise<any | undefined> {
    return undefined;
  }

  async getUserByEmail(email: string): Promise<any | undefined> {
    return undefined;
  }

  async createUser(user: any): Promise<any> {
    return user;
  }

  async updateUser(id: string, user: any): Promise<any> {
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    // Nothing to do
  }

  async authenticateUser(email: string, password: string): Promise<any | null> {
    return null;
  }

  // User preferences operations - minimal implementation
  async getUserPreferences(userId: string): Promise<any | undefined> {
    return undefined;
  }

  async createUserPreferences(preferences: any): Promise<any> {
    return preferences;
  }

  async updateUserPreferences(id: number, preferences: any): Promise<any> {
    return preferences;
  }

  // Search history operations - minimal implementation
  async addSearchHistory(searchHistory: any): Promise<any> {
    return searchHistory;
  }

  async getUserSearchHistory(userId: string, limit?: number): Promise<any[]> {
    return [];
  }

  // User study interactions - minimal implementation
  async saveStudy(userId: string, studyId: number): Promise<any> {
    return { userId, studyId };
  }

  async unsaveStudy(userId: string, studyId: number): Promise<void> {
    // Nothing to do
  }

  async recordStudyView(userId: string, studyId: number): Promise<void> {
    // Nothing to do
  }

  async getSavedStudies(userId: string): Promise<Study[]> {
    return [];
  }

  async getRecentlyViewedStudies(
    userId: string,
    limit?: number,
  ): Promise<Study[]> {
    return [];
  }

  // User blog interactions - minimal implementation
  async saveBlog(userId: string, blogId: number): Promise<any> {
    return { userId, blogId };
  }

  async unsaveBlog(userId: string, blogId: number): Promise<void> {
    // Nothing to do
  }

  async recordBlogView(userId: string, blogId: number): Promise<void> {
    // Nothing to do
  }

  async getSavedBlogs(userId: string): Promise<any[]> {
    return [];
  }

  async getRecentlyViewedBlogs(userId: string, limit?: number): Promise<any[]> {
    return [];
  }

  // Recommendation system - minimal implementation
  async getRecommendedStudies(
    userId: string,
    limit?: number,
  ): Promise<Study[]> {
    return [];
  }

  async getRecommendedBlogs(userId: string, limit?: number): Promise<any[]> {
    return [];
  }

  // Notification system - minimal implementation
  async createNotification(notification: any): Promise<any> {
    return notification;
  }

  async getUserNotifications(
    userId: string,
    unreadOnly?: boolean,
  ): Promise<any[]> {
    return [];
  }

  async markNotificationAsRead(id: number): Promise<void> {
    // Nothing to do
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    // Nothing to do
  }
}

export const storage = new MemStorage();
