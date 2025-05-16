/**
 * Direct scraper for a specific URL
 * This allows us to test scraping a known page that contains a hydrogen study
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { InsertStudy } from '@shared/schema';
import { storage } from './storage';

// Modern browser user-agent
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Extract study from a specific URL
 */
export async function scrapeStudyFromUrl(url: string): Promise<InsertStudy | null> {
  try {
    console.log(`Fetching study from URL: ${url}`);
    
    // Add randomization to request timing
    await delay(Math.floor(Math.random() * 1000) + 500);
    
    // Make request with full browser headers
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="120", "Chromium";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
        'Referer': 'https://www.google.com/'
      },
      timeout: 30000,
      maxRedirects: 5
    });
    
    const $ = cheerio.load(response.data);
    console.log(`Successfully loaded page from ${url}`);
    
    // Log the page structure to understand what we're working with
    console.log(`Page structure: ${$('body').children().length} top-level elements`);
    
    // Try to extract title from various possible elements
    const titleSelectors = [
      '.entry-title', 'h1.title', 'h1', '.post-title', 
      'article h1', '.article-title', 'header h1'
    ];
    
    let title = '';
    for (const selector of titleSelectors) {
      const element = $(selector).first();
      if (element.length) {
        title = element.text().trim();
        console.log(`Found title using selector "${selector}": ${title}`);
        break;
      }
    }
    
    if (!title) {
      console.log('Could not find title, trying alternative approach');
      // If no title found, try any heading that might be a title
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
    
    // Extract abstract - try content elements
    let abstract = '';
    const abstractSelectors = [
      '.entry-content p:first-of-type', 
      'article p:first-of-type',
      '.post-content p:first-of-type',
      '.study-abstract',
      '.abstract'
    ];
    
    for (const selector of abstractSelectors) {
      const element = $(selector);
      if (element.length) {
        abstract = element.text().trim();
        if (abstract && abstract.length > 50) {
          console.log(`Found abstract using selector "${selector}"`);
          break;
        }
      }
    }
    
    // If still no abstract, try to concatenate first few paragraphs
    if (!abstract || abstract.length < 100) {
      let abstractText = '';
      $('article p, .entry-content p, .content p').slice(0, 3).each((_, element) => {
        abstractText += $(element).text().trim() + ' ';
      });
      
      if (abstractText.length > abstract.length) {
        abstract = abstractText.trim();
        console.log('Created abstract from first few paragraphs');
      }
    }
    
    // Extract authors
    let authors = '';
    const authorSelectors = [
      '.author', '.post-author', '.entry-author',
      '.study-authors', '.byline', 'meta[name="author"]'
    ];
    
    for (const selector of authorSelectors) {
      const element = $(selector);
      if (element.length) {
        authors = element.text().trim();
        if (authors) {
          console.log(`Found authors using selector "${selector}": ${authors}`);
          break;
        }
      }
    }
    
    // Extract journal/source
    let journal = '';
    const journalSelectors = [
      '.journal', '.source', '.study-journal',
      '.publication-source', '.citation-source'
    ];
    
    for (const selector of journalSelectors) {
      const element = $(selector);
      if (element.length) {
        journal = element.text().trim();
        if (journal) {
          console.log(`Found journal using selector "${selector}": ${journal}`);
          break;
        }
      }
    }
    
    // Extract publication date
    let publishDate = '';
    const dateSelectors = [
      '.date', '.published-date', '.post-date',
      '.entry-date', 'time', '.study-date'
    ];
    
    for (const selector of dateSelectors) {
      const element = $(selector);
      if (element.length) {
        publishDate = element.text().trim();
        if (publishDate) {
          console.log(`Found publish date using selector "${selector}": ${publishDate}`);
          break;
        }
      }
    }
    
    // Format the date to ISO string
    const formattedDate = formatPublicationDate(publishDate);
    
    // Look for DOI
    let doi = '';
    const doiSelectors = ['.doi', 'a[href*="doi.org"]'];
    
    for (const selector of doiSelectors) {
      const element = $(selector);
      if (element.length) {
        const doiText = element.text().trim() || element.attr('href');
        if (doiText) {
          doi = doiText.replace('doi:', '').replace('https://doi.org/', '').trim();
          console.log(`Found DOI: ${doi}`);
          break;
        }
      }
    }
    
    // Extract category
    let category = '';
    const categorySelectors = [
      '.category', '.categories', '.post-categories',
      '.entry-categories', '.tags'
    ];
    
    for (const selector of categorySelectors) {
      const element = $(selector);
      if (element.length) {
        category = element.text().trim();
        if (category) {
          console.log(`Found category using selector "${selector}": ${category}`);
          break;
        }
      }
    }
    
    if (!category) {
      category = 'Hydrogen Research';
    }
    
    // Determine if the study appears to be peer-reviewed
    const peerReviewed = isPeerReviewed($);
    
    // Create study object
    const study: InsertStudy = {
      title,
      abstract: abstract || `This study explores ${title.toLowerCase()}.`,
      authors: authors || 'Various Researchers',
      journal: journal || 'Scientific Journal',
      publishDate: formattedDate,
      category,
      peerReviewed,
      sourceUrl: url,
      sourcePlatform: 'HydrogenStudies'
    };
    
    console.log(`Successfully extracted study: ${title}`);
    return study;
  } catch (err) {
    const error = err as Error;
    console.error(`Error scraping study from URL ${url}:`, error.message);
    return null;
  }
}

/**
 * Try to save a directly scraped study
 */
export async function saveScrapedStudy(url: string): Promise<{ success: boolean, message: string, study?: any }> {
  try {
    const study = await scrapeStudyFromUrl(url);
    
    if (!study) {
      return { 
        success: false, 
        message: 'Failed to extract study from the provided URL' 
      };
    }
    
    // Save the study to database
    const savedStudy = await storage.createStudy(study);
    
    return {
      success: true,
      message: `Successfully extracted and saved study: ${study.title}`,
      study: savedStudy
    };
  } catch (err) {
    const error = err as Error;
    console.error('Error saving scraped study:', error);
    return {
      success: false,
      message: `Error saving scraped study: ${error.message}`
    };
  }
}

/**
 * Format publication date to ISO string
 */
function formatPublicationDate(dateText: string): string {
  if (!dateText) return new Date().toISOString();
  
  try {
    // Try to parse various date formats
    // Format: "2022 Jan 15"
    const dateMatch = dateText.match(/(\d{4})\s+([A-Za-z]+)\s+(\d{1,2})/);
    if (dateMatch) {
      const year = dateMatch[1];
      const month = getMonthNumber(dateMatch[2]);
      const day = dateMatch[3].padStart(2, '0');
      return new Date(`${year}-${month}-${day}`).toISOString();
    }
    
    // Format: "2022 Jan"
    const monthYearMatch = dateText.match(/(\d{4})\s+([A-Za-z]+)/);
    if (monthYearMatch) {
      const year = monthYearMatch[1];
      const month = getMonthNumber(monthYearMatch[2]);
      return new Date(`${year}-${month}-01`).toISOString();
    }
    
    // Format: "Jan 15, 2022"
    const americanDateMatch = dateText.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (americanDateMatch) {
      const month = getMonthNumber(americanDateMatch[1]);
      const day = americanDateMatch[2].padStart(2, '0');
      const year = americanDateMatch[3];
      return new Date(`${year}-${month}-${day}`).toISOString();
    }
    
    // Format: "2022"
    const yearMatch = dateText.match(/(\d{4})/);
    if (yearMatch) {
      return new Date(`${yearMatch[1]}-01-01`).toISOString();
    }
  } catch (e) {
    console.log(`Error parsing date: ${dateText}`);
  }
  
  // Default to current date if parsing fails
  return new Date().toISOString();
}

/**
 * Convert month name to month number
 */
function getMonthNumber(monthName: string): string {
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
 * Check if a study appears to be peer-reviewed based on page content
 */
function isPeerReviewed($: cheerio.CheerioAPI): boolean {
  const bodyText = $('body').text().toLowerCase();
  const peerReviewKeywords = [
    'peer reviewed', 'peer-reviewed', 'refereed', 'published in',
    'journal of', 'journal article', 'scientific journal'
  ];
  
  return peerReviewKeywords.some(keyword => bodyText.includes(keyword));
}

/**
 * Helper to delay execution
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}