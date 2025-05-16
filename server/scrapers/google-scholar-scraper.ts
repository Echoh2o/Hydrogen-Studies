/**
 * Scraper for Google Scholar academic research
 * Specifically focused on hydrogen-related research studies
 */
import { BaseScraper, ScraperSource } from './base-scraper';
import { InsertStudy } from '@shared/schema';
import * as cheerio from 'cheerio';

export class GoogleScholarScraper extends BaseScraper {
  constructor() {
    const source: ScraperSource = {
      name: 'GoogleScholar',
      baseUrl: 'https://scholar.google.com',
      description: 'Google Scholar - Comprehensive database of academic research',
      enabled: true
    };
    super(source);
  }

  /**
   * Get list of study links from Google Scholar relating to hydrogen research
   */
  protected async getStudyLinks(): Promise<string[]> {
    const searchTerms = [
      'hydrogen+water+therapeutic',
      'molecular+hydrogen+therapy',
      'hydrogen+gas+medicine',
      'hydrogen+rich+water+health',
      'hydrogen+medicine+clinical',
      'hydrogen+therapy+disease',
      'hydrogen+therapeutic+effects',
      'hydrogen+oxidative+stress',
      'hydrogen+inflammation+treatment',
      'hydrogen+antioxidant+effects'
    ];
    
    const links: string[] = [];
    
    for (const searchTerm of searchTerms) {
      let page = 0;
      let hasMoreResults = true;
      
      while (hasMoreResults && page < 3) { // Limit to 3 pages per search term to avoid being blocked
        try {
          const start = page * 10; // Google Scholar shows 10 results per page
          const searchUrl = `${this.source.baseUrl}/scholar?q=${searchTerm}&start=${start}`;
          console.log(`Searching Google Scholar: ${searchUrl}`);
          
          const $ = await this.makeRequest(searchUrl);
          
          // Extract article links from search results
          const articleLinks = $('.gs_ri .gs_rt a');
          
          if (articleLinks.length === 0) {
            console.log(`No more results for search term: ${searchTerm}`);
            hasMoreResults = false;
            break;
          }
          
          console.log(`Found ${articleLinks.length} results on page ${page} for term ${searchTerm}`);
          
          articleLinks.each((_, element) => {
            const href = $(element).attr('href');
            if (href) {
              // Google Scholar may have direct links or redirects
              links.push(href);
            }
          });
          
          // Check if there's a next page button
          const nextPageLink = $('.gs_btnPR');
          if (nextPageLink.length === 0) {
            hasMoreResults = false;
          }
          
          page++;
          
          // Be very gentle with Google Scholar to avoid being blocked
          await this.delay(this.getRequestDelay());
        } catch (err) {
          const error = err as Error; 
          console.error(`Error fetching Google Scholar results for term ${searchTerm}, page ${page}:`, error.message);
          hasMoreResults = false;
        }
      }
      
      // Add a longer delay between search terms
      await this.delay(30000); // 30 seconds between search terms
    }
    
    // Remove duplicates
    const uniqueLinksSet = new Set(links);
    const uniqueLinks = Array.from(uniqueLinksSet);
    console.log(`Found ${uniqueLinks.length} unique study links on Google Scholar`);
    
    return uniqueLinks;
  }

  /**
   * Extract study details from a Google Scholar page or linked article
   */
  protected async scrapeStudyPage(url: string): Promise<InsertStudy | null> {
    try {
      console.log(`Fetching study details from Google Scholar: ${url}`);
      
      // Note: Most Google Scholar links point to external sources
      // This function attempts to extract basic information then follows the link if possible
      
      let $ = await this.makeRequest(url);
      
      // Try to extract title
      let title = $('title').text().trim();
      
      // If we're on a Google Scholar page, we need to extract the actual paper link
      if (url.includes('scholar.google.com')) {
        // This is a Google Scholar page, extract the first link
        const paperLink = $('.gs_or_ggsm a, .gs_rt a').first().attr('href');
        
        if (paperLink) {
          console.log(`Following link to external source: ${paperLink}`);
          
          try {
            $ = await this.makeRequest(paperLink);
            url = paperLink; // Update URL to the actual paper URL
          } catch (err) {
            console.log(`Could not access external source: ${paperLink}, using Google Scholar data only`);
          }
        }
      }
      
      // Try to extract data from the page (either Google Scholar or external page)
      title = title || $('h1').first().text().trim();
      
      if (!title || title === 'Google Scholar') {
        console.log('Could not find title on page');
        return null;
      }
      
      // Extract abstract
      let abstract = '';
      
      // Try different common abstract selectors
      const abstractSelectors = [
        '.abstract, [name="description"], meta[name="description"]',
        '#abstract, .paper-abstract',
        '.summary, .paper-summary',
        'div[role="main"] p:first-of-type',
        'p.first, .first-paragraph',
        'section.abstract'
      ];
      
      for (const selector of abstractSelectors) {
        const abstractElement = $(selector).first();
        if (abstractElement.length) {
          abstract = abstractElement.text().trim();
          if (abstract) break;
        }
      }
      
      // If we still don't have an abstract, try the first paragraph
      if (!abstract) {
        $('p').each((_, element) => {
          const text = $(element).text().trim();
          if (text.length > 100 && text.length < 2000) {
            abstract = text;
            return false; // Break the each loop
          }
        });
      }
      
      // Extract authors
      let authors = '';
      
      // Try different common author selectors
      const authorSelectors = [
        '.author, .authors, .contributors',
        '[name="author"], meta[name="author"]',
        '.byline, .byline a',
        '.meta-authors'
      ];
      
      for (const selector of authorSelectors) {
        const authorElement = $(selector);
        if (authorElement.length) {
          authors = authorElement.text().trim().replace(/\s+/g, ' ');
          if (authors) break;
        }
      }
      
      // Extract publication date
      let publishDate = '';
      
      // Try different common date selectors
      const dateSelectors = [
        '.date, .published-date, .publication-date',
        '[name="date"], meta[name="date"]',
        '.meta-date',
        'time'
      ];
      
      for (const selector of dateSelectors) {
        const dateElement = $(selector);
        if (dateElement.length) {
          publishDate = dateElement.text().trim();
          if (publishDate) break;
        }
      }
      
      // Format the date
      const formattedDate = this.extractDate(publishDate);
      
      // Extract journal name
      let journal = '';
      
      // Try different common journal selectors
      const journalSelectors = [
        '.journal, .publication, .source',
        '[name="citation_journal_title"], meta[name="citation_journal_title"]',
        '.meta-journal'
      ];
      
      for (const selector of journalSelectors) {
        const journalElement = $(selector);
        if (journalElement.length) {
          journal = journalElement.text().trim();
          if (journal) break;
        }
      }
      
      // Extract DOI if available
      let doi = '';
      
      // Look for DOI pattern in text or metadata
      const doiSelectors = [
        '[name="citation_doi"], meta[name="citation_doi"]',
        '.doi',
        'a[href*="doi.org"]'
      ];
      
      for (const selector of doiSelectors) {
        const doiElement = $(selector);
        if (doiElement.length) {
          const doiText = doiElement.attr('content') || doiElement.text().trim();
          if (doiText && (doiText.includes('10.') || doiText.includes('doi:'))) {
            doi = doiText.replace('doi:', '').trim();
            break;
          }
        }
      }
      
      // Search for any DOI pattern in the page if not found already
      if (!doi) {
        const bodyText = $('body').text();
        const doiMatch = bodyText.match(/\b(10\.\d{4,}\/[-._;()/:A-Za-z0-9]+)\b/);
        if (doiMatch) {
          doi = doiMatch[1];
        }
      }
      
      // Look for PDF links
      let pdfUrl: string | undefined;
      
      $('a').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().toLowerCase();
        
        if (href && (
          href.endsWith('.pdf') || 
          href.includes('.pdf') || 
          text.includes('pdf') || 
          text.includes('download') || 
          text.includes('full text')
        )) {
          pdfUrl = href.startsWith('http') ? href : new URL(href, url).href;
          return false; // Break the each loop
        }
      });
      
      // Create the study object
      const study: InsertStudy = {
        title,
        abstract: abstract || `This study explores ${title.toLowerCase()}. Source: Google Scholar.`,
        authors: authors || 'Multiple authors',
        journal: journal || 'Academic Journal',
        publishDate: formattedDate,
        category: 'Hydrogen Research',
        peerReviewed: true, // Assume peer-reviewed for academic sources
        doi,
        pdfUrl,
        sourceUrl: url,
        sourcePlatform: this.source.name
      };
      
      console.log(`Successfully extracted Google Scholar study: ${title}`);
      return study;
    } catch (err) {
      const error = err as Error;
      console.error(`Error scraping Google Scholar study at ${url}:`, error.message);
      return null;
    }
  }
  
  /**
   * Use a longer delay for Google Scholar to avoid being blocked
   */
  protected getRequestDelay(): number {
    return 10000; // 10 seconds between requests
  }
}