/**
 * Batch Enrichment API Routes
 * 
 * Provides endpoints for managing batch enrichment of all studies
 */

import { Router } from 'express';
import { 
  startBatchEnrichment, 
  getBatchEnrichmentProgress, 
  stopBatchEnrichment,
  getEnrichmentStats 
} from '../batch-study-enrichment';

const router = Router();

/**
 * Start batch enrichment of all studies
 */
router.post('/start', async (req, res) => {
  try {
    console.log('🚀 Starting batch enrichment via API...');
    const progress = await startBatchEnrichment();
    
    res.json({
      success: true,
      message: 'Batch enrichment started successfully',
      progress
    });
  } catch (error) {
    console.error('❌ Error starting batch enrichment:', error);
    
    if (error instanceof Error && error.message.includes('already running')) {
      return res.status(409).json({
        success: false,
        message: 'Batch enrichment is already running',
        progress: getBatchEnrichmentProgress()
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to start batch enrichment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get current batch enrichment progress
 */
router.get('/progress', (req, res) => {
  try {
    const progress = getBatchEnrichmentProgress();
    
    res.json({
      success: true,
      progress
    });
  } catch (error) {
    console.error('❌ Error getting batch enrichment progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get progress',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Stop batch enrichment
 */
router.post('/stop', (req, res) => {
  try {
    const stopped = stopBatchEnrichment();
    
    if (stopped) {
      res.json({
        success: true,
        message: 'Batch enrichment stopped successfully'
      });
    } else {
      res.json({
        success: false,
        message: 'No batch enrichment is currently running'
      });
    }
  } catch (error) {
    console.error('❌ Error stopping batch enrichment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop batch enrichment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get enrichment statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getEnrichmentStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ Error getting enrichment stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get enrichment statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;