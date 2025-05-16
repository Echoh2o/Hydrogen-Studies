import { Router } from 'express';
import axios from 'axios';
import { storage } from '../storage';
import { insertStudySchema } from '@shared/schema';
import { db } from '../db';
import { studies } from '@shared/schema';
import { extractStudyFromEuropePMC, searchEuropePMC, getEuropePMCArticle } from '../europepmc-api';

const router = Router();

/**
 * Search Europe PMC for articles
 * 
 * This endpoint searches Europe PMC for articles matching the provided query 
 * and returns paginated results.
 */
router.get('/europepmc/search', async (req, res) => {
  try {
    const { query, page = '1', size = '10', sortBy = '' } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    // Enhance query with hydrogen-related terms if not present
    const searchQuery = enhanceSearchQuery(query as string);
    const pageNum = parseInt(page as string, 10);
    const pageSize = parseInt(size as string, 10);
    
    const results = await searchEuropePMC(searchQuery, pageNum, pageSize);
    
    // Calculate total pages
    const totalResults = results.hitCount || 0;
    const totalPages = Math.ceil(totalResults / pageSize);
    
    res.json({
      data: results,
      metadata: {
        total: totalResults,
        page: pageNum,
        pageSize,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error searching Europe PMC:', error);
    res.status(500).json({ message: 'Failed to search Europe PMC' });
  }
});

/**
 * Get detailed article information from Europe PMC
 * 
 * This endpoint retrieves full details about a specific article from Europe PMC
 * based on its identifier (PMID, PMCID, or DOI).
 */
router.get('/europepmc/article', async (req, res) => {
  try {
    const { id, source } = req.query;
    
    if (!id) {
      return res.status(400).json({ message: 'Article ID is required' });
    }
    
    const articleData = await getEuropePMCArticle(id as string);
    
    // Check if the article already exists in our database
    const existingStudy = await storage.getStudyByIdentifier(id as string);
    
    res.json({
      article: articleData,
      exists: !!existingStudy,
      study: existingStudy
    });
  } catch (error) {
    console.error('Error fetching Europe PMC article:', error);
    res.status(500).json({ message: 'Failed to fetch article from Europe PMC' });
  }
});

/**
 * Preview an article from Europe PMC
 * 
 * This endpoint takes a Europe PMC URL and extracts the relevant article data,
 * returning it in the format used by our application.
 */
router.post('/europepmc/preview', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }
    
    const idInfo = extractIdFromUrl(url);
    
    if (!idInfo) {
      return res.status(400).json({ message: 'Invalid Europe PMC URL' });
    }
    
    const articleData = await getEuropePMCArticle(idInfo.id);
    const studyData = extractStudyFromEuropePMC(articleData);
    
    if (!studyData) {
      return res.status(400).json({ message: 'Failed to extract study data from article' });
    }
    
    res.json({
      success: true,
      study: studyData
    });
  } catch (error) {
    console.error('Error previewing Europe PMC article:', error);
    res.status(500).json({ message: 'Failed to preview article from Europe PMC' });
  }
});

/**
 * Save an article from Europe PMC to the database
 * 
 * This endpoint saves an article from Europe PMC to the database
 * based on its identifier (PMID, PMCID, or DOI).
 */
router.post('/europepmc/save', async (req, res) => {
  try {
    const { id, source } = req.body;
    
    if (!id) {
      return res.status(400).json({ message: 'Article ID is required' });
    }
    
    // Check if the article already exists in our database
    const existingStudy = await storage.getStudyByIdentifier(id as string);
    
    if (existingStudy) {
      return res.status(409).json({ 
        success: false,
        message: 'This study already exists in the database',
        studyId: existingStudy.id
      });
    }
    
    // Fetch the article data from Europe PMC
    const articleData = await getEuropePMCArticle(id as string);
    
    // Extract study data
    const studyData = extractStudyFromEuropePMC(articleData);
    
    if (!studyData) {
      return res.status(400).json({ 
        success: false,
        message: 'Failed to extract study data from article' 
      });
    }
    
    // Parse the study data using the schema to ensure it's valid
    const parsedData = insertStudySchema.safeParse(studyData);
    
    if (!parsedData.success) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid study data',
        errors: parsedData.error
      });
    }
    
    // Save the study to the database
    const study = await storage.createStudy(studyData);
    
    res.json({
      success: true,
      message: 'Study saved successfully',
      study
    });
  } catch (error) {
    console.error('Error saving Europe PMC article:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to save article from Europe PMC' 
    });
  }
});

/**
 * Helper function to enhance search queries with hydrogen-related terms
 * if they are not already present.
 */
function enhanceSearchQuery(query: string): string {
  const hydrogenTerms = ['hydrogen', 'H2', 'molecular hydrogen', 'molecular H2', 'hydrogen water', 'hydrogen gas', 'hydrogen-rich'];
  
  // Check if any hydrogen term is already in the query
  const containsHydrogenTerm = hydrogenTerms.some(term => 
    query.toLowerCase().includes(term.toLowerCase())
  );
  
  // If no hydrogen term is found, add "hydrogen OR H2" to the query
  if (!containsHydrogenTerm) {
    return `(${query}) AND (hydrogen OR "molecular hydrogen" OR H2)`;
  }
  
  return query;
}

/**
 * Helper function to extract ID and ID type from a Europe PMC URL
 */
function extractIdFromUrl(url: string): { id: string; idType: string } | null {
  // Example URLs:
  // https://europepmc.org/article/MED/12345678
  // https://europepmc.org/article/PMC/PMC12345678
  // https://europepmc.org/article/DOI/10.1234/journal.abcd.1234567
  
  const patterns = [
    { regex: /\/article\/MED\/(\d+)/i, type: 'pmid' },
    { regex: /\/article\/PMC\/(PMC\d+)/i, type: 'pmcid' },
    { regex: /\/article\/DOI\/([^\/]+\/[^\/]+)/i, type: 'doi' }
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern.regex);
    if (match && match[1]) {
      return { id: match[1], idType: pattern.type };
    }
  }
  
  return null;
}

export default router;