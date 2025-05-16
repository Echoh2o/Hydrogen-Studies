import { 
  studies, 
  categories, 
  newsletters, 
  contactMessages,
  users,
  userPreferences,
  notifications,
  searchHistory,
  userStudyInteractions,
  userBlogInteractions,
  blogArticles,
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
  type BlogArticle
} from "@shared/schema";

export interface StudyFilters {
  query?: string;
  keyword?: string;
  author?: string;
  yearFrom?: string;
  yearTo?: string;
  category?: string;
  peerReviewed?: boolean;
  sortBy?: string;
  
  // Advanced filters
  healthConditions?: string[];
  bodySystems?: string[];
  studyType?: string[];
  country?: string[];
  region?: string[];
  journal?: string[];
  hasFullText?: boolean;
  hasMedia?: boolean;
}

export interface IStorage {
  // Studies operations
  getStudies(filters: StudyFilters): Promise<Study[]>;
  getStudyById(id: number): Promise<Study | undefined>;
  getStudyByIdentifier(identifier: string): Promise<Study | undefined>;
  getLatestStudies(limit?: number): Promise<Study[]>;
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
  
  // Sample data initialization
  initializeSampleData(): Promise<void>;
}

export class MemStorage implements IStorage {
  private studiesData: Map<number, Study>;
  private categoriesData: Map<number, Category>;
  private newslettersData: Map<number, Newsletter>;
  private contactMessagesData: Map<number, any>;
  private studyCurrentId: number;
  private categoryCurrentId: number;
  private newsletterCurrentId: number;
  private contactMessageCurrentId: number;

  constructor() {
    this.studiesData = new Map();
    this.categoriesData = new Map();
    this.newslettersData = new Map();
    this.contactMessagesData = new Map();
    this.studyCurrentId = 1;
    this.categoryCurrentId = 1;
    this.newsletterCurrentId = 1;
    this.contactMessageCurrentId = 1;
  }

  // Studies methods
  async getStudies(filters: StudyFilters = {}): Promise<Study[]> {
    let results = Array.from(this.studiesData.values());

    // Apply filters with enhanced search
    if (filters.query) {
      const query = filters.query.toLowerCase();
      
      // Split the query into words for more flexible matching
      const queryWords = query.split(/\s+/).filter(word => word.length > 2);
      
      results = results.filter(study => {
        // Check for exact matches first (highest priority)
        if (study.title.toLowerCase().includes(query) || 
            study.abstract.toLowerCase().includes(query) ||
            study.authors.toLowerCase().includes(query) ||
            study.journal.toLowerCase().includes(query) ||
            study.category.toLowerCase().includes(query)) {
          return true;
        }
        
        // If there are query words, check if multiple words match across different fields
        if (queryWords.length > 0) {
          const titleLower = study.title.toLowerCase();
          const abstractLower = study.abstract.toLowerCase();
          const authorsLower = study.authors.toLowerCase();
          const journalLower = study.journal.toLowerCase();
          const methodsLower = (study.methods || '').toLowerCase();
          const resultsLower = (study.results || '').toLowerCase();
          const conclusionLower = (study.conclusion || '').toLowerCase();
          
          // Count how many query words appear in the study
          const matchCount = queryWords.filter(word => 
            titleLower.includes(word) || 
            abstractLower.includes(word) || 
            authorsLower.includes(word) || 
            journalLower.includes(word) ||
            methodsLower.includes(word) ||
            resultsLower.includes(word) ||
            conclusionLower.includes(word)
          ).length;
          
          // Return true if at least 50% of query words are found
          return matchCount >= Math.ceil(queryWords.length * 0.5);
        }
        
        return false;
      });
    }

    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase();
      results = results.filter(study => 
        study.title.toLowerCase().includes(keyword) || 
        study.abstract.toLowerCase().includes(keyword)
      );
    }

    if (filters.author) {
      const author = filters.author.toLowerCase();
      results = results.filter(study => 
        study.authors.toLowerCase().includes(author)
      );
    }

    if (filters.yearFrom) {
      const yearFrom = parseInt(filters.yearFrom);
      results = results.filter(study => {
        const publishYear = new Date(study.publishDate).getFullYear();
        return publishYear >= yearFrom;
      });
    }

    if (filters.yearTo) {
      const yearTo = parseInt(filters.yearTo);
      results = results.filter(study => {
        const publishYear = new Date(study.publishDate).getFullYear();
        return publishYear <= yearTo;
      });
    }

    if (filters.category && filters.category !== 'all') {
      results = results.filter(study => 
        study.category.toLowerCase() === filters.category.toLowerCase()
      );
    }

    if (filters.peerReviewed) {
      results = results.filter(study => study.peerReviewed);
    }

    // Apply sorting
    if (filters.sortBy) {
      switch (filters.sortBy) {
        case 'date':
          results.sort((a, b) => 
            new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
          );
          break;
        case 'title':
          results.sort((a, b) => a.title.localeCompare(b.title));
          break;
        case 'relevance':
          // This is a placeholder for relevance sorting
          // In a real implementation, this would use more complex logic
          // For now, just using the default order which is by ID
          break;
      }
    } else {
      // Default sort by date (newest first)
      results.sort((a, b) => 
        new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
      );
    }

    return results;
  }

  async getStudyById(id: number): Promise<Study | undefined> {
    return this.studiesData.get(id);
  }
  
  async getStudyByIdentifier(identifier: string): Promise<Study | undefined> {
    // Look for study with matching DOI or PMID
    const normalizedIdentifier = identifier.trim().toLowerCase();
    for (const study of this.studiesData.values()) {
      // Check DOI
      if (study.doi && study.doi.toLowerCase() === normalizedIdentifier) {
        return study;
      }
      
      // Check PMID
      if (study.pmid && study.pmid.toLowerCase() === normalizedIdentifier) {
        return study;
      }
      
      // Check PMCID
      if (study.pmcid && study.pmcid.toLowerCase() === normalizedIdentifier) {
        return study;
      }
    }
    
    return undefined;
  }

  async getLatestStudies(limit: number = 3): Promise<Study[]> {
    const studies = Array.from(this.studiesData.values());
    return studies
      .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
      .slice(0, limit);
  }

  async createStudy(insertStudy: InsertStudy): Promise<Study> {
    const id = this.studyCurrentId++;
    const createdAt = new Date().toISOString();
    const study: Study = { ...insertStudy, id, createdAt };
    this.studiesData.set(id, study);
    
    // Update the study count for the category if it exists
    const categoryName = study.category;
    for (const [id, category] of this.categoriesData.entries()) {
      if (category.name.toLowerCase() === categoryName.toLowerCase()) {
        const updatedCategory = { ...category, studyCount: category.studyCount + 1 };
        this.categoriesData.set(id, updatedCategory);
        break;
      }
    }
    
    return study;
  }
  
  async updateStudy(id: number, partialStudy: Partial<InsertStudy>): Promise<Study> {
    const existingStudy = this.studiesData.get(id);
    
    if (!existingStudy) {
      throw new Error(`Study with id ${id} not found`);
    }
    
    // Handle category change
    if (partialStudy.category && partialStudy.category !== existingStudy.category) {
      // Decrease count for old category
      const oldCategoryName = existingStudy.category;
      for (const [catId, category] of this.categoriesData.entries()) {
        if (category.name.toLowerCase() === oldCategoryName.toLowerCase()) {
          const updatedCategory = { 
            ...category, 
            studyCount: Math.max(0, category.studyCount - 1) 
          };
          this.categoriesData.set(catId, updatedCategory);
          break;
        }
      }
      
      // Increase count for new category
      const newCategoryName = partialStudy.category;
      for (const [catId, category] of this.categoriesData.entries()) {
        if (category.name.toLowerCase() === newCategoryName.toLowerCase()) {
          const updatedCategory = { 
            ...category, 
            studyCount: category.studyCount + 1 
          };
          this.categoriesData.set(catId, updatedCategory);
          break;
        }
      }
    }
    
    // Update the study
    const updatedStudy: Study = {
      ...existingStudy,
      ...partialStudy
    };
    
    this.studiesData.set(id, updatedStudy);
    
    return updatedStudy;
  }
  
  async deleteStudy(id: number): Promise<void> {
    const existingStudy = this.studiesData.get(id);
    
    if (!existingStudy) {
      throw new Error(`Study with id ${id} not found`);
    }
    
    // Decrease count for category
    const categoryName = existingStudy.category;
    for (const [catId, category] of this.categoriesData.entries()) {
      if (category.name.toLowerCase() === categoryName.toLowerCase()) {
        const updatedCategory = { 
          ...category, 
          studyCount: Math.max(0, category.studyCount - 1) 
        };
        this.categoriesData.set(catId, updatedCategory);
        break;
      }
    }
    
    // Delete the study
    this.studiesData.delete(id);
  }
  
  async getCategoryByName(name: string): Promise<Category | undefined> {
    for (const category of this.categoriesData.values()) {
      if (category.name.toLowerCase() === name.toLowerCase()) {
        return category;
      }
    }
    return undefined;
  }

  // Categories methods
  async getCategories(): Promise<Category[]> {
    return Array.from(this.categoriesData.values());
  }

  async getCategoryById(id: number): Promise<Category | undefined> {
    return this.categoriesData.get(id);
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const id = this.categoryCurrentId++;
    const createdAt = new Date().toISOString();
    const category: Category = { ...insertCategory, id, createdAt };
    this.categoriesData.set(id, category);
    return category;
  }

  // Newsletter methods
  async subscribeNewsletter(insertNewsletter: InsertNewsletter): Promise<Newsletter> {
    // Check if email already exists
    const emails = Array.from(this.newslettersData.values()).map(n => n.email);
    if (emails.includes(insertNewsletter.email)) {
      throw new Error("Email already subscribed");
    }
    
    const id = this.newsletterCurrentId++;
    const createdAt = new Date().toISOString();
    const newsletter: Newsletter = { ...insertNewsletter, id, createdAt };
    this.newslettersData.set(id, newsletter);
    return newsletter;
  }
  
  // Contact form methods
  async submitContactMessage(insertContact: InsertContact): Promise<any> {
    const id = this.contactMessageCurrentId++;
    const createdAt = new Date().toISOString();
    const contactMessage = { ...insertContact, id, createdAt };
    this.contactMessagesData.set(id, contactMessage);
    return contactMessage;
  }

  // Initialize sample data
  async initializeSampleData(): Promise<void> {
    // Only add sample data if there's no data yet
    if (this.categoriesData.size === 0 && this.studiesData.size === 0) {
      await this.initializeSampleCategories();
      await this.initializeSampleStudies();
    }
  }

  private async initializeSampleCategories(): Promise<void> {
    const sampleCategories: InsertCategory[] = [
      {
        name: "Neurodegenerative Diseases",
        description: "Studies on hydrogen therapy for Alzheimer's, Parkinson's, and other neurodegenerative conditions.",
        studyCount: 0,
        icon: "M12 2a4 4 0 0 1 4 4c0 1.26-.48 2.4-1.27 3.27A4 4 0 0 1 16 12a4 4 0 0 1-1.27 2.73A4 4 0 0 1 16 18a4 4 0 0 1-4 4h-2a4 4 0 0 1-3.27-1.73A4 4 0 0 1 5 18a4 4 0 0 1 1.27-2.73A4 4 0 0 1 5 12a4 4 0 0 1 1.27-2.73A4 4 0 0 1 5 6a4 4 0 0 1 4-4h3Z",
      },
      {
        name: "Cardiovascular Health",
        description: "Research on how hydrogen affects heart health, blood pressure, and vascular function.",
        studyCount: 0,
        icon: "M19.5 12.572 12 20.072l-7.5-7.5a7 7 0 1 1 15 0Z",
      },
      {
        name: "Metabolism & Diabetes",
        description: "Studies examining hydrogen's effects on metabolic disorders and diabetes management.",
        studyCount: 0,
        icon: "M4 6.889v10.222A2 2 0 0 0 6.05 19h12.9a2 2 0 0 0 2.05-1.889V6.89A2 2 0 0 0 18.95 5H6.05A2 2 0 0 0 4 6.889ZM12 16v-4",
      },
      {
        name: "Inflammation",
        description: "Research investigating hydrogen's anti-inflammatory properties and applications.",
        studyCount: 0,
        icon: "M8 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2m-6 12h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2Z",
      },
      {
        name: "Cancer Research",
        description: "Studies focused on hydrogen's potential role in cancer prevention and treatment support.",
        studyCount: 0,
        icon: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z",
      },
      {
        name: "Anti-Aging",
        description: "Research on hydrogen's effects on aging processes and longevity markers.",
        studyCount: 0,
        icon: "M9 21h6m-6-4h6m-6-4h6M9 5h6M7 9h10a4 4 0 0 1 4 4 4 4 0 0 1-4 4H7a4 4 0 0 1-4-4 4 4 0 0 1 4-4Z",
      }
    ];

    for (const category of sampleCategories) {
      await this.createCategory(category);
    }
  }

  private async initializeSampleStudies(): Promise<void> {
    const sampleStudies: InsertStudy[] = [
      {
        title: "Hydrogen-Rich Water Reduces Inflammatory Responses and Prevents Apoptosis of Cardiomyocytes",
        abstract: "This study examined the effects of hydrogen-rich water on inflammation markers in patients with cardiovascular disease, showing significant reductions in oxidative stress. The researchers observed decreased levels of pro-inflammatory cytokines and improved cardiac function in the treatment group compared to controls.",
        authors: "Chen et al.",
        journal: "Journal of Cardiology",
        publishDate: "2023-06-15",
        category: "Cardiovascular",
        methods: "A randomized, double-blind, placebo-controlled trial involving 80 patients with diagnosed cardiovascular disease. Participants consumed either hydrogen-rich water (1.5L daily) or placebo water for 12 weeks. Blood samples were collected at baseline, 6 weeks, and 12 weeks to assess inflammatory markers and oxidative stress parameters.",
        results: "After 12 weeks, the hydrogen-rich water group showed significant reductions in C-reactive protein (-15.2%, p<0.01), TNF-alpha (-8.5%, p<0.05), and IL-6 (-12.7%, p<0.01) compared to the placebo group. Oxidative stress markers, including MDA and 8-OHdG, were also significantly reduced. Echocardiography revealed improved left ventricular ejection fraction in the treatment group (4.2% increase, p<0.05).",
        conclusion: "Hydrogen-rich water demonstrated significant anti-inflammatory and antioxidant effects in patients with cardiovascular disease, suggesting potential therapeutic applications as an adjunct treatment for cardiovascular conditions. The cardioprotective effects appear to be mediated through suppression of inflammatory pathways and reduction of oxidative damage.",
        doi: "10.1016/j.cardjour.2023.06.005",
        peerReviewed: true
      },
      {
        title: "Molecular Hydrogen as a Neuroprotective Agent: Potential Mechanisms in Alzheimer's Disease",
        abstract: "This systematic review evaluates the potential of molecular hydrogen in preventing and treating neurodegenerative disorders, with emphasis on recent clinical trials. Analysis of 28 studies indicates hydrogen therapy may slow cognitive decline through multiple neuroprotective mechanisms.",
        authors: "Tanaka et al.",
        journal: "Neurotherapeutics",
        publishDate: "2023-05-22",
        category: "Neurology",
        methods: "A systematic review of PubMed, EMBASE, and Cochrane databases was performed according to PRISMA guidelines. Studies published between 2010 and 2023 investigating hydrogen therapy in neurodegenerative conditions were included. Data extraction focused on intervention methods, cognitive outcomes, biomarkers, and proposed mechanisms of action.",
        results: "Of 28 studies reviewed (12 animal studies, 16 human trials), 22 reported significant improvements in cognitive function or neuropathological markers. Hydrogen administration methods included hydrogen-rich water (64% of studies), hydrogen gas inhalation (29%), and hydrogen-producing tablets (7%). Key mechanisms identified include reduction of oxidative stress markers (observed in 89% of studies), decreased neuroinflammation (76%), improved mitochondrial function (53%), and reduced amyloid-β accumulation (41%).",
        conclusion: "Current evidence suggests molecular hydrogen exerts multifaceted neuroprotective effects that may benefit patients with Alzheimer's disease and other neurodegenerative conditions. The strongest evidence supports hydrogen's antioxidant and anti-inflammatory actions. While promising, larger clinical trials with standardized protocols and longer follow-up periods are needed to establish optimal treatment regimens and confirm long-term efficacy.",
        doi: "10.1007/s13311-023-01353-9",
        peerReviewed: true
      },
      {
        title: "Effects of Hydrogen-Rich Water on Glucose Metabolism in Type 2 Diabetes: A Randomized Controlled Trial",
        abstract: "This randomized controlled trial investigates the effects of 12-week hydrogen-rich water consumption on glycemic control and insulin sensitivity in patients with type 2 diabetes. Results showed significant improvements in fasting glucose, HbA1c, and HOMA-IR scores.",
        authors: "Martinez et al.",
        journal: "Diabetes Care",
        publishDate: "2023-04-10",
        category: "Metabolism",
        methods: "Sixty-five patients with type 2 diabetes were randomly assigned to consume either hydrogen-rich water (600 mL daily) or placebo water for 12 weeks. Primary outcomes included changes in fasting blood glucose, HbA1c, and insulin resistance (HOMA-IR). Secondary outcomes included lipid profiles, inflammatory markers, and oxidative stress parameters.",
        results: "The hydrogen-rich water group demonstrated significant reductions in fasting blood glucose (-11.2 mg/dL, p=0.008), HbA1c (-0.4%, p=0.012), and HOMA-IR (-0.6, p=0.003) compared to the placebo group. Significant improvements were also observed in total antioxidant capacity (+14.5%, p<0.001) and reduced malondialdehyde levels (-18.7%, p<0.001). No significant changes were observed in lipid profiles between groups. No serious adverse events were reported.",
        conclusion: "Daily consumption of hydrogen-rich water for 12 weeks significantly improved glycemic control and insulin sensitivity in patients with type 2 diabetes. These benefits appear to be mediated, at least in part, through reduction of oxidative stress. Hydrogen-rich water may represent a simple, cost-effective adjunct therapy for managing type 2 diabetes. Larger studies with longer follow-up periods are warranted to confirm these findings and evaluate long-term effects.",
        doi: "10.2337/dc23-0542",
        peerReviewed: true
      },
      {
        title: "Hydrogen Gas Inhalation Mitigates Brain Injury After Cardiac Arrest: A Randomized Controlled Animal Study",
        abstract: "This study evaluated the neuroprotective effects of hydrogen gas inhalation following cardiac arrest and resuscitation in a porcine model. Results demonstrated improved neurological outcomes, reduced oxidative damage, and decreased neuronal apoptosis in the hydrogen treatment group.",
        authors: "Wang et al.",
        journal: "Critical Care Medicine",
        publishDate: "2023-03-05",
        category: "Neurodegenerative",
        methods: "Twelve adult male pigs underwent electrical-induced cardiac arrest for 8 minutes followed by standard cardiopulmonary resuscitation. After successful resuscitation, animals were randomized to receive either 2.4% hydrogen gas inhalation or control (standard oxygen therapy) for 6 hours. Brain tissue samples were collected at 24 hours post-resuscitation for biochemical and histological analyses.",
        results: "The hydrogen gas group demonstrated significantly higher neurological function scores at 24 hours compared to controls (median score 7 vs. 4, p=0.008). Brain tissue analysis showed significantly reduced levels of malondialdehyde (-32%, p<0.01), increased SOD activity (+45%, p<0.01), and decreased inflammatory markers (IL-6, TNF-α) in the hydrogen group. TUNEL staining revealed fewer apoptotic neurons in the hippocampus and cortex of hydrogen-treated animals. MRI diffusion-weighted imaging showed smaller areas of cerebral ischemia in the treatment group.",
        conclusion: "Hydrogen gas inhalation after cardiac arrest and resuscitation provides significant neuroprotection, likely through combined antioxidant, anti-inflammatory, and anti-apoptotic mechanisms. These findings support the potential clinical application of hydrogen gas as an early intervention to reduce brain injury following cardiac arrest. Further studies are needed to optimize treatment protocols and evaluate long-term outcomes.",
        doi: "10.1097/CCM.0000000000005723",
        peerReviewed: true
      },
      {
        title: "Molecular Hydrogen as an Adjuvant Therapy for COVID-19: A Pilot Study",
        abstract: "This pilot study investigated the potential benefits of hydrogen therapy as an adjunct treatment for moderate COVID-19 patients. Preliminary findings indicate potential reductions in inflammatory markers and improved clinical outcomes in patients receiving hydrogen therapy alongside standard care.",
        authors: "Park et al.",
        journal: "Medical Gas Research",
        publishDate: "2023-02-18",
        category: "Inflammation",
        methods: "In this open-label pilot study, 30 hospitalized patients with moderate COVID-19 pneumonia were divided into two groups: standard care (n=15) and standard care plus hydrogen therapy (n=15). The hydrogen therapy consisted of hydrogen gas inhalation (3% H2, 30 minutes, three times daily) plus hydrogen-rich water consumption (600 mL daily) for 7 days. Clinical parameters, inflammatory markers, and lung imaging were evaluated at baseline, day 3, and day 7.",
        results: "By day 7, the hydrogen therapy group showed significantly greater reductions in C-reactive protein (-65% vs -40%, p<0.05) and IL-6 levels (-58% vs -32%, p<0.05) compared to the control group. Time to clinical improvement was shorter in the hydrogen group (median 8 days vs 12 days, p=0.04). Chest CT scores showed greater improvement in the hydrogen group at day 7 (reduction of 4.2 points vs 2.1 points, p=0.03). No hydrogen-related adverse events were reported.",
        conclusion: "This preliminary study suggests that hydrogen therapy may provide additional benefits when added to standard care for COVID-19 patients, potentially through its anti-inflammatory and antioxidant properties. The treatment was well-tolerated with no adverse effects. While these results are promising, larger randomized controlled trials are needed to confirm efficacy, determine optimal administration protocols, and identify which patient subgroups might benefit most from this intervention.",
        doi: "10.4103/mgr.mgr_23_22",
        peerReviewed: true
      },
      {
        title: "Hydrogen-Rich Water Consumption Enhances Exercise-Induced Mitochondrial Adaptations in Skeletal Muscle",
        abstract: "This study examined the effects of hydrogen-rich water consumption on exercise-induced mitochondrial adaptations in skeletal muscle of young healthy adults. Results indicate enhanced mitochondrial biogenesis and improved oxidative capacity after eight weeks of combined hydrogen supplementation and endurance training.",
        authors: "Yamaguchi et al.",
        journal: "Journal of Applied Physiology",
        publishDate: "2023-01-27",
        category: "Metabolism",
        methods: "Thirty-two physically active males (aged 20-30) were randomly assigned to consume either hydrogen-rich water (HRW, 1L daily) or placebo water (PW) during an 8-week endurance training program (cycling, 3 sessions/week). Muscle biopsies from the vastus lateralis were obtained before and after the intervention. Measurements included mitochondrial content, enzyme activities, gene expression related to mitochondrial biogenesis, and exercise performance.",
        results: "The HRW group showed significantly greater increases in citrate synthase activity (+28% vs +16%, p<0.01), PGC-1α protein content (+45% vs +21%, p<0.01), and mitochondrial DNA copy number (+35% vs +17%, p<0.01) compared to the PW group. Gene expression of TFAM, NRF-1, and NRF-2 was significantly upregulated in the HRW group. Maximal oxygen consumption increased more in the HRW group (+14.8% vs +9.6%, p<0.05), as did time to exhaustion during the incremental exercise test (+17.2% vs +9.8%, p<0.01).",
        conclusion: "Hydrogen-rich water consumption augments exercise-induced mitochondrial adaptations in skeletal muscle, potentially through modulation of redox-sensitive signaling pathways involved in mitochondrial biogenesis. These findings suggest that molecular hydrogen may serve as an ergogenic aid to enhance training adaptations and exercise performance. Future research should explore the dose-response relationship and potential benefits in different athletic populations and clinical settings.",
        doi: "10.1152/japplphysiol.00812.2022",
        peerReviewed: true
      },
      {
        title: "Hydrogen-Rich Water Improves Markers of Aging and Age-Related Diseases in C. elegans Through Activation of the FOXO Pathway",
        abstract: "This study explored the effects of hydrogen-rich water on longevity and age-related biomarkers in Caenorhabditis elegans. Findings reveal that molecular hydrogen extends lifespan and improves stress resistance through activation of the FOXO/DAF-16 pathway and enhanced antioxidant gene expression.",
        authors: "Saitoh et al.",
        journal: "GeroScience",
        publishDate: "2022-12-09",
        category: "Aging",
        methods: "Wild-type and mutant strains of C. elegans were cultured in either regular water or hydrogen-rich water (0.5-1.0 ppm) throughout their life cycle. Lifespan analysis, stress resistance assays, age-related biomarker measurements, and gene expression analysis were performed. DAF-16 nuclear translocation was visualized using a GFP-tagged strain.",
        results: "Hydrogen-rich water treatment extended mean lifespan by 22.6% (p<0.001) and maximum lifespan by 16.2% in wild-type worms. This effect was abolished in daf-16 mutants, suggesting FOXO pathway dependence. Hydrogen-treated worms showed enhanced resistance to heat stress (+35% survival, p<0.01) and oxidative stress (+41% survival, p<0.01). Age-related accumulation of lipofuscin was reduced by 28% (p<0.01), and protein carbonyl content decreased by 34% (p<0.001). RT-PCR revealed upregulation of antioxidant genes sod-3 (+112%, p<0.001) and ctl-1 (+87%, p<0.01), and DAF-16 target genes. Fluorescence microscopy confirmed increased nuclear localization of DAF-16 in hydrogen-treated worms.",
        conclusion: "Molecular hydrogen extends lifespan and improves healthspan in C. elegans primarily through activation of the evolutionarily conserved FOXO/DAF-16 pathway. This leads to enhanced expression of stress resistance genes and reduced accumulation of age-related damage. These findings provide mechanistic insights into the anti-aging effects of molecular hydrogen and support its potential as an intervention for promoting healthy aging. Further studies in mammalian models are warranted to validate these results.",
        doi: "10.1007/s11357-022-00665-6",
        peerReviewed: true
      },
      {
        title: "Molecular Hydrogen Therapy Attenuates Chemotherapy-Induced Cognitive Impairment in Breast Cancer Patients",
        abstract: "This prospective clinical study investigated whether molecular hydrogen could prevent or reduce chemotherapy-induced cognitive impairment ('chemo brain') in breast cancer patients. Results indicate improved cognitive function and quality of life in patients receiving hydrogen therapy alongside standard chemotherapy.",
        authors: "Liu et al.",
        journal: "Cancer Research and Treatment",
        publishDate: "2022-11-14",
        category: "Cancer",
        methods: "Sixty-four female breast cancer patients scheduled to receive adjuvant chemotherapy were randomized to either standard care or standard care plus hydrogen therapy (hydrogen inhalation, 3% H₂ for 60 minutes before and after each chemotherapy session, plus hydrogen-rich water consumption). Cognitive function was assessed at baseline, mid-treatment, end of chemotherapy, and 3 months post-treatment using standardized neuropsychological tests. Quality of life and fatigue were evaluated using validated questionnaires.",
        results: "Patients in the hydrogen therapy group showed significantly less decline in executive function (mean difference 0.58 SD, p=0.008), processing speed (mean difference 0.49 SD, p=0.015), and verbal memory (mean difference 0.61 SD, p=0.006) compared to the control group. Three months post-chemotherapy, the hydrogen group demonstrated better recovery of cognitive function across all domains. Self-reported cognitive complaints were lower in the hydrogen group (mean FACT-Cog score difference 8.7 points, p<0.01). Quality of life measures and fatigue scores were also more favorable in the hydrogen group. No serious adverse events related to hydrogen therapy were reported.",
        conclusion: "Molecular hydrogen therapy appears to provide neuroprotective effects against chemotherapy-induced cognitive impairment in breast cancer patients. The treatment was well-tolerated and associated with improved quality of life outcomes. These findings suggest hydrogen may be a promising supportive care intervention to reduce the burden of 'chemo brain' in cancer patients. Further research is needed to determine optimal treatment protocols and long-term outcomes.",
        doi: "10.4143/crt.2022.851",
        peerReviewed: true
      },
      {
        title: "Hydrogen-Rich Saline Protects Against Contrast-Induced Nephropathy in Patients Undergoing Coronary Angiography: A Multicenter Randomized Controlled Trial",
        abstract: "This multicenter trial evaluated the renoprotective effects of hydrogen-rich saline against contrast-induced nephropathy in high-risk patients undergoing coronary angiography. Results showed significant reduction in the incidence of contrast-induced nephropathy and preservation of renal function in the hydrogen-treated group.",
        authors: "Zhang et al.",
        journal: "JACC: Cardiovascular Interventions",
        publishDate: "2022-10-22",
        category: "Cardiovascular",
        methods: "This double-blind, multicenter RCT enrolled 504 patients with chronic kidney disease (eGFR 30-60 mL/min/1.73m²) undergoing elective coronary angiography. Patients were randomized to receive either hydrogen-rich saline (prepared with H₂ concentration of 0.6 mmol/L, 500 mL) or placebo saline intravenously 30 minutes before and immediately after contrast administration. The primary outcome was the incidence of contrast-induced nephropathy (CIN), defined as a ≥25% or ≥0.5 mg/dL increase in serum creatinine from baseline within 72 hours after contrast exposure.",
        results: "CIN occurred in 7.1% (18/252) of patients in the hydrogen-rich saline group versus 19.0% (48/252) in the placebo group (p<0.001), representing a 62.6% relative risk reduction. The hydrogen group also showed smaller increases in serum creatinine at 24, 48, and 72 hours (p<0.01 for all time points) and lower levels of urinary neutrophil gelatinase-associated lipocalin and 8-OHdG, indicating reduced kidney injury and oxidative stress. The incidence of major adverse renal events at 30 days was lower in the hydrogen group (3.6% vs 8.7%, p=0.018). No significant adverse events related to hydrogen-rich saline were reported.",
        conclusion: "Perioperative administration of hydrogen-rich saline significantly reduced the incidence of contrast-induced nephropathy and provided kidney protection in high-risk patients undergoing coronary angiography. The treatment was safe and well-tolerated. These findings suggest that hydrogen-rich saline may be an effective preventive strategy for contrast-induced nephropathy, potentially through its antioxidant and anti-inflammatory properties.",
        doi: "10.1016/j.jcin.2022.08.024",
        peerReviewed: true
      },
      {
        title: "Inhalation of Hydrogen Gas Improves Cognitive Function in Alzheimer's Disease Mouse Model by Reducing Oxidative Stress and Neuroinflammation",
        abstract: "This study investigated the effects of hydrogen gas inhalation on cognitive function and neuropathology in a transgenic mouse model of Alzheimer's disease. Results demonstrated improved cognitive performance, reduced amyloid-β accumulation, and attenuated neuroinflammation in hydrogen-treated mice.",
        authors: "Kim et al.",
        journal: "Journal of Alzheimer's Disease",
        publishDate: "2022-09-08",
        category: "Neurodegenerative",
        methods: "APP/PS1 transgenic mice (8 months old) were randomly assigned to receive either hydrogen gas inhalation (2% H₂, 1 hour daily) or control air for 8 weeks. Cognitive function was assessed using the Morris water maze, novel object recognition, and Y-maze tests. Brain tissues were analyzed for amyloid-β plaque load, markers of oxidative stress, inflammatory cytokines, and microglial activation.",
        results: "Hydrogen-treated mice showed significantly improved performance in all cognitive tests compared to controls, with better spatial memory in the Morris water maze (escape latency reduced by 36%, p<0.01), enhanced recognition memory (discrimination index increased by 52%, p<0.01), and improved working memory in the Y-maze. Immunohistochemical analysis revealed reduced amyloid-β plaque load in the hippocampus (-28%, p<0.001) and cortex (-24%, p<0.001) of hydrogen-treated mice. Biochemical analysis showed decreased levels of oxidative stress markers (4-HNE, 8-OHdG) and proinflammatory cytokines (IL-1β, TNF-α, IL-6). Microglial activation was attenuated in the hydrogen group, with a shift toward an anti-inflammatory phenotype.",
        conclusion: "Daily hydrogen gas inhalation ameliorates cognitive impairment, reduces amyloid-β accumulation, and suppresses neuroinflammation in a mouse model of Alzheimer's disease. These neuroprotective effects appear to be mediated through reduction of oxidative stress and modulation of microglial activation. These findings support the potential therapeutic application of molecular hydrogen for Alzheimer's disease and warrant further investigation in clinical trials.",
        doi: "10.3233/JAD-220451",
        peerReviewed: true
      },
      {
        title: "Molecular Hydrogen Suppresses Renal Fibrosis by Inhibiting the TGF-β1/Smad3 Signaling Pathway in a Rat Model of Diabetic Nephropathy",
        abstract: "This study examined the effects of molecular hydrogen on renal fibrosis in streptozotocin-induced diabetic nephropathy. Results demonstrate that hydrogen therapy attenuates renal fibrosis by inhibiting the TGF-β1/Smad3 signaling pathway and reducing oxidative stress-induced renal injury.",
        authors: "Li et al.",
        journal: "Biomedicine & Pharmacotherapy",
        publishDate: "2022-08-15",
        category: "Metabolism",
        methods: "Diabetic nephropathy was induced in male Sprague-Dawley rats using streptozotocin (60 mg/kg). Diabetic rats were randomized to receive either hydrogen-rich water (HRW, 1.2-1.5 ppm, ad libitum) or regular water for 12 weeks. Renal function, histopathological changes, fibrosis markers, oxidative stress parameters, and components of the TGF-β1/Smad3 pathway were assessed.",
        results: "HRW treatment significantly reduced albuminuria (-42%, p<0.01), serum creatinine (-28%, p<0.05), and BUN levels (-31%, p<0.05) compared to untreated diabetic rats. Histopathological examination revealed decreased glomerulosclerosis index (1.8±0.4 vs 3.2±0.6, p<0.01) and tubulointerstitial fibrosis score (1.2±0.3 vs 2.6±0.5, p<0.01) in the HRW group. Expression of fibrosis markers (collagen I, collagen IV, fibronectin) was significantly reduced in hydrogen-treated kidneys. HRW supplementation decreased renal MDA content (-35%, p<0.01) and increased GSH levels (+42%, p<0.01) and SOD activity (+38%, p<0.01). Western blot analysis showed reduced phosphorylation of Smad3 and decreased expression of TGF-β1 and its receptor in the HRW group.",
        conclusion: "Molecular hydrogen effectively attenuates renal fibrosis and improves kidney function in diabetic nephropathy by inhibiting the TGF-β1/Smad3 signaling pathway. The antifibrotic effects of hydrogen are associated with its antioxidant properties and ability to mitigate oxidative stress-induced kidney injury. These findings suggest that hydrogen therapy may have therapeutic potential for diabetic nephropathy and other chronic kidney diseases characterized by progressive fibrosis.",
        doi: "10.1016/j.biopha.2022.113289",
        peerReviewed: true
      },
      {
        title: "Hydrogen-Rich Water Improves Symptoms and Endoscopic Findings in Patients with Ulcerative Colitis: A Randomized Controlled Trial",
        abstract: "This randomized controlled trial evaluated the efficacy of hydrogen-rich water in patients with mild to moderate ulcerative colitis. Results showed significant improvements in clinical symptoms, quality of life, and endoscopic findings in the hydrogen water group compared to conventional therapy alone.",
        authors: "Takagi et al.",
        journal: "Inflammatory Bowel Diseases",
        publishDate: "2022-07-19",
        category: "Inflammation",
        methods: "Seventy-two patients with mild to moderate ulcerative colitis (Mayo score 3-9) were randomized to receive either standard medical therapy plus hydrogen-rich water (HRW, 1.0 ppm, 1000 mL daily) or standard therapy alone for 8 weeks. Clinical symptoms were assessed using the Mayo score and Inflammatory Bowel Disease Questionnaire (IBDQ). Endoscopic evaluations were performed at baseline and week 8. Mucosal biopsies were obtained to analyze inflammatory markers and oxidative stress parameters.",
        results: "The hydrogen water group showed greater reduction in the Mayo score compared to controls (mean change -3.2 vs -1.8, p=0.003). Clinical remission (Mayo score ≤2 with no subscore >1) was achieved in 48.6% of HRW patients vs 22.9% of controls (p=0.024). IBDQ scores improved significantly more in the HRW group (+45.3 vs +22.1 points, p<0.001). Endoscopic remission (Mayo endoscopic subscore 0 or 1) was observed in 42.9% of HRW patients vs 17.1% of controls (p=0.017). Histological analysis revealed decreased mucosal inflammation and reduced neutrophil infiltration in the HRW group. Mucosal levels of pro-inflammatory cytokines (TNF-α, IL-6, IL-1β) and oxidative stress markers were significantly lower in the HRW group, while IL-10 levels were higher.",
        conclusion: "Eight weeks of hydrogen-rich water supplementation significantly improved clinical symptoms, quality of life, and endoscopic findings in patients with mild to moderate ulcerative colitis. These benefits appear to be mediated through hydrogen's anti-inflammatory and antioxidant effects. Hydrogen-rich water represents a safe, non-invasive adjunctive therapy for ulcerative colitis that may help improve outcomes when combined with standard medical treatment.",
        doi: "10.1093/ibd/izac144",
        peerReviewed: true
      }
    ];

    for (const study of sampleStudies) {
      await this.createStudy(study);
    }
  }
}

import { DatabaseStorage } from './db-storage';

// Switch from MemStorage to DatabaseStorage
export const storage = new DatabaseStorage();
