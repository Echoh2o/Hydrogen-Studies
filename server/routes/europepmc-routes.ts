import { Router, Request, Response } from 'express';
import { searchEuropePMC, getEuropePMCArticle, extractStudyFromEuropePMC } from '../europepmc-api';
import { storage } from '../storage';
import { z } from 'zod';

const router = Router();

/**
 * Search Europe PMC for articles
 * 
 * This endpoint searches Europe PMC for articles matching the provided query 
 * and returns paginated results.
 */
router.get('/api/europepmc/search', async (req: Request, res: Response) => {
  try {
    const { query, page = '1', pageSize = '10', sortBy = 'relevance' } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    // Enhance search query with hydrogen terms if not already present
    const enhancedQuery = enhanceSearchQuery(query as string);
    
    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    
    const results = await searchEuropePMC(
      enhancedQuery,
      pageNum,
      pageSizeNum,
      sortBy as string
    );
    
    // Format the response properly
    const totalResults = results?.hitCount || 0;
    const totalPages = Math.ceil(totalResults / pageSizeNum);
    
    res.json({
      data: results || { resultList: { result: [] } },
      metadata: {
        total: totalResults,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error searching Europe PMC:', error);
    res.status(500).json({ error: 'Failed to search Europe PMC' });
  }
});

/**
 * Get detailed article information from Europe PMC
 * 
 * This endpoint retrieves full details about a specific article from Europe PMC
 * based on its identifier (PMID, PMCID, or DOI).
 */
router.get('/api/europepmc/article/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Article ID is required' });
    }
    
    const article = await getEuropePMCArticle(id);
    res.json(article);
  } catch (error) {
    console.error('Error fetching article from Europe PMC:', error);
    res.status(500).json({ error: 'Failed to fetch article from Europe PMC' });
  }
});

/**
 * Preview an article from Europe PMC
 * 
 * This endpoint takes a Europe PMC URL and extracts the relevant article data,
 * returning it in the format used by our application.
 */
router.post('/api/europepmc/preview', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Extract ID from URL
    const idInfo = extractIdFromUrl(url);
    
    if (!idInfo) {
      return res.status(400).json({ error: 'Invalid Europe PMC URL' });
    }
    
    // Check if study already exists
    const existingStudy = await storage.getStudyByIdentifier(idInfo.id);
    if (existingStudy) {
      return res.status(409).json({ 
        error: 'This study already exists in the database',
        study: existingStudy
      });
    }
    
    // Fetch article data
    const articleData = await getEuropePMCArticle(idInfo.id);
    
    // Extract study data
    const study = extractStudyFromEuropePMC(articleData);
    
    if (!study) {
      return res.status(404).json({ error: 'Failed to extract study data from article' });
    }
    
    res.json({ study, articleData });
  } catch (error) {
    console.error('Error previewing article from Europe PMC:', error);
    res.status(500).json({ error: 'Failed to preview article from Europe PMC' });
  }
});

/**
 * Save an article from Europe PMC to the database
 * 
 * This endpoint saves an article from Europe PMC to the database
 * based on its identifier (PMID, PMCID, or DOI).
 */
router.post('/api/europepmc/import', async (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Article ID is required' });
    }
    
    // Check if study already exists
    const existingStudy = await storage.getStudyByIdentifier(id);
    if (existingStudy) {
      return res.status(409).json({ 
        error: 'This study already exists in the database',
        study: existingStudy
      });
    }
    
    // Fetch article data
    const articleData = await getEuropePMCArticle(id);
    
    // Extract study data
    const study = extractStudyFromEuropePMC(articleData);
    
    if (!study) {
      return res.status(404).json({ error: 'Failed to extract study data from article' });
    }
    
    // Save study to database
    const savedStudy = await storage.createStudy(study);
    
    res.json({ 
      success: true, 
      message: 'Study imported successfully', 
      study: savedStudy 
    });
  } catch (error) {
    console.error('Error importing article from Europe PMC:', error);
    res.status(500).json({ error: 'Failed to import article from Europe PMC' });
  }
});

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
    return `(${query}) AND hydrogen`;
  }
  
  return query;
}

/**
 * Helper function to extract ID and ID type from a Europe PMC URL
 */
function extractIdFromUrl(url: string): { id: string; idType: string } | null {
  try {
    const pmidMatch = url.match(/\/pubmed\/(\d+)/i);
    if (pmidMatch) {
      return { id: pmidMatch[1], idType: 'PMID' };
    }
    
    const pmcidMatch = url.match(/\/pmc\/articles\/(PMC\d+)/i);
    if (pmcidMatch) {
      return { id: pmcidMatch[1], idType: 'PMCID' };
    }
    
    const doiMatch = url.match(/\/doi\/(10\.[^/]+\/[^/\s]+)/i);
    if (doiMatch) {
      return { id: doiMatch[1], idType: 'DOI' };
    }
    
    // Direct ID extraction from Europe PMC URLs
    const europePmcMatch = url.match(/\/europepmc\/article\/([A-Z]+)\/([^/\s]+)/i);
    if (europePmcMatch) {
      const idType = europePmcMatch[1].toUpperCase();
      let id = europePmcMatch[2];
      
      // Handle different ID types
      if (idType === 'MED') {
        return { id, idType: 'PMID' };
      } else if (idType === 'PMC') {
        // Make sure PMC prefix is included
        if (!id.startsWith('PMC')) {
          id = 'PMC' + id;
        }
        return { id, idType: 'PMCID' };
      } else if (idType === 'DOI') {
        return { id, idType: 'DOI' };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting ID from URL:', error);
    return null;
  }
}

export default router;