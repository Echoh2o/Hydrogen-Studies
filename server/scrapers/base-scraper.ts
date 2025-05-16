/**
 * Supported scraper sources
 */
export type ScraperSource = 'pubmed' | 'google-scholar' | 'hydrogen-studies';

/**
 * Base scraper class with common functionality for all scrapers
 */
export abstract class BaseScraper {
  protected source: ScraperSource;
  protected userAgents: string[];
  
  constructor(source: ScraperSource) {
    this.source = source;
    
    // List of user agents to rotate through
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.101 Safari/537.36'
    ];
  }
  
  /**
   * Generate headers with a random user agent to mimic browser behavior
   * This helps avoid being blocked by anti-scraping measures
   */
  protected getRandomizedHeaders(): Record<string, string> {
    const randomUserAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    
    return {
      'User-Agent': randomUserAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0'
    };
  }
  
  /**
   * Add random delay between requests to avoid detection
   */
  protected async randomDelay(minMs: number = 1000, maxMs: number = 3000): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return new Promise(resolve => setTimeout(resolve, delay));
  }
  
  /**
   * Extract text content from HTML
   */
  protected cleanHtmlContent(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
      .replace(/\s+/g, ' ')      // Replace multiple spaces with a single space
      .trim();                   // Trim leading/trailing spaces
  }
  
  /**
   * Abstract methods that must be implemented by derived classes
   */
  abstract searchArticles(query: string, options?: any): Promise<any>;
}