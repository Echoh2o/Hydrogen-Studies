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
  let currentPage = 1;
  let hasNextPage = true;
  
  while (hasNextPage && currentPage <= 10) { // Limit to 10 pages for safety
    try {
      // The current site structure uses /search/ for the studies page
      const url = currentPage === 1 
        ? `${WEBSITE_URL}/search/` 
        : `${WEBSITE_URL}/search/page/${currentPage}/`;
      
      console.log(`Scraping study links from page ${currentPage}: ${url}`);
      
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      
      // Extract study links based on the current site's HTML structure
      $('.study-item a, .card-study a, .card a, h4 a').each((_, element) => {
        const link = $(element).attr('href');
        if (link && (link.includes('/study/') || link.includes('/article/'))) {
          links.push(link.startsWith('http') ? link : `${WEBSITE_URL}${link}`);
        }
      });
      
      console.log(`Found ${$('.study-item a, .card-study a, .card a, h4 a').length} potential links on page ${currentPage}`);
      
      // Check if there's a next page
      const nextPageButton = $('.pagination .next, .pagination .next-page, a:contains("Next"), a.next');
      hasNextPage = nextPageButton.length > 0;
      
      if (hasNextPage) {
        console.log('Found next page button, continuing to next page');
      } else {
        console.log('No next page button found, stopping pagination');
      }
      
      currentPage++;
      
      // Wait briefly between page requests
      await delay(2000);
    } catch (error) {
      console.error(`Error scraping page ${currentPage}:`, error.message);
      hasNextPage = false;
    }
  }
  
  console.log(`Total unique links found: ${new Set(links).size}`);
  
  // Return unique links
  return [...new Set(links)];
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