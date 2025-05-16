/**
 * Scraper for PubMed medical research database
 * Specifically focused on hydrogen-related research studies
 */
import { BaseScraper, ScraperSource } from './base-scraper';
import { InsertStudy } from '@shared/schema';
import * as cheerio from 'cheerio';

export class PubMedScraper extends BaseScraper {
  constructor() {
    const source: ScraperSource = {
      name: 'PubMed',
      baseUrl: 'https://pubmed.ncbi.nlm.nih.gov',
      description: 'PubMed - National Library of Medicine database of biomedical literature',
      enabled: true
    };
    super(source);
  }

  /**
   * Get list of study links from PubMed relating to hydrogen research
   */
  protected async getStudyLinks(): Promise<string[]> {
    const searchTerms = [
      'hydrogen+water',
      'molecular+hydrogen+therapy',
      'hydrogen+gas+medicine',
      'hydrogen+rich+water',
      'hydrogen+medicine',
      'hydrogen+therapy',
      'hydrogen+therapeutic',
      'h2+antioxidant',
      'hydrogen+oxidative+stress',
      'hydrogen+inflammation'
    ];
    
    const links: string[] = [];
    
    for (const searchTerm of searchTerms) {
      let page = 1;
      let hasMoreResults = true;
      
      while (hasMoreResults && page <= 5) { // Limit to 5 pages per search term to avoid overwhelming
        try {
          const searchUrl = `${this.source.baseUrl}/search/?term=${searchTerm}&page=${page}`;
          console.log(`Searching PubMed: ${searchUrl}`);
          
          const $ = await this.makeRequest(searchUrl);
          
          // Extract article links from search results
          const articleLinks = $('.docsum-title');
          
          if (articleLinks.length === 0) {
            console.log(`No more results for search term: ${searchTerm}`);
            hasMoreResults = false;
            break;
          }
          
          console.log(`Found ${articleLinks.length} results on page ${page} for term ${searchTerm}`);
          
          articleLinks.each((_, element) => {
            const href = $(element).attr('href');
            if (href) {
              const fullUrl = `${this.source.baseUrl}${href}`;
              links.push(fullUrl);
            }
          });
          
          // Check if there's a next page
          const nextPageLink = $('.next-page-link');
          if (nextPageLink.length === 0) {
            hasMoreResults = false;
          }
          
          page++;
          
          // Be gentle with the API
          await this.delay(3000);
        } catch (err) {
          const error = err as Error; 
          console.error(`Error fetching PubMed search results for term ${searchTerm}, page ${page}:`, error.message);
          hasMoreResults = false;
        }
      }
    }
    
    // Remove duplicates
    const uniqueLinks = Array.from(new Set(links));
    console.log(`Found ${uniqueLinks.length} unique study links on PubMed`);
    
    return uniqueLinks;
  }

  /**
   * Extract study details from a PubMed article page
   */
  protected async scrapeStudyPage(url: string): Promise<InsertStudy | null> {
    try {
      console.log(`Fetching study details from PubMed: ${url}`);
      const $ = await this.makeRequest(url);
      
      // Extract the PMID from the URL
      const pmidMatch = url.match(/\/(\d+)\/?$/);
      const pmid = pmidMatch ? pmidMatch[1] : '';
      
      // Extract title
      const title = $('.heading-title').text().trim();
      if (!title) {
        console.log('Could not find title on PubMed page');
        return null;
      }
      
      // Extract authors
      let authors = '';
      $('.authors-list .authors-list-item').each((i, element) => {
        const author = $(element).find('.full-name').text().trim();
        if (author) {
          authors += (i > 0 ? ', ' : '') + author;
        }
      });
      
      // If no structured authors found, try alternative selectors
      if (!authors) {
        authors = $('.authors-list').text().trim();
      }
      
      // Extract abstract
      let abstract = '';
      $('.abstract-content p').each((_, element) => {
        abstract += $(element).text().trim() + ' ';
      });
      abstract = abstract.trim();
      
      // Extract journal info
      const journal = $('.journal-citation').text().trim();
      
      // Extract publication date
      let publishDate = '';
      const pubDateElement = $('.publish-date');
      if (pubDateElement.length) {
        publishDate = pubDateElement.text().trim();
      } else {
        // Try alternative date format
        const pubDateAlt = $('.cit').text().match(/(\d{4})\s+[A-Za-z]+\s*;/);
        if (pubDateAlt) {
          publishDate = pubDateAlt[1];
        }
      }
      
      // Format the date to ISO string
      const formattedDate = this.formatPublicationDate(publishDate);
      
      // Extract DOI
      let doi = '';
      $('.identifier.doi').each((_, element) => {
        const doiText = $(element).text().trim();
        if (doiText.includes('doi:')) {
          doi = doiText.replace('doi:', '').trim();
        }
      });
      
      // Extract keywords (tagged terms)
      const keywords: string[] = [];
      $('.keywords-list .keyword-actions-trigger').each((_, element) => {
        keywords.push($(element).text().trim());
      });
      
      const category = keywords.length > 0 ? keywords[0] : 'Hydrogen Research';
      
      // Extract methods and results sections if they exist
      const methodsSection = this.extractSection($, 'methods');
      const resultsSection = this.extractSection($, 'results');
      const conclusionSection = this.extractSection($, 'conclusion');
      
      // PDF link (if available)
      let pdfUrl: string | undefined;
      $('.links-navbar a').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().toLowerCase();
        if (href && (text.includes('full text') || text.includes('pdf'))) {
          pdfUrl = href.startsWith('http') ? href : `https://doi.org/${doi}`;
        }
      });
      
      // Create citation URL
      const citationUrl = `${this.source.baseUrl}/${pmid}/cite/`;
      
      // Determine if peer reviewed (assume all PubMed articles are peer reviewed)
      const peerReviewed = true;
      
      // Create the study object
      const study: InsertStudy = {
        title,
        abstract: abstract || `Study published in ${journal} with PMID ${pmid}`,
        authors: authors || 'PubMed Authors',
        journal: journal || 'Scientific Journal',
        publishDate: formattedDate,
        category,
        methods: methodsSection,
        results: resultsSection,
        conclusion: conclusionSection,
        doi,
        pdfUrl,
        citationUrl,
        peerReviewed,
        sourceUrl: url,
        sourcePlatform: this.source.name
      };
      
      console.log(`Successfully extracted PubMed study: ${title}`);
      return study;
    } catch (err) {
      const error = err as Error;
      console.error(`Error scraping PubMed study at ${url}:`, error.message);
      return null;
    }
  }
  
  /**
   * Helper function to extract specific sections like methods, results, conclusion
   */
  private extractSection($: cheerio.CheerioAPI, sectionName: string): string {
    let sectionText = '';
    
    // Try to find labeled sections
    $('.abstract-content').find('p, div').each((_, element) => {
      const text = $(element).text().trim();
      const label = $(element).find('.label').text().toLowerCase();
      
      if (label && label.includes(sectionName)) {
        sectionText = text.replace(label, '').trim();
        return false; // Break the loop
      }
      
      // Look for strong/b tags that might indicate sections
      const strongLabel = $(element).find('strong, b').text().toLowerCase();
      if (strongLabel && strongLabel.includes(sectionName)) {
        sectionText = text.replace(strongLabel, '').trim();
        return false;
      }
    });
    
    return sectionText;
  }
  
  /**
   * Format publication date to ISO string
   */
  private formatPublicationDate(dateText: string): string {
    if (!dateText) return new Date().toISOString();
    
    try {
      // Try to parse various PubMed date formats
      // Format: "2022 Jan 15"
      const dateMatch = dateText.match(/(\d{4})\s+([A-Za-z]+)\s+(\d{1,2})/);
      if (dateMatch) {
        const year = dateMatch[1];
        const month = this.getMonthNumber(dateMatch[2]);
        const day = dateMatch[3].padStart(2, '0');
        return new Date(`${year}-${month}-${day}`).toISOString();
      }
      
      // Format: "2022 Jan"
      const monthYearMatch = dateText.match(/(\d{4})\s+([A-Za-z]+)/);
      if (monthYearMatch) {
        const year = monthYearMatch[1];
        const month = this.getMonthNumber(monthYearMatch[2]);
        return new Date(`${year}-${month}-01`).toISOString();
      }
      
      // Format: "2022"
      const yearMatch = dateText.match(/(\d{4})/);
      if (yearMatch) {
        return new Date(`${yearMatch[1]}-01-01`).toISOString();
      }
    } catch (e) {
      console.log(`Error parsing PubMed date: ${dateText}`);
    }
    
    // Default to current date if parsing fails
    return new Date().toISOString();
  }
  
  /**
   * Convert month name to month number
   */
  private getMonthNumber(monthName: string): string {
    const months: Record<string, string> = {
      'jan': '01', 'january': '01',
      'feb': '02', 'february': '02',
      'mar': '03', 'march': '03',
      'apr': '04', 'april': '04',
      'may': '05',
      'jun': '06', 'june': '06',
      'jul': '07', 'july': '07',
      'aug': '08', 'august': '08',
      'sep': '09', 'september': '09', 'sept': '09',
      'oct': '10', 'october': '10',
      'nov': '11', 'november': '11',
      'dec': '12', 'december': '12'
    };
    
    const monthLower = monthName.toLowerCase();
    return months[monthLower] || '01';
  }
  
  /**
   * Use a longer delay for PubMed to avoid hitting rate limits
   */
  protected getRequestDelay(): number {
    return 5000; // 5 seconds between requests
  }
}