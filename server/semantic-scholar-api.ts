/**
 * Semantic Scholar API Integration
 * Documentation: https://www.semanticscholar.org/product/api
 * 
 * Note: Semantic Scholar recommends using a User-Agent header for identification
 * and requests that heavy usage include contact information.
 */
import axios from 'axios';
import { InsertStudy } from '@shared/schema';

const SEMANTIC_SCHOLAR_API_BASE = 'https://api.semanticscholar.org/graph/v1';

// Set headers for Semantic Scholar API requests to identify our application
const SEMANTIC_SCHOLAR_HEADERS = {
  'User-Agent': 'HydrogenStudies/1.0 (https://hydrogenstudies.com; info@hydrogenstudies.com)',
  'Accept': 'application/json'
};

/**
 * Search Semantic Scholar for papers
 * @param query Search query
 * @param page Page number (0-based)
 * @param pageSize Number of results per page
 * @returns Search results
 */
export async function searchSemanticScholar(
  query: string,
  page: number = 0,
  pageSize: number = 10,
  fields: string[] = ['title', 'abstract', 'authors', 'venue', 'year', 'url', 'publicationTypes', 'externalIds']
): Promise<any> {
  try {
    // Enhance query with hydrogen if not present
    const enhancedQuery = enhanceSearchQuery(query);
    
    const url = `${SEMANTIC_SCHOLAR_API_BASE}/paper/search`;
    const response = await axios.get(url, {
      params: {
        query: enhancedQuery,
        offset: page * pageSize,
        limit: pageSize,
        fields: fields.join(',')
      },
      headers: SEMANTIC_SCHOLAR_HEADERS,
      timeout: 15000 // 15 second timeout
    });
    
    return response.data;
  } catch (error: any) {
    console.error('Error searching Semantic Scholar:', error.message);
    if (error.response) {
      console.error('Semantic Scholar API response status:', error.response.status);
      console.error('Semantic Scholar API response data:', error.response.data);
    } else if (error.request) {
      console.error('Semantic Scholar API request failed to receive response');
    }
    throw new Error('Failed to search Semantic Scholar');
  }
}

/**
 * Get detailed paper information from Semantic Scholar by ID
 * @param id Paper ID (S2 ID, DOI, etc.)
 * @returns Paper data
 */
export async function getSemanticScholarPaper(id: string): Promise<any> {
  try {
    // Determine the ID type
    let idType = 'DOI';
    
    if (id.startsWith('10.')) {
      idType = 'DOI';
    } else if (/^\d+$/.test(id)) {
      idType = 'PMID';
    } else if (id.startsWith('PMC')) {
      idType = 'PMCID';
    } else {
      idType = 'CORPUSID'; // S2 ID
    }
    
    const fields = [
      'title',
      'abstract',
      'authors',
      'venue',
      'year',
      'referenceCount',
      'citationCount',
      'influentialCitationCount',
      'isOpenAccess',
      'fieldsOfStudy',
      'publicationTypes',
      'publicationDate',
      'journal',
      'url',
      'externalIds'
    ].join(',');
    
    let url = '';
    if (idType === 'CORPUSID') {
      url = `${SEMANTIC_SCHOLAR_API_BASE}/paper/${id}?fields=${fields}`;
    } else {
      url = `${SEMANTIC_SCHOLAR_API_BASE}/paper/${idType}:${id}?fields=${fields}`;
    }
    
    const response = await axios.get(url, {
      headers: SEMANTIC_SCHOLAR_HEADERS,
      timeout: 15000 // 15 second timeout
    });
    return response.data;
  } catch (error: any) {
    console.error('Error fetching paper from Semantic Scholar:', error.message);
    if (error.response) {
      console.error('Semantic Scholar API response status:', error.response.status);
      console.error('Semantic Scholar API response data:', error.response.data);
    } else if (error.request) {
      console.error('Semantic Scholar API request failed to receive response');
    }
    throw new Error('Failed to fetch paper from Semantic Scholar');
  }
}

/**
 * Extract study data from Semantic Scholar API response
 * @param paperData Paper data from Semantic Scholar API
 * @returns Formatted study data for insertion
 */
export function extractStudyFromSemanticScholar(paperData: any): InsertStudy | null {
  if (!paperData) return null;
  
  try {
    // Format authors
    const authorStrings = paperData.authors ? 
      paperData.authors.map((author: any) => author.name) : [];
    const authors = authorStrings.join(', ');
    
    // Format publication date
    const publishDate = paperData.publicationDate || 
      (paperData.year ? `${paperData.year}-01-01` : new Date().toISOString().split('T')[0]);
    
    // Determine if peer reviewed
    const isPeerReviewed = 
      (paperData.publicationTypes && 
       paperData.publicationTypes.some((type: string) => 
         type.toLowerCase().includes('journal'))) || false;
    
    // Extract identifiers
    const doi = paperData.externalIds?.DOI || '';
    const pmid = paperData.externalIds?.PMID || '';
    const pmcid = paperData.externalIds?.PMCID || '';
    const s2id = paperData.paperId || '';
    
    // Create base URL for PDF and citation
    let pdfUrl = paperData.openAccessPdf?.url || '';
    let citationUrl = paperData.url || '';
    
    if (!pdfUrl) {
      if (doi) {
        pdfUrl = `https://doi.org/${doi}`;
      } else if (pmid) {
        pdfUrl = `https://www.ncbi.nlm.nih.gov/pubmed/${pmid}`;
      }
    }
    
    if (!citationUrl) {
      if (doi) {
        citationUrl = `https://doi.org/${doi}`;
      } else if (s2id) {
        citationUrl = `https://www.semanticscholar.org/paper/${s2id}`;
      }
    }
    
    // Extract journal information
    const journal = paperData.journal?.name || paperData.venue || 'Unknown Journal';
    
    // Default to "Inflammation" category for hydrogen studies
    // This can be refined with more specific logic later
    const category = "Inflammation";
    
    // Extract keywords using fields of study
    const keywords = paperData.fieldsOfStudy || [];
    
    const study: InsertStudy = {
      title: paperData.title || 'Untitled Study',
      abstract: paperData.abstract || '',
      authors,
      journal,
      publishDate,
      peerReviewed: isPeerReviewed,
      doi,
      pmid,
      pmcid,
      pdfUrl,
      citationUrl,
      category,
      // Additional fields with default values
      methods: null,
      results: null,
      conclusion: null,
      keywords,
      imageUrl: null,
      imageAlt: null,
      featured: false,
      sourcePlatform: 'SemanticScholar',
      // Hydrogen-specific fields
      hydrogenAdministration: null,
      dosingRegimen: null,
      healthCondition: null,
      bodySystem: null,
      hasPositiveEffect: null,
      hasNegativeEffect: null,
      hasNeutralEffect: null,
      firstAuthor: authorStrings.length > 0 ? authorStrings[0] : '',
      lastAuthor: authorStrings.length > 1 ? authorStrings[authorStrings.length - 1] : '',
      otherAuthors: authorStrings.length > 2 ? 
        authorStrings.slice(1, -1).join(', ') : '',
      region: null,
      country: null,
      pH: null,
      concentration: null,
      duration: null,
      primaryTopic: null,
      secondaryTopic: null,
      tertiaryTopic: null,
      vehicleType: null,
      applicationMethod: null,
      comparisonGroup: null,
      complementaryTherapy: null,
      studyModel: null
    };
    
    return study;
  } catch (error) {
    console.error('Error extracting study from Semantic Scholar data:', error);
    return null;
  }
}

/**
 * Helper function to enhance search queries with hydrogen-related terms
 * if they are not already present.
 */
function enhanceSearchQuery(query: string): string {
  const hydrogenTerms = ['hydrogen', 'h2', 'molecular hydrogen', 'hydrogen-rich'];
  
  // Check if query already contains a hydrogen term
  const lowerQuery = query.toLowerCase();
  const hasHydrogenTerm = hydrogenTerms.some(term => lowerQuery.includes(term));
  
  // If it doesn't, add "hydrogen" to the query
  if (!hasHydrogenTerm) {
    return `${query} hydrogen`;
  }
  
  return query;
}