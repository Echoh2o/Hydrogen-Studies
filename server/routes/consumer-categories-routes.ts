/**
 * Consumer-Friendly Categorization API Routes
 * 
 * Provides endpoints for categorizing studies into consumer-friendly categories
 * and fetching studies by these categories.
 */
import { Router } from 'express';
import { 
  categorizeStudyForConsumers, 
  batchCategorizeStudies, 
  findStudiesByConsumerCategory, 
  getAllConsumerCategories,
  getConsumerCategoryCounts,
  CategorizationModel
} from '../consumer-categories';

const router = Router();

// API endpoint to get all available consumer categories
router.get('/api/consumer-categories', async (req, res) => {
  try {
    const categories = getAllConsumerCategories();
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error getting consumer categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get consumer categories'
    });
  }
});

// API endpoint to get study counts for each consumer category
router.get('/api/consumer-categories/counts', async (req, res) => {
  try {
    const counts = await getConsumerCategoryCounts();
    
    res.json({
      success: true,
      data: counts
    });
  } catch (error) {
    console.error('Error getting consumer category counts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get consumer category counts'
    });
  }
});

// API endpoint to categorize a single study
router.post('/api/studies/:id/categorize-consumer', async (req, res) => {
  try {
    const studyId = parseInt(req.params.id);
    if (isNaN(studyId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid study ID' 
      });
    }
    
    const result = await categorizeStudyForConsumers(studyId);
    
    res.json({
      success: result.success,
      message: result.message,
      data: result.categories
    });
  } catch (error) {
    console.error('Error categorizing study for consumers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to categorize study'
    });
  }
});

// API endpoint to batch categorize multiple studies
router.post('/api/studies/batch-categorize-consumer', async (req, res) => {
  try {
    const limit = req.body.limit || 10;
    
    const result = await batchCategorizeStudies(limit);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error batch categorizing studies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to batch categorize studies'
    });
  }
});

// API endpoint to get studies by consumer category
router.get('/api/studies/by-consumer-category/:model/:category', async (req, res) => {
  try {
    const { model, category } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    if (!model || !Object.values(CategorizationModel).includes(model as CategorizationModel)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid categorization model'
      });
    }
    
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category is required'
      });
    }
    
    const studies = await findStudiesByConsumerCategory(
      model as CategorizationModel,
      category,
      limit
    );
    
    res.json({
      success: true,
      data: studies
    });
  } catch (error) {
    console.error('Error getting studies by consumer category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get studies by consumer category'
    });
  }
});

export default router;