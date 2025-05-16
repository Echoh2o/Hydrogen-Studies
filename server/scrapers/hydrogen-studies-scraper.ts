/**
 * Specialized scraper for hydrogenstudies.com
 * This scraper targets the specific URL structure of the website
 * and extracts all studies from the search pages (1-54)
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { InsertStudy } from '@shared/schema';
import { storage } from '../storage';
import { initScraperStatus, updateScraperProgress, completeScraperStatus } from './scraper-status';

// Base URL for the website
const BASE_URL = 'https://hydrogenstudies.com/';
const SEARCH_URL = `${BASE_URL}?s=`;

/**
 * Main function to scrape all studies from hydrogenstudies.com
 * Uses the known paginated search URL structure
 */
export async function scrapeAllHydrogenStudies(): Promise<{ total: number, success: number }> {
  // Initialize a unique scraper job ID
  const scraperId = `hydrogenstudies-${Date.now()}`;
  initScraperStatus(scraperId);
  
  try {
    // Step 1: Determine the total number of pages
    updateScraperProgress(0, 0, 0, 0, 'Determining total number of pages');
    const totalPages = await determineTotalPages();
    
    // Step 2: Collect all study links from the search pages
    updateScraperProgress(0, 0, 0, 0, 'Collecting all study links');
    const studyLinks = await collectAllStudyLinks(totalPages);
    
    // Update status with total count
    updateScraperProgress(0, 0, 0, studyLinks.length, 'Beginning to scrape individual studies');
    
    // Step 3: Scrape each individual study
    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    
    for (const url of studyLinks) {
      try {
        updateScraperProgress(
          processedCount,
          successCount,
          failedCount,
          studyLinks.length,
          `Scraping study ${processedCount + 1} of ${studyLinks.length}`
        );
        
        const studyData = await scrapeStudyPage(url);
        
        if (studyData) {
          // Check for duplicates by title
          const similarStudies = await storage.getStudiesByTitle(studyData.title);
          
          if (similarStudies.length === 0) {
            // Not a duplicate, save it
            await storage.createStudy(studyData);
            successCount++;
          } else {
            console.log(`Skipping duplicate study: ${studyData.title}`);
            // Count as success but log that it was skipped
          }
        } else {
          failedCount++;
        }
      } catch (error) {
        console.error(`Error scraping study at ${url}:`, error);
        failedCount++;
      }
      
      processedCount++;
      await delay(1000); // Polite delay between requests
    }
    
    // Mark the scraper as complete
    completeScraperStatus();
    
    return {
      total: studyLinks.length,
      success: successCount
    };
  } catch (error) {
    console.error('Error in hydrogen studies scraper:', error);
    completeScraperStatus(`Scraper failed: ${error.message}`);
    
    return {
      total: 0,
      success: 0
    };
  }
}

/**
 * Determine the total number of pages in the search results
 */
async function determineTotalPages(): Promise<number> {
  try {
    const response = await axios.get(SEARCH_URL);
    const $ = cheerio.load(response.data);
    
    // Find the navigation element that contains the pagination
    const pageLinks = $('.nav-links a.page-numbers:not(.next)');
    
    if (pageLinks.length === 0) {
      return 1; // If no pagination found, assume there's only one page
    }
    
    // Get the text from the last pagination link
    const lastPage = pageLinks.last().text();
    return parseInt(lastPage) || 1;
  } catch (error) {
    console.error('Error determining total pages:', error);
    throw error;
  }
}

/**
 * Collect all study links from the search pages
 */
async function collectAllStudyLinks(totalPages: number): Promise<string[]> {
  const allLinks: string[] = [];
  
  for (let page = 1; page <= totalPages; page++) {
    updateScraperProgress(
      page - 1,
      0,
      0,
      totalPages,
      `Collecting study links from page ${page} of ${totalPages}`
    );
    
    try {
      const pageUrl = page === 1 ? SEARCH_URL : `${SEARCH_URL}&paged=${page}`;
      const response = await axios.get(pageUrl);
      const $ = cheerio.load(response.data);
      
      // Extract study links from this page
      $('.entry-title a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (href && href.startsWith(BASE_URL)) {
          allLinks.push(href);
        }
      });
      
      // Be respectful with rate limiting
      if (page < totalPages) {
        await delay(2000);
      }
    } catch (error) {
      console.error(`Error collecting links from page ${page}:`, error);
      // Continue with the next page even if there's an error
    }
  }
  
  return allLinks;
}

/**
 * Scrape an individual study page to extract study details
 */
async function scrapeStudyPage(url: string): Promise<InsertStudy | null> {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    // Extract basic study details
    const title = $('.entry-title').text().trim();
    const abstract = $('.entry-content p').first().text().trim();
    
    if (!title || !abstract) {
      console.error(`Missing title or abstract for ${url}`);
      return null;
    }
    
    // Extract publication date
    const publishDateText = $('.entry-meta .posted-on time').attr('datetime') || 
                           $('.entry-meta .posted-on').text().trim();
    const publishDate = formatDate(publishDateText);
    
    // Extract author information
    const authors = $('.entry-meta .byline .author').text().trim() || 'Unknown';
    
    // Extract categories
    let category = 'Uncategorized';
    $('.cat-links a').each((_, el) => {
      const categoryText = $(el).text().trim();
      if (categoryText) {
        category = categoryText;
        return false; // Break after finding the first category
      }
    });
    
    // Extract content sections
    const methods = extractSectionContent($, ['Methods', 'Method', 'Methodology']) || '';
    const results = extractSectionContent($, ['Results', 'Findings', 'Outcome']) || '';
    const conclusion = extractSectionContent($, ['Conclusion', 'Conclusions', 'Discussion']) || '';
    
    // Extract DOI if available
    let doi = '';
    $('.entry-content a[href*="doi.org"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.includes('doi.org')) {
        doi = href.split('doi.org/').pop() || '';
        return false; // Break after finding the first DOI
      }
    });
    
    // Extract PDF URL if available
    let pdfUrl = '';
    $('.entry-content a[href$=".pdf"]').each((_, el) => {
      pdfUrl = $(el).attr('href') || '';
      return false; // Break after finding the first PDF link
    });
    
    // Determine if peer-reviewed (simplified heuristic)
    const isPeerReviewed = $('.entry-content').text().toLowerCase().includes('peer-reviewed') || 
                          $('.entry-content').text().toLowerCase().includes('peer reviewed');
    
    // Determine study focus areas, models, and other attributes
    const { focusArea, model, design } = determineFocusArea($, title, abstract);
    const healthConditions = determineHealthCondition($, title, abstract);
    const bodySystems = determineBodySystems($, title, abstract);
    const applicationMethod = determineApplicationMethod($, title, abstract);
    const applicationFrequency = determineApplicationFrequency($, title, abstract);
    const applicationDuration = determineApplicationDuration($, title, abstract);
    
    // Build the study object
    const study: InsertStudy = {
      title,
      abstract,
      authors,
      journal: 'Journal data not available',
      publishDate,
      category,
      methods,
      results,
      conclusion,
      doi,
      pdfUrl,
      citationUrl: url,
      peerReviewed: isPeerReviewed,
      viewCount: 0,
      saveCount: 0,
      sourceUrl: url,
      sourcePlatform: 'HydrogenStudies',
      imageUrl: '', // No image extraction for now
      focusArea,
      model,
      design,
      healthConditions: healthConditions || null,
      bodySystems: bodySystems || null,
      applicationMethod: applicationMethod || null,
      applicationFrequency: applicationFrequency || null,
      applicationDuration: applicationDuration || null,
      hydrogenDeliveryAgent: null, // Would require deeper analysis
      hydrogenDosage: null, // Would require deeper analysis
      participantCount: null, // Would require deeper analysis
      participantAge: null, // Would require deeper analysis
      participantGender: null, // Would require deeper analysis
      country: null, // Not easily extractable
      region: null, // Not easily extractable
      keywords: []
    };
    
    return study;
  } catch (error) {
    console.error(`Error scraping study page ${url}:`, error);
    return null;
  }
}

/**
 * Extract content from a specific section (Methods, Results, etc.)
 */
function extractSectionContent($: cheerio.CheerioAPI, headingTexts: string[]): string | null {
  // Try to find a heading that matches one of the provided texts
  let sectionContent = null;
  let foundHeading = false;
  
  // Look for different heading levels
  ['h2', 'h3', 'h4', 'strong'].forEach((headingTag) => {
    if (foundHeading) return;
    
    $(headingTag).each((_, heading) => {
      if (foundHeading) return;
      
      const headingText = $(heading).text().trim();
      
      // Check if this heading matches one of our target headings
      const isTargetHeading = headingTexts.some(target => 
        headingText.toLowerCase().includes(target.toLowerCase())
      );
      
      if (isTargetHeading) {
        foundHeading = true;
        
        // Find all paragraphs after this heading until the next heading
        let content = '';
        let currentElement = $(heading).next();
        
        while (
          currentElement.length > 0 && 
          !['h2', 'h3', 'h4'].includes(currentElement.prop('tagName')?.toLowerCase())
        ) {
          if (currentElement.is('p')) {
            content += currentElement.text().trim() + ' ';
          }
          currentElement = currentElement.next();
        }
        
        if (content) {
          sectionContent = content.trim();
        }
      }
    });
  });
  
  return sectionContent;
}

/**
 * Format a date string to ISO format (YYYY-MM-DD)
 */
function formatDate(dateText: string): string {
  if (!dateText) return new Date().toISOString().split('T')[0];
  
  // Handle ISO date format
  if (dateText.includes('T')) {
    return dateText.split('T')[0];
  }
  
  try {
    // Try to parse various date formats
    const date = new Date(dateText);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (error) {
    console.error(`Error parsing date: ${dateText}`, error);
  }
  
  // Default to current date if parsing fails
  return new Date().toISOString().split('T')[0];
}

/**
 * Function to determine the focus area, model and design of the study
 */
function determineFocusArea($: cheerio.CheerioAPI, title: string, abstract: string): { 
  focusArea: string | null, 
  model: string | null, 
  design: string | null 
} {
  const fullText = `${title} ${abstract}`.toLowerCase();
  let focusArea = null;
  let model = null;
  let design = null;
  
  // Determine focus area
  if (fullText.includes('treatment') || 
      fullText.includes('therapy') || 
      fullText.includes('therapeutic')) {
    focusArea = 'Treatment';
  } else if (fullText.includes('prevention') || 
           fullText.includes('protect') || 
           fullText.includes('prophylactic')) {
    focusArea = 'Prevention';
  } else if (fullText.includes('mechanism') || 
           fullText.includes('pathway') || 
           fullText.includes('signaling')) {
    focusArea = 'Mechanism of Action';
  } else if (fullText.includes('review') || 
           fullText.includes('meta-analysis')) {
    focusArea = 'Review';
  }
  
  // Determine model
  if (fullText.includes('patient') || 
      fullText.includes('human') || 
      fullText.includes('subject') ||
      fullText.includes('participant')) {
    model = 'Human';
  } else if (fullText.includes('rat') || 
           fullText.includes('mouse') || 
           fullText.includes('animal') ||
           fullText.includes('rabbit') ||
           fullText.includes('pig')) {
    model = 'Animal';
  } else if (fullText.includes('in vitro') || 
           fullText.includes('cell') || 
           fullText.includes('culture')) {
    model = 'In Vitro';
  }
  
  // Determine design
  if (fullText.includes('randomized') || 
      fullText.includes('rct')) {
    design = 'Randomized Controlled Trial';
  } else if (fullText.includes('double-blind') || 
           fullText.includes('double blind')) {
    design = 'Double-Blind Study';
  } else if (fullText.includes('placebo')) {
    design = 'Placebo-Controlled';
  } else if (fullText.includes('case-control') || 
           fullText.includes('case control')) {
    design = 'Case-Control Study';
  } else if (fullText.includes('cohort')) {
    design = 'Cohort Study';
  } else if (fullText.includes('review')) {
    design = 'Review';
  } else if (fullText.includes('meta-analysis')) {
    design = 'Meta-Analysis';
  }
  
  return { focusArea, model, design };
}

/**
 * Function to determine health conditions studied
 */
function determineHealthCondition($: cheerio.CheerioAPI, title: string, abstract: string): string[] | null {
  const fullText = `${title} ${abstract}`.toLowerCase();
  const conditions = [];
  
  // Common conditions found in hydrogen studies
  const healthConditions = [
    'diabetes', 'alzheimer', 'parkinson', 'cancer', 'asthma', 'copd',
    'inflammation', 'arthritis', 'hypertension', 'stroke', 'ischemia', 
    'reperfusion injury', 'sepsis', 'oxidative stress', 'metabolic syndrome',
    'obesity', 'fatty liver', 'liver disease', 'kidney disease', 'heart disease',
    'cardiovascular', 'neurodegenerative', 'fibrosis', 'ulcer', 'colitis'
  ];
  
  for (const condition of healthConditions) {
    if (fullText.includes(condition)) {
      conditions.push(condition.charAt(0).toUpperCase() + condition.slice(1));
    }
  }
  
  return conditions.length > 0 ? conditions : null;
}

/**
 * Function to determine body systems studied
 */
function determineBodySystems($: cheerio.CheerioAPI, title: string, abstract: string): string[] | null {
  const fullText = `${title} ${abstract}`.toLowerCase();
  const systems = [];
  
  // Map of body systems and keywords related to them
  const bodySystems = {
    'Cardiovascular': ['heart', 'cardiac', 'cardiovascular', 'vascular', 'circulation', 'blood vessel'],
    'Respiratory': ['lung', 'respiratory', 'pulmonary', 'airway', 'breathing'],
    'Digestive': ['gut', 'intestine', 'colon', 'stomach', 'gastrointestinal', 'gi tract', 'liver', 'pancreas'],
    'Nervous': ['brain', 'neural', 'neuron', 'nervous system', 'neurological', 'cognitive'],
    'Immune': ['immune', 'immunity', 'inflammatory', 'inflammation', 'immunological'],
    'Endocrine': ['hormone', 'endocrine', 'thyroid', 'adrenal', 'pancreas'],
    'Skeletal': ['bone', 'joint', 'skeletal', 'osteo', 'cartilage'],
    'Muscular': ['muscle', 'muscular', 'myocyte'],
    'Renal': ['kidney', 'renal', 'nephro'],
    'Reproductive': ['reproductive', 'fertility', 'sperm', 'ovarian', 'testicular'],
    'Integumentary': ['skin', 'dermal', 'epiderm']
  };
  
  for (const [system, keywords] of Object.entries(bodySystems)) {
    for (const keyword of keywords) {
      if (fullText.includes(keyword)) {
        systems.push(system);
        break; // Once we find a match for this system, move to the next
      }
    }
  }
  
  return systems.length > 0 ? systems : null;
}

/**
 * Function to determine hydrogen application method
 */
function determineApplicationMethod($: cheerio.CheerioAPI, title: string, abstract: string): string | null {
  const fullText = `${title} ${abstract}`.toLowerCase();
  
  if (fullText.includes('inhalation') || 
      fullText.includes('inhaled') || 
      fullText.includes('breathing')) {
    return 'Inhalation';
  } else if (fullText.includes('hydrogen-rich water') || 
           fullText.includes('hydrogen water') || 
           fullText.includes('hydrogenated water') ||
           fullText.includes('hydrogen rich water')) {
    return 'Hydrogen-rich water';
  } else if (fullText.includes('injection') || 
           fullText.includes('intravenous') || 
           fullText.includes('iv') ||
           fullText.includes('intraperitoneal')) {
    return 'Injection';
  } else if (fullText.includes('bath') || 
           fullText.includes('topical') || 
           fullText.includes('skin')) {
    return 'Topical';
  } else if (fullText.includes('saline')) {
    return 'Hydrogen-rich saline';
  }
  
  return null;
}

/**
 * Function to determine application frequency
 */
function determineApplicationFrequency($: cheerio.CheerioAPI, title: string, abstract: string): string | null {
  const fullText = `${title} ${abstract}`.toLowerCase();
  
  if (fullText.includes('daily') || 
      fullText.includes('once a day') || 
      fullText.includes('per day')) {
    return 'Daily';
  } else if (fullText.includes('twice daily') || 
           fullText.includes('twice a day') || 
           fullText.includes('bid')) {
    return 'Twice daily';
  } else if (fullText.includes('three times') || 
           fullText.includes('thrice') || 
           fullText.includes('tid')) {
    return 'Three times daily';
  } else if (fullText.includes('continuous') || 
           fullText.includes('continuously')) {
    return 'Continuous';
  } else if (fullText.includes('single dose') || 
           fullText.includes('one time') || 
           fullText.includes('once')) {
    return 'Single dose';
  } else if (fullText.includes('weekly') || 
           fullText.includes('once a week')) {
    return 'Weekly';
  }
  
  return null;
}

/**
 * Function to determine application duration
 */
function determineApplicationDuration($: cheerio.CheerioAPI, title: string, abstract: string): string | null {
  const fullText = `${title} ${abstract}`.toLowerCase();
  
  // Look for patterns like "X weeks", "X days", etc.
  const durationRegex = /(\d+)\s+(day|days|week|weeks|month|months|hour|hours)/gi;
  const matches = fullText.match(durationRegex);
  
  if (matches && matches.length > 0) {
    return matches[0]; // Return the first duration match
  }
  
  // Also check for more specific phrases
  if (fullText.includes('acute') || 
      fullText.includes('single dose')) {
    return 'Acute (single dose)';
  } else if (fullText.includes('chronic') || 
           fullText.includes('long-term') || 
           fullText.includes('long term')) {
    return 'Chronic (long-term)';
  } else if (fullText.includes('short-term') || 
           fullText.includes('short term')) {
    return 'Short-term';
  }
  
  return null;
}

/**
 * Helper function to add a delay between requests
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}