import axios from 'axios';
import type { InsertStudy } from '@shared/schema';

/**
 * Search Europe PMC for articles
 * @param query Search query string
 * @param page Page number (1-based)
 * @param pageSize Number of results per page
 * @returns Search results
 */
export async function searchEuropePMC(
  query: string,
  page: number = 1,
  pageSize: number = 10
): Promise<any> {
  try {
    const response = await axios.get('https://www.ebi.ac.uk/europepmc/webservices/rest/search', {
      params: {
        query: query,
        resultType: 'core',
        format: 'json',
        pageSize: pageSize,
        page: page
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error searching Europe PMC:', error);
    throw error;
  }
}

/**
 * Get article details by DOI
 * @param doi Digital Object Identifier
 * @returns Article data
 */
export async function getArticleByDOI(doi: string): Promise<any> {
  try {
    const response = await axios.get('https://www.ebi.ac.uk/europepmc/webservices/rest/search', {
      params: {
        query: `DOI:${doi}`,
        resultType: 'core',
        format: 'json'
      }
    });

    if (response.data.hitCount > 0 && response.data.resultList.result.length > 0) {
      return response.data.resultList.result[0];
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching article by DOI ${doi}:`, error);
    throw error;
  }
}

/**
 * Get article details by PubMed ID
 * @param pmid PubMed ID
 * @returns Article data
 */
export async function getArticleByPMID(pmid: string): Promise<any> {
  try {
    const response = await axios.get('https://www.ebi.ac.uk/europepmc/webservices/rest/search', {
      params: {
        query: `EXT_ID:${pmid} AND SRC:MED`,
        resultType: 'core',
        format: 'json'
      }
    });

    if (response.data.hitCount > 0 && response.data.resultList.result.length > 0) {
      return response.data.resultList.result[0];
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching article by PMID ${pmid}:`, error);
    throw error;
  }
}

/**
 * Get article details by PubMed Central ID
 * @param pmcid PubMed Central ID
 * @returns Article data
 */
export async function getArticleByPMCID(pmcid: string): Promise<any> {
  try {
    // Remove PMC prefix if present
    const cleanPMCID = pmcid.startsWith('PMC') ? pmcid.substring(3) : pmcid;
    
    const response = await axios.get('https://www.ebi.ac.uk/europepmc/webservices/rest/search', {
      params: {
        query: `PMCID:PMC${cleanPMCID}`,
        resultType: 'core',
        format: 'json'
      }
    });

    if (response.data.hitCount > 0 && response.data.resultList.result.length > 0) {
      return response.data.resultList.result[0];
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching article by PMCID ${pmcid}:`, error);
    throw error;
  }
}

/**
 * Extract study data from Europe PMC API response
 * @param articleData Article data from Europe PMC API
 * @returns Formatted study data for insertion
 */
export function extractStudyFromEuropePMC(articleData: any): InsertStudy {
  if (!articleData) return null;

  // Determine the publication date
  let publishDate = new Date().toISOString().split('T')[0]; // Default to today
  let journalPublishDate = null;
  
  // First priority: Try to get journalInfo.journalIssueDate
  if (articleData.journalInfo?.journalIssueDate) {
    const dateStr = articleData.journalInfo.journalIssueDate;
    try {
      // Date format can be YYYY MMM DD or YYYY MMM or just YYYY
      const dateParts = dateStr.split(' ');
      if (dateParts.length >= 1) {
        const year = dateParts[0];
        let month = '01';
        let day = '01';
        
        if (dateParts.length >= 2) {
          // Convert month name to number
          const months: { [key: string]: string } = {
            'Jan': '01', 'January': '01',
            'Feb': '02', 'February': '02',
            'Mar': '03', 'March': '03',
            'Apr': '04', 'April': '04',
            'May': '05',
            'Jun': '06', 'June': '06',
            'Jul': '07', 'July': '07',
            'Aug': '08', 'August': '08',
            'Sep': '09', 'September': '09',
            'Oct': '10', 'October': '10',
            'Nov': '11', 'November': '11',
            'Dec': '12', 'December': '12'
          };
          month = months[dateParts[1]] || '01';
          
          if (dateParts.length >= 3) {
            day = dateParts[2].padStart(2, '0');
          }
        }
        
        journalPublishDate = `${year}-${month}-${day}`;
      }
    } catch (error) {
      console.error('Error parsing journal issue date:', error);
    }
  }
  
  // Second priority: Try to get firstPublicationDate
  if (!journalPublishDate && articleData.firstPublicationDate) {
    journalPublishDate = formatEuropePMCDate(articleData.firstPublicationDate);
  }
  
  // Fallback to electronic publication date if available
  if (!journalPublishDate && articleData.electronicPublicationDate) {
    journalPublishDate = formatEuropePMCDate(articleData.electronicPublicationDate);
  }

  // Use journalPublishDate for publishDate if available
  if (journalPublishDate) {
    publishDate = journalPublishDate;
  }

  // Construct the study object
  const study: InsertStudy = {
    title: articleData.title || 'Untitled Study',
    abstract: articleData.abstractText || '',
    authors: articleData.authorString || '',
    journal: articleData.journalInfo?.journal?.title || 'Scientific Journal',
    publishDate,
    journalPublishDate,
    category: 'general', // Default category
    peerReviewed: true, // Assuming all Europe PMC articles are peer-reviewed
    hasMedia: false,
    hasFullText: !!articleData.fullTextUrlList,
    doi: articleData.doi || null,
    imageUrl: null,
    imageAlt: null,
    pdfUrl: null,
    citationUrl: null,
    sourcePlatform: 'EuropePMC'
  };

  return study;
}

/**
 * Format a Europe PMC date (usually in 'YYYY MMM DD' format) to ISO date
 */
function formatEuropePMCDate(dateStr: string): string | null {
  try {
    const dateParts = dateStr.split(' ');
    if (dateParts.length === 0) return null;

    const year = dateParts[0];
    let month = '01';
    let day = '01';
    
    if (dateParts.length >= 2) {
      // Convert month name to number
      const months: { [key: string]: string } = {
        'Jan': '01', 'January': '01',
        'Feb': '02', 'February': '02',
        'Mar': '03', 'March': '03',
        'Apr': '04', 'April': '04',
        'May': '05',
        'Jun': '06', 'June': '06',
        'Jul': '07', 'July': '07',
        'Aug': '08', 'August': '08',
        'Sep': '09', 'September': '09',
        'Oct': '10', 'October': '10',
        'Nov': '11', 'November': '11',
        'Dec': '12', 'December': '12'
      };
      month = months[dateParts[1]] || '01';
      
      if (dateParts.length >= 3) {
        day = dateParts[2].padStart(2, '0');
      }
    }
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error formatting Europe PMC date:', error);
    return null;
  }
}