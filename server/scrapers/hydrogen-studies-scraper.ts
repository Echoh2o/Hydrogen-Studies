/**
 * Specialized scraper for hydrogenstudies.com
 * This scraper targets the specific URL structure of the website
 * and extracts all studies from the search pages (1-54)
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { storage } from '../storage';
import { InsertStudy } from '@shared/schema';

// Base URLs
const WEBSITE_URL = 'https://hydrogenstudies.com';
const SEARCH_URL = 'https://hydrogenstudies.com/search/';

import { 
  initScraperStatus, 
  updateScraperProgress, 
  completeScraperStatus,
  getScraperStatus
} from './scraper-status';

/**
 * Main function to scrape all studies from hydrogenstudies.com
 * Uses the known paginated search URL structure
 */
export async function scrapeAllHydrogenStudies(): Promise<{ total: number, success: number }> {
  try {
    console.log('Starting specialized hydrogen studies scraper...');
    
    // Initialize scraper status
    initScraperStatus('hydrogen-studies-full');
    
    // First, determine the total number of pages
    const totalPages = await determineTotalPages();
    console.log(`Found ${totalPages} pages of studies to scrape`);
    
    // Collect all study links from the search pages
    const studyLinks = await collectAllStudyLinks(totalPages);
    console.log(`Collected ${studyLinks.length} unique study links`);
    
    // Update status with total number of studies
    updateScraperProgress(0, 0, 0, studyLinks.length);
    
    // Scrape each individual study page
    let successCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < studyLinks.length; i++) {
      const link = studyLinks[i];
      
      try {
        console.log(`Scraping study ${i + 1}/${studyLinks.length}: ${link}`);
        const study = await scrapeStudyPage(link);
        
        if (study) {
          // Check if study with similar title already exists
          const existingStudies = await storage.getStudiesByTitle(study.title);
          
          if (existingStudies.length === 0) {
            await storage.createStudy(study);
            successCount++;
            console.log(`Successfully imported study: ${study.title}`);
          } else {
            console.log(`Study with similar title already exists: ${study.title}`);
            successCount++;
          }
        } else {
          failedCount++;
          console.log(`Failed to extract study details from ${link}`);
        }
      } catch (error) {
        console.error(`Error scraping study at ${link}:`, error);
        failedCount++;
      }
      
      // Update progress status
      updateScraperProgress(i + 1, successCount, failedCount);
      
      // Wait between requests to avoid overloading the server
      await delay(1000);
    }
    
    // Mark scraper as complete
    completeScraperStatus();
    
    console.log(`Scraping complete. Successfully processed ${successCount} of ${studyLinks.length} studies.`);
    return { total: studyLinks.length, success: successCount };
  } catch (error) {
    console.error('Error scraping hydrogen studies:', error);
    completeScraperStatus(error.message);
    throw error;
  }
}

/**
 * Determine the total number of pages in the search results
 */
async function determineTotalPages(): Promise<number> {
  try {
    // We know there are 54 pages, but let's confirm by checking the pagination
    const response = await axios.get(SEARCH_URL);
    const $ = cheerio.load(response.data);
    
    // Look for pagination elements
    let highestPage = 1;
    
    // Check pagination links
    $('.pagination a, .nav-links a, .page-numbers').each((_, element) => {
      const pageText = $(element).text().trim();
      const pageNum = parseInt(pageText);
      
      if (!isNaN(pageNum) && pageNum > highestPage) {
        highestPage = pageNum;
      }
      
      // Also check the href attribute
      const href = $(element).attr('href');
      if (href) {
        const pageMatch = href.match(/pg=(\d+)/);
        if (pageMatch && pageMatch[1]) {
          const urlPageNum = parseInt(pageMatch[1]);
          if (!isNaN(urlPageNum) && urlPageNum > highestPage) {
            highestPage = urlPageNum;
          }
        }
      }
    });
    
    // If pagination elements found, return that number
    if (highestPage > 1) {
      return highestPage;
    }
    
    // Default to 54 pages as specified
    return 54; 
  } catch (error) {
    console.error('Error determining total pages:', error);
    // Default to 54 pages as specified
    return 54;
  }
}

/**
 * Collect all study links from the search pages
 */
async function collectAllStudyLinks(totalPages: number): Promise<string[]> {
  console.log(`Collecting study links from ${totalPages} pages...`);
  const allLinks = new Set<string>();
  
  for (let page = 1; page <= totalPages; page++) {
    try {
      // Construct the search URL with page number
      const url = `${SEARCH_URL}?pg=${page}`;
      console.log(`Fetching study links from page ${page}: ${url}`);
      
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      
      // Extract study links - hydrogenstudies.com has a consistent structure
      // Studies are typically in article or div elements with links
      
      // Find all article links
      $('.post, article, .study, .item, .card').each((_, element) => {
        // Get the link from title or the whole article if it's clickable
        const titleLink = $(element).find('h2 a, h3 a, .title a, .entry-title a').attr('href');
        if (titleLink) {
          // Ensure it's a full URL
          const fullLink = titleLink.startsWith('http') ? 
            titleLink : 
            `${WEBSITE_URL}${titleLink.startsWith('/') ? '' : '/'}${titleLink}`;
          
          if (fullLink.includes('/study/')) {
            allLinks.add(fullLink);
          }
        }
        
        // If the whole article is clickable
        const articleLink = $(element).find('a').attr('href');
        if (articleLink) {
          const fullLink = articleLink.startsWith('http') ? 
            articleLink : 
            `${WEBSITE_URL}${articleLink.startsWith('/') ? '' : '/'}${articleLink}`;
          
          if (fullLink.includes('/study/')) {
            allLinks.add(fullLink);
          }
        }
      });
      
      // Also look for any links with the study pattern
      $('a').each((_, element) => {
        const href = $(element).attr('href');
        if (href && href.includes('/study/')) {
          const fullLink = href.startsWith('http') ? 
            href : 
            `${WEBSITE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
          
          allLinks.add(fullLink);
        }
      });
      
      console.log(`Found ${allLinks.size} unique study links so far (page ${page}/${totalPages})`);
      
      // Update progress in scraper status
      const status = getScraperStatus('hydrogen-studies-full');
      if (status) {
        updateScraperProgress(
          page, 
          0, 
          0, 
          0, 
          `Collecting links: page ${page}/${totalPages}`
        );
      }
      
      // Add delay between pages
      await delay(1500);
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
    }
  }
  
  return Array.from(allLinks);
}

/**
 * Scrape an individual study page to extract study details
 */
async function scrapeStudyPage(url: string): Promise<InsertStudy | null> {
  try {
    console.log(`Fetching study details from: ${url}`);
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    // Extract study title - usually in a heading element
    const title = $('h1.entry-title, h1.post-title, .article-title h1, h1').first().text().trim();
    
    if (!title) {
      console.log('Could not find title on the page');
      return null;
    }
    
    // Extract abstract - usually the first few paragraphs
    let abstract = '';
    const contentSelector = '.entry-content, .post-content, .article-content, .content';
    
    // First try to find a dedicated abstract section
    const abstractSection = $(contentSelector).find('.abstract, [class*="abstract"], h2:contains("Abstract") + p');
    if (abstractSection.length) {
      abstract = abstractSection.text().trim();
    } 
    // If not found, take the first 1-3 paragraphs as abstract
    else {
      const paragraphs = $(contentSelector).find('p').slice(0, 3);
      const paragraphTexts: string[] = [];
      
      paragraphs.each((_, element) => {
        const text = $(element).text().trim();
        if (text.length > 50) { // Only include substantial paragraphs
          paragraphTexts.push(text);
        }
      });
      
      abstract = paragraphTexts.join('\n\n');
    }
    
    // Extract authors information
    let authors = '';
    // Check for author metadata
    const authorMeta = $('meta[name="author"]').attr('content');
    if (authorMeta) {
      authors = authorMeta;
    } 
    // Check for visible author information
    else {
      const authorSection = $('.author, .authors, .byline, [class*="author"], .meta-author');
      if (authorSection.length) {
        authors = authorSection.text().trim()
          .replace('By', '')
          .replace('Author:', '')
          .replace('Authors:', '')
          .trim();
      }
    }
    
    // Extract publication date
    let publishDate = '';
    const dateSection = $('.date, .post-date, .published, time, [class*="date"], .meta-date');
    if (dateSection.length) {
      const dateText = dateSection.text().trim();
      publishDate = formatDate(dateText);
    } else {
      // If no visible date, try metadata
      const dateMeta = $('meta[property="article:published_time"]').attr('content');
      if (dateMeta) {
        publishDate = formatDate(dateMeta);
      } else {
        // Default to current date
        publishDate = new Date().toISOString().split('T')[0];
      }
    }
    
    // Extract journal name if available
    let journal = '';
    const journalSection = $('.journal, .publication, [class*="journal"], [class*="publication"]');
    if (journalSection.length) {
      journal = journalSection.text().trim()
        .replace('Journal:', '')
        .replace('Publication:', '')
        .trim();
    }
    
    if (!journal) {
      journal = 'Hydrogen Studies Research Journal';
    }
    
    // Extract DOI if available
    let doi = '';
    const doiSection = $('.doi, [class*="doi"]');
    if (doiSection.length) {
      doi = doiSection.text().trim()
        .replace('DOI:', '')
        .replace('doi:', '')
        .trim();
    } 
    // Also check for DOI in links
    else {
      $('a[href*="doi.org"]').each((_, element) => {
        const href = $(element).attr('href');
        if (href && href.includes('doi.org')) {
          const doiMatch = href.match(/doi\.org\/(.+)$/);
          if (doiMatch && doiMatch[1]) {
            doi = doiMatch[1];
            return false; // Break the loop
          }
        }
      });
    }
    
    // Extract category or health condition
    let category = 'Hydrogen Studies';
    const categorySection = $('.category, .categories, [class*="category"], .tags, .terms');
    if (categorySection.length) {
      category = categorySection.text().trim()
        .replace('Category:', '')
        .replace('Categories:', '')
        .replace('Tags:', '')
        .trim();
      
      // If multiple categories, take the first one
      if (category.includes(',')) {
        category = category.split(',')[0].trim();
      }
    }
    
    // If category is empty or too generic, try to determine from content
    if (!category || category === 'Hydrogen Studies' || category === 'Research') {
      // Look for health condition keywords in title and abstract
      const combinedText = `${title} ${abstract}`.toLowerCase();
      
      // Common health conditions in hydrogen research
      const healthConditions = [
        'Alzheimer', 'Parkinson', 'cancer', 'diabetes', 'stroke', 'heart disease',
        'cardiovascular', 'hypertension', 'inflammation', 'arthritis', 'liver',
        'kidney', 'renal', 'brain', 'neurological', 'pulmonary', 'lung', 'respiratory',
        'gut', 'intestinal', 'metabolism', 'metabolic', 'obesity', 'aging', 'skin'
      ];
      
      for (const condition of healthConditions) {
        if (combinedText.includes(condition.toLowerCase())) {
          // Map to standardized categories
          if (['Alzheimer', 'Parkinson', 'brain', 'neurological', 'stroke'].some(
            term => condition.toLowerCase().includes(term.toLowerCase())
          )) {
            category = 'Neurological';
            break;
          } else if (['heart disease', 'cardiovascular', 'hypertension'].some(
            term => condition.toLowerCase().includes(term.toLowerCase())
          )) {
            category = 'Cardiovascular';
            break;
          } else if (['diabetes', 'metabolism', 'metabolic', 'obesity'].some(
            term => condition.toLowerCase().includes(term.toLowerCase())
          )) {
            category = 'Metabolic';
            break;
          } else if (['inflammation', 'arthritis', 'autoimmune'].some(
            term => condition.toLowerCase().includes(term.toLowerCase())
          )) {
            category = 'Inflammation';
            break;
          } else if (['liver', 'kidney', 'renal'].some(
            term => condition.toLowerCase().includes(term.toLowerCase())
          )) {
            category = 'Organ Function';
            break;
          } else if (['cancer'].some(
            term => condition.toLowerCase().includes(term.toLowerCase())
          )) {
            category = 'Cancer';
            break;
          } else if (['pulmonary', 'lung', 'respiratory'].some(
            term => condition.toLowerCase().includes(term.toLowerCase())
          )) {
            category = 'Respiratory';
            break;
          } else if (['gut', 'intestinal', 'digestion'].some(
            term => condition.toLowerCase().includes(term.toLowerCase())
          )) {
            category = 'Gastrointestinal';
            break;
          } else if (['aging', 'longevity'].some(
            term => condition.toLowerCase().includes(term.toLowerCase())
          )) {
            category = 'Aging';
            break;
          }
        }
      }
    }
    
    // Look for PMID (PubMed ID)
    let pmid = '';
    const pmidSection = $('.pmid, [class*="pmid"], a[href*="pubmed"]');
    if (pmidSection.length) {
      const pmidText = pmidSection.text().trim();
      const pmidMatch = pmidText.match(/PMID:?\s*(\d+)/i);
      if (pmidMatch && pmidMatch[1]) {
        pmid = pmidMatch[1];
      } else {
        // Check for PMID in href
        const href = pmidSection.attr('href');
        if (href && href.includes('pubmed')) {
          const hrefMatch = href.match(/\/(\d+)$/);
          if (hrefMatch && hrefMatch[1]) {
            pmid = hrefMatch[1];
          }
        }
      }
    }
    
    // Look for methods, results, conclusion sections
    const methods = extractSectionContent($, ['Methods', 'Methodology', 'Materials and Methods']);
    const results = extractSectionContent($, ['Results', 'Findings']);
    const conclusion = extractSectionContent($, ['Conclusion', 'Conclusions', 'Discussion', 'Summary']);
    
    // Extract PDF URL if available
    let pdfUrl = '';
    $('a[href$=".pdf"], a:contains("PDF"), a:contains("Full Text")').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        if (href.endsWith('.pdf') || href.includes('pdf') || href.includes('fulltext')) {
          pdfUrl = href.startsWith('http') ? href : `${WEBSITE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
          return false; // Break the loop
        }
      }
    });
    
    // Extract citation URL if available
    let citationUrl = '';
    $('a:contains("Cite"), a:contains("Citation")').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        citationUrl = href.startsWith('http') ? href : `${WEBSITE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
        return false; // Break the loop
      }
    });
    
    // If no citation URL, use the current page URL
    if (!citationUrl) {
      citationUrl = url;
    }
    
    // Extract keywords if available
    let keywords: string[] = [];
    const keywordsSection = $('.keywords, .tags, meta[name="keywords"]');
    if (keywordsSection.length) {
      const keywordsText = keywordsSection.attr('content') || keywordsSection.text().trim();
      if (keywordsText) {
        keywords = keywordsText
          .replace('Keywords:', '')
          .replace('Tags:', '')
          .split(',')
          .map(k => k.trim())
          .filter(k => k.length > 0);
      }
    }
    
    // If no keywords found, extract from title and abstract
    if (keywords.length === 0) {
      const combinedText = `${title} ${abstract}`.toLowerCase();
      const potentialKeywords = [
        'hydrogen', 'molecular hydrogen', 'H2', 'hydrogen-rich', 'hydrogen water',
        'hydrogen gas', 'antioxidant', 'therapeutic', 'clinical', 'oxidative stress',
        'inflammation', 'neuroprotection', 'cardioprotection', 'metabolic'
      ];
      
      keywords = potentialKeywords.filter(keyword => 
        combinedText.includes(keyword.toLowerCase())
      );
    }
    
    // Determine if study is peer-reviewed
    const isPeerReviewed = $('.peer-reviewed, [class*="peer-reviewed"]').length > 0 ||
      $('body').text().toLowerCase().includes('peer-reviewed') ||
      $('body').text().toLowerCase().includes('peer reviewed');
    
    // Special handling for hydrogen-specific fields
    let studyType = determineFocusArea($, title, abstract);
    let healthCondition = determineHealthCondition($, title, abstract);
    let bodySystems = determineBodySystems($, title, abstract);
    let applicationMethod = determineApplicationMethod($, title, abstract);
    let applicationFrequency = determineApplicationFrequency($, title, abstract);
    let applicationDuration = determineApplicationDuration($, title, abstract);
    
    // Construct the study object
    const study: InsertStudy = {
      title,
      abstract: abstract || `Study about ${title}`,
      authors: authors || 'Unknown',
      journal: journal || 'Hydrogen Studies Research Journal',
      publishDate,
      category,
      methods: methods || null,
      results: results || null,
      conclusion: conclusion || null,
      doi: doi || null,
      pmid: pmid || null,
      pdfUrl: pdfUrl || null,
      citationUrl: citationUrl || null,
      peerReviewed: isPeerReviewed || true,
      keywords: keywords.length > 0 ? keywords : null,
      primaryFocus: studyType.primaryFocus || null,
      secondaryFocus: studyType.secondaryFocus || null,
      model: studyType.model || null,
      healthConditions: healthCondition || null,
      bodySystems: bodySystems || null,
      applicationMethod: applicationMethod || null,
      applicationFrequency: applicationFrequency || null,
      applicationDuration: applicationDuration || null,
      sourcePlatform: 'HydrogenStudies'
    };
    
    console.log(`Successfully extracted study: ${title}`);
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
  for (const headingText of headingTexts) {
    // Try to find a heading with this text
    const heading = $(`h2:contains("${headingText}"), h3:contains("${headingText}"), h4:contains("${headingText}")`);
    
    if (heading.length) {
      // Get all content until the next heading
      let content = '';
      let currentNode = heading.next();
      
      while (currentNode.length && !currentNode.is('h2, h3, h4')) {
        if (currentNode.is('p')) {
          content += currentNode.text().trim() + '\n\n';
        }
        currentNode = currentNode.next();
      }
      
      if (content) {
        return content.trim();
      }
    }
    
    // Also try to find a div or section with this class or ID
    const section = $(`.${headingText.toLowerCase()}, #${headingText.toLowerCase()}, [data-section="${headingText.toLowerCase()}"]`);
    if (section.length) {
      return section.text().trim();
    }
  }
  
  return null;
}

/**
 * Format a date string to ISO format (YYYY-MM-DD)
 */
function formatDate(dateText: string): string {
  if (!dateText) return new Date().toISOString().split('T')[0];
  
  // Try to parse the date text
  try {
    // Handle common formats
    const date = new Date(dateText);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    // Look for year, month, day patterns
    const dateMatch = dateText.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})|(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (dateMatch) {
      if (dateMatch[1]) { // MM/DD/YYYY or DD/MM/YYYY
        const part1 = parseInt(dateMatch[1]);
        const part2 = parseInt(dateMatch[2]);
        const year = dateMatch[3];
        
        // Assume MM/DD/YYYY for US-based site
        const month = part1 <= 12 ? part1 : part2;
        const day = part1 <= 12 ? part2 : part1;
        
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      } else { // YYYY/MM/DD
        const year = dateMatch[4];
        const month = dateMatch[5];
        const day = dateMatch[6];
        
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    
    // Look for month name format (e.g., "January 15, 2022")
    const monthNameMatch = dateText.match(/([A-Za-z]+)\s+(\d{1,2})[\s,]+(\d{4})/);
    if (monthNameMatch) {
      const monthName = monthNameMatch[1];
      const day = monthNameMatch[2];
      const year = monthNameMatch[3];
      
      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                         'july', 'august', 'september', 'october', 'november', 'december'];
      const monthIndex = monthNames.findIndex(m => 
        m.toLowerCase() === monthName.toLowerCase() || 
        m.toLowerCase().startsWith(monthName.toLowerCase().substring(0, 3))
      );
      
      if (monthIndex !== -1) {
        const month = monthIndex + 1;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    
    // Extract just a year if nothing else works
    const yearMatch = dateText.match(/\d{4}/);
    if (yearMatch) {
      return `${yearMatch[0]}-01-01`;
    }
  } catch (e) {
    console.log(`Error parsing date: ${dateText}`);
  }
  
  // Default to current date if parsing fails
  return new Date().toISOString().split('T')[0];
}

/**
 * Function to determine the focus area, model and design of the study
 */
function determineFocusArea($: cheerio.CheerioAPI, title: string, abstract: string): { 
  primaryFocus: string | null, 
  secondaryFocus: string | null,
  model: string | null
} {
  const combinedText = `${title} ${abstract}`.toLowerCase();
  
  // Primary focus categories
  const therapeuticKeywords = ['treatment', 'therapy', 'therapeutic', 'intervention', 'clinical trial'];
  const preventiveKeywords = ['prevention', 'preventive', 'prophylactic', 'protect', 'protective'];
  const diagnosticKeywords = ['diagnostic', 'biomarker', 'detection', 'screening', 'monitoring'];
  const mechanisticKeywords = ['mechanism', 'pathway', 'signaling', 'molecular', 'cellular'];
  
  // Secondary focus categories
  const safetyKeywords = ['safety', 'side effect', 'adverse', 'toxicity', 'safe'];
  const efficacyKeywords = ['efficacy', 'effective', 'effectiveness', 'outcome', 'result'];
  const developmentKeywords = ['development', 'novel', 'new', 'innovative', 'method'];
  
  // Model categories
  const humanKeywords = ['human', 'patient', 'subject', 'volunteer', 'participant', 'clinical'];
  const animalKeywords = ['animal', 'mouse', 'mice', 'rat', 'rats', 'model', 'in vivo'];
  const vitroKeywords = ['in vitro', 'cell', 'culture', 'cultured', 'line'];
  const computationalKeywords = ['computational', 'simulation', 'in silico', 'model', 'algorithm'];
  
  // Check for primary focus
  let primaryFocus: string | null = null;
  if (therapeuticKeywords.some(kw => combinedText.includes(kw))) {
    primaryFocus = 'Therapeutic';
  } else if (preventiveKeywords.some(kw => combinedText.includes(kw))) {
    primaryFocus = 'Preventive';
  } else if (diagnosticKeywords.some(kw => combinedText.includes(kw))) {
    primaryFocus = 'Diagnostic';
  } else if (mechanisticKeywords.some(kw => combinedText.includes(kw))) {
    primaryFocus = 'Mechanistic';
  }
  
  // Check for secondary focus
  let secondaryFocus: string | null = null;
  if (safetyKeywords.some(kw => combinedText.includes(kw))) {
    secondaryFocus = 'Safety';
  } else if (efficacyKeywords.some(kw => combinedText.includes(kw))) {
    secondaryFocus = 'Efficacy';
  } else if (developmentKeywords.some(kw => combinedText.includes(kw))) {
    secondaryFocus = 'Development';
  }
  
  // Check for model
  let model: string | null = null;
  if (humanKeywords.some(kw => combinedText.includes(kw))) {
    model = 'Human';
  } else if (animalKeywords.some(kw => combinedText.includes(kw))) {
    model = 'Animal';
  } else if (vitroKeywords.some(kw => combinedText.includes(kw))) {
    model = 'In Vitro';
  } else if (computationalKeywords.some(kw => combinedText.includes(kw))) {
    model = 'Computational';
  }
  
  return { primaryFocus, secondaryFocus, model };
}

/**
 * Function to determine health conditions studied
 */
function determineHealthCondition($: cheerio.CheerioAPI, title: string, abstract: string): string[] | null {
  const combinedText = `${title} ${abstract}`.toLowerCase();
  
  const conditions = [];
  
  // Neurological conditions
  const neurologicalKeywords = [
    'alzheimer', 'parkinson', 'stroke', 'brain injury', 'traumatic brain', 
    'neuropathy', 'neurological', 'neurodegenerative', 'cognitive decline',
    'dementia', 'concussion', 'tbi', 'multiple sclerosis', 'neuroinflammation'
  ];
  
  if (neurologicalKeywords.some(kw => combinedText.includes(kw))) {
    conditions.push('Neurological');
    
    // More specific conditions
    if (combinedText.includes('alzheimer')) conditions.push('Alzheimer\'s Disease');
    if (combinedText.includes('parkinson')) conditions.push('Parkinson\'s Disease');
    if (combinedText.includes('stroke')) conditions.push('Stroke');
    if (combinedText.includes('brain injury') || combinedText.includes('tbi')) conditions.push('Traumatic Brain Injury');
    if (combinedText.includes('multiple sclerosis')) conditions.push('Multiple Sclerosis');
  }
  
  // Cardiovascular conditions
  const cardiovascularKeywords = [
    'heart', 'cardiac', 'cardiovascular', 'hypertension', 'blood pressure',
    'myocardial', 'atherosclerosis', 'coronary', 'infarction', 'stroke',
    'arrhythmia', 'ischemia'
  ];
  
  if (cardiovascularKeywords.some(kw => combinedText.includes(kw))) {
    conditions.push('Cardiovascular');
    
    // More specific conditions
    if (combinedText.includes('infarction') || combinedText.includes('heart attack')) conditions.push('Myocardial Infarction');
    if (combinedText.includes('hypertension') || combinedText.includes('blood pressure')) conditions.push('Hypertension');
    if (combinedText.includes('atherosclerosis')) conditions.push('Atherosclerosis');
    if (combinedText.includes('ischemia')) conditions.push('Ischemia');
  }
  
  // Metabolic conditions
  const metabolicKeywords = [
    'diabetes', 'metabolic syndrome', 'obesity', 'insulin resistance',
    'hyperglycemia', 'fatty liver', 'lipid', 'metabolism'
  ];
  
  if (metabolicKeywords.some(kw => combinedText.includes(kw))) {
    conditions.push('Metabolic');
    
    // More specific conditions
    if (combinedText.includes('diabetes')) conditions.push('Diabetes');
    if (combinedText.includes('obesity')) conditions.push('Obesity');
    if (combinedText.includes('fatty liver')) conditions.push('Fatty Liver Disease');
    if (combinedText.includes('metabolic syndrome')) conditions.push('Metabolic Syndrome');
  }
  
  // Inflammatory conditions
  const inflammatoryKeywords = [
    'inflammation', 'inflammatory', 'arthritis', 'autoimmune',
    'colitis', 'crohn', 'lupus', 'psoriasis'
  ];
  
  if (inflammatoryKeywords.some(kw => combinedText.includes(kw))) {
    conditions.push('Inflammatory');
    
    // More specific conditions
    if (combinedText.includes('arthritis')) conditions.push('Arthritis');
    if (combinedText.includes('colitis') || combinedText.includes('crohn')) conditions.push('Inflammatory Bowel Disease');
    if (combinedText.includes('lupus')) conditions.push('Lupus');
    if (combinedText.includes('psoriasis')) conditions.push('Psoriasis');
  }
  
  // Cancer
  const cancerKeywords = [
    'cancer', 'tumor', 'carcinoma', 'oncology', 'neoplasm', 'malignant'
  ];
  
  if (cancerKeywords.some(kw => combinedText.includes(kw))) {
    conditions.push('Cancer');
  }
  
  // Respiratory conditions
  const respiratoryKeywords = [
    'lung', 'respiratory', 'copd', 'asthma', 'pulmonary', 'pneumonia',
    'bronchitis', 'emphysema'
  ];
  
  if (respiratoryKeywords.some(kw => combinedText.includes(kw))) {
    conditions.push('Respiratory');
    
    // More specific conditions
    if (combinedText.includes('asthma')) conditions.push('Asthma');
    if (combinedText.includes('copd')) conditions.push('COPD');
    if (combinedText.includes('pneumonia')) conditions.push('Pneumonia');
  }
  
  // Remove duplicates and return
  return conditions.length > 0 ? [...new Set(conditions)] : null;
}

/**
 * Function to determine body systems studied
 */
function determineBodySystems($: cheerio.CheerioAPI, title: string, abstract: string): string[] | null {
  const combinedText = `${title} ${abstract}`.toLowerCase();
  
  const systems = [];
  
  // Nervous system
  const nervousKeywords = [
    'brain', 'nervous system', 'neural', 'cognitive', 'neuron',
    'cns', 'pns', 'central nervous', 'peripheral nervous'
  ];
  
  if (nervousKeywords.some(kw => combinedText.includes(kw))) {
    systems.push('Nervous System');
  }
  
  // Cardiovascular system
  const cardiovascularKeywords = [
    'heart', 'cardiac', 'vascular', 'blood vessel', 'circulatory'
  ];
  
  if (cardiovascularKeywords.some(kw => combinedText.includes(kw))) {
    systems.push('Cardiovascular System');
  }
  
  // Digestive system
  const digestiveKeywords = [
    'digestive', 'gastrointestinal', 'gut', 'intestine', 'stomach',
    'liver', 'pancreas', 'colon', 'gi tract'
  ];
  
  if (digestiveKeywords.some(kw => combinedText.includes(kw))) {
    systems.push('Digestive System');
  }
  
  // Respiratory system
  const respiratoryKeywords = [
    'lung', 'respiratory', 'pulmonary', 'bronchial', 'alveoli'
  ];
  
  if (respiratoryKeywords.some(kw => combinedText.includes(kw))) {
    systems.push('Respiratory System');
  }
  
  // Immune system
  const immuneKeywords = [
    'immune', 'immunity', 'lymphocyte', 'antibody', 'inflammation',
    'macrophage', 'cytokine'
  ];
  
  if (immuneKeywords.some(kw => combinedText.includes(kw))) {
    systems.push('Immune System');
  }
  
  // Endocrine system
  const endocrineKeywords = [
    'endocrine', 'hormone', 'insulin', 'thyroid', 'adrenal',
    'pituitary', 'pancreatic'
  ];
  
  if (endocrineKeywords.some(kw => combinedText.includes(kw))) {
    systems.push('Endocrine System');
  }
  
  // Musculoskeletal system
  const musculoskeletalKeywords = [
    'muscle', 'skeletal', 'bone', 'joint', 'tendon',
    'cartilage', 'musculoskeletal'
  ];
  
  if (musculoskeletalKeywords.some(kw => combinedText.includes(kw))) {
    systems.push('Musculoskeletal System');
  }
  
  // Integumentary system (skin)
  const skinKeywords = [
    'skin', 'dermal', 'epidermal', 'cutaneous', 'integumentary'
  ];
  
  if (skinKeywords.some(kw => combinedText.includes(kw))) {
    systems.push('Integumentary System');
  }
  
  // Urinary system
  const urinaryKeywords = [
    'kidney', 'renal', 'urinary', 'bladder', 'nephron'
  ];
  
  if (urinaryKeywords.some(kw => combinedText.includes(kw))) {
    systems.push('Urinary System');
  }
  
  // Remove duplicates and return
  return systems.length > 0 ? [...new Set(systems)] : null;
}

/**
 * Function to determine hydrogen application method
 */
function determineApplicationMethod($: cheerio.CheerioAPI, title: string, abstract: string): string | null {
  const combinedText = `${title} ${abstract}`.toLowerCase();
  
  // Look for specific application methods
  if (combinedText.includes('hydrogen water') || 
      combinedText.includes('hydrogen-rich water') || 
      combinedText.includes('hydrogen rich water') ||
      combinedText.includes('h2 water')) {
    return 'Hydrogen Water';
  }
  
  if (combinedText.includes('hydrogen gas') || 
      combinedText.includes('h2 gas') || 
      combinedText.includes('hydrogen inhalation') ||
      combinedText.includes('inhaled hydrogen')) {
    return 'Hydrogen Gas Inhalation';
  }
  
  if (combinedText.includes('hydrogen saline') || 
      combinedText.includes('hydrogen-rich saline') ||
      combinedText.includes('hydrogen rich saline') ||
      combinedText.includes('h2 saline') ||
      combinedText.includes('hydrogen injection')) {
    return 'Hydrogen-Rich Saline Injection';
  }
  
  if (combinedText.includes('hydrogen bath') || 
      combinedText.includes('hydrogen bathing') ||
      combinedText.includes('h2 bath')) {
    return 'Hydrogen Bath';
  }
  
  if (combinedText.includes('topical') || 
      combinedText.includes('hydrogen gel') ||
      combinedText.includes('hydrogen cream') ||
      combinedText.includes('hydrogen lotion')) {
    return 'Topical Application';
  }
  
  if (combinedText.includes('hydrogen tablet') || 
      combinedText.includes('hydrogen pill') ||
      combinedText.includes('oral hydrogen')) {
    return 'Hydrogen Tablet';
  }
  
  if (combinedText.includes('iv') || 
      combinedText.includes('intravenous') ||
      combinedText.includes('intra-venous')) {
    return 'Intravenous';
  }
  
  // Default if method not clearly specified
  return null;
}

/**
 * Function to determine application frequency
 */
function determineApplicationFrequency($: cheerio.CheerioAPI, title: string, abstract: string): string | null {
  const combinedText = `${title} ${abstract}`.toLowerCase();
  
  // Look for frequency patterns
  if (combinedText.includes('daily') || 
      combinedText.includes('once a day') ||
      combinedText.includes('per day') ||
      combinedText.includes('every day')) {
    return 'Daily';
  }
  
  if (combinedText.includes('twice daily') || 
      combinedText.includes('twice a day') ||
      combinedText.includes('two times a day') ||
      combinedText.includes('2 times per day') ||
      combinedText.includes('bid')) {
    return 'Twice Daily';
  }
  
  if (combinedText.includes('three times a day') || 
      combinedText.includes('three times daily') ||
      combinedText.includes('3 times per day') ||
      combinedText.includes('tid')) {
    return 'Three Times Daily';
  }
  
  if (combinedText.includes('every other day') || 
      combinedText.includes('alternate days')) {
    return 'Every Other Day';
  }
  
  if (combinedText.includes('weekly') || 
      combinedText.includes('once a week') ||
      combinedText.includes('per week')) {
    return 'Weekly';
  }
  
  if (combinedText.includes('continuous') || 
      combinedText.includes('continuously') ||
      combinedText.includes('ongoing')) {
    return 'Continuous';
  }
  
  // Default if frequency not clearly specified
  return null;
}

/**
 * Function to determine application duration
 */
function determineApplicationDuration($: cheerio.CheerioAPI, title: string, abstract: string): string | null {
  const combinedText = `${title} ${abstract}`.toLowerCase();
  
  // Look for duration patterns with regex
  const durationPatterns = [
    /(\d+)\s*days?/,
    /(\d+)\s*weeks?/,
    /(\d+)\s*months?/,
    /(\d+)\s*years?/,
    /(\d+)\s*hours?/
  ];
  
  for (const pattern of durationPatterns) {
    const match = combinedText.match(pattern);
    if (match && match[1]) {
      const value = parseInt(match[1]);
      const unit = match[0].replace(match[1], '').trim();
      
      if (unit.includes('day')) {
        return value === 1 ? '1 Day' : `${value} Days`;
      } else if (unit.includes('week')) {
        return value === 1 ? '1 Week' : `${value} Weeks`;
      } else if (unit.includes('month')) {
        return value === 1 ? '1 Month' : `${value} Months`;
      } else if (unit.includes('year')) {
        return value === 1 ? '1 Year' : `${value} Years`;
      } else if (unit.includes('hour')) {
        return value === 1 ? '1 Hour' : `${value} Hours`;
      }
    }
  }
  
  // Look for specific phrases
  if (combinedText.includes('short term') || 
      combinedText.includes('short-term') ||
      combinedText.includes('acute')) {
    return 'Short-term (< 1 week)';
  }
  
  if (combinedText.includes('long term') || 
      combinedText.includes('long-term') ||
      combinedText.includes('chronic')) {
    return 'Long-term (> 1 month)';
  }
  
  // Default if duration not clearly specified
  return null;
}

/**
 * Helper function to add a delay between requests
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}