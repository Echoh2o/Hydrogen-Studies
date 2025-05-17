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
  } catch (error: any) {
    console.error('Error running journal date update:', error);
    res.status(500).json({
      success: false,
      message: `Failed to update journal dates: ${error.message || 'Unknown error'}`
    });
  }
});

/**
 * Get status of publication date completeness
 * Returns stats about how many studies have journal publication dates and how many need them
 */
router.get('/journal-date-stats', async (req, res) => {
  try {
    const db = (await import('../db')).db;
    const studies = (await import('@shared/schema')).studies;
    const { count, isNull, sql } = await import('drizzle-orm');
    
    // Count total studies
    const [totalResult] = await db.select({ value: count() }).from(studies);
    const totalStudies = totalResult?.value || 0;
    
    // Count studies with DOIs but missing journal dates
    const [needingDatesResult] = await db
      .select({ value: count() })
      .from(studies)
      .where(
        isNull(studies.journalPublishDate)
      );
    const studiesNeedingDate = needingDatesResult?.value || 0;
    
    // Count studies with journal dates
    const studiesWithDate = totalStudies - studiesNeedingDate;
    
    // Calculate percentage complete
    const percentComplete = totalStudies > 0 
      ? Math.round((studiesWithDate / totalStudies) * 100) 
      : 0;
    
    // Get recent studies that were updated with journal publication dates
    const recentlyUpdated = await db
      .select()
      .from(studies)
      .where(
        sql`${studies.journalPublishDate} IS NOT NULL`
      )
      .limit(5);

    res.json({
      success: true,
      stats: {
        totalStudies,
        studiesWithDate,
        studiesNeedingDate,
        percentComplete,
        recentlyUpdated
      }
    });
  } catch (error: any) {
    console.error('Error getting journal date stats:', error);
    res.status(500).json({
      success: false,
      message: `Failed to get journal date stats: ${error.message || 'Unknown error'}`
    });
  }
});

export default router;