import { Router } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { db } from '../db';
import { studies } from '../../shared/schema';
import { enrichStudyFromPubMed } from '../pubmed-enricher';

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
    
    let articles = [];
    
    // Search PubMed for articles
    if (source === 'pubmed' || source === 'all') {
      const pubmedArticles = await searchPubMed(searchTerms, limit);
      articles = [...articles, ...pubmedArticles];
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
      where: (studies, { like }) => {
        return like(studies.url, `%${pmid}%`);
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
        year: null,
        authors: '',
        categoryId: 1, // Default category
        createdAt: new Date(),
        updatedAt: new Date()
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
async function searchPubMed(query: string, limit: number = 10): Promise<any[]> {
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

export default router;