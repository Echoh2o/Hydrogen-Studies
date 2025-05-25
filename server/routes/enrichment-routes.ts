/**
 * API routes for managing targeted studies enrichment
 */

import { Router } from 'express';
import { startTargetedEnrichment, getEnrichmentStatus, getEnrichmentSummary } from '../targeted-enrichment';

const router = Router();

/**
 * Start the targeted enrichment process
 */
router.post('/start', async (req, res) => {
  try {
    const { batchSize = 10 } = req.body;
    
    const stats = await startTargetedEnrichment(batchSize);
    
    res.json({
      success: true,
      message: 'Targeted enrichment started successfully',
      stats
    });
  } catch (error) {
    console.error('Error starting enrichment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get current enrichment status
 */
router.get('/status', async (req, res) => {
  try {
    const status = getEnrichmentStatus();
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Error getting enrichment status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get enrichment summary and progress
 */
router.get('/summary', async (req, res) => {
  try {
    const summary = await getEnrichmentSummary();
    
    res.json({
      success: true,
      summary: {
        total_studies: parseInt(summary.total_studies),
        with_keywords: parseInt(summary.with_keywords),
        with_health_conditions: parseInt(summary.with_health_conditions),
        with_body_systems: parseInt(summary.with_body_systems),
        with_conclusions: parseInt(summary.with_conclusions),
        keywords_percentage: Math.round((summary.with_keywords / summary.total_studies) * 100),
        health_conditions_percentage: Math.round((summary.with_health_conditions / summary.total_studies) * 100),
        body_systems_percentage: Math.round((summary.with_body_systems / summary.total_studies) * 100),
        conclusions_percentage: Math.round((summary.with_conclusions / summary.total_studies) * 100)
      }
    });
  } catch (error) {
    console.error('Error getting enrichment summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;