import axios from 'axios';
import cheerio from 'cheerio';
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
  
  while (hasNextPage) {
    try {
      const url = `${WEBSITE_URL}/studies/page/${currentPage}`;
      console.log(`Scraping study links from page ${currentPage}`);
      
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      
      // Extract study links based on the site's HTML structure
      $('.study-card a, .study-title a').each((_, element) => {
        const link = $(element).attr('href');
        if (link && link.includes('/study/')) {
          links.push(link.startsWith('http') ? link : `${WEBSITE_URL}${link}`);
        }
      });
      
      // Check if there's a next page
      const nextPageButton = $('.pagination .next, .pagination .next-page');
      hasNextPage = nextPageButton.length > 0;
      currentPage++;
      
      // Wait briefly between page requests
      await delay(1000);
    } catch (error) {
      console.error(`Error scraping page ${currentPage}:`, error.message);
      hasNextPage = false;
    }
  }
  
  // Return unique links
  return [...new Set(links)];
}

/**
 * Scrapes an individual study page to extract study details
 */
async function scrapeStudyPage(url: string): Promise<InsertStudy | null> {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    // Extract study details based on HTML structure
    const title = $('.study-title, h1').first().text().trim();
    if (!title) return null;
    
    // Extract all other study details
    const abstract = $('.study-abstract, .abstract').text().trim();
    const authors = $('.study-authors, .authors').text().trim();
    const journal = $('.study-journal, .journal').text().trim();
    const publishDate = extractDate($('.study-date, .publish-date').text().trim());
    const category = $('.study-category, .category').text().trim() || 'General';
    
    // Additional fields
    const methods = $('.study-methods, .methods').text().trim();
    const results = $('.study-results, .results').text().trim();
    const conclusion = $('.study-conclusion, .conclusion').text().trim();
    const doi = $('.study-doi, .doi').text().trim();
    
    // URL links
    const pdfUrlElement = $('a[href*=".pdf"], a:contains("PDF")');
    const pdfUrl = pdfUrlElement.length ? pdfUrlElement.attr('href') : undefined;
    
    const citationUrlElement = $('a:contains("Citation"), a:contains("Cite")');
    const citationUrl = citationUrlElement.length ? citationUrlElement.attr('href') : undefined;
    
    // Boolean values
    const peerReviewed = $('span:contains("Peer Reviewed"), .peer-reviewed').length > 0;
    
    return {
      title,
      abstract,
      authors,
      journal,
      publishDate,
      category,
      methods,
      results,
      conclusion,
      doi,
      pdfUrl,
      citationUrl,
      peerReviewed
    };
  } catch (error) {
    console.error(`Error scraping study page ${url}:`, error.message);
    return null;
  }
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