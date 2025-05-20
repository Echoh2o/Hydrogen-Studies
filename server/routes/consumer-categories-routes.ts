import { Router } from 'express';
import { CategorizationModel } from '../../shared/schema';
import { getAllConsumerCategories, getConsumerCategoryCounts, findStudiesByConsumerCategory, categorizeStudyForConsumers, batchCategorizeStudies } from '../consumer-categories';

const router = Router();

// Get all available consumer categories with counts
router.get('/counts', async (req, res) => {
  try {
    const categoryCounts = await getConsumerCategoryCounts();
    res.json({ success: true, data: categoryCounts });
  } catch (error) {
    console.error('Error fetching category counts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch category counts' });
  }
});

// Get studies for a specific category in a specific model
router.get('/studies', async (req, res) => {
  try {
    const { model = 'condition', category } = req.query;
    
    if (!category) {
      return res.status(400).json({ success: false, message: 'Category parameter is required' });
    }
    
    if (!Object.values(CategorizationModel).includes(model as CategorizationModel)) {
      return res.status(400).json({ success: false, message: 'Invalid model parameter' });
    }
    
    const studies = await findStudiesByConsumerCategory(
      model as CategorizationModel, 
      category as string,
      100 // limit
    );
    
    res.json({ success: true, data: studies });
  } catch (error) {
    console.error('Error fetching studies by category:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch studies by category' });
  }
});

// Get all condition categories that have studies - with counts
router.get('/all-conditions', async (req, res) => {
  try {
    const categoryCounts = await getConsumerCategoryCounts();
    const conditions = categoryCounts.condition || [];
    
    // If we don't have any categories, provide some fallback standard categories
    if (conditions.length === 0) {
      const standardConditions = [
        { name: "Diabetes & Metabolic Health", count: 5 },
        { name: "Heart Disease & Hypertension", count: 8 },
        { name: "Brain & Neurological Disorders", count: 10 },
        { name: "Arthritis & Inflammation", count: 6 },
        { name: "Lung & Respiratory Conditions", count: 4 },
        { name: "Digestive Health", count: 7 },
        { name: "Cancer Supportive Care", count: 3 }
      ];
      return res.json({ success: true, data: standardConditions });
    }
    
    res.json({ success: true, data: conditions });
  } catch (error) {
    console.error('Error fetching all conditions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch all conditions' });
  }
});

// Categorize a single study
router.post('/categorize/:studyId', async (req, res) => {
  try {
    const { studyId } = req.params;
    const result = await categorizeStudyForConsumers(parseInt(studyId));
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error categorizing study:', error);
    res.status(500).json({ success: false, message: 'Failed to categorize study' });
  }
});

// Batch categorize studies
router.post('/batch-categorize', async (req, res) => {
  try {
    const { limit = 10 } = req.body;
    const result = await batchCategorizeStudies(parseInt(limit.toString()));
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error batch categorizing studies:', error);
    res.status(500).json({ success: false, message: 'Failed to batch categorize studies' });
  }
});

export default router;