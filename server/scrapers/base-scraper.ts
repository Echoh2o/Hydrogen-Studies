/**
 * Base scraper class for research platforms
 * Provides common functionality for all research platform scrapers
 */
import { InsertStudy, scrapedSources } from '@shared/schema';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { storage } from '../storage';
import { db } from '../db';
import { eq } from 'drizzle-orm';

export interface ScraperSource {
  name: string;
  baseUrl: string;
  description: string;
  enabled: boolean;
}

export abstract class BaseScraper {
  public readonly source: ScraperSource;
  protected userAgent: string = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  
  constructor(source: ScraperSource) {
    this.source = source;
  }
  
  /**
   * Execute the scraper to find and extract studies
   */
  public async execute(): Promise<{ total: number; success: number }> {
    console.log(`Starting scraper for ${this.source.name}...`);
    
    try {
      // Get list of study links to scrape
      const studyLinks = await this.getStudyLinks();
      console.log(`Found ${studyLinks.length} potential studies to scrape from ${this.source.name}`);
      
      // Filter out already scraped sources
      const newLinks = await this.filterAlreadyScrapedSources(studyLinks);
      console.log(`${newLinks.length} new studies to scrape from ${this.source.name}`);
      
      // Scrape each study
      let successCount = 0;
      for (let i = 0; i < newLinks.length; i++) {
        const link = newLinks[i];
        try {
          console.log(`Scraping study ${i + 1}/${newLinks.length}: ${link}`);
          const study = await this.scrapeStudyPage(link);
          
          if (study) {
            // Create the study in the database
            const createdStudy = await storage.createStudy(study);
            
            // Record that we've scraped this source
            await this.recordScrapedSource(link, createdStudy.id);
            
            successCount++;
            console.log(`Successfully imported study: ${study.title}`);
          }
        } catch (err) {
          const error = err as Error;
          console.error(`Error scraping study at ${link}: ${error.message}`);
        }
        
        // Delay between requests to avoid overloading the server
        await this.delay(this.getRequestDelay());
      }
      
      console.log(`Scraping complete for ${this.source.name}. Successfully imported ${successCount} studies.`);
      return { total: newLinks.length, success: successCount };
    } catch (err) {
      const error = err as Error;
      console.error(`Error executing scraper for ${this.source.name}:`, error);
      throw error;
    }
  }
  
  /**
   * Get a list of URLs to study pages that should be scraped
   * This needs to be implemented by each specific scraper
   */
  protected abstract getStudyLinks(): Promise<string[]>;
  
  /**
   * Extract study details from a specific page
   * This needs to be implemented by each specific scraper
   */
  protected abstract scrapeStudyPage(url: string): Promise<InsertStudy | null>;
  
  /**
   * Get the delay between requests (ms)
   * Can be overridden by specific scrapers
   */
  protected getRequestDelay(): number {
    return 2000; // Default 2 seconds
  }
  
  /**
   * Make an HTTP request with appropriate headers
   */
  protected async makeRequest(url: string): Promise<cheerio.CheerioAPI> {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    return cheerio.load(response.data);
  }
  
  /**
   * Helper to delay execution
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Filter out URLs that have already been scraped
   */
  private async filterAlreadyScrapedSources(urls: string[]): Promise<string[]> {
    // Get all already scraped sources for this platform
    const scrapedUrls = await db.select()
      .from(scrapedSources)
      .where(eq(scrapedSources.sourcePlatform, this.source.name));
    
    // Extract just the URLs
    const existingUrls = new Set(scrapedUrls.map(item => item.sourceUrl));
    
    // Filter out URLs we've already scraped
    return urls.filter(url => !existingUrls.has(url));
  }
  
  /**
   * Record that we've scraped a particular source
   */
  private async recordScrapedSource(url: string, studyId: number): Promise<void> {
    await db.insert(scrapedSources)
      .values({
        sourceUrl: url,
        sourcePlatform: this.source.name,
        studyId: studyId,
        scrapedAt: new Date(),
      });
  }
  
  /**
   * Helper function to extract text from multiple possible selectors
   */
  protected extractTextFromSelectors($: cheerio.CheerioAPI, selectors: string[]): string {
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length) {
        const text = element.text().trim();
        if (text) {
          return text;
        }
      }
    }
    return '';
  }
  
  /**
   * Helper function to check if page contains specific text
   */
  protected containsText($: cheerio.CheerioAPI, textOptions: string[]): boolean {
    const bodyText = $('body').text().toLowerCase();
    return textOptions.some(text => bodyText.includes(text.toLowerCase()));
  }
  
  /**
   * Helper function to extract a date from a text string
   */
  protected extractDate(dateText: string): string {
    if (!dateText) return new Date().toISOString();
    
    // Try to parse the date text
    try {
      // Look for common date formats in the text
      const dateMatch = dateText.match(/(\d{1,2}\/\d{1,2}\/\d{4})|(\d{4}-\d{1,2}-\d{1,2})|(\w+ \d{1,2},? \d{4})/);
      if (dateMatch) {
        const dateString = dateMatch[0];
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
      
      // If we can extract just a year
      const yearMatch = dateText.match(/\d{4}/);
      if (yearMatch) {
        const year = parseInt(yearMatch[0]);
        if (year >= 1900 && year <= new Date().getFullYear()) {
          return new Date(`${year}-01-01`).toISOString();
        }
      }
    } catch (e) {
      console.log(`Error parsing date: ${dateText}`);
    }
    
    // Default to current date if parsing fails
    return new Date().toISOString();
  }
}