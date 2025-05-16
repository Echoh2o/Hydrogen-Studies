/**
 * Europe PMC API Integration
 * Documentation: https://europepmc.org/RestfulWebService
 */
import axios from 'axios';
import { InsertStudy } from '@shared/schema';

const BASE_URL = 'https://www.ebi.ac.uk/europepmc/webservices/rest';

/**
 * Search Europe PMC for articles
 * @param query Search query
 * @param page Page number (1-based)
 * @param pageSize Number of results per page
 * @returns Search results
 */
export async function searchEuropePMC(query: string, page: number = 1, pageSize: number = 10): Promise<any> {
  try {
    const response = await axios.get(`${BASE_URL}/search`, {
      params: {
        query,
        format: 'json',
        pageSize,
        page
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error searching Europe PMC:', error);
    throw error;
  }
}

/**
 * Get detailed article information from Europe PMC by ID
 * @param id Article ID (PMID, PMCID, or DOI)
 * @returns Article data
 */
export async function getEuropePMCArticle(id: string): Promise<any> {
  try {
    // Determine ID type
    let idType = 'ext_id';
    if (id.startsWith('PMC')) {
      idType = 'PMCID';
    } else if (!isNaN(Number(id))) {
      idType = 'PMID';
    } else if (id.includes('/')) {
      idType = 'DOI';
    }
    
    const response = await axios.get(`${BASE_URL}/article/${idType}/${id}`, {
      params: {
        format: 'json'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching Europe PMC article ${id}:`, error);
    throw error;
  }
}

/**
 * Extract study data from Europe PMC API response
 * @param articleData Article data from Europe PMC API
 * @returns Formatted study data for insertion
 */
export function extractStudyFromEuropePMC(articleData: any): InsertStudy | null {
  try {
    if (!articleData || !articleData.result) {
      return null;
    }
    
    const article = articleData.result;
    
    // Extract basic fields
    const title = article.title || '';
    
    // Extract authors
    let authors = '';
    if (article.authorList && article.authorList.author && article.authorList.author.length > 0) {
      authors = article.authorList.author.map((author: any) => 
        `${author.firstName || ''} ${author.lastName || ''}`
      ).join(', ');
    }
    
    // Extract abstract
    let abstract = '';
    if (article.abstractText) {
      abstract = article.abstractText;
    }
    
    // Extract journal info
    const journal = article.journalInfo?.journal?.title || '';
    
    // Extract publication date
    let publishDate = '';
    if (article.journalInfo?.dateOfPublication) {
      const pubDateStr = article.journalInfo.dateOfPublication;
      publishDate = formatEuropePMCDate(pubDateStr);
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
    // This is an assumption; more accurate determination would require additional data
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
    
    // Extract methods, results, and conclusions if available
    if (article.fullTextXML) {
      // If full text XML is available, we could parse it to extract sections
      // This would require XML parsing, which is more complex
      // For now, we'll leave these fields empty
    }
    
    return study;
  } catch (error) {
    console.error('Error extracting Europe PMC study data:', error);
    return null;
  }
}

/**
 * Format a publication date from Europe PMC format (YYYY MMM DD) to ISO date
 * @param dateStr Date string in Europe PMC format
 * @returns ISO date string
 */
function formatEuropePMCDate(dateStr: string): string {
  try {
    // Handle various date formats from Europe PMC
    let year, month, day;
    
    // Format: YYYY MMM DD or YYYY-MM-DD or YYYY
    const parts = dateStr.split(/[\s-]+/);
    
    if (parts.length === 1) {
      // Just year
      year = parts[0];
      return `${year}-01-01`;
    } else if (parts.length === 2) {
      // Year and month
      year = parts[0];
      month = getMonthNumber(parts[1]);
      return `${year}-${month}-01`;
    } else {
      // Full date
      year = parts[0];
      
      // Check if second part is a month name or a month number
      if (isNaN(Number(parts[1]))) {
        month = getMonthNumber(parts[1]);
      } else {
        month = parts[1].padStart(2, '0');
      }
      
      day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (error) {
    console.error('Error formatting date:', error);
    return new Date().toISOString().split('T')[0]; // Default to today's date
  }
}

/**
 * Convert month name to month number
 * @param monthName Month name (Jan, Feb, etc.)
 * @returns Month number as string, padded with leading zero if needed
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
    'sep': '09', 'september': '09',
    'oct': '10', 'october': '10',
    'nov': '11', 'november': '11',
    'dec': '12', 'december': '12'
  };
  
  const key = monthName.toLowerCase().substring(0, 3);
  return months[key] || '01';
}