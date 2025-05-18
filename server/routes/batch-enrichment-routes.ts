import { Router } from 'express';
import { z } from 'zod';
import { 
  startBatchEnrichment, 
  getBatchEnrichmentStatus, 
  enhanceStudyContent 
} from '../batch-enrichment';

const router = Router();

/**
 * Start a batch enrichment process
 * POST /api/enrichment/batch/start
 */
router.post('/start', async (req, res) => {
  try {
    const schema = z.object({
      batchSize: z.number().int().min(1).max(50).default(10),
      maxStudies: z.number().int().min(1).max(1000).default(100)
    });

    const validatedData = schema.parse(req.body);
    const { batchSize, maxStudies } = validatedData;
    
    const status = await startBatchEnrichment(batchSize, maxStudies);
    
    return res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Error starting batch enrichment:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

/**
 * Get the status of the current batch enrichment process
 * GET /api/enrichment/batch/status
 */
router.get('/status', (req, res) => {
  try {
    const status = getBatchEnrichmentStatus();
    
    return res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Error getting batch enrichment status:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

/**
 * Enrich a specific study by ID (single study enrichment)
 * POST /api/enrichment/batch/enrichStudy/:id
 */
router.post('/enrichStudy/:id', async (req, res) => {
  try {
    const studyId = parseInt(req.params.id);
    
    if (isNaN(studyId) || studyId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid study ID'
      });
    }
    
    const result = await enhanceStudyContent(studyId);
    
    return res.json(result);
  } catch (error) {
    console.error('Error enriching study:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

export default router;