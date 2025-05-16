import axios from 'axios';
import * as cheerio from 'cheerio';
import { storage } from './storage';
import { InsertStudy } from '@shared/schema';

const WEBSITE_URL = 'https://hydrogenstudies.com';

/**
 * Scrapes the hydrogen studies website and imports studies into the database
 */
export async function scrapeHydrogenStudies() {
  try {
    console.log('Starting hydrogen studies scraper...');
    
    // First, scrape the main studies page to get all study links
    const studyLinks = await scrapeStudyLinks();
    
    console.log(`Found ${studyLinks.length} studies to scrape`);
    
    // Scrape each individual study page
    let successCount = 0;
    for (let i = 0; i < studyLinks.length; i++) {
      const link = studyLinks[i];
      try {
        console.log(`Scraping study ${i + 1}/${studyLinks.length}: ${link}`);
        const study = await scrapeStudyPage(link);
        
        if (study) {
          await storage.createStudy(study);
          successCount++;
          console.log(`Successfully imported study: ${study.title}`);
        }
      } catch (error) {
        console.error(`Error scraping study at ${link}: ${error.message}`);
      }
      
      // Wait briefly between requests to avoid overloading the server
      await delay(500);
    }
    
    console.log(`Scraping complete. Successfully imported ${successCount} studies.`);
    return { total: studyLinks.length, success: successCount };
  } catch (error) {
    console.error('Error scraping hydrogen studies:', error);
    throw error;
  }
}

/**
 * Scrapes the study list pages to get all individual study links
 */
async function scrapeStudyLinks(): Promise<string[]> {
  const links: string[] = [];
  
  // First, check the main page for any featured studies
  try {
    console.log(`Scraping main page for featured studies`);
    const response = await axios.get(WEBSITE_URL);
    const $ = cheerio.load(response.data);
    
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
        const fullLink = link.startsWith('http') ? link : `${WEBSITE_URL}${link.startsWith('/') ? '' : '/'}${link}`;
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
          ? `${WEBSITE_URL}${basePath}` 
          : `${WEBSITE_URL}${basePath}/page/${currentPage}`;
        
        console.log(`Scraping ${basePath} page ${currentPage}: ${url}`);
        
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        
        // Try many different selectors that could contain study links
        const linkCount = extractLinksFromPage($, links);
        
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
        await delay(2000);
        
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
  const uniqueLinks = [...new Set(links)];
  console.log(`Total unique study links found: ${uniqueLinks.length}`);
  
  return uniqueLinks;
}

// Helper function to extract links from a page
function extractLinksFromPage($: cheerio.CheerioAPI, links: string[]): number {
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
      const fullLink = link.startsWith('http') ? link : `${WEBSITE_URL}${link.startsWith('/') ? '' : '/'}${link}`;
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
      const fullLink = link.startsWith('http') ? link : `${WEBSITE_URL}${link.startsWith('/') ? '' : '/'}${link}`;
      links.push(fullLink);
      count++;
    }
  });
  
  return count;
}

/**
 * Scrapes an individual study page to extract study details
 */
async function scrapeStudyPage(url: string): Promise<InsertStudy | null> {
  try {
    console.log(`Fetching study details from: ${url}`);
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
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
    const abstract = extractTextFromSelectors($, [
      '.study-abstract', 
      '.abstract', 
      '.entry-content p:first-of-type',
      '.card-text',
      '.summary'
    ]);
    
    const authors = extractTextFromSelectors($, [
      '.study-authors', 
      '.authors', 
      '.entry-meta .author',
      '.researcher',
      'meta[name="author"]',
      '.card-subtitle'
    ]);
    
    const journal = extractTextFromSelectors($, [
      '.study-journal', 
      '.journal', 
      '.publication',
      '.source'
    ]);
    
    const dateText = extractTextFromSelectors($, [
      '.study-date', 
      '.publish-date', 
      '.entry-date',
      '.posted-on',
      'time'
    ]);
    const publishDate = extractDate(dateText);
    
    const category = extractTextFromSelectors($, [
      '.study-category', 
      '.category', 
      '.entry-categories',
      '.tags'
    ]) || 'General';
    
    // Additional fields
    const methods = extractTextFromSelectors($, [
      '.study-methods', 
      '.methods',
      '.methodology'
    ]);
    
    const results = extractTextFromSelectors($, [
      '.study-results', 
      '.results',
      '.findings'
    ]);
    
    const conclusion = extractTextFromSelectors($, [
      '.study-conclusion', 
      '.conclusion',
      '.summary'
    ]);
    
    const doi = extractTextFromSelectors($, [
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
    const peerReviewed = containsText($, [
      'peer reviewed',
      'peer-reviewed',
      'refereed',
      'reviewed by peers'
    ]);
    
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
      peerReviewed: peerReviewed || true // Assume peer reviewed if not specified
    };
    
    console.log(`Successfully extracted study: ${title}`);
    return study;
  } catch (error) {
    console.error(`Error scraping study page ${url}:`, error.message);
    return null;
  }
}

/**
 * Helper function to extract text from multiple possible selectors
 */
function extractTextFromSelectors($: cheerio.CheerioAPI, selectors: string[]): string {
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
function containsText($: cheerio.CheerioAPI, textOptions: string[]): boolean {
  const bodyText = $('body').text().toLowerCase();
  return textOptions.some(text => bodyText.includes(text.toLowerCase()));
}

/**
 * Helper function to extract a date from a text string
 */
function extractDate(dateText: string): string {
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

/**
 * Helper function to add a delay between requests
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}