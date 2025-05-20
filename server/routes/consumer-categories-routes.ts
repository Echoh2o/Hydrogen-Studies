import { Router } from 'express';
import { 
  batchCategorizeStudies, 
  findStudiesByConsumerCategory, 
  getAllConsumerCategories, 
  getConsumerCategoryCounts,
  categorizeStudyForConsumers,
  CategorizationModel
} from '../consumer-categories';

const router = Router();

/**
 * Get all available consumer categories
 */
router.get('/', async (req, res) => {
  try {
    const categories = getAllConsumerCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching consumer categories:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch consumer categories' 
    });
  }
});

/**
 * Get category counts
 */
router.get('/counts', async (req, res) => {
  try {
    const counts = await getConsumerCategoryCounts();
    res.json({ success: true, data: counts });
  } catch (error) {
    console.error('Error fetching category counts:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch category counts' 
    });
  }
});

/**
 * Manually categorize a specific study with consumer-friendly categories
 */
router.post('/categorize/:studyId', async (req, res) => {
  try {
    const studyId = parseInt(req.params.studyId);
    
    if (isNaN(studyId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid study ID' 
      });
    }
    
    const result = await categorizeStudyForConsumers(studyId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error categorizing study:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to categorize study' 
    });
  }
});

/**
 * Batch categorize multiple studies
 */
router.post('/batch-categorize', async (req, res) => {
  try {
    const { limit = 10 } = req.body;
    
    const result = await batchCategorizeStudies(limit);
    res.json({ 
      success: true, 
      total: result.total,
      successful: result.success,
      failed: result.failed,
      errors: result.errors
    });
  } catch (error) {
    console.error('Error batch categorizing studies:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to batch categorize studies' 
    });
  }
});

/**
 * Find studies by consumer category
 */
router.get('/studies', async (req, res) => {
  try {
    const { model, category, limit = 20, page = 1 } = req.query;
    
    if (!model || !category) {
      return res.status(400).json({ 
        success: false, 
        error: 'Model and category are required' 
      });
    }
    
    let categoryModel: CategorizationModel;
    switch (model) {
      case 'condition':
        categoryModel = CategorizationModel.CONDITION;
        break;
      case 'body_system':
        categoryModel = CategorizationModel.BODY_SYSTEM;
        break;
      case 'life_stage':
        categoryModel = CategorizationModel.LIFE_STAGE;
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid model' 
        });
    }
    
    const studies = await findStudiesByConsumerCategory(
      categoryModel,
      category as string,
      parseInt(limit as string)
    );
    
    res.json({ success: true, data: studies });
  } catch (error) {
    console.error('Error finding studies by category:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to find studies by category' 
    });
  }
});

export default router;