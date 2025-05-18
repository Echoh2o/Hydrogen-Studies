/**
 * Content Enrichment Routes
 * 
 * API endpoints for enhancing study content with full abstracts, text, and images
 * from DOI sources.
 */

import { Router } from 'express';
import { db } from '../db';
import { studies } from '@shared/schema';
import { eq, lt, desc, and, isNull, not, sql } from 'drizzle-orm';
import { enhanceStudyContent, batchEnhanceStudies, findStudiesForEnhancement } from '../content-enrichment';
import { z } from 'zod';

const router = Router();

// Get studies that need content enhancement
router.get('/admin/studies/incomplete', async (req, res) => {
  try {
    // Find studies with DOIs but short or missing abstracts
    const results = await db
      .select({
        id: studies.id,
        title: studies.title,
        doi: studies.doi,
        abstract: studies.abstract,
        imageUrl: studies.imageUrl
      })
      .from(studies)
      .where(
        and(
          not(isNull(studies.doi)),
          // One of these conditions:
          sql`(
            ${isNull(studies.abstract)} OR 
            ${lt(sql`length(${studies.abstract})`, 100)} OR
            ${isNull(studies.imageUrl)}
          )`
        )
      )
      .orderBy(desc(studies.id))
      .limit(50);
    
    res.json(results);
  } catch (error: any) {
    console.error('Error fetching incomplete studies:', error);
    res.status(500).json({
      success: false,
      message: `Failed to fetch studies for enhancement: ${error.message}`
    });
  }
});

// Enhance a single study by ID
router.post('/admin/enhance-study/:id', async (req, res) => {
  try {
    const studyId = parseInt(req.params.id);
    
    if (isNaN(studyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid study ID'
      });
    }
    
    const result = await enhanceStudyContent(studyId);
    res.json(result);
  } catch (error: any) {
    console.error('Error enhancing study:', error);
    res.status(500).json({
      success: false,
      message: `Failed to enhance study: ${error.message}`
    });
  }
});

// Batch enhance multiple studies
router.post('/admin/enhance-studies/batch', async (req, res) => {
  try {
    const schema = z.object({
      studyIds: z.array(z.number())
    });
    
    const validation = schema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request body',
        errors: validation.error.errors
      });
    }
    
    const { studyIds } = validation.data;
    
    if (studyIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No study IDs provided'
      });
    }
    
    const result = await batchEnhanceStudies(studyIds);
    res.json(result);
  } catch (error: any) {
    console.error('Error batch enhancing studies:', error);
    res.status(500).json({
      success: false,
      message: `Failed to batch enhance studies: ${error.message}`
    });
  }
});

// Auto-find studies needing enhancement
router.post('/admin/enhance-studies/auto', async (req, res) => {
  try {
    const schema = z.object({
      limit: z.number().optional().default(10)
    });
    
    const validation = schema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request body',
        errors: validation.error.errors
      });
    }
    
    const { limit } = validation.data;
    
    // Find studies that need enhancement
    const studyIds = await findStudiesForEnhancement(limit);
    
    if (studyIds.length === 0) {
      return res.json({
        success: true,
        message: 'No studies found needing enhancement',
        results: []
      });
    }
    
    // Process the found studies
    const result = await batchEnhanceStudies(studyIds);
    res.json(result);
  } catch (error: any) {
    console.error('Error auto-enhancing studies:', error);
    res.status(500).json({
      success: false,
      message: `Failed to auto-enhance studies: ${error.message}`
    });
  }
});

export default router;