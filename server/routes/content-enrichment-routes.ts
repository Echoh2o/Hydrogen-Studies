/**
 * Content Enrichment Routes
 * 
 * API endpoints for enhancing study content with full abstracts, text, and images
 * from DOI sources.
 */

import { Router } from 'express';
import { db } from '../db';
import { studies } from '@shared/schema';
import { enhanceStudyContent, batchEnhanceStudies, findStudiesForEnhancement } from '../content-enrichment';
import { eq, sql, desc, inArray } from 'drizzle-orm';

const router = Router();

/**
 * Get studies that need content enrichment (missing or truncated abstracts)
 */
router.get('/candidates', async (req, res) => {
  try {
    const studyIds = await findStudiesForEnhancement(50);
    
    if (studyIds.length === 0) {
      return res.json([]);
    }
    
    const candidateStudies = await db
      .select()
      .from(studies)
      .where(
        // Using the IN operator to get all studies by their ids
        inArray(studies.id, studyIds)
      );
      
    return res.json(candidateStudies);
  } catch (error) {
    console.error('Error fetching candidates for content enrichment:', error);
    return res.status(500).json({ message: 'Failed to fetch candidates for content enrichment' });
  }
});

/**
 * Get recently enriched studies
 */
router.get('/recent', async (req, res) => {
  try {
    // For now, we'll return recently updated studies as a proxy
    // This could be improved by tracking enrichment operations in their own table
    const recentlyProcessed = await db
      .select()
      .from(studies)
      .where(
        // Only select studies with DOIs and full abstracts
        sql`${studies.doi} IS NOT NULL AND LENGTH(${studies.abstract}) > 500`
      )
      .orderBy(desc(studies.createdAt))
      .limit(20);
      
    // Add mock "enhancedFields" for the UI to display
    const enhancedStudies = recentlyProcessed.map(study => ({
      ...study,
      enhancedFields: getEnhancedFields(study)
    }));
    
    return res.json(enhancedStudies);
  } catch (error) {
    console.error('Error fetching recently enhanced studies:', error);
    return res.status(500).json({ message: 'Failed to fetch recently enhanced studies' });
  }
});

/**
 * Enhance a single study content by id
 */
router.post('/study/:id', async (req, res) => {
  const studyId = parseInt(req.params.id);
  
  if (isNaN(studyId)) {
    return res.status(400).json({ message: 'Invalid study ID' });
  }
  
  try {
    const result = await enhanceStudyContent(studyId);
    
    if (!result.success) {
      return res.status(400).json({ 
        message: result.message || 'Failed to enhance study content'
      });
    }
    
    return res.json(result);
  } catch (error) {
    console.error('Error enhancing study content:', error);
    return res.status(500).json({ message: 'An error occurred while enhancing study content' });
  }
});

/**
 * Batch enhance multiple studies
 */
router.post('/batch', async (req, res) => {
  const { count = 10 } = req.body;
  
  // Validate count
  const batchSize = Math.min(Math.max(1, count), 100);
  
  try {
    const studyIds = await findStudiesForEnhancement(batchSize);
    
    if (studyIds.length === 0) {
      return res.json({ message: 'No studies found that need enhancement', processed: 0, success: 0, failed: 0 });
    }
    
    const result = await batchEnhanceStudies(studyIds);
    
    // Count successes and failures from the results
    const successCount = result.results.filter(r => r.success).length;
    const failedCount = result.results.length - successCount;
    
    return res.json({
      message: `Enhanced ${successCount} studies out of ${result.results.length}`,
      processed: result.results.length,
      success: successCount,
      failed: failedCount,
      overall: result.overall
    });
  } catch (error) {
    console.error('Error batch enhancing studies:', error);
    return res.status(500).json({ message: 'Failed to process batch enhancement' });
  }
});

/**
 * Helper function to determine which fields were likely enhanced
 * based on the content of the study
 */
function getEnhancedFields(study: any): string[] {
  const enhancedFields: string[] = [];
  
  if (study.abstract && study.abstract.length > 500) {
    enhancedFields.push('abstract');
  }
  
  if (study.methods && study.methods.length > 100) {
    enhancedFields.push('methods');
  }
  
  if (study.results && study.results.length > 100) {
    enhancedFields.push('results');
  }
  
  if (study.conclusion && study.conclusion.length > 100) {
    enhancedFields.push('conclusion');
  }
  
  if (study.fullText && study.fullText.length > 1000) {
    enhancedFields.push('fullText');
  }
  
  if (study.imageUrl) {
    enhancedFields.push('image');
  }
  
  // Default if nothing was enhanced
  if (enhancedFields.length === 0) {
    enhancedFields.push('metadata');
  }
  
  return enhancedFields;
}

// Export the router
export default router;