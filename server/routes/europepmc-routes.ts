/**
 * Europe PMC API Routes
 * 
 * These routes handle interactions with the Europe PMC API for searching and retrieving
 * academic articles related to hydrogen research.
 */
import { Router } from 'express';
import { z } from 'zod';
import { searchEuropePMC, getEuropePMCArticle, extractStudyFromEuropePMC } from '../europepmc-api';

const router = Router();

const searchQuerySchema = z.object({
  query: z.string().min(1, "Search query is required"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10)
});

const articleIdSchema = z.object({
  id: z.string().min(1, "Article ID is required"),
  idType: z.enum(['PMID', 'PMCID', 'DOI']).optional()
});

/**
 * Search Europe PMC for articles
 * 
 * This endpoint searches Europe PMC for articles matching the provided query 
 * and returns paginated results.
 */
router.get('/search', async (req, res) => {
  try {
    const { query, page, pageSize } = searchQuerySchema.parse(req.query);
    
    // Add hydrogen-related terms to the query if not already present
    const enhancedQuery = enhanceSearchQuery(query);
    
    const results = await searchEuropePMC(enhancedQuery, page, pageSize);
    
    return res.json({
      success: true,
      data: results,
      metadata: {
        page,
        pageSize,
        total: results.hitCount || 0,
        totalPages: Math.ceil((results.hitCount || 0) / pageSize)
      }
    });
  } catch (error) {
    console.error('Error searching Europe PMC:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid search parameters',
        errors: error.errors
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Failed to search Europe PMC'
    });
  }
});

/**
 * Get detailed article information from Europe PMC
 * 
 * This endpoint retrieves full details about a specific article from Europe PMC
 * based on its identifier (PMID, PMCID, or DOI).
 */
router.get('/article/:idType/:id', async (req, res) => {
  try {
    const idType = req.params.idType.toUpperCase();
    const id = req.params.id;
    
    if (!['PMID', 'PMCID', 'DOI'].includes(idType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID type. Must be one of: PMID, PMCID, DOI'
      });
    }
    
    const article = await getEuropePMCArticle(id);
    
    // Extract study data in our application's format
    const studyData = extractStudyFromEuropePMC(article);
    
    return res.json({
      success: true,
      article,
      study: studyData
    });
  } catch (error) {
    console.error('Error fetching article from Europe PMC:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch article from Europe PMC'
    });
  }
});

/**
 * Preview an article from Europe PMC
 * 
 * This endpoint takes a Europe PMC URL and extracts the relevant article data,
 * returning it in the format used by our application.
 */
router.post('/preview', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL is required'
      });
    }
    
    // Extract ID and ID type from URL
    const idInfo = extractIdFromUrl(url);
    
    if (!idInfo) {
      return res.status(400).json({
        success: false,
        message: 'Could not extract article ID from URL'
      });
    }
    
    const { id, idType } = idInfo;
    
    // Fetch article data
    const article = await getEuropePMCArticle(id);
    
    // Extract study data in our application's format
    const studyData = extractStudyFromEuropePMC(article);
    
    return res.json({
      success: true,
      article,
      study: studyData
    });
  } catch (error) {
    console.error('Error previewing Europe PMC article:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to preview article from Europe PMC'
    });
  }
});

/**
 * Helper function to enhance search queries with hydrogen-related terms
 * if they are not already present.
 */
function enhanceSearchQuery(query: string): string {
  // Define hydrogen-related terms
  const hydrogenTerms = ['hydrogen', 'H2', 'molecular hydrogen', 'hydrogen gas', 'hydrogen water', 
                          'hydrogen-rich', 'hydrogen therapy', 'hydrogen medicine'];
  
  // Check if any hydrogen terms are already in the query
  const lowerQuery = query.toLowerCase();
  const hasHydrogenTerm = hydrogenTerms.some(term => lowerQuery.includes(term.toLowerCase()));
  
  // If no hydrogen terms are present, add "hydrogen OR H2" to the query
  if (!hasHydrogenTerm) {
    return `(${query}) AND (hydrogen OR "molecular hydrogen" OR H2)`;
  }
  
  return query;
}

/**
 * Helper function to extract ID and ID type from a Europe PMC URL
 */
function extractIdFromUrl(url: string): { id: string; idType: string } | null {
  // Different URL patterns for Europe PMC
  // Examples:
  // - https://europepmc.org/article/MED/12345678
  // - https://europepmc.org/article/PMC/PMC1234567
  // - https://europepmc.org/article/DOI/10.1234/abc123
  
  const pmcMatch = url.match(/\/article\/PMC\/(PMC\d+)/i);
  const pmidMatch = url.match(/\/article\/MED\/(\d+)/i);
  const doiMatch = url.match(/\/article\/DOI\/([^\/&\?]+)/i);
  
  if (pmcMatch) {
    return { id: pmcMatch[1], idType: 'PMCID' };
  } else if (pmidMatch) {
    return { id: pmidMatch[1], idType: 'PMID' };
  } else if (doiMatch) {
    return { id: doiMatch[1], idType: 'DOI' };
  } else {
    // Try to extract from URL path components
    const urlParts = url.split('/');
    const lastPart = urlParts[urlParts.length - 1];
    
    if (lastPart.startsWith('PMC')) {
      return { id: lastPart, idType: 'PMCID' };
    } else if (/^\d+$/.test(lastPart)) {
      return { id: lastPart, idType: 'PMID' };
    } else if (lastPart.includes('10.')) {
      return { id: lastPart, idType: 'DOI' };
    }
  }
  
  return null;
}

export default router;