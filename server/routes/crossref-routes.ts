import express from 'express';
import { searchCrossRef, getCrossRefArticleByDOI, extractStudyFromCrossRef } from '../crossref-api';
import { storage } from '../storage';

const router = express.Router();

/**
 * Search CrossRef for studies
 */
router.get('/search', async (req, res) => {
  try {
    const { query, page = '1', pageSize = '10' } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }
    
    const results = await searchCrossRef(
      query as string, 
      parseInt(page as string), 
      parseInt(pageSize as string)
    );
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('CrossRef search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search CrossRef API'
    });
  }
});

/**
 * Get article details by DOI from CrossRef
 */
router.get('/doi/:doi', async (req, res) => {
  try {
    const { doi } = req.params;
    
    if (!doi) {
      return res.status(400).json({
        success: false,
        message: 'DOI is required'
      });
    }
    
    const article = await getCrossRefArticleByDOI(doi);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found with provided DOI'
      });
    }
    
    res.json({
      success: true,
      data: article
    });
  } catch (error) {
    console.error('CrossRef DOI lookup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch article from CrossRef API'
    });
  }
});

/**
 * Import article from CrossRef by DOI
 */
router.post('/import/:doi', async (req, res) => {
  try {
    const { doi } = req.params;
    
    if (!doi) {
      return res.status(400).json({
        success: false,
        message: 'DOI is required'
      });
    }
    
    // Check if study with this DOI already exists
    const existingStudy = await storage.getStudyByIdentifier(doi);
    
    if (existingStudy) {
      return res.status(409).json({
        success: false,
        message: 'Study with this DOI already exists',
        studyId: existingStudy.id
      });
    }
    
    // Get article data from CrossRef
    const articleData = await getCrossRefArticleByDOI(doi);
    
    if (!articleData) {
      return res.status(404).json({
        success: false,
        message: 'Article not found with provided DOI'
      });
    }
    
    // Extract study data from article
    const studyData = extractStudyFromCrossRef(articleData);
    
    // Create study in database
    const createdStudy = await storage.createStudy(studyData);
    
    res.status(201).json({
      success: true,
      message: 'Study successfully imported from CrossRef',
      study: createdStudy
    });
  } catch (error) {
    console.error('CrossRef import error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import study from CrossRef API'
    });
  }
});

/**
 * Update journal publication date by DOI
 */
router.put('/update-journal-date/:doi', async (req, res) => {
  try {
    const { doi } = req.params;
    
    if (!doi) {
      return res.status(400).json({
        success: false,
        message: 'DOI is required'
      });
    }
    
    // Check if study with this DOI exists
    const existingStudy = await storage.getStudyByIdentifier(doi);
    
    if (!existingStudy) {
      return res.status(404).json({
        success: false,
        message: 'Study with this DOI not found'
      });
    }
    
    // Get article data from CrossRef
    const articleData = await getCrossRefArticleByDOI(doi);
    
    if (!articleData) {
      return res.status(404).json({
        success: false,
        message: 'Article not found in CrossRef with provided DOI'
      });
    }
    
    // Extract publication date data
    let journalPublishDate = null;
    
    // Try to get the publication date from various fields
    if (articleData.published) {
      const dateParts = articleData.published["date-parts"]?.[0];
      if (dateParts && dateParts.length >= 1) {
        // Format: YYYY-MM-DD or as much as we have
        const year = dateParts[0];
        const month = dateParts.length > 1 ? String(dateParts[1]).padStart(2, '0') : '01';
        const day = dateParts.length > 2 ? String(dateParts[2]).padStart(2, '0') : '01';
        journalPublishDate = `${year}-${month}-${day}`;
      }
    }
    
    if (!journalPublishDate) {
      return res.status(404).json({
        success: false,
        message: 'Could not find publication date in CrossRef data'
      });
    }
    
    // Update study in database
    const updatedStudy = await storage.updateStudy(existingStudy.id, { 
      journalPublishDate
    });
    
    res.json({
      success: true,
      message: 'Journal publication date successfully updated',
      study: updatedStudy
    });
  } catch (error) {
    console.error('CrossRef date update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update journal publication date from CrossRef'
    });
  }
});

export default router;