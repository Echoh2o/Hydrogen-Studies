import { Router } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { db } from '../db';
import { studies } from '../../shared/schema';
import { sql } from 'drizzle-orm';
import { enrichStudyFromPubMed } from '../pubmed-enricher';
// Note: Direct scraper functionality removed during cleanup

// Check if PubMed API key is available
const PUBMED_API_KEY = process.env.PUBMED_API_KEY;

const router = Router();

// Schema for validating discovery parameters
const discoverSchema = z.object({
  keywords: z.string().optional(),
  source: z.enum(['pubmed', 'all']).default('pubmed'),
  limit: z.number().min(1).max(100).default(10)
});

/**
 * Discover new research articles
 */
router.post('/research/discover', async (req, res) => {
  try {
    const { keywords, source, limit } = discoverSchema.parse(req.body);
    
    // Default to searching for hydrogen studies if no keywords provided
    const searchTerms = keywords || 'hydrogen therapy molecular hydrogen hydrogen water hydrogen gas';
    
    let articles: any[] = [];
    
    // Search PubMed for articles
    if (source === 'pubmed' || source === 'all') {
      const pubmedArticles = await searchPubMed(searchTerms, limit);
      articles = [...articles, ...pubmedArticles.results || []];
    }
    
    return res.json({
      success: true,
      articles,
      count: articles.length
    });
  } catch (error: any) {
    console.error('Error discovering research:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to discover research articles'
    });
  }
});

/**
 * Import a discovered article
 */
router.post('/research/import', async (req, res) => {
  try {
    const { pmid, autoEnrich } = req.body;
    
    if (!pmid) {
      return res.status(400).json({
        success: false,
        message: 'PMID is required'
      });
    }
    
    // Check if article already exists
    const existingStudy = await db.query.studies.findFirst({
      where: (studiesTable, { like }) => {
        return like(studiesTable.url, `%${pmid}%`);
      }
    });
    
    if (existingStudy) {
      return res.status(400).json({
        success: false,
        message: `Study with PMID ${pmid} already exists in the database`,
        study: existingStudy
      });
    }
    
    // Add minimal study record
    const [study] = await db.insert(studies)
      .values({
        title: 'Pending PubMed Import',
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        abstract: '',
        journal: '',
        authors: '',
        category: 'Pending Classification',
        publishDate: new Date().toISOString().split('T')[0]
      })
      .returning();
    
    // Auto-enrich from PubMed if requested
    let enrichResult = { success: false, message: 'Enrichment not requested' };
    
    if (autoEnrich && study) {
      enrichResult = await enrichStudyFromPubMed(study.id);
    }
    
    return res.json({
      success: true,
      message: 'Article added to database',
      study,
      enriched: enrichResult.success,
      enrichMessage: enrichResult.message
    });
  } catch (error: any) {
    console.error('Error importing article:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to import article'
    });
  }
});

/**
 * Search PubMed for articles
 */
export async function searchPubMed(query: string, page: number = 1, pageSize: number = 10): Promise<{results: any[], total: number}> {
  try {
    const apiKey = process.env.PUBMED_API_KEY;
    
    if (!apiKey) {
      throw new Error('PubMed API key is not configured');
    }
    
    // First, search for article IDs
    const searchUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
    const searchParams = {
      db: 'pubmed',
      term: query,
      retmode: 'json',
      retmax: limit,
      api_key: apiKey
    };
    
    const searchResponse = await axios.get(searchUrl, { params: searchParams });
    const idList = searchResponse.data.esearchresult.idlist;
    
    if (!idList || idList.length === 0) {
      return [];
    }
    
    // Then, get summaries for those IDs
    const summaryUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';
    const summaryParams = {
      db: 'pubmed',
      id: idList.join(','),
      retmode: 'json',
      api_key: apiKey
    };
    
    const summaryResponse = await axios.get(summaryUrl, { params: summaryParams });
    const results = summaryResponse.data.result;
    
    // Convert to our article format
    const articles = idList.map((id: string) => {
      const articleData = results[id];
      
      if (!articleData) return null;
      
      return {
        pmid: id,
        title: articleData.title || 'Untitled Article',
        authors: formatAuthors(articleData.authors),
        journal: articleData.fulljournalname || articleData.source || '',
        publicationDate: formatPubDate(articleData.pubdate),
        year: extractYear(articleData.pubdate),
        abstract: '', // Summaries don't include abstracts
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        inDatabase: false // Will be checked by frontend
      };
    }).filter(Boolean);
    
    return articles;
  } catch (error) {
    console.error('Error searching PubMed:', error);
    return [];
  }
}

/**
 * Format author list from PubMed data
 */
function formatAuthors(authors: any[]): string {
  if (!authors || !Array.isArray(authors)) return '';
  
  return authors
    .filter(author => author.name)
    .map(author => author.name)
    .join(', ');
}

/**
 * Format publication date from PubMed data
 */
function formatPubDate(pubdate: string): string {
  if (!pubdate) return '';
  
  return pubdate;
}

/**
 * Extract year from publication date
 */
function extractYear(pubdate: string): number | null {
  if (!pubdate) return null;
  
  const yearMatch = pubdate.match(/\b(19|20)\d{2}\b/);
  
  if (yearMatch) {
    return parseInt(yearMatch[0], 10);
  }
  
  return null;
}

/**
 * Search for research articles
 */
router.get('/research/search', async (req, res) => {
  try {
    // Extract query parameters
    const query = req.query.query as string || 'hydrogen therapy';
    const source = req.query.source as string || 'pubmed';
    const startIndex = parseInt(req.query.startIndex as string || '0');
    const maxResults = parseInt(req.query.maxResults as string || '10');
    const sortBy = req.query.sortBy as string || 'relevance';
    
    if (!PUBMED_API_KEY) {
      return res.status(400).json({
        success: false,
        message: 'PubMed API key is not configured. Please add your PubMed API key in the environment variables.'
      });
    }
    
    // Search PubMed for articles
    if (source === 'pubmed') {
      const articles = await searchPubMedWithPagination(query, startIndex, maxResults, sortBy);
      
      // Check if articles are already in the database
      const articleIds = articles.map(article => article.pmid);
      const existingStudies = await checkArticlesInDatabase(articleIds);
      
      // Mark articles that are already in the database
      const articlesWithDbStatus = articles.map(article => ({
        ...article,
        inDatabase: existingStudies.includes(article.pmid)
      }));
      
      return res.json({
        success: true,
        source: 'pubmed',
        query,
        total: articles.length > 0 ? articles[0].totalResults || articles.length : 0,
        startIndex,
        nextIndex: startIndex + articles.length < (articles[0]?.totalResults || 0) ? 
                  startIndex + maxResults : null,
        articles: articlesWithDbStatus
      });
    } else {
      return res.status(400).json({
        success: false,
        message: `Source '${source}' is not supported yet.`
      });
    }
  } catch (error: any) {
    console.error('Error searching for articles:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to search for articles'
    });
  }
});

/**
 * Search PubMed with pagination support
 */
export async function searchPubMedWithPagination(query: string, start: number = 0, max: number = 10, sortBy: string = 'relevance'): Promise<any[]> {
  try {
    // First, search for article IDs
    const searchUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
    const searchParams = {
      db: 'pubmed',
      term: query,
      retmode: 'json',
      retstart: start,
      retmax: max,
      sort: sortBy === 'pub_date' ? 'date' : 'relevance',
      api_key: PUBMED_API_KEY
    };
    
    const searchResponse = await axios.get(searchUrl, { params: searchParams });
    const data = searchResponse.data.esearchresult;
    const idList = data.idlist;
    const totalResults = parseInt(data.count);
    
    if (!idList || idList.length === 0) {
      return [];
    }
    
    // Then, get summaries for those IDs
    const summaryUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';
    const summaryParams = {
      db: 'pubmed',
      id: idList.join(','),
      retmode: 'json',
      api_key: PUBMED_API_KEY
    };
    
    const summaryResponse = await axios.get(summaryUrl, { params: summaryParams });
    const results = summaryResponse.data.result;
    
    // Convert to our article format
    const articles = idList.map((id: string) => {
      const articleData = results[id];
      
      if (!articleData) return null;
      
      return {
        pmid: id,
        id: id, // Use PMID as the ID
        title: articleData.title || 'Untitled Article',
        authors: formatAuthors(articleData.authors),
        journal: articleData.fulljournalname || articleData.source || '',
        publicationDate: formatPubDate(articleData.pubdate),
        year: extractYear(articleData.pubdate),
        abstract: '', // Summaries don't include abstracts
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        totalResults // Add total results count to each article for pagination info
      };
    }).filter(Boolean);
    
    return articles;
  } catch (error) {
    console.error('Error searching PubMed with pagination:', error);
    return [];
  }
}

/**
 * Check if articles are already in the database
 */
async function checkArticlesInDatabase(pmids: string[]): Promise<string[]> {
  if (!pmids || pmids.length === 0) {
    return [];
  }
  
  try {
    // Find studies with sourceUrl or DOI containing the PMIDs
    const existingIds = [];
    
    for (const pmid of pmids) {
      // Check if pmid is in sourceUrl field
      const sourceUrlResult = await db.select().from(studies).where(
        sql`studies.source_url LIKE ${'%' + pmid + '%'}`
      );
      
      // Check if study exists with this PMID in the DOI field
      const doiResult = await db.select().from(studies).where(
        sql`studies.doi LIKE ${'%' + pmid + '%'}`
      );
      
      if ((sourceUrlResult && sourceUrlResult.length > 0) || 
          (doiResult && doiResult.length > 0)) {
        existingIds.push(pmid);
      }
    }
    
    return existingIds;
  } catch (error) {
    console.error('Error checking database for articles:', error);
    return [];
  }
}

/**
 * Scrape study data directly from a URL (disabled during cleanup)
 */
router.post('/research/scrape-url', async (req, res) => {
  return res.status(503).json({
    success: false,
    message: 'Direct scraping functionality temporarily disabled during system cleanup'
  });
});

/**
 * Preview study data from a URL without saving (disabled during cleanup)
 */
router.post('/research/preview-url', async (req, res) => {
  return res.status(503).json({
    success: false,
    message: 'URL preview functionality temporarily disabled during system cleanup'
  });
});

export default router;