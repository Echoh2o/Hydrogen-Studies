import { Router } from 'express';
import { generateImageForStudy, findStudiesNeedingImages, batchGenerateImagesForStudies } from '../image-generator';

const router = Router();

/**
 * Generate image for a specific study
 */
router.post('/generate/:studyId', async (req, res) => {
  try {
    const studyId = parseInt(req.params.studyId);
    if (isNaN(studyId)) {
      return res.status(400).json({ success: false, message: 'Invalid study ID' });
    }
    
    const result = await generateImageForStudy(studyId);
    return res.json(result);
  } catch (error) {
    console.error('Error generating image for study:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error generating image: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

/**
 * Find studies that need images
 */
router.get('/find-studies-needing-images', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const studyIds = await findStudiesNeedingImages(limit);
    return res.json({ 
      success: true, 
      studyIds, 
      count: studyIds.length 
    });
  } catch (error) {
    console.error('Error finding studies needing images:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error finding studies: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

/**
 * Batch generate images for multiple studies
 */
router.post('/batch-generate', async (req, res) => {
  try {
    const { studyIds, limit } = req.body;
    
    // If studyIds provided, use them, otherwise auto-find studies that need images
    const idsToProcess = studyIds || await findStudiesNeedingImages(limit || 10);
    
    if (!idsToProcess || idsToProcess.length === 0) {
      return res.json({ 
        success: false, 
        message: 'No studies to process' 
      });
    }
    
    // Start the batch process
    const batchProcess = batchGenerateImagesForStudies(idsToProcess);
    
    // Return immediately to let the process run in background
    return res.json({ 
      success: true, 
      message: `Started batch image generation for ${idsToProcess.length} studies`,
      studyIds: idsToProcess
    });
  } catch (error) {
    console.error('Error starting batch image generation:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error starting batch process: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

export const imageGenerationRoutes = router;