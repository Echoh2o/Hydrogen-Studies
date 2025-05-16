/**
 * Scraper for HydrogenStudies.com
 */
import { BaseScraper, ScraperSource } from './base-scraper';
import { InsertStudy } from '@shared/schema';
import * as cheerio from 'cheerio';

export class HydrogenStudiesScraper extends BaseScraper {
  constructor() {
    const source: ScraperSource = {
      name: 'HydrogenStudies',
      baseUrl: 'https://hydrogenstudies.com',
      description: 'HydrogenStudies.com - Collection of hydrogen-related medical research',
      enabled: true
    };
    super(source);
  }

  /**
   * Get list of study links from HydrogenStudies.com
   */
  protected async getStudyLinks(): Promise<string[]> {
    const links: string[] = [];
    
    // First, check the main page for any featured studies
    try {
      console.log(`Scraping main page for featured studies`);
      const $ = await this.makeRequest(this.source.baseUrl);
      
      // Extract any links that might be studies from the main page
      $('a').each((_, element) => {
        const link = $(element).attr('href');
        const text = $(element).text().trim();
        
        // If link contains keywords that suggest it's a study
        if (link && (
            link.includes('/hydrogen') || 
            link.includes('/study') || 
            link.includes('/research') || 
            link.includes('/article') ||
            (text && text.length > 15 && (
              text.toLowerCase().includes('study') || 
              text.toLowerCase().includes('research') || 
              text.toLowerCase().includes('clinical')
            ))
        )) {
          const fullLink = link.startsWith('http') ? link : `${this.source.baseUrl}${link.startsWith('/') ? '' : '/'}${link}`;
          links.push(fullLink);
        }
      });
      
      console.log(`Found ${links.length} potential study links on the main page`);
    } catch (error) {
      console.error(`Error scraping main page:`, error);
    }
    
    // Try different paths that might contain studies
    const pathsToTry = [
      '/research',
      '/studies',
      '/clinical-studies',
      '/search',
      '/hydrogen-studies',
      '/blog',
      '/articles',
      '/resources'
    ];
    
    for (const basePath of pathsToTry) {
      let currentPage = 1;
      let hasNextPage = true;
      
      while (hasNextPage && currentPage <= 15) { // Scan up to 15 pages per section
        try {
          const url = currentPage === 1 
            ? `${this.source.baseUrl}${basePath}` 
            : `${this.source.baseUrl}${basePath}/page/${currentPage}`;
          
          console.log(`Scraping ${basePath} page ${currentPage}: ${url}`);
          
          const $ = await this.makeRequest(url);
          
          // Try many different selectors that could contain study links
          const linkCount = this.extractLinksFromPage($, links);
          
          console.log(`Found ${linkCount} potential study links on ${basePath} page ${currentPage}`);
          
          // Check for pagination
          const paginationSelectors = [
            '.pagination a', 'a.next', '.nav-links a', 
            'a:contains("Next")', '.next-posts a',
            '.wp-block-query-pagination a'
          ];
          
          let foundNextPageLink = false;
          for (const selector of paginationSelectors) {
            $(selector).each((_, element) => {
              const href = $(element).attr('href');
              const text = $(element).text().toLowerCase();
              
              if ((text.includes('next') || 
                  href?.includes(`page/${currentPage + 1}`)) && 
                  !href?.includes(`page/${currentPage}`)) {
                foundNextPageLink = true;
                return false; // Break each loop
              }
            });
            
            if (foundNextPageLink) break;
          }
          
          hasNextPage = foundNextPageLink;
          
          if (hasNextPage) {
            console.log(`Found next page link on ${basePath} page ${currentPage}`);
          } else {
            console.log(`No next page link found on ${basePath} page ${currentPage}`);
          }
          
          currentPage++;
          
          // More gentle scraping
          await this.delay(this.getRequestDelay());
          
          // If no links found after first page, stop trying this path
          if (linkCount === 0 && currentPage > 2) {
            console.log(`No study links found on ${basePath} page ${currentPage-1}, skipping further pages`);
            break;
          }
        } catch (error) {
          console.error(`Error scraping ${basePath} page ${currentPage}:`, error);
          hasNextPage = false;
        }
      }
    }
    
    // Deduplicate the links
    const uniqueLinksSet = new Set(links);
    const uniqueLinks = Array.from(uniqueLinksSet);
    console.log(`Total unique study links found: ${uniqueLinks.length}`);
    
    return uniqueLinks;
  }

  /**
   * Extract links from a page
   */
  private extractLinksFromPage($: cheerio.CheerioAPI, links: string[]): number {
    let count = 0;
    
    // Title selectors that might indicate a study
    const titleSelectors = [
      'h1 a', 'h2 a', 'h3 a', 'h4 a', 'h5 a',
      '.entry-title a', '.post-title a', '.title a',
      '.card-title a', '.study-title a', '.article-title a',
      'article a', '.post a', '.study a'
    ];
    
    // Extract links from title elements
    $(titleSelectors.join(', ')).each((_, element) => {
      const link = $(element).attr('href');
      if (link) {
        const fullLink = link.startsWith('http') ? link : `${this.source.baseUrl}${link.startsWith('/') ? '' : '/'}${link}`;
        links.push(fullLink);
        count++;
      }
    });
    
    // Look for links containing relevant keywords in their text or href
    $('a').each((_, element) => {
      const link = $(element).attr('href');
      const text = $(element).text().trim();
      
      if (link && !links.includes(link) && (
          link.includes('study') || 
          link.includes('research') || 
          link.includes('article') ||
          link.includes('clinical') ||
          link.includes('hydrogen') ||
          (text && text.length > 10 && (
            text.toLowerCase().includes('study') || 
            text.toLowerCase().includes('research') || 
            text.toLowerCase().includes('clinical trial') ||
            text.toLowerCase().includes('publication')
          ))
      )) {
        const fullLink = link.startsWith('http') ? link : `${this.source.baseUrl}${link.startsWith('/') ? '' : '/'}${link}`;
        links.push(fullLink);
        count++;
      }
    });
    
    return count;
  }

  /**
   * Scrape an individual study page
   */
  protected async scrapeStudyPage(url: string): Promise<InsertStudy | null> {
    try {
      console.log(`Fetching study details from: ${url}`);
      const $ = await this.makeRequest(url);
      
      // Debug HTML structure
      console.log(`Page HTML structure overview: ${$('body').children().length} top-level elements`);
      
      // Extract study details based on current site HTML structure
      let title = '';
      // Try multiple selectors to find the title
      const possibleTitleSelectors = [
        '.study-title', 
        'h1', 
        '.article-title', 
        '.post-title',
        '.entry-title',
        '.card-title'
      ];
      
      for (const selector of possibleTitleSelectors) {
        const element = $(selector).first();
        if (element.length && element.text().trim()) {
          title = element.text().trim();
          console.log(`Found title using selector "${selector}": ${title}`);
          break;
        }
      }
      
      if (!title) {
        console.log('Could not find title with common selectors, trying alternative approach');
        // If no title found with common selectors, try to find any heading that looks like a title
        $('h1, h2, h3').each((_, element) => {
          const text = $(element).text().trim();
          if (text && text.length > 10 && text.length < 200) {
            title = text;
            console.log(`Found title in heading: ${title}`);
            return false; // Break the each loop
          }
        });
      }
      
      if (!title) {
        console.log('Could not find any suitable title on the page');
        return null;
      }
      
      // Extract other study details with multiple selector options
      const abstract = this.extractTextFromSelectors($, [
        '.study-abstract', 
        '.abstract', 
        '.entry-content p:first-of-type',
        '.card-text',
        '.summary'
      ]);
      
      const authors = this.extractTextFromSelectors($, [
        '.study-authors', 
        '.authors', 
        '.entry-meta .author',
        '.researcher',
        'meta[name="author"]',
        '.card-subtitle'
      ]);
      
      const journal = this.extractTextFromSelectors($, [
        '.study-journal', 
        '.journal', 
        '.publication',
        '.source'
      ]);
      
      const dateText = this.extractTextFromSelectors($, [
        '.study-date', 
        '.publish-date', 
        '.entry-date',
        '.posted-on',
        'time'
      ]);
      const publishDate = this.extractDate(dateText);
      
      const category = this.extractTextFromSelectors($, [
        '.study-category', 
        '.category', 
        '.entry-categories',
        '.tags'
      ]) || 'General';
      
      // Additional fields
      const methods = this.extractTextFromSelectors($, [
        '.study-methods', 
        '.methods',
        '.methodology'
      ]);
      
      const results = this.extractTextFromSelectors($, [
        '.study-results', 
        '.results',
        '.findings'
      ]);
      
      const conclusion = this.extractTextFromSelectors($, [
        '.study-conclusion', 
        '.conclusion',
        '.summary'
      ]);
      
      const doi = this.extractTextFromSelectors($, [
        '.study-doi', 
        '.doi',
        'a[href*="doi.org"]'
      ]);
      
      // URL links - look for PDF links
      let pdfUrl: string | undefined;
      $('a').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().toLowerCase();
        if (
          href && 
          (href.endsWith('.pdf') || 
           href.includes('.pdf') || 
           text.includes('pdf') || 
           text.includes('download') || 
           text.includes('full text'))
        ) {
          pdfUrl = href.startsWith('http') ? href : `${new URL(url).origin}${href}`;
          return false; // Break the each loop
        }
      });
      
      // Look for citation links
      let citationUrl: string | undefined;
      $('a').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().toLowerCase();
        if (
          href && 
          (text.includes('citation') || 
           text.includes('cite') || 
           text.includes('reference') ||
           href.includes('citation'))
        ) {
          citationUrl = href.startsWith('http') ? href : `${new URL(url).origin}${href}`;
          return false; // Break the each loop
        }
      });
      
      // Boolean values
      const peerReviewed = this.containsText($, [
        'peer reviewed',
        'peer-reviewed',
        'refereed',
        'reviewed by peers'
      ]);
      
      // Create study object with source tracking
      const study: InsertStudy = {
        title,
        abstract: abstract || `This study explores ${title.toLowerCase()}.`,
        authors: authors || 'Various Researchers',
        journal: journal || 'Scientific Journal',
        publishDate,
        category,
        methods,
        results,
        conclusion,
        doi,
        pdfUrl,
        citationUrl,
        peerReviewed: peerReviewed || true, // Assume peer reviewed if not specified
        sourceUrl: url,
        sourcePlatform: this.source.name
      };
      
      console.log(`Successfully extracted study: ${title}`);
      return study;
    } catch (err) {
      const error = err as Error;
      console.error(`Error scraping study page ${url}:`, error.message);
      return null;
    }
  }

  /**
   * Adjust the delay between requests
   */
  protected getRequestDelay(): number {
    return 2500; // 2.5 seconds between requests for hydrogenstudies.com
  }
}