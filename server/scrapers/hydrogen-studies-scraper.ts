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
// Use the optimized search URL that shows all studies at once 
const SEARCH_URL = `${BASE_URL}search/?search=&sortBy=publish_year_desc&perPage=2000`;

/**
 * Database utility to get existing studies by URL or domain
 */
async function getExistingStudiesFromDomain(domain: string): Promise<Set<string>> {
  try {
    // Get all studies that come from hydrogenstudies.com
    const existingStudies = await storage.getStudiesBySourcePlatform('HydrogenStudies');
    
    // Create a set of URLs for fast lookup
    const existingUrls = new Set<string>();
    for (const study of existingStudies) {
      if (study.sourceUrl) {
        existingUrls.add(study.sourceUrl);
      }
    }
    
    console.log(`Found ${existingUrls.size} existing studies from ${domain}`);
    return existingUrls;
  } catch (error) {
    console.error('Error getting existing studies:', error);
    return new Set<string>();
  }
}

/**
 * Main function to scrape all studies from hydrogenstudies.com
 * Uses the known paginated search URL structure
 * 
 * When this is run, it checks for new articles that haven't been scraped yet,
 * rather than scraping everything each time.
 */
export async function scrapeAllHydrogenStudies(): Promise<{ total: number, success: number }> {
  // Initialize a unique scraper job ID
  const scraperId = `hydrogenstudies-${Date.now()}`;
  initScraperStatus(scraperId);
  
  try {
    // Get the set of existing study URLs to avoid duplicates
    updateScraperProgress(0, 0, 0, 0, 'Checking for existing studies');
    const existingStudyUrls = await getExistingStudiesFromDomain('hydrogenstudies.com');
    
    // Step 1: Determine the total number of pages
    updateScraperProgress(0, 0, 0, 0, 'Determining total number of pages');
    const totalPages = await determineTotalPages();
    
    // Step 2: Collect all study links from the search pages
    updateScraperProgress(0, 0, 0, 0, 'Collecting all study links');
    const allStudyLinks = await collectAllStudyLinks(totalPages);
    
    // Step 3: Filter out studies that have already been scraped
    const newStudyLinks = allStudyLinks.filter(url => !existingStudyUrls.has(url));
    
    if (newStudyLinks.length === 0) {
      updateScraperProgress(0, 0, 0, 0, 'No new studies found');
      completeScraperStatus('No new studies found');
      return {
        total: allStudyLinks.length,
        success: 0
      };
    }
    
    // Update status with total count of new studies
    updateScraperProgress(0, 0, 0, newStudyLinks.length, 
      `Found ${newStudyLinks.length} new studies out of ${allStudyLinks.length} total`);
    
    // Step 4: Scrape each new study
    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    
    for (const url of newStudyLinks) {
      try {
        updateScraperProgress(
          processedCount,
          successCount,
          failedCount,
          newStudyLinks.length,
          `Scraping new study ${processedCount + 1} of ${newStudyLinks.length}`
        );
        
        const studyData = await scrapeStudyPage(url);
        
        if (studyData) {
          // Double-check for duplicates by title as an extra precaution
          const similarStudies = await storage.getStudiesByTitle(studyData.title);
          
          if (similarStudies.length === 0) {
            // Not a duplicate, save it
            await storage.createStudy(studyData);
            successCount++;
            console.log(`Added new study: ${studyData.title}`);
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
      total: allStudyLinks.length,
      success: successCount,
      newStudies: newStudyLinks.length
    } as any;
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
 * 
 * Note: With the new search URL, we're showing all studies on a single page,
 * so this always returns 1.
 */
async function determineTotalPages(): Promise<number> {
  return 1; // Using the new URL that shows all studies at once
}

/**
 * Collect all study links from the search page
 * 
 * This function retrieves all study links from the optimized search URL
 * that shows all studies at once (up to 2000 studies).
 */
async function collectAllStudyLinks(totalPages: number): Promise<string[]> {
  const allLinks: string[] = [];
  
  updateScraperProgress(
    0,
    0,
    0,
    1,
    `Collecting all study links from search page`
  );
  
  try {
    const response = await axios.get(SEARCH_URL);
    const $ = cheerio.load(response.data);
    
    // Extract study links from the page
    // The search page has a different structure than the paginated results
    // so we check multiple possible selectors
    
    // First check the standard search result selector
    $('.search-results .entry-title a[href], .search-results h2 a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (href && href.includes('hydrogenstudies.com/study/')) {
        allLinks.push(href);
      }
    });
    
    // If we didn't find any with the first selector, try some alternatives
    if (allLinks.length === 0) {
      $('article a[href], .post a[href], .study a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (href && href.includes('hydrogenstudies.com/study/')) {
          // Avoid duplicates
          if (!allLinks.includes(href)) {
            allLinks.push(href);
          }
        }
      });
    }
    
    console.log(`Found ${allLinks.length} study links on the search page`);
  } catch (error) {
    console.error(`Error collecting links from search page:`, error);
    // This is a critical error, so we'll let it propagate
    throw error;
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
    
    // Extract keywords from the study content
    const keywords = extractKeywords($, title, abstract, methods, results, conclusion);
    
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
      keywords: keywords
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

/**
 * Extract keywords from the study content
 * @param $ Cheerio instance
 * @param title Study title
 * @param abstract Study abstract
 * @param methods Study methods
 * @param results Study results
 * @param conclusion Study conclusion
 * @returns Array of keywords
 */
function extractKeywords($: cheerio.CheerioAPI, title: string, abstract: string, methods: string, results: string, conclusion: string): string[] {
  // Common hydrogen research related terms
  const hydrogenTerms = [
    'hydrogen', 'molecular hydrogen', 'H2', 'hydrogen water', 'hydrogen gas',
    'hydrogen-rich', 'hydrogen-saturated', 'hydrogen inhalation', 'hydrogen bath'
  ];
  
  // Helper function to extract text-based keywords
  function extractTextKeywords(text: string): string[] {
    if (!text) return [];
    
    // Convert to lowercase
    const lowerText = text.toLowerCase();
    
    // Split by common separators and get words/phrases
    const words = lowerText.split(/[\s,;:.!?()[\]{}""'']+/)
      .map(word => word.trim())
      .filter(word => 
        // Filter out short words and common stop words
        word.length > 3 && 
        !['this', 'that', 'with', 'from', 'were', 'have', 'been', 'there', 'their', 'they', 'which'].includes(word)
      );
    
    return words;
  }
  
  // Combine all text content
  const combinedText = `${title} ${abstract} ${methods} ${results} ${conclusion}`;
  
  // Get keywords from main content
  const contentKeywords = extractTextKeywords(combinedText);
  
  // Extract any meta keywords from the page if available
  const metaKeywords: string[] = [];
  $('meta[name="keywords"]').each((_, el) => {
    const content = $(el).attr('content');
    if (content) {
      metaKeywords.push(...content.split(',').map(k => k.trim().toLowerCase()));
    }
  });
  
  // Combine all keywords and remove duplicates
  let allKeywords = [...hydrogenTerms, ...contentKeywords, ...metaKeywords];
  
  // Filter for more relevant keywords
  const keywordSet = new Set<string>();
  
  // Add most relevant hydrogen terms
  for (const term of hydrogenTerms) {
    if (combinedText.toLowerCase().includes(term.toLowerCase())) {
      keywordSet.add(term);
    }
  }
  
  // Add disease/condition terms if found in text
  const conditionTerms = [
    'diabetes', 'cancer', 'inflammation', 'oxidative stress', 'brain', 'heart',
    'liver', 'kidney', 'lung', 'skin', 'intestine', 'blood', 'immune', 
    'antioxidant', 'pain', 'stroke', 'disease', 'injury', 'damage'
  ];
  
  for (const term of conditionTerms) {
    if (combinedText.toLowerCase().includes(term)) {
      keywordSet.add(term);
    }
  }
  
  // Add method-related terms if found
  const methodTerms = [
    'oral', 'inhalation', 'injection', 'topical', 'bath', 'water', 'saline',
    'gas', 'drinking', 'tablets', 'dissolved', 'saturated', 'rich', 'therapy'
  ];
  
  for (const term of methodTerms) {
    if (combinedText.toLowerCase().includes(term)) {
      keywordSet.add(term);
    }
  }
  
  // Convert set back to array, limit to 20 most relevant keywords
  return Array.from(keywordSet).slice(0, 20);
}