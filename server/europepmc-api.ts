/**
 * Europe PMC API Integration
 * Documentation: https://europepmc.org/RestfulWebService
 * 
 * Note: The Europe PMC API endpoint has changed from previous versions.
 * Current endpoint is https://www.ebi.ac.uk/europepmc/webservices/rest
 */
import axios from 'axios';
import { InsertStudy } from '@shared/schema';

const EUROPEPMC_API_BASE = 'https://www.ebi.ac.uk/europepmc/webservices/rest';

// Set headers for Europe PMC API requests to identify our application
const EUROPEPMC_HEADERS = {
  'User-Agent': 'HydrogenStudies/1.0 (https://hydrogenstudies.com; info@hydrogenstudies.com)',
  'Accept': 'application/json'
};

/**
 * Search Europe PMC for articles
 * @param query Search query
 * @param page Page number (1-based)
 * @param pageSize Number of results per page
 * @returns Search results
 */
export async function searchEuropePMC(
  query: string, 
  page: number = 1, 
  pageSize: number = 10, 
  sortBy: string = 'relevance'
): Promise<any> {
  try {
    // Convert sortBy to Europe PMC format
    let sort = 'RELEVANCE';
    if (sortBy === 'date') sort = 'DATE';
    else if (sortBy === 'cited') sort = 'CITED';
    
    const url = `${EUROPEPMC_API_BASE}/search`;
    const response = await axios.get(url, {
      params: {
        query,
        resultType: 'core',
        format: 'json',
        cursorMark: '*',
        pageSize,
        sort
      },
      headers: EUROPEPMC_HEADERS,
      timeout: 15000 // 15 second timeout
    });
    
    // The API response structure has hitCount and resultList
    const resultList = response.data.resultList || { result: [] };
    const hitCount = response.data.hitCount || 0;
    
    return {
      resultList,
      hitCount
    };
  } catch (error: any) {
    console.error('Error searching Europe PMC:', error.message);
    if (error.response) {
      console.error('Europe PMC API response status:', error.response.status);
      console.error('Europe PMC API response data:', error.response.data);
    } else if (error.request) {
      console.error('Europe PMC API request failed to receive response');
    }
    throw new Error('Failed to search Europe PMC');
  }
}

/**
 * Get detailed article information from Europe PMC by ID
 * @param id Article ID (PMID, PMCID, or DOI)
 * @returns Article data
 */
export async function getEuropePMCArticle(id: string): Promise<any> {
  try {
    // Determine the source type
    let source = 'MED';
    if (id.startsWith('PMC')) {
      source = 'PMC';
    } else if (id.includes('/')) {
      source = 'DOI';
    }
    
    // Europe PMC API has changed, now we use article endpoint
    const url = `${EUROPEPMC_API_BASE}/article/${source}/${id}`;
    const response = await axios.get(url, {
      params: {
        format: 'json'
      },
      headers: EUROPEPMC_HEADERS,
      timeout: 15000 // 15 second timeout
    });
    
    return response.data.result;
  } catch (error: any) {
    console.error('Error fetching article from Europe PMC:', error.message);
    if (error.response) {
      console.error('Europe PMC API response status:', error.response.status);
      console.error('Europe PMC API response data:', error.response.data);
    } else if (error.request) {
      console.error('Europe PMC API request failed to receive response');
    }
    throw new Error('Failed to fetch article from Europe PMC');
  }
}

/**
 * Extract study data from Europe PMC API response
 * @param articleData Article data from Europe PMC API
 * @returns Formatted study data for insertion
 */
export function extractStudyFromEuropePMC(articleData: any): InsertStudy | null {
  if (!articleData) return null;
  
  try {
    // Format authors
    const authors = articleData.authorString || 'Unknown Authors';
    
    // Format publication date
    const publishDate = formatEuropePMCDate(
      articleData.journalInfo?.dateOfPublication ||
      `${articleData.pubYear || new Date().getFullYear()} Jan 01`
    );
    
    // Determine if peer reviewed
    const isPeerReviewed = 
      articleData.pubTypeList?.pubType?.some((type: string) => 
        type.toLowerCase().includes('journal article')
      ) || false;
    
    // Extract identifiers
    const doi = articleData.doi || '';
    const pmid = articleData.pmid || '';
    const pmcid = articleData.pmcid || '';
    
    // Create base URL for PDF and citation if available
    let pdfUrl = '';
    let citationUrl = '';
    
    if (pmid) {
      pdfUrl = `https://www.ncbi.nlm.nih.gov/pubmed/${pmid}`;
      citationUrl = `https://www.ncbi.nlm.nih.gov/pubmed/${pmid}`;
    } else if (pmcid) {
      pdfUrl = `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid}/pdf/`;
      citationUrl = `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid}/`;
    } else if (doi) {
      pdfUrl = `https://doi.org/${doi}`;
      citationUrl = `https://doi.org/${doi}`;
    }
    
    // If fullTextUrlList is available, prioritize it for PDF URL
    if (articleData.fullTextUrlList?.fullTextUrl) {
      const pdfLinks = articleData.fullTextUrlList.fullTextUrl.filter(
        (url: any) => url.documentStyle === 'pdf'
      );
      
      if (pdfLinks.length > 0) {
        pdfUrl = pdfLinks[0].url;
      }
    }
    
    // Extract journal information
    const journal = articleData.journalInfo?.journal?.title || 
                   articleData.journalTitle || 
                   'Unknown Journal';
    
    // Default to "Inflammation" category for hydrogen studies
    // This can be refined with more specific logic later
    const category = "Inflammation";
    
    const study: InsertStudy = {
      title: articleData.title || 'Untitled Study',
      abstract: articleData.abstractText || '',
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
      keywords: articleData.keywordList?.keyword || [],
      imageUrl: null,
      imageAlt: null,
      featured: false,
      sourcePlatform: 'EuropePMC',
      // Hydrogen-specific fields
      hydrogenAdministration: null,
      dosingRegimen: null,
      healthCondition: null,
      bodySystem: null,
      hasPositiveEffect: null,
      hasNegativeEffect: null,
      hasNeutralEffect: null,
      firstAuthor: extractFirstAuthor(authors),
      lastAuthor: extractLastAuthor(authors),
      otherAuthors: extractOtherAuthors(authors),
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
    console.error('Error extracting study from Europe PMC data:', error);
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
    // Common formats: "2022 Jan 01" or "2022" or "2022 Jan"
    const parts = dateStr.trim().split(' ');
    const year = parts[0];
    const month = parts.length > 1 ? getMonthNumber(parts[1]) : '01';
    const day = parts.length > 2 ? parts[2].padStart(2, '0') : '01';
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    // Return current date if parsing fails
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Convert month name to month number
 * @param monthName Month name (Jan, Feb, etc.)
 * @returns Month number as string, padded with leading zero if needed
 */
function getMonthNumber(monthName: string): string {
  const months: Record<string, string> = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };
  
  const shortName = monthName.toLowerCase().substring(0, 3);
  return months[shortName] || '01';
}

/**
 * Extract the first author from the authors string
 */
function extractFirstAuthor(authors: string): string {
  if (!authors) return '';
  
  // Handle comma-separated author lists
  if (authors.includes(',')) {
    return authors.split(',')[0].trim();
  }
  
  // Handle "et al." format
  if (authors.includes('et al.')) {
    return authors.split('et al.')[0].trim();
  }
  
  return authors;
}

/**
 * Extract the last author from the authors string
 */
function extractLastAuthor(authors: string): string {
  if (!authors) return '';
  
  // Handle comma-separated author lists
  if (authors.includes(',')) {
    const authorList = authors.split(',');
    return authorList[authorList.length - 1].trim();
  }
  
  // For "et al." format, we don't know the last author
  return '';
}

/**
 * Extract other authors (excluding first and last) from the authors string
 */
function extractOtherAuthors(authors: string): string {
  if (!authors) return '';
  
  // Handle comma-separated author lists
  if (authors.includes(',')) {
    const authorList = authors.split(',');
    if (authorList.length <= 2) return '';
    
    // Remove first and last authors
    authorList.shift();
    authorList.pop();
    
    return authorList.join(',').trim();
  }
  
  // For "et al." format, we represent other authors as "et al."
  if (authors.includes('et al.')) {
    return 'et al.';
  }
  
  return '';
}