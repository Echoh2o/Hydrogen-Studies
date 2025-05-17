/**
 * CrossRef API Integration
 * Documentation: https://api.crossref.org/swagger-ui/index.html
 * 
 * Note: CrossRef recommends identifying your application with a proper User-Agent header
 * to prevent being rate-limited as anonymous users.
 */
import axios from 'axios';

// Base URL for CrossRef API
const CROSSREF_API_BASE_URL = 'https://api.crossref.org';

/**
 * Search CrossRef for articles
 * @param query Search query
 * @param page Page number (1-based)
 * @param pageSize Number of results per page
 * @returns Search results
 */
export async function searchCrossRef(
  query: string, 
  page: number = 1, 
  pageSize: number = 20
): Promise<any> {
  try {
    const response = await axios.get(`${CROSSREF_API_BASE_URL}/works`, {
      params: {
        query,
        rows: pageSize,
        offset: (page - 1) * pageSize
      },
      headers: {
        'User-Agent': 'HydrogenStudies.com Research Database/1.0 (https://hydrogenstudies.com; mailto:info@hydrogenstudies.com)'
      }
    });

    return response.data;
  } catch (error) {
    console.error(`Error searching CrossRef for query "${query}":`, error);
    throw error;
  }
}

/**
 * Get detailed article information from CrossRef by DOI
 * @param doi Digital Object Identifier
 * @returns Article data
 */
export async function getCrossRefArticleByDOI(doi: string): Promise<any> {
  try {
    // Encode the DOI to handle special characters
    const encodedDOI = encodeURIComponent(doi);
    
    const response = await axios.get(`${CROSSREF_API_BASE_URL}/works/${encodedDOI}`, {
      headers: {
        'User-Agent': 'HydrogenStudies.com Research Database/1.0 (https://hydrogenstudies.com; mailto:info@hydrogenstudies.com)'
      }
    });

    return response.data;
  } catch (error) {
    console.error(`Error fetching CrossRef data for DOI ${doi}:`, error);
    throw error;
  }
}

/**
 * Extract study data from CrossRef API response
 * @param articleData Article data from CrossRef API
 * @returns Formatted study data for insertion
 */
export function extractStudyFromCrossRef(articleData: any): any {
  try {
    if (!articleData?.message) {
      return null;
    }

    const data = articleData.message;
    
    // Extract publish year from publication date
    let publishYear = null;
    if (data['published-print'] && data['published-print']['date-parts'] && data['published-print']['date-parts'][0]) {
      publishYear = data['published-print']['date-parts'][0][0];
    } else if (data['published-online'] && data['published-online']['date-parts'] && data['published-online']['date-parts'][0]) {
      publishYear = data['published-online']['date-parts'][0][0];
    } else if (data.created && data.created['date-parts'] && data.created['date-parts'][0]) {
      publishYear = data.created['date-parts'][0][0];
    }
    
    // Extract journal publication date
    let journalPublishDate = null;
    if (data['published-print'] && data['published-print']['date-parts'] && data['published-print']['date-parts'][0]) {
      journalPublishDate = formatDateParts(data['published-print']['date-parts'][0]);
    } else if (data['published-online'] && data['published-online']['date-parts'] && data['published-online']['date-parts'][0]) {
      journalPublishDate = formatDateParts(data['published-online']['date-parts'][0]);
    } else if (data.created && data.created['date-parts'] && data.created['date-parts'][0]) {
      journalPublishDate = formatDateParts(data.created['date-parts'][0]);
    }

    // Extract authors
    let authors = 'Unknown Authors';
    if (data.author && data.author.length > 0) {
      authors = data.author.map((author: any) => {
        return `${author.given || ''} ${author.family || ''}`.trim();
      }).join(', ');
    }

    // Determine if paper is peer-reviewed based on type
    const isPeerReviewed = !!(data.type && (
      data.type === 'journal-article' || 
      data.type === 'proceedings-article' || 
      data.type === 'journal-issue'
    ));

    // Extract journal title
    const journal = data['container-title'] && data['container-title'].length > 0 
      ? data['container-title'][0] 
      : 'Scientific Journal';

    const study = {
      title: data.title && data.title.length > 0 ? data.title[0] : 'Untitled Study',
      abstract: data.abstract || 'No abstract available',
      authors: authors,
      journal: journal,
      publishDate: new Date().toISOString().substring(0, 10), // Today's date for website publish date
      journalPublishDate: journalPublishDate || new Date().toISOString().substring(0, 10),
      category: 'General', // Default category - can be updated later
      methods: '',
      results: '',
      conclusion: '',
      doi: data.DOI || '',
      pdfUrl: data.link && data.link.length > 0 ? data.link[0].URL : '',
      citationUrl: `https://doi.org/${data.DOI}`,
      peerReviewed: isPeerReviewed,
      publishYear: publishYear || new Date().getFullYear(),
      country: data.institution ? data.institution : '',
      methodsShort: '',
      resultsShort: '',
      conclusionShort: '',
      objective: '',
      summaryMarkdown: generateSummaryMarkdown(data),
    };

    return study;
  } catch (error) {
    console.error('Error extracting study from CrossRef data:', error);
    return null;
  }
}

/**
 * Format date parts from CrossRef into YYYY-MM-DD
 */
function formatDateParts(dateParts: number[]): string {
  try {
    const year = dateParts[0];
    const month = dateParts.length > 1 ? (dateParts[1] < 10 ? `0${dateParts[1]}` : `${dateParts[1]}`) : '01';
    const day = dateParts.length > 2 ? (dateParts[2] < 10 ? `0${dateParts[2]}` : `${dateParts[2]}`) : '01';
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error formatting date parts:', error);
    return new Date().toISOString().substring(0, 10); // Return current date as fallback
  }
}

/**
 * Generate a markdown summary from the article data
 */
function generateSummaryMarkdown(data: any): string {
  try {
    let markdown = '';
    
    if (data.title && data.title.length > 0) {
      markdown += `# ${data.title[0]}\n\n`;
    }
    
    if (data.author && data.author.length > 0) {
      const authorNames = data.author.map((author: any) => {
        return `${author.given || ''} ${author.family || ''}`.trim();
      }).join(', ');
      
      markdown += `**Authors:** ${authorNames}\n\n`;
    }
    
    if (data['container-title'] && data['container-title'].length > 0) {
      let publishedInfo = `**Published in:** ${data['container-title'][0]}`;
      
      if (data['published-print'] && data['published-print']['date-parts'] && data['published-print']['date-parts'][0]) {
        publishedInfo += ` (${data['published-print']['date-parts'][0][0]})`;
      }
      
      markdown += `${publishedInfo}\n\n`;
    }
    
    if (data.abstract) {
      markdown += `## Abstract\n\n${data.abstract}\n\n`;
    }
    
    if (data.DOI) {
      markdown += `**DOI:** [${data.DOI}](https://doi.org/${data.DOI})\n\n`;
    }
    
    return markdown;
  } catch (error) {
    console.error('Error generating summary markdown:', error);
    return '';
  }
}