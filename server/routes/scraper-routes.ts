/**
 * API routes for triggering and managing scrapers
 */
import express from 'express';
import { getScraperInfo, runAllScrapers, runScraperByName } from '../scrapers/scraper-manager';
import { isAuthenticated } from '../auth';

const router = express.Router();

/**
 * Get list of available scrapers
 * 
 * GET /api/scrapers
 */
router.get('/scrapers', async (req, res) => {
  try {
    const scrapers = getScraperInfo();
    res.json({ scrapers });
  } catch (error) {
    console.error('Error fetching scraper info:', error);
    res.status(500).json({ message: 'Failed to fetch scraper information' });
  }
});

/**
 * Run a specific scraper by name
 * 
 * POST /api/scrapers/:name/run
 */
router.post('/scrapers/:name/run', async (req, res) => {
  try {
    const scraperName = req.params.name;
    
    // Run the scraper
    const result = await runScraperByName(scraperName);
    
    if (result.success) {
      res.json({
        message: result.message,
        results: result.results
      });
    } else {
      res.status(400).json({
        message: result.message
      });
    }
  } catch (error: any) {
    console.error('Error running scraper:', error);
    res.status(500).json({ message: `Failed to run scraper: ${error.message}` });
  }
});

/**
 * Run all enabled scrapers
 * 
 * POST /api/scrapers/run-all
 */
router.post('/scrapers/run-all', async (req, res) => {
  try {
    // Run all scrapers
    const result = await runAllScrapers();
    
    res.json({
      message: result.message,
      results: result.results
    });
  } catch (error: any) {
    console.error('Error running scrapers:', error);
    res.status(500).json({ message: `Failed to run scrapers: ${error.message}` });
  }
});

export default router;