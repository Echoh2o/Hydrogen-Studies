import express from 'express';
import { db } from '../db';
import { studies } from '../../shared/schema';
import { sql } from 'drizzle-orm';

const router = express.Router();

// Get consumer categories' names - use specific path to avoid conflict with homepage
router.get('/list', async (req, res) => {
  // Set content type to JSON explicitly
  res.setHeader('Content-Type', 'application/json');
  try {
    // Health condition categories
    const conditionCategories = [
      "Heart Disease & Hypertension",
      "Brain & Neurological Disorders",
      "Diabetes & Metabolic Health",
      "Arthritis & Inflammation",
      "Lung & Respiratory Conditions",
      "Digestive Health (Gut/Liver)",
      "Cancer Supportive Care"
    ];
    
    // Body system categories
    const bodySystemCategories = [
      "Cardiovascular System",
      "Nervous System",
      "Respiratory System",
      "Digestive System",
      "Immune System",
      "Musculoskeletal System",
      "Renal System",
      "Integumentary System"
    ];
    
    // Life stage categories
    const lifeStageCategories = [
      "Infants & Newborns",
      "Children & Adolescents",
      "Adults",
      "Older Adults",
      "Athletes & Fitness"
    ];
    
    return res.json({
      success: true,
      data: {
        condition: conditionCategories,
        body_system: bodySystemCategories,
        life_stage: lifeStageCategories
      }
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve categories'
    });
  }
});

// Get counts for all categorization types
router.get('/counts', async (req, res) => {
  // Set content type to JSON explicitly
  res.setHeader('Content-Type', 'application/json');
  try {
    // Health condition categories matching those in the database 
    const healthConditionCounts = [
      { name: "Heart Disease & Hypertension", count: 18 },
      { name: "Brain & Neurological Disorders", count: 34 },
      { name: "Diabetes & Metabolic Health", count: 21 },
      { name: "Arthritis & Inflammation", count: 9 },
      { name: "Lung & Respiratory Conditions", count: 19 },
      { name: "Digestive Health (Gut/Liver)", count: 24 },
      { name: "Cancer Supportive Care", count: 10 },
      { name: "Cardiovascular Health", count: 18 },
      { name: "Neurological Health", count: 34 },
      { name: "Metabolic Health", count: 21 },
      { name: "Inflammation", count: 9 },
      { name: "Respiratory Health", count: 19 },
      { name: "Kidney Health", count: 8 },
      { name: "Skin Health", count: 17 },
      { name: "Healthy Aging", count: 12 },
      { name: "General Wellness", count: 30 }
    ];

    // Body system categories with accurate names and counts
    const bodySystemCounts = [
      { name: "Cardiovascular System", count: 18 },
      { name: "Nervous System", count: 35 },
      { name: "Respiratory System", count: 19 },
      { name: "Digestive System", count: 24 }, // Combined Gastrointestinal (16) and Liver (8)
      { name: "Immune System", count: 15 },
      { name: "Musculoskeletal System", count: 10 },
      { name: "Renal System", count: 8 }, // Kidney
      { name: "Integumentary System", count: 17 } // Dermatology/Skin
    ];
    
    // Life stage categories with refined names and counts
    const lifeStageCategories = [
      { name: "Infants & Newborns", count: 5 },
      { name: "Children & Adolescents", count: 8 },
      { name: "Adults", count: 45 },
      { name: "Older Adults", count: 28 },
      { name: "Athletes & Fitness", count: 18 }
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
        if (categoryName.includes('Cardiovascular')) {
          keywords = ['heart', 'cardiovascular', 'blood pressure', 'hypertension', 'vascular'];
        } else if (categoryName.includes('Neurological') || categoryName.includes('Neurodegenerative')) {
          keywords = ['brain', 'cognitive', 'neurological', 'memory', 'neuro', 'alzheimer', 'parkinson'];
        } else if (categoryName.includes('Metabolic') || categoryName.includes('Metabolism & Diabetes')) {
          keywords = ['diabetes', 'insulin', 'glucose', 'blood sugar', 'metabolic', 'obesity'];
        } else if (categoryName.includes('Inflammation')) {
          keywords = ['arthritis', 'inflammation', 'joint', 'pain', 'rheumatoid', 'anti-inflammatory'];
        } else if (categoryName.includes('Respiratory')) {
          keywords = ['lung', 'respiratory', 'breathing', 'copd', 'asthma', 'pulmonary'];
        } else if (categoryName.includes('Gastrointestinal')) {
          keywords = ['digestive', 'gut', 'intestine', 'ibs', 'gastro', 'colon'];
        } else if (categoryName.includes('Cancer')) {
          keywords = ['cancer', 'tumor', 'oncology', 'carcinoma', 'malignant'];
        } else if (categoryName.includes('Kidney')) {
          keywords = ['kidney', 'renal', 'nephro', 'urinary'];
        } else if (categoryName.includes('Liver')) {
          keywords = ['liver', 'hepatic', 'hepato', 'cirrhosis'];
        } else if (categoryName.includes('Dermatology')) {
          keywords = ['skin', 'dermatitis', 'eczema', 'acne', 'dermatology'];
        } else if (categoryName.includes('Aging')) {
          keywords = ['aging', 'longevity', 'age-related', 'senescence', 'elderly'];
        } else if (categoryName.includes('General')) {
          keywords = ['wellness', 'health', 'antioxidant', 'prevention', 'hydrogen'];
        }
      } else if (model === 'body_system') {
        if (categoryName.includes('Cardiovascular')) {
          keywords = ['heart', 'cardiovascular', 'blood pressure', 'vascular', 'circulation'];
        } else if (categoryName.includes('Nervous')) {
          keywords = ['brain', 'nerve', 'neural', 'cognitive', 'neurological'];
        } else if (categoryName.includes('Immune')) {
          keywords = ['immune', 'inflammation', 'autoimmune', 'cytokine', 'antibody'];
        } else if (categoryName.includes('Respiratory')) {
          keywords = ['lung', 'breath', 'respiratory', 'oxygen', 'pulmonary'];
        } else if (categoryName.includes('Digestive')) {
          keywords = ['digestive', 'gut', 'intestine', 'gastro', 'liver', 'hepatic'];
        } else if (categoryName.includes('Musculoskeletal')) {
          keywords = ['muscle', 'strength', 'bone', 'joint', 'skeletal', 'exercise'];
        } else if (categoryName.includes('Renal')) {
          keywords = ['kidney', 'renal', 'nephro', 'urinary'];
        } else if (categoryName.includes('Integumentary')) {
          keywords = ['skin', 'dermal', 'dermatology', 'epithelial', 'wound'];
        }
      } else if (model === 'life_stage') {
        // Life stage categories
        if (categoryName.includes('Infants')) {
          keywords = ['infant', 'baby', 'newborn', 'neonatal', 'perinatal'];
        } else if (categoryName.includes('Children')) {
          keywords = ['child', 'children', 'adolescent', 'pediatric', 'youth', 'teen'];
        } else if (categoryName.includes('Adults') && !categoryName.includes('Older')) {
          keywords = ['adult', 'middle-aged', 'working', 'man', 'woman'];
        } else if (categoryName.includes('Older Adults')) {
          keywords = ['elderly', 'aging', 'senior', 'older adult', 'geriatric'];
        } else if (categoryName.includes('Athletes')) {
          keywords = ['athlete', 'exercise', 'fitness', 'performance', 'sport', 'training'];
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
    
    // Use direct database query to avoid column issues
    try {
      const { pool } = await import('../db');
      
      // Create search terms for brain health category
      const searchTerms = categoryKeywords.join('|');
      
      const query = `
        SELECT id, title, abstract, authors, journal, publish_date as "publishDate", 
               category, doi, image_url as "imageUrl"
        FROM studies 
        WHERE title ILIKE ANY($1) OR abstract ILIKE ANY($2)
        ORDER BY id DESC
        LIMIT 20
      `;
      
      const likeTerms = categoryKeywords.map(keyword => `%${keyword}%`);
      const result = await pool.query(query, [likeTerms, likeTerms]);
      const studyResults = result.rows;
      
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
    // Life stage categories with descriptions
    const lifeStageCategories = [
      { name: "Infants & Newborns", count: 5, description: "Studies focused on infant health and development" },
      { name: "Children & Adolescents", count: 8, description: "Research on pediatric and adolescent health" },
      { name: "Adults", count: 45, description: "Studies focused on working-age adults" },
      { name: "Older Adults", count: 28, description: "Research on elderly populations and aging" },
      { name: "Athletes & Fitness", count: 18, description: "Studies on performance enhancement and recovery" }
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