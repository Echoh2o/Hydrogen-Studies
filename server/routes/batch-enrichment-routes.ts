/**
 * Batch Enrichment Routes
 * 
 * API endpoints for running batch content enrichment processes on studies.
 * Allows for starting, monitoring, and managing batch enrichment operations.
 */

import { Router } from 'express';
import { z } from 'zod';
import { startBatchEnrichment, getBatchEnrichmentStatus } from '../batch-enrichment';

const router = Router();

// Schema for starting batch enrichment
const startBatchEnrichmentSchema = z.object({
  batchSize: z.number().positive().default(10),
  maxStudies: z.number().positive().default(100)
});

/**
 * Start a batch enrichment process
 * POST /api/enrichment/batch/start
 */
router.post('/start', async (req, res) => {
  try {
    const { batchSize, maxStudies } = startBatchEnrichmentSchema.parse(req.body);
    
    const status = await startBatchEnrichment(batchSize, maxStudies);
    
    res.json({
      success: true,
      message: 'Batch enrichment process started successfully',
      status
    });
  } catch (error) {
    console.error('Error starting batch enrichment:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to start batch enrichment',
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
    
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'No batch enrichment process has been started'
      });
    }
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Error getting batch enrichment status:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get batch enrichment status'
    });
  }
});

/**
 * Enrich a specific study by ID (single study enrichment)
 * POST /api/enrichment/batch/enrichStudy/:id
 */
router.post('/enrichStudy/:id', async (req, res) => {
  const studyId = parseInt(req.params.id);
  
  if (isNaN(studyId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid study ID'
    });
  }
  
  try {
    // Direct import with type assertion to avoid circular dependency issue
    const { enhanceStudyContent } = require('../batch-enrichment');
    const result = await enhanceStudyContent(studyId);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        updates: result.updates
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error(`Error enriching study ${studyId}:`, error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : `Failed to enrich study ${studyId}`
    });
  }
});

export default router;