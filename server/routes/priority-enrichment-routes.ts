/**
 * Priority-Based Content Enrichment API Routes
 * 
 * Provides endpoints for intelligent study content enrichment based on priority
 */
import { Router } from 'express';
import { 
  startPriorityEnrichment, 
  getPriorityEnrichmentStatus, 
  getContentGapStatistics, 
  ContentGapType
} from '../content-priority-queue';

const router = Router();

// API endpoint to get content gap statistics
router.get('/api/enrichment/statistics', async (req, res) => {
  try {
    const statistics = await getContentGapStatistics();
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error getting content gap statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get content gap statistics'
    });
  }
});

// API endpoint to get current priority enrichment status
router.get('/api/enrichment/priority/status', async (req, res) => {
  try {
    const status = getPriorityEnrichmentStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting priority enrichment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get priority enrichment status'
    });
  }
});

// API endpoint to start priority-based content enrichment
router.post('/api/enrichment/priority/start', async (req, res) => {
  try {
    const batchSize = req.body.batchSize || 10;
    const maxStudies = req.body.maxStudies || 100;
    
    // Start priority enrichment
    const initialStats = await startPriorityEnrichment(batchSize, maxStudies);
    
    res.json({
      success: true,
      message: 'Priority-based content enrichment started',
      data: initialStats
    });
  } catch (error) {
    console.error('Error starting priority enrichment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start priority-based content enrichment'
    });
  }
});

// API endpoint to manually set priority for content enrichment
router.post('/api/enrichment/priority/set', async (req, res) => {
  try {
    const { priorityType, batchSize, maxStudies } = req.body;
    
    if (!priorityType || !Object.values(ContentGapType).includes(priorityType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid priority type'
      });
    }
    
    // Start priority enrichment with the specified priority
    const initialStats = await startPriorityEnrichment(
      batchSize || 10,
      maxStudies || 100
    );
    
    res.json({
      success: true,
      message: `Priority-based content enrichment started with ${priorityType} priority`,
      data: initialStats
    });
  } catch (error) {
    console.error('Error setting priority for enrichment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set priority for content enrichment'
    });
  }
});

export default router;