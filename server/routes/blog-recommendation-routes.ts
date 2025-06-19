import { Router } from 'express';
import { z } from 'zod';
import { 
  getBlogRecommendations, 
  generateBulkBlogs,
  type BulkGenerationRequest 
} from '../blog-recommendation-system';

const router = Router();

/**
 * Get blog article recommendations
 */
router.get('/recommendations', async (req, res) => {
  try {
    console.log('Blog recommendations endpoint called');
    const limit = parseInt(req.query.limit as string) || 10; // Reduced default limit
    const recommendations = await getBlogRecommendations(limit);
    
    console.log(`Returning ${recommendations.length} recommendations`);
    res.json({
      success: true,
      data: recommendations,
      count: recommendations.length
    });
  } catch (error) {
    console.error('Error fetching blog recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch blog recommendations'
    });
  }
});

/**
 * Generate bulk blog articles
 */
router.post('/bulk-generate', async (req, res) => {
  try {
    const requestSchema = z.object({
      selectedStudyIds: z.array(z.number()).min(1, 'At least one study must be selected'),
      articleTypes: z.array(z.string()).min(1, 'At least one article type must be selected'),
      readingLevel: z.string().default('general'),
      includeImages: z.boolean().default(true),
      includeSEO: z.boolean().default(true),
      saveToDatabase: z.boolean().default(false)
    });

    const validatedRequest = requestSchema.parse(req.body);
    
    // Generate the blogs
    const results = await generateBulkBlogs(validatedRequest);
    
    // TODO: Implement save to database functionality
    let saveResults = null;
    
    res.json({
      success: true,
      data: {
        generationResults: results,
        saveResults: saveResults,
        summary: {
          totalStudies: results.length,
          successfulStudies: results.filter(r => r.success).length,
          failedStudies: results.filter(r => !r.success).length,
          totalBlogs: results.reduce((sum, r) => sum + r.generatedBlogs.length, 0),
          savedBlogs: saveResults?.saved || 0,
          failedSaves: saveResults?.failed || 0
        }
      }
    });
  } catch (error) {
    console.error('Error generating bulk blogs:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate bulk blogs'
    });
  }
});

/**
 * Preview blog generation for selected studies
 */
router.post('/preview', async (req, res) => {
  try {
    const previewSchema = z.object({
      selectedStudyIds: z.array(z.number()).min(1, 'At least one study must be selected'),
      articleTypes: z.array(z.string()).min(1, 'At least one article type must be selected')
    });

    const { selectedStudyIds, articleTypes } = previewSchema.parse(req.body);
    
    // Calculate estimated generation stats
    const totalBlogs = selectedStudyIds.length * articleTypes.length;
    const estimatedTimeMinutes = Math.ceil(totalBlogs * 1.5); // Estimate 1.5 minutes per blog
    
    res.json({
      success: true,
      data: {
        selectedStudiesCount: selectedStudyIds.length,
        articleTypesCount: articleTypes.length,
        totalBlogsToGenerate: totalBlogs,
        estimatedTimeMinutes: estimatedTimeMinutes,
        estimatedTimeDisplay: estimatedTimeMinutes < 60 
          ? `${estimatedTimeMinutes} minutes`
          : `${Math.floor(estimatedTimeMinutes / 60)}h ${estimatedTimeMinutes % 60}m`,
        articleTypes: articleTypes
      }
    });
  } catch (error) {
    console.error('Error creating generation preview:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create generation preview'
    });
  }
});

export default router;