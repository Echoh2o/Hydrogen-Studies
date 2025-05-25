/**
 * Full Database Enrichment Routes
 * API endpoints for enriching all 1,326 hydrogen studies
 */

import { Router } from 'express';
import { startFullDatabaseEnrichment, getFullEnrichmentProgress } from '../direct-full-enrichment';

const router = Router();

/**
 * Start full database enrichment
 */
router.post('/start', async (req, res) => {
  try {
    console.log('🚀 Starting full database enrichment via API...');
    const progress = await startFullDatabaseEnrichment();
    
    res.json({
      success: true,
      message: `Started enrichment of ${progress.totalStudies} hydrogen studies`,
      progress
    });
  } catch (error) {
    console.error('❌ Error starting full enrichment:', error);
    
    if (error instanceof Error && error.message.includes('already running')) {
      return res.status(409).json({
        success: false,
        message: 'Enrichment is already running',
        progress: getFullEnrichmentProgress()
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to start enrichment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get current enrichment progress
 */
router.get('/progress', (req, res) => {
  try {
    const progress = getFullEnrichmentProgress();
    
    res.json({
      success: true,
      progress
    });
  } catch (error) {
    console.error('❌ Error getting enrichment progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get progress',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;