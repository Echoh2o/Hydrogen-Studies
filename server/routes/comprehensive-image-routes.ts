
/**
 * Comprehensive Image System API Routes
 */

import { Router } from 'express';
import { 
  ensureAllStudiesHaveOptimizedImages, 
  getSystemStatus, 
  getProcessingStats,
  stopProcessing 
} from '../comprehensive-image-system';

const router = Router();

/**
 * Start comprehensive image processing
 */
router.post('/start-comprehensive-processing', async (req, res) => {
  try {
    const result = await ensureAllStudiesHaveOptimizedImages();
    res.json(result);
  } catch (error) {
    console.error('Error starting comprehensive processing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start processing'
    });
  }
});

/**
 * Get system status
 */
router.get('/system-status', async (req, res) => {
  try {
    const status = await getSystemStatus();
    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Error getting system status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get status'
    });
  }
});

/**
 * Get processing statistics
 */
router.get('/processing-stats', (req, res) => {
  try {
    const stats = getProcessingStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting processing stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get stats'
    });
  }
});

/**
 * Stop processing
 */
router.post('/stop-processing', (req, res) => {
  try {
    const result = stopProcessing();
    res.json(result);
  } catch (error) {
    console.error('Error stopping processing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop processing'
    });
  }
});

export default router;
