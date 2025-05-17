import { 
  studies, 
  categories, 
  newsletters, 
  type Study, 
  type Category, 
  type Newsletter, 
  type InsertStudy, 
  type InsertCategory, 
  type InsertNewsletter 
} from "@shared/schema";
import { IStorage, StudyFilters } from "./storage";
import { db } from "./db";
import { eq, and, or, like, gte, lte, desc, asc, sql, ilike } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  // Studies methods
  async getStudies(filters: StudyFilters = {}): Promise<any> {
    // Build filter conditions
    const conditions = [];
    
    // Basic search
    if (filters.query) {
      const searchTerm = `%${filters.query}%`;
      conditions.push(
        or(
          like(studies.title, searchTerm),
          like(studies.abstract, searchTerm),
          like(studies.authors, searchTerm),
          like(studies.journal, searchTerm),
          like(studies.methods, searchTerm),
          like(studies.results, searchTerm),
          like(studies.conclusion, searchTerm)
        )
      );
    }
    
    // Journal filter
    if (filters.journal && filters.journal.length > 0) {
      const journalName = filters.journal[0];
      if (journalName && journalName.trim() !== '') {
        conditions.push(ilike(studies.journal, `%${journalName}%`));
      }
    }
    
    // Study type filter
    if (filters.studyType && filters.studyType.length > 0) {
      const studyTypeValue = filters.studyType[0];
      if (studyTypeValue && studyTypeValue.trim() !== '') {
        conditions.push(ilike(studies.studyType, `%${studyTypeValue}%`));
      }
    }
    
    // Country filter
    if (filters.country && filters.country.length > 0) {
      const countryValue = filters.country[0];
      if (countryValue && countryValue.trim() !== '') {
        conditions.push(ilike(studies.country, `%${countryValue}%`));
      }
    }
    
    // Region filter
    if (filters.region && filters.region.length > 0) {
      const regionValue = filters.region[0];
      if (regionValue && regionValue.trim() !== '') {
        conditions.push(ilike(studies.region, `%${regionValue}%`));
      }
    }
    
    // Keyword search
    if (filters.keyword) {
      const keyword = `%${filters.keyword}%`;
      conditions.push(
        or(
          ilike(studies.title, keyword),
          ilike(studies.abstract, keyword)
        )
      );
    }
    
    // Author filter
    if (filters.author) {
      conditions.push(ilike(studies.authors, `%${filters.author}%`));
    }
    
    // Date range filters
    if (filters.yearFrom) {
      // This is simplified, in a real app we'd need to handle date parsing better
      conditions.push(gte(studies.publishDate, `${filters.yearFrom}-01-01`));
    }
    
    if (filters.yearTo) {
      // This is simplified, in a real app we'd need to handle date parsing better
      conditions.push(lte(studies.publishDate, `${filters.yearTo}-12-31`));
    }
    
    // More specific date range for the new UI
    if (filters.dateFrom) {
      conditions.push(gte(studies.publishDate, filters.dateFrom));
    }
    
    if (filters.dateTo) {
      conditions.push(lte(studies.publishDate, filters.dateTo));
    }
    
    // Category filter
    if (filters.category && filters.category !== 'all' && filters.category !== '') {
      conditions.push(eq(studies.category, filters.category));
    }
    
    // Boolean filters for the enhanced UI
    if (filters.isPeerReviewed === true) {
      conditions.push(eq(studies.peerReviewed, true));
    } else if (filters.isPeerReviewed === false) {
      conditions.push(eq(studies.peerReviewed, false));
    }
    
    if (filters.hasHealthImplications === true) {
      conditions.push(eq(studies.healthImplications, true));
    } else if (filters.hasHealthImplications === false) {
      conditions.push(eq(studies.healthImplications, false));
    }
    
    if (filters.hasMedia === true) {
      conditions.push(eq(studies.hasMedia, true));
    } else if (filters.hasMedia === false) {
      conditions.push(eq(studies.hasMedia, false));
    }
    
    // Advanced filters for health conditions and body systems
    if (filters.healthConditions && filters.healthConditions.length > 0) {
      try {
        const firstCondition = filters.healthConditions[0];
        if (firstCondition && firstCondition.trim() !== '') {
          // Using ilike for case insensitive text search
          conditions.push(
            ilike(studies.healthConditions, `%${firstCondition}%`)
          );
        }
      } catch (error) {
        console.error("Error applying health conditions filter:", error);
      }
    }
    
    if (filters.bodySystems && filters.bodySystems.length > 0) {
      try {
        const firstSystem = filters.bodySystems[0];
        if (firstSystem && firstSystem.trim() !== '') {
          // Using ilike for case insensitive text search
          conditions.push(
            ilike(studies.bodySystems, `%${firstSystem}%`)
          );
        }
      } catch (error) {
        console.error("Error applying body systems filter:", error);
      }
    }
    
    // Pagination parameters
    const page = filters.page ? parseInt(filters.page as string) : 1;
    const pageSize = filters.pageSize ? parseInt(filters.pageSize as string) : 10;
    const offset = (page - 1) * pageSize;
    
    // Determine sort field and direction
    let sortField = studies.publishDate;
    let sortDirection = desc;
    
    if (filters.sortField) {
      switch (filters.sortField) {
        case 'title':
          sortField = studies.title;
          break;
        case 'journal':
          sortField = studies.journal;
          break;
        case 'category':
          sortField = studies.category;
          break;
        case 'publishDate':
        default:
          sortField = studies.publishDate;
          break;
      }
    }
    
    if (filters.sortOrder === 'asc') {
      sortDirection = asc;
    }
    
    // Get total count first (for pagination)
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(studies)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    const totalCount = countResult[0]?.count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);
    
    // Get the actual data with pagination
    let query = db.select().from(studies);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    // Apply sorting
    query = query.orderBy(sortDirection(sortField));
    
    // Apply pagination
    query = query.limit(pageSize).offset(offset);
    
    // Execute query
    const result = await query;
    
    // Get additional counts for the UI metrics
    const peerReviewedCount = await db.select({ count: sql<number>`count(*)` })
      .from(studies)
      .where(
        conditions.length > 0 
          ? and(eq(studies.peerReviewed, true), ...conditions) 
          : eq(studies.peerReviewed, true)
      );
      
    // Health implications count - temporarily using peer-reviewed count
    // since healthImplications field doesn't exist yet
    const healthImplicationsCount = await db.select({ count: sql<number>`count(*)` })
      .from(studies)
      .where(
        conditions.length > 0 
          ? and(...conditions) 
          : undefined
      );
      
    // Use a conditional query to count studies with media (image_url or video_url not null)
    const withMediaCount = await db.select({ count: sql<number>`count(*)` })
      .from(studies)
      .where(
        conditions.length > 0 
          ? and(
              or(
                sql`${studies.imageUrl} IS NOT NULL`, 
                sql`${studies.videoUrl} IS NOT NULL`
              ), 
              ...conditions
            ) 
          : or(
              sql`${studies.imageUrl} IS NOT NULL`, 
              sql`${studies.videoUrl} IS NOT NULL`
            )
      );
    
    // Return enhanced response with pagination metadata
    return {
      data: result,
      totalCount,
      totalPages,
      page,
      pageSize,
      peerReviewedCount: peerReviewedCount[0]?.count || 0,
      healthImplicationsCount: healthImplicationsCount[0]?.count || 0,
      withMediaCount: withMediaCount[0]?.count || 0
    };
  }

  async getStudyById(id: number): Promise<Study | undefined> {
    const result = await db.select().from(studies).where(eq(studies.id, id));
    return result[0];
  }
  
  async getStudiesByTitle(title: string): Promise<Study[]> {
    // Find studies with similar titles to check for duplicates during import
    if (!title) return [];
    
    const normalizedTitle = title.trim();
    
    // Split the title into keywords for better matching
    const keywords = normalizedTitle
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3) // Only use meaningful words
      .map(word => `%${word}%`);
    
    if (keywords.length === 0) {
      // If no meaningful keywords, just do a simple LIKE search
      return await db
        .select()
        .from(studies)
        .where(like(studies.title, `%${normalizedTitle}%`));
    }
    
    // For each keyword, create a LIKE condition
    const conditions = keywords.map(keyword => like(studies.title, keyword));
    
    // Studies that match at least 70% of the keywords are likely duplicates
    const minMatchCount = Math.ceil(keywords.length * 0.7);
    
    // This is a simplified approach that checks if multiple keywords appear in the title
    // A more sophisticated approach would be to use a text search extension like pg_trgm
    const matchedStudies = await db
      .select()
      .from(studies)
      .where(or(...conditions));
    
    // Filter studies that match enough keywords
    return matchedStudies.filter(study => {
      const studyTitle = study.title.toLowerCase();
      const matchCount = keywords.filter(keyword => 
        studyTitle.includes(keyword.replace(/%/g, ''))
      ).length;
      
      return matchCount >= minMatchCount;
    });
  }

  async getLatestStudies(limit: number = 3): Promise<Study[]> {
    const result = await db.select()
      .from(studies)
      .orderBy(desc(studies.publishDate))
      .limit(limit);
    return result;
  }

  async createStudy(insertStudy: InsertStudy): Promise<Study> {
    const [study] = await db.insert(studies)
      .values(insertStudy)
      .returning();
    
    // Update the study count for the category
    const category = await this.getCategoryByName(insertStudy.category);
    if (category) {
      await db.update(categories)
        .set({ studyCount: category.studyCount + 1 })
        .where(eq(categories.id, category.id));
    }
    
    return study;
  }
  
  async updateStudy(id: number, partialStudy: Partial<InsertStudy>): Promise<Study> {
    // Get the current study to check for category changes
    const currentStudy = await this.getStudyById(id);
    if (!currentStudy) {
      throw new Error(`Study with id ${id} not found`);
    }
    
    // Update the study
    const [updatedStudy] = await db.update(studies)
      .set(partialStudy)
      .where(eq(studies.id, id))
      .returning();
    
    // If category changed, update category counts
    if (partialStudy.category && partialStudy.category !== currentStudy.category) {
      // Decrement count for old category
      const oldCategory = await this.getCategoryByName(currentStudy.category);
      if (oldCategory && oldCategory.studyCount > 0) {
        await db.update(categories)
          .set({ studyCount: oldCategory.studyCount - 1 })
          .where(eq(categories.id, oldCategory.id));
      }
      
      // Increment count for new category
      const newCategory = await this.getCategoryByName(partialStudy.category);
      if (newCategory) {
        await db.update(categories)
          .set({ studyCount: newCategory.studyCount + 1 })
          .where(eq(categories.id, newCategory.id));
      }
    }
    
    return updatedStudy;
  }
  
  async deleteStudy(id: number): Promise<void> {
    // Get the current study to update category count
    const study = await this.getStudyById(id);
    if (!study) {
      throw new Error(`Study with id ${id} not found`);
    }
    
    // Delete the study
    await db.delete(studies)
      .where(eq(studies.id, id));
    
    // Update the category count
    const category = await this.getCategoryByName(study.category);
    if (category && category.studyCount > 0) {
      await db.update(categories)
        .set({ studyCount: category.studyCount - 1 })
        .where(eq(categories.id, category.id));
    }
  }

  // Categories methods
  async getCategories(): Promise<Category[]> {
    const result = await db.select().from(categories);
    return result;
  }

  async getCategoryById(id: number): Promise<Category | undefined> {
    const result = await db.select().from(categories).where(eq(categories.id, id));
    return result[0];
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    const result = await db.select()
      .from(categories)
      .where(eq(categories.name, name));
    return result[0];
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db.insert(categories)
      .values(insertCategory)
      .returning();
    return category;
  }

  // Newsletter methods
  async subscribeNewsletter(insertNewsletter: InsertNewsletter): Promise<Newsletter> {
    // Check if email already exists
    const existingEmails = await db.select({ email: newsletters.email })
      .from(newsletters)
      .where(eq(newsletters.email, insertNewsletter.email));
    
    if (existingEmails.length > 0) {
      throw new Error("Email already subscribed");
    }
    
    const [newsletter] = await db.insert(newsletters)
      .values(insertNewsletter)
      .returning();
    return newsletter;
  }

  // Initialize sample data
  async initializeSampleData(): Promise<void> {
    // Check if there's already data in the database
    const existingCategories = await db.select().from(categories);
    const existingStudies = await db.select().from(studies);
    
    if (existingCategories.length === 0 && existingStudies.length === 0) {
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
        category: "Cardiovascular Health",
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
        category: "Neurodegenerative Diseases",
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
        category: "Metabolism & Diabetes",
        methods: "Sixty-five patients with type 2 diabetes were randomly assigned to consume either hydrogen-rich water (600 mL daily) or placebo water for 12 weeks. Primary outcomes included changes in fasting blood glucose, HbA1c, and insulin resistance (HOMA-IR). Secondary outcomes included lipid profiles, inflammatory markers, and oxidative stress parameters.",
        results: "The hydrogen-rich water group demonstrated significant reductions in fasting blood glucose (-11.2 mg/dL, p=0.008), HbA1c (-0.4%, p=0.012), and HOMA-IR (-0.6, p=0.003) compared to the placebo group. Significant improvements were also observed in total antioxidant capacity (+14.5%, p<0.001) and reduced malondialdehyde levels (-18.7%, p<0.001). No significant changes were observed in lipid profiles between groups. No serious adverse events were reported.",
        conclusion: "Daily consumption of hydrogen-rich water for 12 weeks significantly improved glycemic control and insulin sensitivity in patients with type 2 diabetes. These benefits appear to be mediated, at least in part, through reduction of oxidative stress. Hydrogen-rich water may represent a simple, cost-effective adjunct therapy for managing type 2 diabetes. Larger studies with longer follow-up periods are warranted to confirm these findings and evaluate long-term effects.",
        doi: "10.2337/dc23-0542",
        peerReviewed: true
      }
    ];

    for (const study of sampleStudies) {
      await this.createStudy(study);
    }
  }
}