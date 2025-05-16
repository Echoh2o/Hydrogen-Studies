import { BaseScraper, ScraperSource } from './base-scraper';
import { PubMedScraper } from './pubmed-scraper';
import { InsertStudy } from '@shared/schema';
import { storage } from '../storage';

/**
 * Manager for handling multiple scraper sources
 */
export class ScraperManager {
  private scrapers: Map<ScraperSource, BaseScraper>;
  
  constructor() {
    this.scrapers = new Map();
    
    // Initialize scrapers
    this.scrapers.set('pubmed', new PubMedScraper());
    
    // TODO: Add other scrapers when implemented
    // this.scrapers.set('google-scholar', new GoogleScholarScraper());
    // this.scrapers.set('hydrogen-studies', new HydrogenStudiesScraper());
  }
  
  /**
   * Get a specific scraper by source
   */
  getScraper(source: ScraperSource): BaseScraper | undefined {
    return this.scrapers.get(source);
  }
  
  /**
   * Get all available scrapers
   */
  getAllScrapers(): BaseScraper[] {
    return Array.from(this.scrapers.values());
  }
  
  /**
   * Search articles from a specific source
   */
  async searchArticles(
    source: ScraperSource,
    query: string,
    options?: any
  ): Promise<any> {
    const scraper = this.scrapers.get(source);
    
    if (!scraper) {
      throw new Error(`Scraper for source "${source}" not found`);
    }
    
    return await scraper.searchArticles(query, options);
  }
  
  /**
   * Search articles from all available sources
   */
  async searchAllSources(
    query: string,
    options?: any
  ): Promise<Record<ScraperSource, any>> {
    const results: Record<ScraperSource, any> = {} as Record<ScraperSource, any>;
    
    // Search each source in parallel
    const searchPromises = Array.from(this.scrapers.entries()).map(
      async ([source, scraper]) => {
        try {
          const result = await scraper.searchArticles(query, options);
          results[source] = result;
        } catch (error) {
          console.error(`Error searching ${source}:`, error);
          results[source] = { error: true, message: `Failed to search ${source}` };
        }
      }
    );
    
    await Promise.all(searchPromises);
    
    return results;
  }
  
  /**
   * Process and approve an article to be added to the database
   */
  async approveAndSaveArticle(source: ScraperSource, article: any): Promise<{ success: boolean; study?: any; message?: string }> {
    try {
      const scraper = this.scrapers.get(source);
      
      if (!scraper) {
        throw new Error(`Scraper for source "${source}" not found`);
      }
      
      // For PubMed
      if (source === 'pubmed') {
        const pubmedScraper = scraper as PubMedScraper;
        const study = pubmedScraper.convertToStudy(article);
        
        // Check if study with this DOI or title already exists
        const existingStudies = await storage.getStudies({
          query: study.title
        });
        
        if (existingStudies.some(s => s.doi === study.doi && study.doi)) {
          return {
            success: false,
            message: 'A study with this DOI already exists in the database'
          };
        }
        
        if (existingStudies.some(s => 
          s.title.toLowerCase() === study.title.toLowerCase() && 
          s.authors.toLowerCase() === study.authors.toLowerCase()
        )) {
          return {
            success: false,
            message: 'A study with this title and authors already exists in the database'
          };
        }
        
        // Save the study
        const savedStudy = await storage.createStudy(study);
        
        return {
          success: true,
          study: savedStudy
        };
      }
      
      return {
        success: false,
        message: `Source "${source}" not supported for approval`
      };
      
    } catch (error: any) {
      console.error('Error approving article:', error);
      return {
        success: false,
        message: error.message || 'Failed to approve article'
      };
    }
  }
  
  /**
   * Bulk approve and save multiple articles
   */
  async bulkApproveArticles(source: ScraperSource, articles: any[]): Promise<{
    total: number;
    success: number;
    failed: number;
    savedStudies: any[];
    errors: string[];
  }> {
    const results = {
      total: articles.length,
      success: 0,
      failed: 0,
      savedStudies: [] as any[],
      errors: [] as string[]
    };
    
    for (const article of articles) {
      const result = await this.approveAndSaveArticle(source, article);
      
      if (result.success && result.study) {
        results.success++;
        results.savedStudies.push(result.study);
      } else {
        results.failed++;
        results.errors.push(result.message || 'Unknown error');
      }
    }
    
    return results;
  }
}

// Create and export a singleton instance
export const scraperManager = new ScraperManager();