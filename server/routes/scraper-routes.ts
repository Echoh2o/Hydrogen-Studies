import express from 'express';
import { ScraperSource } from '../scrapers/base-scraper';
import { scraperManager } from '../scrapers/scraper-manager';
import { scrapeHydrogenStudies } from '../scraper';
import { getScraperStatus, getScraperProgressDescription } from '../scrapers/scraper-status';

const router = express.Router();

/**
 * Search for articles from a specific source
 * GET /api/research/search
 */
router.get('/research/search', async (req, res) => {
  try {
    const { 
      source = 'pubmed', 
      query, 
      max = 10, 
      startIndex = 0,
      sort = 'relevance'
    } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter is required'
      });
    }
    
    // Validate source
    if (!['pubmed', 'google-scholar', 'hydrogen-studies'].includes(source as string)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid source. Valid options: pubmed, google-scholar, hydrogen-studies'
      });
    }
    
    const results = await scraperManager.searchArticles(
      source as ScraperSource,
      query as string,
      {
        max: parseInt(max as string),
        startIndex: parseInt(startIndex as string),
        sort: sort as 'relevance' | 'pub_date'
      }
    );
    
    return res.status(200).json({
      success: true,
      source,
      query,
      ...results
    });
    
  } catch (error: any) {
    console.error('Error searching articles:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to search articles'
    });
  }
});

/**
 * Search for articles from all sources
 * GET /api/research/search-all
 */
router.get('/research/search-all', async (req, res) => {
  try {
    const { query, max = 10 } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter is required'
      });
    }
    
    const results = await scraperManager.searchAllSources(
      query as string,
      { max: parseInt(max as string) }
    );
    
    return res.status(200).json({
      success: true,
      query,
      results
    });
    
  } catch (error: any) {
    console.error('Error searching all sources:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to search all sources'
    });
  }
});

/**
 * Approve an article to be added to the database
 * POST /api/research/approve
 */
router.post('/research/approve', async (req, res) => {
  try {
    const { source, article } = req.body;
    
    if (!source || !article) {
      return res.status(400).json({
        success: false,
        message: 'Source and article are required'
      });
    }
    
    // Validate source
    if (!['pubmed', 'google-scholar', 'hydrogen-studies'].includes(source)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid source. Valid options: pubmed, google-scholar, hydrogen-studies'
      });
    }
    
    const result = await scraperManager.approveAndSaveArticle(
      source as ScraperSource,
      article
    );
    
    return res.status(result.success ? 200 : 400).json(result);
    
  } catch (error: any) {
    console.error('Error approving article:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to approve article'
    });
  }
});

/**
 * Bulk approve multiple articles
 * POST /api/research/bulk-approve
 */
router.post('/research/bulk-approve', async (req, res) => {
  try {
    const { source, articles } = req.body;
    
    if (!source || !articles || !Array.isArray(articles)) {
      return res.status(400).json({
        success: false,
        message: 'Source and articles array are required'
      });
    }
    
    // Validate source
    if (!['pubmed', 'google-scholar', 'hydrogen-studies'].includes(source)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid source. Valid options: pubmed, google-scholar, hydrogen-studies'
      });
    }
    
    const results = await scraperManager.bulkApproveArticles(
      source as ScraperSource,
      articles
    );
    
    return res.status(200).json({
      success: true,
      ...results
    });
    
  } catch (error: any) {
    console.error('Error bulk approving articles:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to bulk approve articles'
    });
  }
});

/**
 * Get the current status of the hydrogen studies scraper
 * GET /api/scraper/status
 */
router.get('/scraper/status', (req, res) => {
  try {
    const status = getScraperStatus();
    const description = getScraperProgressDescription();
    
    return res.status(200).json({
      success: true,
      status,
      description
    });
  } catch (error: any) {
    console.error('Error getting scraper status:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get scraper status'
    });
  }
});

/**
 * Start scraping the hydrogen studies website
 * POST /api/scraper/start
 */
router.post('/scraper/start', (req, res) => {
  try {
    const status = getScraperStatus();
    
    // If scraper is already running, return the status
    if (status.isRunning) {
      return res.status(400).json({
        success: false,
        message: 'Scraper is already running',
        status,
        description: getScraperProgressDescription()
      });
    }
    
    // Start the scraper in the background
    scrapeHydrogenStudies().catch(error => {
      console.error('Error during hydrogen studies scraping:', error);
    });
    
    return res.status(200).json({
      success: true,
      message: 'Scraper started successfully',
      description: getScraperProgressDescription()
    });
  } catch (error: any) {
    console.error('Error starting scraper:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to start scraper'
    });
  }
});

export default router;