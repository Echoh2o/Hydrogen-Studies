import { 
  Study, InsertStudy, 
  Category, InsertCategory, 
  Resource, InsertResource,
  Subscription, InsertSubscription,
  Contact, InsertContact
} from "@shared/schema";

export interface IStorage {
  // Studies
  getStudies(): Promise<Study[]>;
  getStudyById(id: number): Promise<Study | undefined>;
  searchStudies(query: string, filters?: StudyFilters): Promise<Study[]>;
  getRecentStudies(limit?: number): Promise<Study[]>;
  getStudiesByCategory(category: string): Promise<Study[]>;
  createStudy(study: InsertStudy): Promise<Study>;
  
  // Categories
  getCategories(): Promise<Category[]>;
  getCategoryByName(name: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  
  // Resources
  getResources(): Promise<Resource[]>;
  getResourceBySlug(slug: string): Promise<Resource | undefined>;
  createResource(resource: InsertResource): Promise<Resource>;
  
  // Subscriptions
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  
  // Contacts
  createContact(contact: InsertContact): Promise<Contact>;
}

export interface StudyFilters {
  category?: string;
  year?: number;
  sort?: 'relevance' | 'date-desc' | 'date-asc' | 'citations';
  studyType?: string;
  fullTextOnly?: boolean;
  author?: string;
  journal?: string;
}

export class MemStorage implements IStorage {
  private studies: Map<number, Study>;
  private categories: Map<number, Category>;
  private resources: Map<number, Resource>;
  private subscriptions: Map<number, Subscription>;
  private contacts: Map<number, Contact>;
  
  private studyId: number;
  private categoryId: number;
  private resourceId: number;
  private subscriptionId: number;
  private contactId: number;

  constructor() {
    this.studies = new Map();
    this.categories = new Map();
    this.resources = new Map();
    this.subscriptions = new Map();
    this.contacts = new Map();
    
    this.studyId = 1;
    this.categoryId = 1;
    this.resourceId = 1;
    this.subscriptionId = 1;
    this.contactId = 1;
    
    // Initialize with sample data
    this.initializeData();
  }

  // Studies
  async getStudies(): Promise<Study[]> {
    return Array.from(this.studies.values());
  }

  async getStudyById(id: number): Promise<Study | undefined> {
    return this.studies.get(id);
  }

  async searchStudies(query: string, filters: StudyFilters = {}): Promise<Study[]> {
    let results = Array.from(this.studies.values());
    
    // Search by query
    if (query) {
      const lowercaseQuery = query.toLowerCase();
      results = results.filter(study => 
        study.title.toLowerCase().includes(lowercaseQuery) || 
        study.abstract.toLowerCase().includes(lowercaseQuery) || 
        study.authors.toLowerCase().includes(lowercaseQuery) ||
        study.journal.toLowerCase().includes(lowercaseQuery)
      );
    }
    
    // Apply filters
    if (filters.category) {
      results = results.filter(study => study.category === filters.category);
    }
    
    if (filters.year) {
      results = results.filter(study => study.year === filters.year);
    }
    
    if (filters.studyType) {
      results = results.filter(study => study.studyType === filters.studyType);
    }
    
    if (filters.fullTextOnly) {
      results = results.filter(study => study.fullTextAvailable);
    }
    
    if (filters.author) {
      const lowercaseAuthor = filters.author.toLowerCase();
      results = results.filter(study => study.authors.toLowerCase().includes(lowercaseAuthor));
    }
    
    if (filters.journal) {
      const lowercaseJournal = filters.journal.toLowerCase();
      results = results.filter(study => study.journal.toLowerCase().includes(lowercaseJournal));
    }
    
    // Apply sorting
    if (filters.sort) {
      switch (filters.sort) {
        case 'date-desc':
          results.sort((a, b) => b.year - a.year);
          break;
        case 'date-asc':
          results.sort((a, b) => a.year - b.year);
          break;
        case 'citations':
          results.sort((a, b) => b.citations - a.citations);
          break;
        // For relevance, we don't need to do anything as it's the default order
      }
    }
    
    return results;
  }

  async getRecentStudies(limit = 3): Promise<Study[]> {
    const studies = Array.from(this.studies.values());
    return studies.sort((a, b) => b.year - a.year).slice(0, limit);
  }

  async getStudiesByCategory(category: string): Promise<Study[]> {
    return Array.from(this.studies.values()).filter(study => study.category === category);
  }

  async createStudy(study: InsertStudy): Promise<Study> {
    const id = this.studyId++;
    const newStudy: Study = { ...study, id };
    this.studies.set(id, newStudy);
    return newStudy;
  }
  
  // Categories
  async getCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    return Array.from(this.categories.values()).find(category => category.name === name);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const id = this.categoryId++;
    const newCategory: Category = { ...category, id };
    this.categories.set(id, newCategory);
    return newCategory;
  }
  
  // Resources
  async getResources(): Promise<Resource[]> {
    return Array.from(this.resources.values());
  }

  async getResourceBySlug(slug: string): Promise<Resource | undefined> {
    return Array.from(this.resources.values()).find(resource => resource.slug === slug);
  }

  async createResource(resource: InsertResource): Promise<Resource> {
    const id = this.resourceId++;
    const newResource: Resource = { ...resource, id };
    this.resources.set(id, newResource);
    return newResource;
  }
  
  // Subscriptions
  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const id = this.subscriptionId++;
    const newSubscription: Subscription = { 
      ...subscription, 
      id, 
      subscribedAt: new Date() 
    };
    this.subscriptions.set(id, newSubscription);
    return newSubscription;
  }
  
  // Contacts
  async createContact(contact: InsertContact): Promise<Contact> {
    const id = this.contactId++;
    const newContact: Contact = { 
      ...contact, 
      id, 
      submittedAt: new Date() 
    };
    this.contacts.set(id, newContact);
    return newContact;
  }

  // Initialize with sample data
  private initializeData() {
    // Sample categories
    const categoriesData: InsertCategory[] = [
      {
        name: "Neurology",
        description: "Studies on hydrogen effects on brain health, neurological disorders, and cognitive function.",
        icon: "brain"
      },
      {
        name: "Cardiology",
        description: "Research on cardiovascular applications, heart health, and circulation improvements.",
        icon: "heartbeat"
      },
      {
        name: "Immunology",
        description: "Studies examining hydrogen's impact on immune function and inflammatory processes.",
        icon: "shield-virus"
      },
      {
        name: "Metabolism",
        description: "Research on metabolic effects, diabetes, and cellular energy production.",
        icon: "dna"
      },
      {
        name: "Longevity",
        description: "Studies on aging, lifespan extension, and age-related degeneration processes.",
        icon: "hourglass-half"
      },
      {
        name: "Clinical Trials",
        description: "Human clinical trials evaluating therapeutic applications of hydrogen treatment.",
        icon: "flask"
      }
    ];
    
    // Add categories
    categoriesData.forEach(category => {
      this.createCategory(category);
    });
    
    // Sample studies
    const studiesData: InsertStudy[] = [
      {
        title: "Hydrogen-rich water attenuates amyloid β-induced neurotoxicity in cultured hippocampal neurons",
        abstract: "This study demonstrates the neuroprotective effects of hydrogen-rich water against amyloid β-induced oxidative stress in hippocampal neurons, suggesting potential applications in Alzheimer's disease treatment.",
        authors: "Tanaka et al.",
        journal: "Neural Research",
        year: 2023,
        category: "Neurology",
        citations: 24,
        fullTextAvailable: true,
        studyType: "cellular-study",
        url: "/study/1",
        publicationDate: new Date("2023-03-15")
      },
      {
        title: "Effects of hydrogen gas inhalation on myocardial ischemia-reperfusion injury in a rat model",
        abstract: "This research investigates how hydrogen gas inhalation affects myocardial ischemia-reperfusion injury, showing significant reduction in oxidative damage markers and improved cardiac function.",
        authors: "Chen et al.",
        journal: "Cardiovascular Research",
        year: 2023,
        category: "Cardiology",
        citations: 18,
        fullTextAvailable: false,
        studyType: "animal-study",
        url: "/study/2",
        publicationDate: new Date("2023-02-10")
      },
      {
        title: "Hydrogen-rich saline treatment alleviates inflammatory response in a model of autoimmune hepatitis",
        abstract: "This study examines the anti-inflammatory effects of hydrogen-rich saline in an autoimmune hepatitis model, showing reduced expression of pro-inflammatory cytokines and oxidative stress markers.",
        authors: "Zhang et al.",
        journal: "Immunology Journal",
        year: 2022,
        category: "Immunology",
        citations: 21,
        fullTextAvailable: true,
        studyType: "animal-study",
        url: "/study/3",
        publicationDate: new Date("2022-11-30")
      },
      {
        title: "Molecular hydrogen improves obesity and diabetes by inducing hepatic FGF21 and stimulating energy metabolism",
        abstract: "This research demonstrates that hydrogen stimulates energy metabolism by inducing fibroblast growth factor 21, offering potential therapeutic applications for metabolic syndrome.",
        authors: "Kamimura et al.",
        journal: "Metabolism",
        year: 2022,
        category: "Metabolism",
        citations: 32,
        fullTextAvailable: true,
        studyType: "clinical-trial",
        url: "/study/4",
        publicationDate: new Date("2022-09-18")
      },
      {
        title: "Hydrogen therapy attenuates irradiation-induced lung damage by reducing oxidative stress",
        abstract: "This study investigates the protective effects of hydrogen gas inhalation against radiation-induced lung injury, showing significant reduction in inflammation markers.",
        authors: "Wang et al.",
        journal: "Clinical Cancer Research",
        year: 2021,
        category: "Clinical Trials",
        citations: 27,
        fullTextAvailable: true,
        studyType: "clinical-trial",
        url: "/study/5",
        publicationDate: new Date("2021-08-05")
      },
      {
        title: "Hydrogen-rich water for improvements of mood, anxiety, and autonomic nerve function in daily life",
        abstract: "A randomized, placebo-controlled trial examining how daily consumption of hydrogen-rich water affects mood, anxiety, and autonomic nerve function in healthy adults.",
        authors: "Mizuno et al.",
        journal: "Medical Gas Research",
        year: 2021,
        category: "Neurology",
        citations: 15,
        fullTextAvailable: false,
        studyType: "clinical-trial",
        url: "/study/6",
        publicationDate: new Date("2021-05-12")
      }
    ];
    
    // Add studies
    studiesData.forEach(study => {
      this.createStudy(study);
    });
    
    // Sample resources
    const resourcesData: InsertResource[] = [
      {
        title: "Beginner's Guide to Hydrogen Research",
        description: "An introduction to molecular hydrogen and its potential health benefits. Learn the basics of how hydrogen interacts with cellular systems.",
        content: "Comprehensive guide to hydrogen research basics...",
        imageUrl: "https://images.unsplash.com/photo-1575503802870-45de6a6217c8?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=450",
        slug: "beginners-guide",
        resourceType: "guide"
      },
      {
        title: "Research Methodologies",
        description: "Explore the various methods of studying hydrogen's effects, from in vitro experiments to clinical trials in human subjects.",
        content: "Detailed explanation of research methodologies...",
        imageUrl: "https://pixabay.com/get/g6832f301cd416d5f97b25b09d0753daf2cfc472bd8bebca2b84da908a63fed60f42d6546e1ea9fcfd7590777b6147a738f0e7f39208d5be51ade1ed9439169cc_1280.jpg",
        slug: "research-methods",
        resourceType: "guide"
      },
      {
        title: "Clinical Applications",
        description: "Discover how hydrogen therapy is being applied in various medical fields and what the current evidence suggests about its efficacy.",
        content: "Overview of clinical applications of hydrogen therapy...",
        imageUrl: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=450",
        slug: "clinical-applications",
        resourceType: "guide"
      }
    ];
    
    // Add resources
    resourcesData.forEach(resource => {
      this.createResource(resource);
    });
  }
}

export const storage = new MemStorage();
