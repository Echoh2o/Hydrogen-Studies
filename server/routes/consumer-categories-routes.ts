import express from 'express';
import { db } from '../db';
import { studies } from '../../shared/schema';
import { sql } from 'drizzle-orm';

const router = express.Router();

// Get counts for all categorization types
router.get('/counts', async (req, res) => {
  try {
    // Static health condition categories with counts
    const healthConditionCounts = [
      { name: "Heart Disease & Hypertension", count: 18 },
      { name: "Brain & Neurological Disorders", count: 35 },
      { name: "Diabetes & Metabolic Health", count: 23 },
      { name: "Arthritis & Inflammation", count: 14 },
      { name: "Lung & Respiratory Conditions", count: 19 },
      { name: "Digestive Health", count: 16 },
      { name: "Cancer Supportive Care", count: 10 },
      { name: "Kidney Health", count: 8 },
      { name: "Skin Conditions", count: 17 },
      { name: "Aging", count: 12 },
      { name: "General Wellness", count: 30 }
    ];

    // Static body system categories with counts
    const bodySystemCounts = [
      { name: "Cardiovascular System", count: 20 },
      { name: "Nervous System", count: 35 },
      { name: "Immune System", count: 18 },
      { name: "Respiratory System", count: 19 },
      { name: "Digestive System", count: 16 },
      { name: "Endocrine System", count: 12 },
      { name: "Muscular System", count: 9 },
      { name: "Skeletal System", count: 7 }
    ];
    
    // Life stage categories to be implemented later
    const lifeStageCategories = [
      { name: "Adults", count: 45 },
      { name: "Seniors", count: 28 },
      { name: "Athletes", count: 15 },
      { name: "Women's Health", count: 12 }
    ];
    
    return res.json({
      success: true,
      data: {
        condition: healthConditionCounts,
        body_system: bodySystemCounts,
        life_stage: lifeStageCategories
      }
    });
  } catch (error) {
    console.error('Error fetching category counts:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve category counts'
    });
  }
});

// Get studies by category
router.get('/studies', async (req, res) => {
  try {
    const { model, category } = req.query;
    
    if (!model || !category) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    // Get category name as a string
    const categoryName = category as string;
    
    if (!db) {
      return res.status(500).json({
        success: false,
        error: 'Database connection not available'
      });
    }
    
    // Map health conditions to relevant keywords for better search results
    const getKeywords = (model: string, categoryName: string): string[] => {
      let keywords: string[] = [];
      
      if (model === 'condition') {
        if (categoryName.includes('Heart Disease')) {
          keywords = ['heart', 'cardiovascular', 'blood pressure', 'hypertension'];
        } else if (categoryName.includes('Brain')) {
          keywords = ['brain', 'cognitive', 'neurological', 'memory', 'neuro'];
        } else if (categoryName.includes('Diabetes')) {
          keywords = ['diabetes', 'insulin', 'glucose', 'blood sugar', 'metabolic'];
        } else if (categoryName.includes('Arthritis')) {
          keywords = ['arthritis', 'inflammation', 'joint', 'pain', 'rheumatoid'];
        } else if (categoryName.includes('Lung')) {
          keywords = ['lung', 'respiratory', 'breathing', 'copd', 'asthma'];
        } else if (categoryName.includes('Digestive')) {
          keywords = ['digestive', 'gut', 'intestine', 'ibs', 'gastro'];
        } else if (categoryName.includes('Cancer')) {
          keywords = ['cancer', 'tumor', 'oncology', 'carcinoma'];
        } else if (categoryName.includes('Kidney')) {
          keywords = ['kidney', 'renal', 'nephro'];
        } else if (categoryName.includes('Skin')) {
          keywords = ['skin', 'dermatitis', 'eczema', 'acne'];
        } else if (categoryName.includes('Aging')) {
          keywords = ['aging', 'longevity', 'age-related', 'senescence'];
        } else if (categoryName.includes('General Wellness')) {
          keywords = ['wellness', 'health', 'antioxidant', 'prevention'];
        }
      } else if (model === 'body_system') {
        if (categoryName.includes('Cardiovascular')) {
          keywords = ['heart', 'cardiovascular', 'blood pressure', 'vascular'];
        } else if (categoryName.includes('Nervous')) {
          keywords = ['brain', 'nerve', 'neural', 'cognitive'];
        } else if (categoryName.includes('Immune')) {
          keywords = ['immune', 'inflammation', 'autoimmune', 'cytokine'];
        } else if (categoryName.includes('Respiratory')) {
          keywords = ['lung', 'breath', 'respiratory', 'oxygen'];
        } else if (categoryName.includes('Digestive')) {
          keywords = ['digestive', 'gut', 'intestine', 'gastro'];
        } else if (categoryName.includes('Endocrine')) {
          keywords = ['hormone', 'insulin', 'thyroid', 'endocrine'];
        } else if (categoryName.includes('Muscular')) {
          keywords = ['muscle', 'strength', 'exercise', 'recovery'];
        } else if (categoryName.includes('Skeletal')) {
          keywords = ['bone', 'joint', 'osteo', 'skeletal'];
        }
      } else if (model === 'life_stage') {
        // Life stage categories
        if (categoryName.includes('Adults')) {
          keywords = ['adult', 'middle-aged', 'working'];
        } else if (categoryName.includes('Seniors')) {
          keywords = ['elderly', 'aging', 'senior', 'older adult'];
        } else if (categoryName.includes('Athletes')) {
          keywords = ['athlete', 'exercise', 'performance', 'sport'];
        } else if (categoryName.includes('Women')) {
          keywords = ['women', 'female', 'estrogen', 'pregnancy'];
        }
      }
      
      // If no specific keywords were found, extract from category name
      if (keywords.length === 0) {
        keywords = categoryName.split(/[\s&]+/).filter(w => w.length > 3);
      }
      
      return keywords;
    };
    
    // Get relevant keywords for this category
    const categoryKeywords = getKeywords(model as string, categoryName);
    
    // Build SQL conditions for each keyword
    const keywordConditions = categoryKeywords.map(keyword => 
      sql`${studies.title} ILIKE ${`%${keyword}%`} OR ${studies.abstract} ILIKE ${`%${keyword}%`}`
    );
    
    // Execute the query with keyword conditions
    const studyResults = await db
      .select()
      .from(studies)
      .where(sql`(${sql.join(keywordConditions, sql` OR `)})`)
      .limit(20);
    
    return res.json({
      success: true,
      data: studyResults
    });
  } catch (error) {
    console.error('Error fetching studies by category:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch studies'
    });
  }
});

// Add life stage route 
router.get('/life-stages', async (req, res) => {
  try {
    // Static life stage data for now
    const lifeStageCategories = [
      { name: "Adults", count: 45, description: "Studies focused on working-age adults" },
      { name: "Seniors", count: 28, description: "Research on elderly populations and aging" },
      { name: "Athletes", count: 15, description: "Studies on performance enhancement and recovery" },
      { name: "Women's Health", count: 12, description: "Research specific to women's health concerns" }
    ];
    
    return res.json({
      success: true,
      data: lifeStageCategories
    });
  } catch (error) {
    console.error('Error fetching life stages:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve life stages'
    });
  }
});

export default router;