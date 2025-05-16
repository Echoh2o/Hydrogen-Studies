/**
 * CrossRef API routes
 */
import { Router, Request, Response } from 'express';
import { searchCrossRef, getCrossRefArticleByDOI, extractStudyFromCrossRef } from '../crossref-api';
import { db } from '../db';
import { studies } from '@shared/schema';

const router = Router();

/**
 * Search CrossRef for articles
 * GET /api/crossref/search?q=query&page=1&pageSize=10
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, page = '1', pageSize = '10' } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);
    
    // Search CrossRef API
    const results = await searchCrossRef(q, pageNum, pageSizeNum);
    
    // Format the response for the frontend
    return res.json({
      items: results.items.map((item: any) => ({
        id: item.DOI,
        title: Array.isArray(item.title) ? item.title[0] : item.title,
        authors: item.author?.map((author: any) => {
          return `${author.given || ''} ${author.family || ''}`.trim();
        }).join(', ') || 'Unknown',
        journal: Array.isArray(item['container-title']) ? item['container-title'][0] : item['container-title'] || 'Unknown',
        year: item.published?.['date-parts']?.[0]?.[0] || 'Unknown',
        doi: item.DOI,
        url: `https://doi.org/${item.DOI}`,
        abstract: item.abstract || ''
      })),
      page: results.page,
      pageSize: results.pageSize,
      totalResults: results.totalResults
    });
  } catch (error) {
    console.error('Error searching CrossRef:', error);
    return res.status(500).json({ error: 'Failed to search CrossRef' });
  }
});

/**
 * Get article details by DOI
 * GET /api/crossref/article/:doi
 */
router.get('/article/:doi', async (req: Request, res: Response) => {
  try {
    const { doi } = req.params;
    
    if (!doi) {
      return res.status(400).json({ error: 'DOI is required' });
    }
    
    // Get article from CrossRef API
    const articleData = await getCrossRefArticleByDOI(doi);
    
    // Format the article for the frontend
    return res.json({
      id: articleData.DOI,
      title: Array.isArray(articleData.title) ? articleData.title[0] : articleData.title,
      authors: articleData.author?.map((author: any) => {
        return `${author.given || ''} ${author.family || ''}`.trim();
      }).join(', ') || 'Unknown',
      journal: Array.isArray(articleData['container-title']) ? articleData['container-title'][0] : articleData['container-title'] || 'Unknown',
      year: articleData.published?.['date-parts']?.[0]?.[0] || 'Unknown',
      doi: articleData.DOI,
      url: `https://doi.org/${articleData.DOI}`,
      abstract: articleData.abstract || '',
      pdfUrl: articleData.link?.find((l: any) => l.content_type?.includes('pdf'))?.URL || null,
      citationUrl: `https://doi.org/${articleData.DOI}`
    });
  } catch (error) {
    console.error('Error getting article from CrossRef:', error);
    return res.status(500).json({ error: 'Failed to get article from CrossRef' });
  }
});

/**
 * Import article to database
 * POST /api/crossref/import/:doi
 */
router.post('/import/:doi', async (req: Request, res: Response) => {
  try {
    const { doi } = req.params;
    
    if (!doi) {
      return res.status(400).json({ error: 'DOI is required' });
    }
    
    // Check if study with this DOI already exists
    const existingStudy = await db.query.studies.findFirst({
      where: (studies, { eq }) => eq(studies.doi, doi)
    });
    
    if (existingStudy) {
      return res.status(409).json({ 
        error: 'Study with this DOI already exists', 
        studyId: existingStudy.id 
      });
    }
    
    // Get article from CrossRef API
    const articleData = await getCrossRefArticleByDOI(doi);
    
    // Extract study data
    const studyData = extractStudyFromCrossRef(articleData);
    
    if (!studyData) {
      return res.status(400).json({ error: 'Failed to extract study data from CrossRef' });
    }
    
    // Insert study into database
    const [insertedStudy] = await db.insert(studies).values(studyData).returning();
    
    return res.status(201).json({
      success: true,
      message: 'Study imported successfully',
      study: insertedStudy
    });
  } catch (error) {
    console.error('Error importing article from CrossRef:', error);
    return res.status(500).json({ error: 'Failed to import article from CrossRef' });
  }
});

/**
 * Auto-complete missing study data using DOI
 * POST /api/crossref/autocomplete
 */
router.post('/autocomplete', async (req: Request, res: Response) => {
  try {
    const { doi, studyId } = req.body;
    
    if (!doi) {
      return res.status(400).json({ error: 'DOI is required' });
    }
    
    // Get article from CrossRef API
    const articleData = await getCrossRefArticleByDOI(doi);
    
    // Extract study data
    const studyData = extractStudyFromCrossRef(articleData);
    
    if (!studyData) {
      return res.status(400).json({ error: 'Failed to extract study data from CrossRef' });
    }
    
    // If studyId is provided, update the existing study
    if (studyId) {
      await db.update(studies)
        .set({
          title: studyData.title,
          abstract: studyData.abstract,
          authors: studyData.authors,
          firstAuthor: studyData.firstAuthor,
          otherAuthors: studyData.otherAuthors,
          lastAuthor: studyData.lastAuthor,
          journal: studyData.journal,
          publishDate: studyData.publishDate,
          pdfUrl: studyData.pdfUrl,
          citationUrl: studyData.citationUrl,
          keywords: studyData.keywords
        })
        .where(studies.id, '=', studyId);
      
      return res.json({
        success: true,
        message: 'Study updated successfully with CrossRef data',
        study: studyData
      });
    }
    
    // Return the extracted data
    return res.json({
      success: true,
      studyData
    });
  } catch (error) {
    console.error('Error auto-completing with CrossRef:', error);
    return res.status(500).json({ error: 'Failed to auto-complete with CrossRef' });
  }
});

export default router;