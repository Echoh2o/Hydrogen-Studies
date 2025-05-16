import express from 'express';
import { scrapeStudyFromUrl, saveScrapedStudy } from '../direct-scraper';

const router = express.Router();

/**
 * Preview a URL by scraping its content
 * This is called when a user wants to preview a study from an external URL
 */
router.post('/preview-url', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false,
        message: 'URL is required' 
      });
    }
    
    // Try to scrape the study data
    const study = await scrapeStudyFromUrl(url);
    
    if (!study) {
      return res.status(404).json({ 
        success: false,
        message: 'Could not extract study data from the provided URL' 
      });
    }
    
    return res.json({
      success: true,
      study
    });
  } catch (error: any) {
    console.error('Error previewing URL:', error);
    return res.status(500).json({ 
      success: false,
      message: error.message || 'An error occurred while previewing the URL' 
    });
  }
});

/**
 * Save a study from a URL
 * This is called when a user wants to save a study after previewing it
 */
router.post('/save-url', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false,
        message: 'URL is required' 
      });
    }
    
    // Save the scraped study
    const result = await saveScrapedStudy(url);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
    
    return res.json({
      success: true,
      message: 'Study saved successfully',
      study: result.study
    });
  } catch (error: any) {
    console.error('Error saving study from URL:', error);
    return res.status(500).json({ 
      success: false,
      message: error.message || 'An error occurred while saving the study' 
    });
  }
});

export default router;