import express from 'express';
import { updateJournalPublicationDates } from '../journal-date-updater';

const router = express.Router();

/**
 * Run the journal publication date update process
 * This endpoint will find studies with DOIs but missing journal publication dates
 * and attempt to update them with data from external APIs.
 */
router.post('/update-journal-dates', async (req, res) => {
  try {
    const { limit = 50 } = req.body;
    
    // Validate limit is a reasonable number
    const processLimit = Math.min(Math.max(1, Number(limit)), 100);
    
    const result = await updateJournalPublicationDates(processLimit);
    
    res.json(result);
  } catch (error) {
    console.error('Error running journal date update:', error);
    res.status(500).json({
      success: false,
      message: `Failed to update journal dates: ${error.message}`
    });
  }
});

/**
 * Get status of publication date completeness
 * Returns stats about how many studies have journal publication dates and how many need them
 */
router.get('/journal-date-stats', async (req, res) => {
  try {
    // This will be implemented in the future
    // For now, return a placeholder
    res.json({
      success: true,
      stats: {
        totalStudies: 0,
        studiesWithDate: 0,
        studiesNeedingDate: 0,
        percentComplete: 0
      }
    });
  } catch (error) {
    console.error('Error getting journal date stats:', error);
    res.status(500).json({
      success: false,
      message: `Failed to get journal date stats: ${error.message}`
    });
  }
});

export default router;