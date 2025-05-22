import { Router } from 'express';
import { comprehensiveEnrichStudy, batchComprehensiveEnrichment } from '../comprehensive-doi-enricher';
import { db } from '../db';
import { studies } from '../../shared/schema';
import { isNull, or, eq } from 'drizzle-orm';

const router = Router();

/**
 * Comprehensively enrich a single study with all available data
 */
router.post('/enrich/:studyId', async (req, res) => {
  try {
    const studyId = parseInt(req.params.studyId);
    if (isNaN(studyId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid study ID' 
      });
    }

    console.log(`Starting comprehensive enrichment for study ${studyId}`);
    const result = await comprehensiveEnrichStudy(studyId);

    return res.json(result);
  } catch (error) {
    console.error('Error in comprehensive enrichment:', error);
    return res.status(500).json({
      success: false,
      message: `Enrichment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      totalFieldsEnriched: 0,
      sourcesUsed: [],
      enrichmentQuality: 0
    });
  }
});

/**
 * Find studies that would benefit from comprehensive enrichment
 */
router.get('/find-studies-for-enrichment', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    
    // Find studies with DOIs that haven't been recently enriched or have low quality scores
    const studies_to_enrich = await db.select({ 
      id: studies.id, 
      title: studies.title,
      doi: studies.doi,
      enrichmentQuality: studies.enrichmentQuality,
      lastEnriched: studies.lastEnriched
    })
    .from(studies)
    .where(
      or(
        isNull(studies.lastEnriched), // Never enriched
        eq(studies.enrichmentQuality, 0) // Low quality enrichment
      )
    )
    .limit(limit);

    const studyIds = studies_to_enrich
      .filter(study => study.doi) // Only studies with DOIs
      .map(study => study.id);

    return res.json({
      success: true,
      studyIds,
      count: studyIds.length,
      studies: studies_to_enrich
    });
  } catch (error) {
    console.error('Error finding studies for enrichment:', error);
    return res.status(500).json({
      success: false,
      message: `Error finding studies: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

/**
 * Batch comprehensive enrichment for multiple studies
 */
router.post('/batch-enrich', async (req, res) => {
  try {
    const { studyIds, limit } = req.body;
    
    let idsToProcess = studyIds;
    
    // If no specific IDs provided, find studies that need enrichment
    if (!idsToProcess || idsToProcess.length === 0) {
      const findResult = await fetch(`${req.protocol}://${req.get('host')}/api/comprehensive-enrichment/find-studies-for-enrichment?limit=${limit || 10}`);
      const findData = await findResult.json();
      
      if (findData.success && findData.studyIds) {
        idsToProcess = findData.studyIds;
      } else {
        return res.json({
          success: false,
          message: 'No studies found for enrichment'
        });
      }
    }

    if (!idsToProcess || idsToProcess.length === 0) {
      return res.json({
        success: false,
        message: 'No studies to process'
      });
    }

    // Start batch enrichment in background
    console.log(`Starting batch comprehensive enrichment for ${idsToProcess.length} studies`);
    
    // Run batch process asynchronously
    setTimeout(async () => {
      try {
        const batchResult = await batchComprehensiveEnrichment(idsToProcess);
        console.log(`Batch enrichment completed:`, batchResult);
      } catch (error) {
        console.error('Batch enrichment error:', error);
      }
    }, 100);

    return res.json({
      success: true,
      message: `Started comprehensive enrichment for ${idsToProcess.length} studies`,
      studyIds: idsToProcess,
      note: 'Process running in background - check logs for progress'
    });

  } catch (error) {
    console.error('Error starting batch enrichment:', error);
    return res.status(500).json({
      success: false,
      message: `Error starting batch enrichment: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

/**
 * Get enrichment statistics
 */
router.get('/stats', async (req, res) => {
  try {
    // Count studies by enrichment quality
    const enrichmentStats = await db.select({
      enrichmentQuality: studies.enrichmentQuality,
      count: studies.id
    })
    .from(studies);

    // Calculate summary stats
    const totalStudies = enrichmentStats.length;
    const enrichedStudies = enrichmentStats.filter(s => s.enrichmentQuality && s.enrichmentQuality > 0).length;
    const highQualityStudies = enrichmentStats.filter(s => s.enrichmentQuality && s.enrichmentQuality >= 70).length;
    
    const avgQuality = enrichmentStats.length > 0 
      ? enrichmentStats.reduce((sum, s) => sum + (s.enrichmentQuality || 0), 0) / enrichmentStats.length 
      : 0;

    return res.json({
      success: true,
      stats: {
        totalStudies,
        enrichedStudies,
        highQualityStudies,
        averageQuality: Math.round(avgQuality),
        enrichmentCoverage: totalStudies > 0 ? Math.round((enrichedStudies / totalStudies) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Error getting enrichment stats:', error);
    return res.status(500).json({
      success: false,
      message: `Error getting stats: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

export const comprehensiveEnrichmentRoutes = router;