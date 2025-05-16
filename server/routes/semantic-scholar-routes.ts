import { Router, Request, Response } from 'express';
import { searchSemanticScholar, getSemanticScholarPaper, extractStudyFromSemanticScholar } from '../semantic-scholar-api';
import { storage } from '../storage';
import { z } from 'zod';

const router = Router();

/**
 * Search Semantic Scholar for papers
 * 
 * This endpoint searches Semantic Scholar for papers matching the provided query 
 * and returns paginated results.
 */
router.get('/api/semanticscholar/search', async (req: Request, res: Response) => {
  try {
    const { query, page = '0', pageSize = '10' } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    
    const results = await searchSemanticScholar(
      query as string,
      pageNum,
      pageSizeNum
    );
    
    // Format the response to match the expected structure in the frontend
    const totalResults = results?.total || 0;
    const papers = results?.data || [];
    
    res.json({
      total: totalResults,
      data: papers,
      offset: pageNum * pageSizeNum,
      next: (pageNum + 1) * pageSizeNum < totalResults ? pageNum + 1 : null
    });
  } catch (error) {
    console.error('Error searching Semantic Scholar:', error);
    res.status(500).json({ error: 'Failed to search Semantic Scholar' });
  }
});

/**
 * Get detailed paper information from Semantic Scholar
 * 
 * This endpoint retrieves full details about a specific paper from Semantic Scholar
 * based on its identifier (S2 ID, DOI, PMID, etc.).
 */
router.get('/api/semanticscholar/paper/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Paper ID is required' });
    }
    
    const paper = await getSemanticScholarPaper(id);
    res.json(paper);
  } catch (error) {
    console.error('Error fetching paper from Semantic Scholar:', error);
    res.status(500).json({ error: 'Failed to fetch paper from Semantic Scholar' });
  }
});

/**
 * Preview a paper from Semantic Scholar
 * 
 * This endpoint takes a paper ID (S2 ID, DOI, PMID, etc.) and returns
 * the data in the format used by our application.
 */
router.post('/api/semanticscholar/preview', async (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Paper ID is required' });
    }
    
    // Check if study already exists by DOI or PMID
    const existingStudy = await storage.getStudyByIdentifier(id);
    if (existingStudy) {
      return res.status(409).json({ 
        error: 'This study already exists in the database',
        study: existingStudy
      });
    }
    
    // Fetch paper data
    const paperData = await getSemanticScholarPaper(id);
    
    // Extract study data
    const study = extractStudyFromSemanticScholar(paperData);
    
    if (!study) {
      return res.status(404).json({ error: 'Failed to extract study data from paper' });
    }
    
    res.json({ study, paperData });
  } catch (error) {
    console.error('Error previewing paper from Semantic Scholar:', error);
    res.status(500).json({ error: 'Failed to preview paper from Semantic Scholar' });
  }
});

/**
 * Save a paper from Semantic Scholar to the database
 * 
 * This endpoint saves a paper from Semantic Scholar to the database
 * based on its identifier (S2 ID, DOI, PMID, etc.).
 */
router.post('/api/semanticscholar/import', async (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Paper ID is required' });
    }
    
    // Check if study already exists
    const existingStudy = await storage.getStudyByIdentifier(id);
    if (existingStudy) {
      return res.status(409).json({ 
        error: 'This study already exists in the database',
        study: existingStudy
      });
    }
    
    // Fetch paper data
    const paperData = await getSemanticScholarPaper(id);
    
    // Extract study data
    const study = extractStudyFromSemanticScholar(paperData);
    
    if (!study) {
      return res.status(404).json({ error: 'Failed to extract study data from paper' });
    }
    
    // Save study to database
    const savedStudy = await storage.createStudy(study);
    
    res.json({ 
      success: true, 
      message: 'Study imported successfully', 
      study: savedStudy 
    });
  } catch (error) {
    console.error('Error importing paper from Semantic Scholar:', error);
    res.status(500).json({ error: 'Failed to import paper from Semantic Scholar' });
  }
});

export default router;