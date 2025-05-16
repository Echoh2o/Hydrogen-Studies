import { Router } from 'express';
import { z } from 'zod';
import { 
  getAllScraperStatuses, 
  getScraperStatus 
} from '../scrapers/scraper-status';
import { scrapeAllHydrogenStudies } from '../scrapers/hydrogen-studies-scraper';

const router = Router();

// Get status of all scrapers
router.get('/scraper/status', (req, res) => {
  try {
    // Get all scraper statuses
    const scraperStatuses = getAllScraperStatuses();
    
    // Check if any scraper is currently running
    const runningStatus = scraperStatuses.find(s => s.status === 'running');
    
    // Prepare response data
    const responseData = {
      success: true,
      status: {
        isRunning: !!runningStatus,
        current: runningStatus || scraperStatuses[0] || null,
        all: scraperStatuses,
      }
    };
    
    return res.json(responseData);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get scraper status'
    });
  }
});

// Start the hydrogen studies scraper
router.post('/scraper/start', async (req, res) => {
  try {
    // Check if a scraper is already running
    const scraperStatuses = getAllScraperStatuses();
    const runningStatus = scraperStatuses.find(s => s.status === 'running');
    
    if (runningStatus) {
      return res.status(400).json({
        success: false,
        message: 'A scraper is already running',
        status: runningStatus
      });
    }
    
    // Start the hydrogen studies scraper (non-blocking)
    setTimeout(async () => {
      try {
        await scrapeAllHydrogenStudies();
      } catch (error) {
        console.error('Error running hydrogen studies scraper:', error);
      }
    }, 0);
    
    return res.json({
      success: true,
      message: 'Hydrogen studies scraper started'
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to start scraper'
    });
  }
});

// Get status of a specific scraper
router.get('/scraper/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const status = getScraperStatus(id);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        message: `No scraper found with ID: ${id}`
      });
    }
    
    return res.json({
      success: true,
      status
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get scraper status'
    });
  }
});

export default router;