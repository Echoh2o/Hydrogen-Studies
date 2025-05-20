import {
  studies, type Study, type InsertStudy,
  categories, type Category, type InsertCategory,
  newsletters, type Newsletter, type InsertNewsletter,
  contactMessages, type InsertContact,
  studyReviewQueue, type StudyReviewQueue, type InsertStudyReviewQueue,
  users, type User, type InsertUser,
  userPreferences, type UserPreferences, type InsertUserPreferences,
  searchHistory, type SearchHistory, type InsertSearchHistory,
  userStudyInteractions, type UserStudyInteraction,
  userBlogInteractions, type UserBlogInteraction,
  notifications, type Notification, type InsertNotification,
  blogArticles, type BlogArticle,
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
  sortOrder?: 'asc' | 'desc';
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
  enrichmentStatus?: 'basic' | 'partial' | 'complete';
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
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;
  deleteUser(id: number): Promise<void>;
  authenticateUser(email: string, password: string): Promise<User | null>;
  
  // User preferences operations
  getUserPreferences(userId: number): Promise<UserPreferences | undefined>;
  createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences>;
  updateUserPreferences(id: number, preferences: Partial<InsertUserPreferences>): Promise<UserPreferences>;
  
  // Search history operations
  addSearchHistory(searchHistory: InsertSearchHistory): Promise<SearchHistory>;
  getUserSearchHistory(userId: number, limit?: number): Promise<SearchHistory[]>;
  
  // User study interactions
  saveStudy(userId: number, studyId: number): Promise<UserStudyInteraction>;
  unsaveStudy(userId: number, studyId: number): Promise<void>;
  recordStudyView(userId: number, studyId: number): Promise<void>;
  getSavedStudies(userId: number): Promise<Study[]>;
  getRecentlyViewedStudies(userId: number, limit?: number): Promise<Study[]>;
  
  // User blog interactions
  saveBlog(userId: number, blogId: number): Promise<UserBlogInteraction>;
  unsaveBlog(userId: number, blogId: number): Promise<void>;
  recordBlogView(userId: number, blogId: number): Promise<void>;
  getSavedBlogs(userId: number): Promise<BlogArticle[]>;
  getRecentlyViewedBlogs(userId: number, limit?: number): Promise<BlogArticle[]>;
  
  // Recommendation system
  getRecommendedStudies(userId: number, limit?: number): Promise<Study[]>;
  getRecommendedBlogs(userId: number, limit?: number): Promise<BlogArticle[]>;
  
  // Notification system
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: number, unreadOnly?: boolean): Promise<Notification[]>;
  markNotificationAsRead(id: number): Promise<void>;
  markAllNotificationsAsRead(userId: number): Promise<void>;
  
  // Study review queue
  saveStudyForReview(reviewItem: InsertStudyReviewQueue): Promise<StudyReviewQueue>;
  getStudyReviewQueue(filters?: {status?: string, userId?: string}): Promise<StudyReviewQueue[]>;
  getStudyReviewQueueById(id: number): Promise<StudyReviewQueue | undefined>;
  updateStudyReviewStatus(id: number, status: string, reviewedByUserId: string, notes?: string): Promise<StudyReviewQueue>;
  deleteStudyFromReviewQueue(id: number): Promise<void>;
  checkStudyExists(doi: string): Promise<{exists: boolean, studyId?: number}>;
  
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
    this.studyCurrentId = 1;
    this.categoryCurrentId = 1;
    this.newsletterCurrentId = 1;
    this.contactMessageCurrentId = 1;
    this.reviewQueueCurrentId = 1;
  }

  // Studies methods
  async getStudies(filters: StudyFilters = {}): Promise<PaginatedResults<Study>> {
    console.log("Search query parameters:", filters);
    
    try {
      // Get all studies from map and convert to array
      const allStudies = Array.from(this.studiesData.values());
      let filteredStudies = allStudies;
      
      // Apply text search if query is provided
      if (filters.query) {
        const query = filters.query.toLowerCase();
        filteredStudies = filteredStudies.filter(study => 
          study.title.toLowerCase().includes(query) || 
          study.abstract.toLowerCase().includes(query) ||
          (study.authors && study.authors.toLowerCase().includes(query))
        );
      }
      
      // Apply keyword filter
      if (filters.keyword) {
        const keyword = filters.keyword.toLowerCase();
        filteredStudies = filteredStudies.filter(study => 
          study.title.toLowerCase().includes(keyword) || 
          study.abstract.toLowerCase().includes(keyword) ||
          (study.keywords && study.keywords.some(k => k.toLowerCase().includes(keyword)))
        );
      }
      
      // Apply author filter
      if (filters.author) {
        const author = filters.author.toLowerCase();
        filteredStudies = filteredStudies.filter(study => 
          study.authors && study.authors.toLowerCase().includes(author)
        );
      }
      
      // Apply year range filters
      if (filters.yearFrom) {
        const yearFrom = parseInt(filters.yearFrom.toString());
        filteredStudies = filteredStudies.filter(study => 
          study.publishYear >= yearFrom
        );
      }
      
      if (filters.yearTo) {
        const yearTo = parseInt(filters.yearTo.toString());
        filteredStudies = filteredStudies.filter(study => 
          study.publishYear <= yearTo
        );
      }
      
      // Apply category filter
      if (filters.category) {
        filteredStudies = filteredStudies.filter(study => 
          study.category === filters.category
        );
      }
      
      // Apply peer review filter
      if (filters.isPeerReviewed === true || filters.peerReviewed === true) {
        filteredStudies = filteredStudies.filter(study => study.peerReviewed === true);
      } else if (filters.isPeerReviewed === false || filters.peerReviewed === false) {
        filteredStudies = filteredStudies.filter(study => study.peerReviewed === false);
      }
      
      // Apply health implications filter
      if (filters.hasHealthImplications === true) {
        filteredStudies = filteredStudies.filter(study => study.hasHealthImplications === true);
      } else if (filters.hasHealthImplications === false) {
        filteredStudies = filteredStudies.filter(study => study.hasHealthImplications === false);
      }
      
      // Apply has media filter
      if (filters.hasMedia === true) {
        filteredStudies = filteredStudies.filter(study => 
          study.imageUrl || study.videoUrl || study.audioUrl || 
          (study.images && study.images.length > 0)
        );
      } else if (filters.hasMedia === false) {
        filteredStudies = filteredStudies.filter(study => 
          !study.imageUrl && !study.videoUrl && !study.audioUrl && 
          (!study.images || study.images.length === 0)
        );
      }
      
      // Apply date range filters for publication date
      if (filters.dateFrom) {
        const dateFrom = new Date(filters.dateFrom);
        filteredStudies = filteredStudies.filter(study => 
          new Date(study.publishDate) >= dateFrom
        );
      }
      
      if (filters.dateTo) {
        const dateTo = new Date(filters.dateTo);
        filteredStudies = filteredStudies.filter(study => 
          new Date(study.publishDate) <= dateTo
        );
      }
      
      // Apply has full text filter
      if (filters.hasFullText === true) {
        filteredStudies = filteredStudies.filter(study => study.hasFullText === true);
      } else if (filters.hasFullText === false) {
        filteredStudies = filteredStudies.filter(study => study.hasFullText === false);
      }

      // Apply sorting
      const sortField = filters.sortField || filters.sortBy || 'publishDate';
      const sortOrder = filters.sortOrder || 'desc';
      
      if (sortField === 'title') {
        filteredStudies.sort((a, b) => {
          return sortOrder === 'asc' 
            ? a.title.localeCompare(b.title)
            : b.title.localeCompare(a.title);
        });
      } else if (sortField === 'authors') {
        filteredStudies.sort((a, b) => {
          return sortOrder === 'asc' 
            ? (a.authors || '').localeCompare(b.authors || '')
            : (b.authors || '').localeCompare(a.authors || '');
        });
      } else if (sortField === 'publishYear') {
        filteredStudies.sort((a, b) => {
          return sortOrder === 'asc' 
            ? a.publishYear - b.publishYear
            : b.publishYear - a.publishYear;
        });
      } else if (sortField === 'publishDate') {
        filteredStudies.sort((a, b) => {
          const dateA = new Date(a.publishDate);
          const dateB = new Date(b.publishDate);
          return sortOrder === 'asc' 
            ? dateA.getTime() - dateB.getTime()
            : dateB.getTime() - dateA.getTime();
        });
      } else if (sortField === 'viewCount') {
        filteredStudies.sort((a, b) => {
          return sortOrder === 'asc' 
            ? (a.viewCount || 0) - (b.viewCount || 0)
            : (b.viewCount || 0) - (a.viewCount || 0);
        });
      }
      
      // Process pagination
      const page = parseInt(filters.page?.toString() || '1');
      const pageSize = parseInt(filters.pageSize?.toString() || '10');
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const studiesForPage = filteredStudies.slice(startIndex, endIndex);
      
      return {
        data: studiesForPage,
        total: filteredStudies.length,
        page,
        pageSize,
        pageCount: Math.ceil(filteredStudies.length / pageSize)
      };
    } catch (error) {
      console.error("Error fetching studies:", error);
      return {
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
        pageCount: 0
      };
    }
  }

  async getStudyById(id: number): Promise<Study | undefined> {
    return this.studiesData.get(id);
  }
  
  async getStudyByIdentifier(identifier: string): Promise<Study | undefined> {
    // Look for study with matching DOI or PMID
    const normalizedIdentifier = identifier.trim().toLowerCase();
    for (const study of this.studiesData.values()) {
      if (
        (study.doi && study.doi.toLowerCase() === normalizedIdentifier) ||
        (study.pmid && study.pmid.toLowerCase() === normalizedIdentifier)
      ) {
        return study;
      }
    }
    return undefined;
  }

  async getStudiesByTitle(title: string): Promise<Study[]> {
    const studies: Study[] = [];
    for (const study of this.studiesData.values()) {
      if (study.title === title) {
        studies.push(study);
      }
    }
    return studies;
  }

  async getStudiesByTitlePartial(titlePart: string, limit: number = 20): Promise<Study[]> {
    const studies: Study[] = [];
    const lowerTitlePart = titlePart.toLowerCase();
    
    for (const study of this.studiesData.values()) {
      if (study.title.toLowerCase().includes(lowerTitlePart)) {
        studies.push(study);
        if (studies.length >= limit) break;
      }
    }
    
    return studies;
  }

  async getStudiesBySourcePlatform(platform: string): Promise<Study[]> {
    const studies: Study[] = [];
    for (const study of this.studiesData.values()) {
      if (study.sourcePlatform === platform) {
        studies.push(study);
      }
    }
    return studies;
  }

  async getLatestStudies(limit: number = 3): Promise<Study[]> {
    const studies = Array.from(this.studiesData.values())
      .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
      .slice(0, limit);
    
    return studies;
  }

  async createStudy(insertStudy: InsertStudy): Promise<Study> {
    const id = this.studyCurrentId++;
    const createdAt = new Date();
    const study: Study = { ...insertStudy, id, createdAt };
    this.studiesData.set(id, study);
    return study;
  }

  async updateStudy(id: number, partialStudy: Partial<InsertStudy>): Promise<Study> {
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
    const categories = Array.from(this.categoriesData.values());
    return categories;
  }

  async getCategoryById(id: number): Promise<Category | undefined> {
    return this.categoriesData.get(id);
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const id = this.categoryCurrentId++;
    const createdAt = new Date();
    const category: Category = { ...insertCategory, id, createdAt };
    this.categoriesData.set(id, category);
    return category;
  }

  async subscribeNewsletter(insertNewsletter: InsertNewsletter): Promise<Newsletter> {
    const id = this.newsletterCurrentId++;
    const createdAt = new Date();
    const newsletter: Newsletter = { ...insertNewsletter, id, createdAt };
    this.newslettersData.set(id, newsletter);
    return newsletter;
  }

  async submitContactMessage(insertContact: InsertContact): Promise<any> {
    const id = this.contactMessageCurrentId++;
    const createdAt = new Date();
    const message = { ...insertContact, id, createdAt };
    this.contactMessagesData.set(id, message);
    return message;
  }

  async checkStudyExists(doi: string): Promise<{ exists: boolean, studyId?: number }> {
    if (!doi) return { exists: false };
    
    const normalizedDoi = doi.trim().toLowerCase();
    
    // Check in studies
    for (const study of this.studiesData.values()) {
      if (study.doi && study.doi.toLowerCase() === normalizedDoi) {
        return { exists: true, studyId: study.id };
      }
    }
    
    // Check in review queue
    for (const item of this.reviewQueueData.values()) {
      if (item.doi && item.doi.toLowerCase() === normalizedDoi) {
        return { exists: true };
      }
    }
    
    return { exists: false };
  }

  async saveStudyForReview(reviewItem: InsertStudyReviewQueue): Promise<StudyReviewQueue> {
    const id = this.reviewQueueCurrentId++;
    const savedAt = new Date();
    const item: StudyReviewQueue = { ...reviewItem, id, savedAt };
    this.reviewQueueData.set(id, item);
    return item;
  }

  async getStudyReviewQueue(filters?: { status?: string, userId?: string }): Promise<StudyReviewQueue[]> {
    let queue = Array.from(this.reviewQueueData.values());
    
    if (filters?.status) {
      queue = queue.filter(item => item.status === filters.status);
    }
    
    if (filters?.userId) {
      queue = queue.filter(item => item.savedByUserId === filters.userId);
    }
    
    // Sort by savedAt date (newest first)
    queue.sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime());
    
    return queue;
  }

  async getStudyReviewQueueById(id: number): Promise<StudyReviewQueue | undefined> {
    return this.reviewQueueData.get(id);
  }

  async updateStudyReviewStatus(
    id: number, 
    status: string, 
    reviewedByUserId: string, 
    notes?: string
  ): Promise<StudyReviewQueue> {
    const item = this.reviewQueueData.get(id);
    if (!item) {
      throw new Error(`Review item with ID ${id} not found`);
    }
    
    const reviewedAt = new Date();
    const updatedItem: StudyReviewQueue = {
      ...item,
      status,
      reviewedByUserId,
      reviewNotes: notes,
      reviewedAt
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
    // Only initialize if no categories exist
    if (this.categoriesData.size === 0) {
      console.log("Initializing sample categories...");
      const categories = [
        { name: "General Health", description: "Studies on general health impacts", icon: "heart" },
        { name: "Antioxidant Effects", description: "Research on antioxidant properties", icon: "shield" },
        { name: "Metabolism", description: "Studies related to metabolic effects", icon: "activity" },
        { name: "Brain Health", description: "Neurological and cognitive research", icon: "brain" },
        { name: "Athletic Performance", description: "Studies on physical performance", icon: "running" },
        { name: "Inflammation", description: "Anti-inflammatory research", icon: "flame" },
        { name: "Longevity", description: "Research on aging and lifespan", icon: "clock" },
        { name: "Disease Treatment", description: "Therapeutic applications", icon: "pill" }
      ];
      
      for (const category of categories) {
        await this.createCategory({ 
          name: category.name, 
          description: category.description, 
          icon: category.icon,
          studyCount: 0
        });
      }
    }
  }

  private async initializeSampleStudies(): Promise<void> {
    // Only initialize if no studies exist
    if (this.studiesData.size === 0) {
      console.log("Initializing sample studies...");
      
      // Get category IDs
      const categories = await this.getCategories();
      const categoryMap = new Map<string, number>();
      for (const category of categories) {
        categoryMap.set(category.name, category.id);
      }
      
      const studies = [
        {
          title: "Hydrogen-rich water decreases serum LDL-cholesterol levels and improves HDL function in patients with potential metabolic syndrome",
          abstract: "Metabolic syndrome is characterized by cardiometabolic risk factors that include obesity, insulin resistance, hypertension and dyslipidemia. Dyslipidemia is characterized by elevated total cholesterol, low-density lipoprotein (LDL) cholesterol and reduced high-density lipoprotein (HDL) cholesterol levels. The aim of this study was to investigate the effects of hydrogen (H2) supplementation on HDL functionality and cholesterol efflux capacity. Participants (n = 42) with potential metabolic syndrome consumed 1.5 L/day of H2-generating water (HW) for 8 weeks. Cholesterol efflux capacity improved by 9.0% with a significant linear increase (R = 0.33; P < 0.001), during the study of 7.7% at week 4, and 9.0% at week 8. There was increased ABCA1-mediated cholesterol efflux (8.1% at week 8), increased cellular ATP-binding cassette A1 (ABCA1) mRNA expression by 2- to 7-fold (p < 0.05), and decreased plasma levels of large/medium VLDL particles and increased small HDL particles, both with statistical significance, whereas reduced 5% total LDL-cholesterol and increased 2% HDL-cholesterol were not significant. All participants had a reduction of plasma ethane (biomarker of oxidative stress) from 0.55 ± 0.06 to 0.40 ± 0.06 ppb (P < 0.05). These results suggest that H2 may protect against the development of dyslipidemia by enhancing HDL function in patients with potential metabolic syndrome. The ability of H2 administration to improve HDL function in patients at an elevated risk for cardiac events requires further investigation.",
          authors: "Jin Hee Kim, Minji Kim, Jiyoung Park, Hoyi Jin, Yoonho Jeong, Hyunnam Cho, Seyeon Oh, Min-Seon Park, Chang Hoon Ha, Joohyun Park, Ikuroh Ohsawa, Hyun-Sik Kang",
          journal: "Scientific Journal of Medicine",
          publishDate: "2023-02-15",
          publishYear: 2023,
          doi: "10.1038/s41598-023-05923-1",
          pmid: "PMC8833178",
          peerReviewed: true,
          category: "Metabolism",
          methods: "This study recruited 42 participants with potential metabolic syndrome who consumed 1.5 liters of hydrogen-rich water daily for a period of 8 weeks. Blood samples were collected at baseline, 4 weeks, and 8 weeks to measure changes in cholesterol levels, HDL functionality, and oxidative stress markers.",
          results: "After 8 weeks of hydrogen water consumption, participants showed a 9.0% improvement in cholesterol efflux capacity with a significant linear increase (R = 0.33; P < 0.001). There was an 8.1% increase in ABCA1-mediated cholesterol efflux and 2-7 fold increase in cellular ATP-binding cassette A1 (ABCA1) mRNA expression. Plasma ethane levels (a biomarker of oxidative stress) decreased from 0.55 ± 0.06 to 0.40 ± 0.06 ppb.",
          conclusion: "The results suggest that molecular hydrogen may help protect against dyslipidemia by enhancing HDL function in patients with potential metabolic syndrome. Further research is needed to investigate the ability of hydrogen administration to improve HDL function in patients at elevated risk for cardiac events."
        },
        {
          title: "Effects of Hydrogen-Rich Water on Oxidative Stress and Muscle Recovery After Eccentric Exercise",
          abstract: "The purpose of this study was to investigate the effects of hydrogen-rich water (HRW) consumption on muscle recovery and oxidative stress after eccentric exercise. Healthy male adults (n=36) performed eccentric exercise of the elbow flexors and were randomized to consume either HRW or placebo water for 7 days. Muscle soreness, range of motion, maximum voluntary contraction, and serum markers of muscle damage and oxidative stress were measured at baseline, immediately after exercise, and at 24, 48, and 72 hours after exercise. The HRW group showed significantly lower muscle soreness scores (p<0.01) and improved range of motion (p<0.05) at 48 and 72 hours compared to the placebo group. Serum markers of muscle damage (creatine kinase and myoglobin) were significantly lower in the HRW group (p<0.05). Additionally, markers of oxidative stress (malondialdehyde) were significantly lower in the HRW group (p<0.01), while antioxidant markers (superoxide dismutase and glutathione peroxidase) were significantly higher (p<0.05). These results suggest that consumption of hydrogen-rich water may be beneficial for attenuating muscle damage and oxidative stress induced by eccentric exercise.",
          authors: "Takeshi Aoki, Michael Johnson, Sarah Chen, David Park",
          journal: "Journal of Sports Science and Medicine",
          publishDate: "2022-08-10",
          publishYear: 2022,
          doi: "10.1007/s40279-022-01785-9",
          pmid: "PMC8975462",
          peerReviewed: true,
          category: "Athletic Performance",
          imageUrl: "https://example.com/hydrogen-performance-study.jpg",
          hasHealthImplications: true,
          methods: "This randomized controlled trial involved 36 healthy male adults who performed eccentric exercise of the elbow flexors. Participants were randomly assigned to consume either hydrogen-rich water or placebo water for 7 days. Measurements included muscle soreness scores, range of motion, maximum voluntary contraction, and serum markers of muscle damage and oxidative stress. These were assessed at baseline, immediately after exercise, and at 24, 48, and 72 hours post-exercise.",
          results: "The hydrogen-rich water group demonstrated significantly lower muscle soreness scores (p<0.01) and improved range of motion (p<0.05) at both 48 and 72 hours post-exercise compared to the placebo group. Serum markers of muscle damage (creatine kinase and myoglobin) were significantly lower in the hydrogen-rich water group (p<0.05). Markers of oxidative stress (malondialdehyde) were significantly reduced in the hydrogen-rich water group (p<0.01), while antioxidant markers (superoxide dismutase and glutathione peroxidase) were significantly elevated (p<0.05).",
          conclusion: "Consumption of hydrogen-rich water appears to be beneficial for reducing muscle damage and oxidative stress induced by eccentric exercise. These findings suggest hydrogen may be an effective nutritional strategy to enhance recovery in athletes and active individuals."
        }
      ];
      
      for (const studyData of studies) {
        const categoryName = studyData.category;
        const categoryId = categoryMap.get(categoryName);
        
        if (!categoryId) {
          console.warn(`Category '${categoryName}' not found, using 'General Health'`);
          studyData.category = 'General Health';
        }
        
        await this.createStudy({
          ...studyData,
          viewCount: Math.floor(Math.random() * 100),
          hasFullText: Boolean(studyData.methods && studyData.results && studyData.conclusion),
          keywords: ["hydrogen", "molecular hydrogen", "oxidative stress"],
          sourcePlatform: "manual",
          journalPublishDate: null
        });
      }
    }
  }

  // The following methods are stubs to satisfy the interface
  // They will be implemented when needed
  async getUserById(id: number): Promise<User | undefined> {
    throw new Error("Method not implemented.");
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    throw new Error("Method not implemented.");
  }
  
  async createUser(user: InsertUser): Promise<User> {
    throw new Error("Method not implemented.");
  }
  
  async updateUser(id: number, user: Partial<InsertUser>): Promise<User> {
    throw new Error("Method not implemented.");
  }
  
  async deleteUser(id: number): Promise<void> {
    throw new Error("Method not implemented.");
  }
  
  async authenticateUser(email: string, password: string): Promise<User | null> {
    throw new Error("Method not implemented.");
  }
  
  async getUserPreferences(userId: number): Promise<UserPreferences | undefined> {
    throw new Error("Method not implemented.");
  }
  
  async createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences> {
    throw new Error("Method not implemented.");
  }
  
  async updateUserPreferences(id: number, preferences: Partial<InsertUserPreferences>): Promise<UserPreferences> {
    throw new Error("Method not implemented.");
  }
  
  async addSearchHistory(searchHistory: InsertSearchHistory): Promise<SearchHistory> {
    throw new Error("Method not implemented.");
  }
  
  async getUserSearchHistory(userId: number, limit?: number): Promise<SearchHistory[]> {
    throw new Error("Method not implemented.");
  }
  
  async saveStudy(userId: number, studyId: number): Promise<UserStudyInteraction> {
    throw new Error("Method not implemented.");
  }
  
  async unsaveStudy(userId: number, studyId: number): Promise<void> {
    throw new Error("Method not implemented.");
  }
  
  async recordStudyView(userId: number, studyId: number): Promise<void> {
    throw new Error("Method not implemented.");
  }
  
  async getSavedStudies(userId: number): Promise<Study[]> {
    throw new Error("Method not implemented.");
  }
  
  async getRecentlyViewedStudies(userId: number, limit?: number): Promise<Study[]> {
    throw new Error("Method not implemented.");
  }
  
  async saveBlog(userId: number, blogId: number): Promise<UserBlogInteraction> {
    throw new Error("Method not implemented.");
  }
  
  async unsaveBlog(userId: number, blogId: number): Promise<void> {
    throw new Error("Method not implemented.");
  }
  
  async recordBlogView(userId: number, blogId: number): Promise<void> {
    throw new Error("Method not implemented.");
  }
  
  async getSavedBlogs(userId: number): Promise<BlogArticle[]> {
    throw new Error("Method not implemented.");
  }
  
  async getRecentlyViewedBlogs(userId: number, limit?: number): Promise<BlogArticle[]> {
    throw new Error("Method not implemented.");
  }
  
  async getRecommendedStudies(userId: number, limit?: number): Promise<Study[]> {
    throw new Error("Method not implemented.");
  }
  
  async getRecommendedBlogs(userId: number, limit?: number): Promise<BlogArticle[]> {
    throw new Error("Method not implemented.");
  }
  
  async createNotification(notification: InsertNotification): Promise<Notification> {
    throw new Error("Method not implemented.");
  }
  
  async getUserNotifications(userId: number, unreadOnly?: boolean): Promise<Notification[]> {
    throw new Error("Method not implemented.");
  }
  
  async markNotificationAsRead(id: number): Promise<void> {
    throw new Error("Method not implemented.");
  }
  
  async markAllNotificationsAsRead(userId: number): Promise<void> {
    throw new Error("Method not implemented.");
  }

  // Helper methods
  private calculateLevenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
  
    const matrix = [];
  
    // Initialize the top row of the matrix
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
  
    // Initialize the first column of the matrix
    for (let i = 0; i <= a.length; i++) {
      matrix[0][i] = i;
    }
  
    // Calculate distances
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
  
    return matrix[b.length][a.length];
  }
}

// Create a storage manager to handle the transition
import { createStorageManager } from './storage-manager';
import { dbStorage } from './database-storage';

// Create a new storage manager with both storage implementations
// By default use in-memory storage for reliability until database is fully tested
const storageManager = createStorageManager(new MemStorage(), dbStorage, false);

// Check if we should use database by environment variable
if (process.env.USE_DATABASE === 'true') {
  // Switch to database storage
  storageManager.useDatabase();
} else {
  console.log('Using in-memory storage. Set USE_DATABASE=true environment variable to use database storage.');
}

// Export the storage from the manager
export const storage = storageManager.getStorage();