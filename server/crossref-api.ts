/**
 * CrossRef API Integration
 * Documentation: https://api.crossref.org/swagger-ui/index.html
 */
import axios from 'axios';
import { InsertStudy } from '@shared/schema';

// CrossRef API URL
const CROSSREF_API_URL = 'https://api.crossref.org/works';

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
  pageSize: number = 10
): Promise<any> {
  try {
    const offset = (page - 1) * pageSize;
    
    // Formulate the query to focus on hydrogen-related studies
    const formattedQuery = `${query}+hydrogen`;
    
    // Make API request to CrossRef
    const response = await axios.get(`${CROSSREF_API_URL}`, {
      params: {
        query: formattedQuery,
        rows: pageSize,
        offset: offset,
        sort: 'relevance',
        order: 'desc'
      }
    });
    
    return {
      items: response.data.message.items || [],
      totalResults: response.data.message['total-results'] || 0,
      page: page,
      pageSize: pageSize
    };
  } catch (error) {
    console.error('Error searching CrossRef:', error);
    throw new Error('Failed to search CrossRef API');
  }
}

/**
 * Get detailed article information from CrossRef by DOI
 * @param doi Digital Object Identifier
 * @returns Article data
 */
export async function getCrossRefArticleByDOI(doi: string): Promise<any> {
  try {
    // CrossRef API accepts DOIs directly in the URL path
    const encodedDOI = encodeURIComponent(doi);
    const response = await axios.get(`${CROSSREF_API_URL}/${encodedDOI}`);
    
    return response.data.message;
  } catch (error) {
    console.error('Error fetching article from CrossRef:', error);
    throw new Error('Failed to fetch article from CrossRef API');
  }
}

/**
 * Extract study data from CrossRef API response
 * @param articleData Article data from CrossRef API
 * @returns Formatted study data for insertion
 */
export function extractStudyFromCrossRef(articleData: any): InsertStudy | null {
  try {
    if (!articleData || !articleData.title || articleData.title.length === 0) {
      return null;
    }
    
    // Extract authors
    const authors = articleData.author?.map((author: any) => {
      return `${author.given || ''} ${author.family || ''}`.trim();
    }).join(', ') || '';
    
    // Extract publication date
    let publishDate = '';
    if (articleData.published) {
      const date = articleData.published['date-parts']?.[0];
      if (date && date.length >= 1) {
        // Format: YYYY-MM-DD
        const year = date[0];
        const month = date.length >= 2 ? String(date[1]).padStart(2, '0') : '01';
        const day = date.length >= 3 ? String(date[2]).padStart(2, '0') : '01';
        publishDate = `${year}-${month}-${day}`;
      }
    }
    
    // Default to publication date if available, otherwise use created date
    if (!publishDate && articleData.created) {
      const date = articleData.created['date-parts']?.[0];
      if (date && date.length >= 1) {
        const year = date[0];
        const month = date.length >= 2 ? String(date[1]).padStart(2, '0') : '01';
        const day = date.length >= 3 ? String(date[2]).padStart(2, '0') : '01';
        publishDate = `${year}-${month}-${day}`;
      }
    }
    
    // Extract first and other authors
    let firstAuthor = '';
    let otherAuthors = '';
    let lastAuthor = '';
    
    if (authors) {
      const authorArray = authors.split(', ');
      if (authorArray.length > 0) {
        firstAuthor = authorArray[0];
        if (authorArray.length > 1) {
          lastAuthor = authorArray[authorArray.length - 1];
          otherAuthors = authorArray.slice(1, -1).join(', ');
        }
      }
    }
    
    // Create study object for insertion
    const study: InsertStudy = {
      title: Array.isArray(articleData.title) ? articleData.title[0] : articleData.title,
      abstract: articleData.abstract || '',
      authors: authors,
      firstAuthor: firstAuthor,
      otherAuthors: otherAuthors,
      lastAuthor: lastAuthor,
      journal: articleData['container-title']?.[0] || '',
      publishDate: publishDate,
      category: 'Uncategorized',
      peerReviewed: isPeerReviewed(articleData),
      methods: null,
      results: null,
      conclusion: null,
      doi: articleData.DOI || null,
      pdfUrl: articleData.link?.find((l: any) => l.content_type?.includes('pdf'))?.URL || null,
      citationUrl: `https://doi.org/${articleData.DOI}`,
      keywords: extractKeywords(articleData),
      sourcePlatform: 'CrossRef',
      healthConditions: [],
      bodySystems: [],
      // Hydrogen research specific fields with default values
      rank: null,
      model: null,
      primaryTopic: null,
      secondaryTopic: null,
      tertiaryTopic: null,
      vehicle: null,
      pH: null,
      application: null,
      duration: null,
      comparison: null,
      complement: null,
      country: null
    };
    
    return study;
  } catch (error) {
    console.error('Error extracting study from CrossRef data:', error);
    return null;
  }
}

/**
 * Determine if an article is peer-reviewed based on CrossRef metadata
 */
function isPeerReviewed(articleData: any): boolean {
  // Check if the article has a DOI (most peer-reviewed articles do)
  if (!articleData.DOI) {
    return false;
  }
  
  // Check the type of publication
  const type = articleData.type?.toLowerCase();
  if (['journal-article', 'journal_article'].includes(type)) {
    return true;
  }
  
  // Check if the container title (journal) exists
  if (articleData['container-title'] && articleData['container-title'].length > 0) {
    return true;
  }
  
  return false;
}

/**
 * Extract keywords from CrossRef data
 */
function extractKeywords(articleData: any): string[] {
  const keywords: string[] = [];
  
  // Extract subject keywords if available
  if (articleData.subject && Array.isArray(articleData.subject)) {
    keywords.push(...articleData.subject);
  }
  
  // Add keywords from title
  if (articleData.title && Array.isArray(articleData.title) && articleData.title.length > 0) {
    const titleWords = articleData.title[0]
      .split(/\s+/)
      .filter((word: string) => word.length > 3 && !['with', 'from', 'that', 'this', 'through'].includes(word.toLowerCase()))
      .slice(0, 5);
    keywords.push(...titleWords);
  }
  
  return Array.from(new Set(keywords));
}