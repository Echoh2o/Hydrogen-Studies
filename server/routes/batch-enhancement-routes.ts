/**
 * Batch Enhancement Routes
 * 
 * Provides API endpoints for a comprehensive batch enrichment process with:
 * - Study selection capabilities
 * - Status tracking
 * - Failure logging
 * - Progress reporting
 */
import { Router } from 'express';
import { enhanceStudyContent, findStudiesForEnhancement } from '../content-enrichment';
import { db } from '../db';
import { studies } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Get candidate studies for content enrichment
router.get('/candidates', async (req, res) => {
  try {
    // Find studies that need content enrichment
    const studyIds = await findStudiesForEnhancement(100);
    
    if (!studyIds || studyIds.length === 0) {
      return res.json([]);
    }
    
    // Get the study data for the found IDs
    const candidates = [];
    
    for (const id of studyIds) {
      const study = await db.query.studies.findFirst({
        where: eq(studies.id, id)
      });
      
      if (study) {
        candidates.push({
          ...study,
          status: 'pending'
        });
      }
    }
    
    res.json(candidates);
  } catch (error) {
    console.error('Error fetching enrichment candidates:', error);
    res.status(500).json({ error: 'Failed to fetch enrichment candidates' });
  }
});

// Get recently enriched studies
router.get('/recent', async (req, res) => {
  try {
    // Get the 50 most recently updated studies
    const recentlyUpdated = await db.query.studies.findMany({
      orderBy: [{ createdAt: 'desc' }],
      limit: 50
    });
    
    // Add enhanced fields information for display
    const enhancedStudies = recentlyUpdated.map(study => {
      const enhancedFields = [];
      
      if (study.abstract && study.abstract.length > 100) enhancedFields.push('Abstract');
      if (study.methods) enhancedFields.push('Methods');
      if (study.results) enhancedFields.push('Results');
      if (study.conclusion) enhancedFields.push('Conclusion');
      if (study.imageUrl) enhancedFields.push('Image');
      
      return {
        ...study,
        enhancedFields
      };
    });
    
    // Filter to only include studies with at least one enhanced field
    const actuallyEnhanced = enhancedStudies.filter(study => 
      study.enhancedFields && study.enhancedFields.length > 0
    );
    
    res.json(actuallyEnhanced);
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

export default router;