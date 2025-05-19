/**
 * Enhanced Content Enrichment Routes
 * 
 * Provides API endpoints for the improved batch enrichment process with:
 * - Study selection capabilities
 * - Status tracking
 * - Failure logging
 * - Progress reporting
 */
import { Router } from 'express';
import { enhanceStudyContent, findStudiesForEnhancement } from '../content-enrichment';
import { db } from '../db';
import { studies } from '@shared/schema';
import { eq, or, and, isNull, sql } from 'drizzle-orm';

const router = Router();

// Get candidate studies for content enrichment
router.get('/candidates', async (req, res) => {
  try {
    // Find studies that need content enrichment
    // This includes studies with:
    // - Missing or short abstract (less than 100 chars)
    // - Missing methods, results, or conclusion sections
    // - Missing images
    // - Limited to 100 studies at a time for performance
    const candidates = await db.query.studies.findMany({
      where: or(
        isNull(studies.abstract),
        and(
          lt(studies.abstract, 100),
          lt(studies.abstract, 'short')
        ),
        isNull(studies.methods),
        isNull(studies.results),
        isNull(studies.conclusion),
        isNull(studies.imageUrl)
      ),
      limit: 100,
      orderBy: studies.id
    });

    // If no results from database query, use the fallback function
    if (!candidates || candidates.length === 0) {
      const studyIds = await findStudiesForEnhancement(100);
      
      if (studyIds && studyIds.length > 0) {
        const candidates = await db.query.studies.findMany({
          where: or(
            ...studyIds.map(id => eq(studies.id, id))
          )
        });
        
        return res.json(candidates);
      }
    }

    // Return candidates with placeholder status for the UI to track
    const candidatesWithStatus = candidates.map(study => ({
      ...study,
      status: 'pending'
    }));

    res.json(candidatesWithStatus);
  } catch (error) {
    console.error('Error fetching enrichment candidates:', error);
    res.status(500).json({ error: 'Failed to fetch enrichment candidates' });
  }
});

// Get recently enriched studies
router.get('/recent', async (req, res) => {
  try {
    // Get studies that have been recently enriched
    // Checking for fields that were previously null/empty and are now populated
    // Limited to 50 most recent studies
    const recentlyEnriched = await db.query.studies.findMany({
      where: and(
        or(
          and(
            lt(studies.abstract, 'not null'),
            lt(studies.abstract, 'not short')
          ),
          lt(studies.methods, 'not null'),
          lt(studies.results, 'not null'),
          lt(studies.conclusion, 'not null'),
          lt(studies.imageUrl, 'not null')
        )
      ),
      limit: 50,
      orderBy: [{ column: studies.updatedAt, order: 'desc' }]
    });

    // Add enhanced fields information
    const enhancedStudies = recentlyEnriched.map(study => {
      const enhancedFields = [];
      
      if (study.abstract && study.abstract.length > 100) enhancedFields.push('Abstract');
      if (study.methods) enhancedFields.push('Methods');
      if (study.results) enhancedFields.push('Results');
      if (study.conclusion) enhancedFields.push('Conclusion');
      if (study.imageUrl) enhancedFields.push('Image');
      if (study.fullText) enhancedFields.push('Full Text');
      
      return {
        ...study,
        enhancedFields
      };
    });

    res.json(enhancedStudies);
  } catch (error) {
    console.error('Error fetching recently enriched studies:', error);
    res.status(500).json({ error: 'Failed to fetch recently enriched studies' });
  }
});

// Process a single study for content enrichment
router.post('/study/:id', async (req, res) => {
  try {
    const studyId = parseInt(req.params.id);
    
    if (isNaN(studyId)) {
      return res.status(400).json({ success: false, message: 'Invalid study ID' });
    }
    
    // Process the study using the existing enhanceStudyContent function
    const result = await enhanceStudyContent(studyId);
    res.json(result);
  } catch (error) {
    console.error(`Error enhancing study: ${error}`);
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error during enhancement' 
    });
  }
});

// Process multiple studies in a batch
router.post('/batch', async (req, res) => {
  try {
    const { studyIds } = req.body;
    
    if (!Array.isArray(studyIds) || studyIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid request: studyIds must be a non-empty array' 
      });
    }
    
    // For now, just acknowledge the request and let the client handle the batch processing
    // This could be replaced with a background job or queue in the future
    res.json({ 
      success: true, 
      message: `Started batch processing of ${studyIds.length} studies`,
      studyIds
    });
  } catch (error) {
    console.error(`Error starting batch enhancement: ${error}`);
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error starting batch enhancement' 
    });
  }
});

// Get processing status (for future implementation with a queue system)
router.get('/status', async (req, res) => {
  try {
    // Placeholder for future implementation
    // This would connect to a batch processing queue system
    res.json({
      active: false,
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0
    });
  } catch (error) {
    console.error(`Error getting batch status: ${error}`);
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error getting batch status' 
    });
  }
});

export default router;