/**
 * Direct scraper for a specific URL
 * This allows us to test scraping a known page that contains a hydrogen study
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { InsertStudy } from '@shared/schema';
import { storage } from './storage';
import { extractPMIDFromIdentifier } from './pubmed-enricher';

/**
 * Extract study from a specific URL
 */
export async function scrapeStudyFromUrl(url: string): Promise<InsertStudy | null> {
  try {
    // Try to detect the platform from the URL
    const platform = detectPlatform(url);
    
    if (!platform) {
      throw new Error('Unsupported platform or URL format');
    }
    
    let study: InsertStudy | null = null;
    
    // Choose scraping strategy based on platform
    switch (platform) {
      case 'pubmed':
        study = await scrapePubMed(url);
        break;
      case 'hydrogen-studies':
        study = await scrapeHydrogenStudies(url);
        break;
      case 'europe-pmc':
        study = await scrapeEuropePMC(url);
        break;
      case 'crossref':
        study = await scrapeCrossRef(url);
        break;
      case 'semantic-scholar':
        study = await scrapeSemanticScholar(url);
        break;
      case 'core':
        study = await scrapeCoreAPI(url);
        break;
      case 'dimensions':
        study = await scrapeDimensions(url);
        break;
      default:
        throw new Error('Unsupported platform');
    }
    
    return study;
  } catch (error: any) {
    console.error(`Error scraping URL ${url}:`, error.message);
    throw new Error(`Failed to scrape the URL: ${error.message}`);
  }
}

/**
 * Try to save a directly scraped study
 */
export async function saveScrapedStudy(url: string): Promise<{ success: boolean, message: string, study?: any }> {
  try {
    const study = await scrapeStudyFromUrl(url);
    
    if (!study) {
      return { success: false, message: 'Failed to extract study data from the URL' };
    }
    
    // Check if study already exists by title
    const existingStudies = await storage.getStudies({ title: study.title });
    
    if (existingStudies && existingStudies.length > 0) {
      return { 
        success: false, 
        message: 'Study with this title already exists in the database',
        study
      };
    }
    
    // Save the study
    const savedStudy = await storage.createStudy(study);
    
    return {
      success: true,
      message: 'Study successfully imported',
      study: savedStudy
    };
  } catch (error: any) {
    console.error('Error saving scraped study:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to save scraped study' 
    };
  }
}

/**
 * Detect platform from URL
 */
function detectPlatform(url: string): string | null {
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('pubmed.ncbi.nlm.nih.gov') || lowerUrl.includes('ncbi.nlm.nih.gov/pubmed')) {
    return 'pubmed';
  } else if (lowerUrl.includes('hydrogenstudies.com')) {
    return 'hydrogen-studies';
  } else if (lowerUrl.includes('europepmc.org')) {
    return 'europe-pmc';
  } else if (lowerUrl.includes('crossref.org') || lowerUrl.includes('doi.org')) {
    return 'crossref';
  } else if (lowerUrl.includes('semanticscholar.org')) {
    return 'semantic-scholar';
  } else if (lowerUrl.includes('core.ac.uk')) {
    return 'core';
  } else if (lowerUrl.includes('dimensions.ai') || lowerUrl.includes('app.dimensions.ai')) {
    return 'dimensions';
  }
  
  return null;
}

/**
 * Scrape a PubMed page
 */
async function scrapePubMed(url: string): Promise<InsertStudy | null> {
  try {
    // Extract PMID from URL
    const pmid = extractPMIDFromIdentifier(url);
    
    if (!pmid) {
      throw new Error('Could not extract PMID from URL');
    }
    
    // Fetch HTML content
    const response = await axios.get(`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`);
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Extract study data
    const title = $('.heading-title').text().trim();
    const authors = $('.authors-list').text().trim().replace(/,\s*$/, '');
    const abstract = $('.abstract-content p').text().trim();
    
    // Extract journal info
    const journalElement = $('.journal-actions-trigger');
    const journal = journalElement.length ? journalElement.text().trim() : '';
    
    // Extract publication date
    let publishDate = '';
    const pubDateElement = $('.pubdate');
    if (pubDateElement.length) {
      publishDate = pubDateElement.text().trim();
    }
    
    // Extract DOI if available
    let doi = '';
    const doiElement = $('.identifier.doi');
    if (doiElement.length) {
      doi = doiElement.text().replace('DOI:', '').trim();
    }
    
    // Determine if peer-reviewed (most PubMed articles are)
    const peerReviewed = true;
    
    // Create study object
    const study: InsertStudy = {
      title,
      authors,
      abstract,
      journal,
      publishDate: formatPublicationDate(publishDate),
      doi,
      peerReviewed,
      category: 'Hydrogen Research',
      sourcePlatform: 'PubMed'
    };
    
    return study;
  } catch (error) {
    console.error('Error scraping PubMed:', error);
    throw error;
  }
}

/**
 * Scrape a Hydrogen Studies page
 */
async function scrapeHydrogenStudies(url: string): Promise<InsertStudy | null> {
  try {
    // Fetch HTML content
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Extract study data
    const title = $('h1.entry-title').text().trim();
    const authors = extractTextFromSelectors($, ['.study-authors', '.study-author']);
    const abstract = extractTextFromSelectors($, ['.study-abstract', '.abstract']);
    const journal = extractTextFromSelectors($, ['.study-journal', '.journal']);
    const publishDate = extractTextFromSelectors($, ['.study-date', '.publication-date']);
    
    // Extract DOI if available
    const doi = extractTextFromSelectors($, ['.study-doi', '.doi']);
    
    // Extract citation URL if available
    const citationUrl = $('.citation-link a').attr('href') || '';
    
    // Extract PDF URL if available
    const pdfUrl = $('.pdf-link a').attr('href') || '';
    
    // Determine if peer-reviewed
    const peerReviewed = isPeerReviewed($);
    
    // Create study object
    const study: InsertStudy = {
      title,
      authors,
      abstract,
      journal,
      publishDate: formatPublicationDate(publishDate),
      doi,
      pdfUrl,
      citationUrl,
      peerReviewed,
      category: 'Hydrogen Research',
      sourcePlatform: 'Hydrogen Studies'
    };
    
    return study;
  } catch (error) {
    console.error('Error scraping HydrogenStudies.com:', error);
    throw error;
  }
}

/**
 * Scrape a Europe PMC page using their REST API
 */
async function scrapeEuropePMC(url: string): Promise<InsertStudy | null> {
  try {
    // Extract ID and ID type from URL
    let id = '';
    let idType = '';
    
    // Different URL patterns for Europe PMC
    // Examples:
    // - https://europepmc.org/article/MED/12345678
    // - https://europepmc.org/article/PMC/PMC1234567
    // - https://europepmc.org/article/DOI/10.1234/abc123
    
    const pmcMatch = url.match(/\/article\/PMC\/(PMC\d+)/i);
    const pmidMatch = url.match(/\/article\/MED\/(\d+)/i);
    const doiMatch = url.match(/\/article\/DOI\/([^\/&\?]+)/i);
    
    if (pmcMatch) {
      id = pmcMatch[1];
      idType = 'PMCID';
    } else if (pmidMatch) {
      id = pmidMatch[1];
      idType = 'PMID';
    } else if (doiMatch) {
      id = doiMatch[1];
      idType = 'DOI';
    } else {
      // Try to extract from URL path components
      const urlParts = url.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      
      if (lastPart.startsWith('PMC')) {
        id = lastPart;
        idType = 'PMCID';
      } else if (/^\d+$/.test(lastPart)) {
        id = lastPart;
        idType = 'PMID';
      } else if (lastPart.includes('10.')) {
        id = lastPart;
        idType = 'DOI';
      }
    }
    
    if (!id) {
      throw new Error('Could not extract ID from Europe PMC URL');
    }
    
    console.log(`Fetching Europe PMC article with ${idType}: ${id}`);
    
    // Use the Europe PMC REST API to fetch article data
    const apiUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/article/${idType}/${id}?format=json`;
    const response = await axios.get(apiUrl);
    const data = response.data;
    
    if (!data || !data.result) {
      throw new Error('No data returned from Europe PMC API');
    }
    
    const article = data.result;
    
    // Extract title
    const title = article.title || '';
    
    // Extract authors
    let authors = '';
    if (article.authorList && article.authorList.author && article.authorList.author.length > 0) {
      authors = article.authorList.author
        .map((author: any) => `${author.firstName || ''} ${author.lastName || ''}`.trim())
        .join(', ');
    }
    
    // Extract abstract
    const abstract = article.abstractText || '';
    
    // Extract journal info
    const journal = article.journalInfo?.journal?.title || '';
    
    // Extract publication date
    let publishDate = '';
    if (article.journalInfo?.dateOfPublication) {
      const pubDateStr = article.journalInfo.dateOfPublication;
      const dateParts = pubDateStr.split(' ');
      
      if (dateParts.length >= 2) {
        const year = dateParts[0];
        const month = getMonthNumber(dateParts[1]);
        const day = dateParts.length > 2 ? dateParts[2].padStart(2, '0') : '01';
        publishDate = `${year}-${month}-${day}`;
      } else {
        publishDate = `${pubDateStr}-01-01`; // Default to January 1st if only year is provided
      }
    }
    
    // Extract DOI if available
    const doi = article.doi || '';
    
    // Extract PDF URL if available
    let pdfUrl = '';
    if (article.fullTextUrlList && article.fullTextUrlList.fullTextUrl) {
      const pdfLink = article.fullTextUrlList.fullTextUrl.find(
        (url: any) => url.documentStyle === 'pdf'
      );
      if (pdfLink) {
        pdfUrl = pdfLink.url;
      }
    }
    
    // Determine if peer-reviewed (most journal articles in Europe PMC are peer-reviewed)
    const isPeerReviewed = article.pubTypeList?.pubType?.some(
      (type: string) => !type.toLowerCase().includes('preprint')
    ) ?? true;
    
    // Create study object
    const study: InsertStudy = {
      title,
      authors,
      abstract,
      journal,
      publishDate,
      doi,
      pdfUrl,
      peerReviewed: isPeerReviewed,
      category: 'Hydrogen Research',
      sourcePlatform: 'Europe PMC API'
    };
    
    return study;
  } catch (error) {
    console.error('Error scraping Europe PMC:', error);
    throw error;
  }
}

/**
 * Scrape a CrossRef DOI
 */
async function scrapeCrossRef(url: string): Promise<InsertStudy | null> {
  try {
    // Extract DOI from URL
    let doi = '';
    if (url.includes('doi.org/')) {
      doi = url.split('doi.org/')[1];
    } else {
      const doiMatch = url.match(/\b(10\.\d{4,}\/[^\/\s]+)\b/);
      doi = doiMatch ? doiMatch[1] : '';
    }
    
    if (!doi) {
      throw new Error('Could not extract DOI from URL');
    }
    
    // Fetch metadata from CrossRef API
    const response = await axios.get(`https://api.crossref.org/works/${doi}`);
    const data = response.data.message;
    
    // Extract study data
    const title = data.title ? data.title[0] : '';
    
    // Extract authors
    const authorNames: string[] = [];
    if (data.author) {
      data.author.forEach((author: any) => {
        const name = `${author.given || ''} ${author.family || ''}`.trim();
        if (name) authorNames.push(name);
      });
    }
    const authors = authorNames.join(', ');
    
    // Extract journal
    const journal = data['container-title'] ? data['container-title'][0] : '';
    
    // Extract publish date
    let publishDate = '';
    if (data.published && data.published['date-parts'] && data.published['date-parts'][0]) {
      const dateParts = data.published['date-parts'][0];
      publishDate = dateParts.length === 3 
        ? `${dateParts[0]}-${String(dateParts[1]).padStart(2, '0')}-${String(dateParts[2]).padStart(2, '0')}`
        : dateParts[0].toString();
    }
    
    // Extract abstract
    const abstract = data.abstract || '';
    
    // Determine if peer-reviewed (based on type)
    const peerReviewed = data.type === 'journal-article';
    
    // Create study object
    const study: InsertStudy = {
      title,
      authors,
      abstract,
      journal,
      publishDate,
      doi,
      peerReviewed,
      category: 'Hydrogen Research',
      sourcePlatform: 'CrossRef'
    };
    
    return study;
  } catch (error) {
    console.error('Error scraping CrossRef:', error);
    throw error;
  }
}

/**
 * Scrape a Semantic Scholar page
 */
async function scrapeSemanticScholar(url: string): Promise<InsertStudy | null> {
  try {
    // Extract paper ID from URL
    const idMatch = url.match(/\/paper\/([^\/]+)/);
    const paperId = idMatch ? idMatch[1] : null;
    
    if (!paperId) {
      throw new Error('Could not extract paper ID from Semantic Scholar URL');
    }
    
    // Fetch HTML content
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Extract study data
    const title = $('h1').text().trim();
    
    // Extract authors
    const authorElements = $('.paper-meta-item a[data-selenium-selector="author-link"]');
    const authorNames: string[] = [];
    authorElements.each((i, el) => {
      authorNames.push($(el).text().trim());
    });
    const authors = authorNames.join(', ');
    
    // Extract abstract
    const abstract = $('.text-truncator__text').text().trim();
    
    // Extract journal info
    const journal = $('.slate-container > span:first').text().trim();
    
    // Extract publication date
    const yearElement = $('.paper-year');
    const publishDate = yearElement.length ? yearElement.text().trim() : '';
    
    // Extract DOI if available
    let doi = '';
    $('.badge__content').each((i, el) => {
      const text = $(el).text();
      if (text.includes('DOI:')) {
        doi = text.replace('DOI:', '').trim();
      }
    });
    
    // Determine if peer-reviewed (based on venue type)
    const peerReviewed = journal !== '';
    
    // Create study object
    const study: InsertStudy = {
      title,
      authors,
      abstract,
      journal,
      publishDate: formatPublicationDate(publishDate),
      doi,
      peerReviewed,
      category: 'Hydrogen Research',
      sourcePlatform: 'Semantic Scholar'
    };
    
    return study;
  } catch (error) {
    console.error('Error scraping Semantic Scholar:', error);
    throw error;
  }
}

/**
 * Format publication date to ISO string
 */
function formatPublicationDate(dateText: string): string {
  // Handle empty dates
  if (!dateText) return '';
  
  try {
    // Try to parse various date formats
    
    // Full date format (e.g., "2022 Jan 15")
    const fullDateMatch = dateText.match(/(\d{4})\s+([A-Za-z]{3})\s+(\d{1,2})/);
    if (fullDateMatch) {
      const [, year, monthName, day] = fullDateMatch;
      const month = getMonthNumber(monthName);
      return `${year}-${month}-${day.padStart(2, '0')}`;
    }
    
    // Year and month format (e.g., "2022 Jan")
    const yearMonthMatch = dateText.match(/(\d{4})\s+([A-Za-z]{3})/);
    if (yearMonthMatch) {
      const [, year, monthName] = yearMonthMatch;
      const month = getMonthNumber(monthName);
      return `${year}-${month}-01`;
    }
    
    // ISO date format (e.g., "2022-01-15")
    const isoMatch = dateText.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return dateText;
    }
    
    // Year only (e.g., "2022")
    const yearMatch = dateText.match(/(\d{4})/);
    if (yearMatch) {
      return `${yearMatch[1]}-01-01`;
    }
    
    // If all patterns fail, return original
    return dateText;
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateText;
  }
}

/**
 * Convert month name to month number
 */
function getMonthNumber(monthName: string): string {
  const months: { [key: string]: string } = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };
  
  const shortMonth = monthName.toLowerCase().substring(0, 3);
  return months[shortMonth] || '01';
}

/**
 * Check if a study appears to be peer-reviewed based on page content
 */
function isPeerReviewed($: cheerio.CheerioAPI): boolean {
  const pageText = $('body').text().toLowerCase();
  
  // Check for common terms that indicate peer review
  const peerReviewTerms = [
    'peer reviewed', 'peer-reviewed', 'journal', 'academic',
    'published in', 'publication', 'doi:', 'pmid:'
  ];
  
  return peerReviewTerms.some(term => pageText.includes(term));
}

/**
 * Helper to extract text from multiple possible selectors
 */
function extractTextFromSelectors($: cheerio.CheerioAPI, selectors: string[]): string {
  for (const selector of selectors) {
    const element = $(selector);
    if (element.length) {
      return element.text().trim();
    }
  }
  return '';
}

/**
 * Scrape a CORE API article
 */
async function scrapeCoreAPI(url: string): Promise<InsertStudy | null> {
  try {
    // Extract article ID from URL
    const idMatch = url.match(/\/works\/(\d+)/);
    const articleId = idMatch ? idMatch[1] : null;
    
    if (!articleId) {
      throw new Error('Could not extract article ID from CORE URL');
    }
    
    if (!process.env.CORE_API_KEY) {
      throw new Error('CORE_API_KEY environment variable not set');
    }
    
    // Fetch article data from CORE API
    const response = await axios.get(`https://api.core.ac.uk/v3/works/${articleId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CORE_API_KEY}`
      }
    });
    
    const data = response.data;
    
    // Extract study data
    const title = data.title || '';
    
    // Extract authors
    const authorNames: string[] = [];
    if (data.authors) {
      data.authors.forEach((author: any) => {
        const name = author.name || '';
        if (name) authorNames.push(name);
      });
    }
    const authors = authorNames.join(', ');
    
    // Extract abstract
    const abstract = data.abstract || '';
    
    // Extract journal info
    const journal = data.journalName || data.publisher || '';
    
    // Extract publication date
    let publishDate = data.publicationDate || '';
    
    // Extract DOI if available
    const doi = data.doi || '';
    
    // Extract PDF URL if available
    const pdfUrl = data.downloadUrl || '';
    
    // Determine if peer-reviewed (most academic papers in CORE are)
    const peerReviewed = data.documentType === 'journal-article' || data.documentType === 'proceedings-article';
    
    // Create study object
    const study: InsertStudy = {
      title,
      authors,
      abstract,
      journal,
      publishDate: formatPublicationDate(publishDate),
      doi,
      pdfUrl,
      peerReviewed,
      category: 'Hydrogen Research',
      sourcePlatform: 'CORE'
    };
    
    return study;
  } catch (error) {
    console.error('Error scraping CORE:', error);
    throw error;
  }
}

// Rxivist platform has been discontinued

/**
 * Scrape Dimensions.ai
 * Note: Dimensions requires institutional access or subscription for full API
 * This currently uses HTML scraping as fallback
 */
async function scrapeDimensions(url: string): Promise<InsertStudy | null> {
  try {
    // For Dimensions, we'll have to scrape the HTML directly
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Extract study data
    const title = $('h1.title').text().trim();
    
    // Extract authors
    const authorElements = $('.author-list span.author-name');
    const authorNames: string[] = [];
    authorElements.each((i, el) => {
      authorNames.push($(el).text().trim());
    });
    const authors = authorNames.join(', ');
    
    // Extract abstract
    const abstract = $('.abstract-content').text().trim();
    
    // Extract journal info
    const journal = $('.journal-title').text().trim();
    
    // Extract publication date
    const publishDate = $('.pub-date').text().trim();
    
    // Extract DOI if available
    let doi = '';
    $('.identifiers span').each((i, el) => {
      const text = $(el).text();
      if (text.toLowerCase().includes('doi:')) {
        doi = text.replace(/doi:\s*/i, '').trim();
      }
    });
    
    // Determine if peer-reviewed
    const peerReviewed = $('.publication-type').text().toLowerCase().includes('journal');
    
    // Create study object
    const study: InsertStudy = {
      title,
      authors,
      abstract,
      journal,
      publishDate: formatPublicationDate(publishDate),
      doi,
      peerReviewed,
      category: 'Hydrogen Research',
      sourcePlatform: 'Dimensions'
    };
    
    return study;
  } catch (error) {
    console.error('Error scraping Dimensions:', error);
    throw error;
  }
}

/**
 * Helper to delay execution
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}