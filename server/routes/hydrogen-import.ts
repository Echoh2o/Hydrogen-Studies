import express from 'express';
import { db } from '../db';
import { studies } from '../../shared/schema';
import * as XLSX from 'xlsx';
import path from 'path';
import { z } from 'zod';

// Define Excel column mappings
const hydrogenColumnMap = {
  'ID': 'id',
  'First Author': 'first_author',
  'Other Authors': 'other_authors',
  'Last Author': 'last_author',
  'Title': 'title',
  'Publish Year': 'year',
  'Journal': 'journal',
  'DOI/PMID/Link': 'url',
  'Abstract': 'abstract',
  'Rank': 'rank',
  'Model': 'model',
  'Primary Topic': 'primary_topic',
  'Secondary Topic': 'secondary_topic',
  'Tertiary Topic': 'tertiary_topic',
  'Vehicle': 'vehicle',
  'pH': 'ph',
  'Application': 'application',
  'Comparison': 'comparison',
  'Complement': 'complement',
  'Country': 'country'
};

const router = express.Router();

// Route for importing the hydrogen research database
router.post('/import-hydrogen-database', async (req, res) => {
  try {
    // Path to the hydrogen database file
    const filePath = path.join(process.cwd(), 'attached_assets', 'Hydrogen Research Database_Timeline.xlsx');

    // Read Excel file
    const workbook = XLSX.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Processing ${jsonData.length} studies from Hydrogen Research Database`);

    // Track import statistics
    let imported = 0;
    const total = jsonData.length;
    const errors: string[] = [];

    // Process each row
    for (const row of jsonData) {
      try {
        // Map Excel columns to database fields
        const study: any = {};
        
        // Process each column from the Excel file
        for (const [excelColumn, dbColumn] of Object.entries(hydrogenColumnMap)) {
          if (row[excelColumn] !== undefined) {
            study[dbColumn] = row[excelColumn];
          }
        }

        // Add type and method from model field if available
        if (study.model) {
          study.type = mapModelToType(study.model);
          study.methods = mapModelToMethods(study.model);
        }
        
        // Set categoryId based on primary topic
        if (study.primary_topic) {
          study.categoryId = await mapTopicToCategory(study.primary_topic, study.secondary_topic);
        }
        
        // Set health condition based on topics
        if (study.primary_topic || study.secondary_topic || study.tertiary_topic) {
          study.healthConditions = extractHealthConditions(study.primary_topic, study.secondary_topic, study.tertiary_topic);
        }
        
        // Set body systems based on topics
        if (study.primary_topic || study.secondary_topic || study.tertiary_topic) {
          study.bodySystems = extractBodySystems(study.primary_topic, study.secondary_topic, study.tertiary_topic);
        }
        
        // Fix or create needed fields
        study.title = study.title || 'Untitled Study';
        study.abstract = study.abstract || '';
        study.year = study.year ? parseInt(study.year.toString()) : null;
        study.url = study.url || '';
        study.peerReviewed = isProbablyPeerReviewed(study.journal);
        study.journal = study.journal || '';
        study.createdAt = new Date();
        study.updatedAt = new Date();
        
        // Insert study into database
        await db.insert(studies).values(study).onConflictDoUpdate({
          target: [studies.title, studies.year],
          set: {
            ...study,
            updatedAt: new Date()
          }
        });
        
        imported++;
      } catch (error) {
        console.error(`Error importing study: ${(error as Error).message}`);
        errors.push((error as Error).message);
      }
    }

    console.log(`Hydrogen Database Import completed. Imported ${imported} of ${total} studies`);
    
    return res.json({
      success: true,
      total,
      imported,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error importing Hydrogen Research Database:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to import Hydrogen Research Database',
      error: (error as Error).message
    });
  }
});

// Helper function to map topics to categories
async function mapTopicToCategory(primaryTopic?: string, secondaryTopic?: string): Promise<number> {
  // Default to a general category if we can't determine
  let categoryId = 1; // Default to General category
  
  const topicToCategory: Record<string, number> = {
    // Cardiovascular
    'Heart': 2,
    'Cardiovascular': 2,
    'Hypertension': 2,
    'Cardiac': 2,
    
    // Inflammation
    'Inflammation': 4,
    'Inflammatory': 4,
    'Immune': 4,
    'Autoimmune': 4,
    
    // Neurological
    'Brain': 3,
    'Neurological': 3,
    'Cognitive': 3,
    'Neurodegenerative': 3,
    
    // Metabolic
    'Metabolic': 5,
    'Diabetes': 5,
    'Obesity': 5,
    'Liver': 5,
    'Kidney': 5,
    
    // Gastrointestinal
    'Gut': 6,
    'Intestine': 6,
    'Gastric': 6,
    'Colon': 6,
    'Digestive': 6,
    
    // Respiratory
    'Lung': 7,
    'Respiratory': 7,
    'Pulmonary': 7,
    'Asthma': 7,
    
    // General health
    'Health': 1,
    'Wellbeing': 1,
    'Performance': 1,
    'Athletic': 1,
    'Skin': 1
  };
  
  // Check primary topic first
  if (primaryTopic) {
    const primaryMatches = Object.entries(topicToCategory).find(([key]) => 
      primaryTopic.toLowerCase().includes(key.toLowerCase())
    );
    
    if (primaryMatches) {
      return primaryMatches[1];
    }
  }
  
  // Check secondary topic if no match found
  if (secondaryTopic) {
    const secondaryMatches = Object.entries(topicToCategory).find(([key]) => 
      secondaryTopic.toLowerCase().includes(key.toLowerCase())
    );
    
    if (secondaryMatches) {
      return secondaryMatches[1];
    }
  }
  
  return categoryId;
}

// Map model to study type
function mapModelToType(model: string): string {
  const modelLower = model.toLowerCase();
  
  if (modelLower.includes('human') || modelLower.includes('clinical')) {
    return 'Clinical';
  } else if (modelLower.includes('animal') || modelLower.includes('mice') || modelLower.includes('rat')) {
    return 'Preclinical';
  } else if (modelLower.includes('vitro') || modelLower.includes('cell')) {
    return 'In Vitro';
  } else if (modelLower.includes('review') || modelLower.includes('meta')) {
    return 'Review';
  }
  
  return 'Other';
}

// Map model to methods
function mapModelToMethods(model: string): string {
  const modelLower = model.toLowerCase();
  
  if (modelLower.includes('human') || modelLower.includes('clinical')) {
    return 'Human Clinical Trial';
  } else if (modelLower.includes('animal')) {
    return 'Animal Study';
  } else if (modelLower.includes('mice') || modelLower.includes('mouse')) {
    return 'Mouse Model';
  } else if (modelLower.includes('rat')) {
    return 'Rat Model';
  } else if (modelLower.includes('vitro')) {
    return 'In Vitro Cell Culture';
  } else if (modelLower.includes('review')) {
    return 'Systematic Review';
  } else if (modelLower.includes('meta')) {
    return 'Meta-Analysis';
  }
  
  return model; // Return original if no match
}

// Extract health conditions from topics
function extractHealthConditions(primaryTopic?: string, secondaryTopic?: string, tertiaryTopic?: string): string[] {
  const healthConditions = new Set<string>();
  const topics = [primaryTopic, secondaryTopic, tertiaryTopic].filter(Boolean) as string[];
  
  const conditionKeywords = [
    'Alzheimer', 'Parkinson', 'dementia', 'stroke', 'anxiety', 'depression',
    'diabetes', 'obesity', 'hypertension', 'heart disease', 'arthritis',
    'inflammation', 'cancer', 'tumor', 'asthma', 'COPD', 'liver disease',
    'kidney disease', 'autoimmune', 'allergy', 'infection', 'sepsis',
    'ulcer', 'colitis', 'IBS', 'pain', 'injury', 'wound', 'trauma'
  ];
  
  for (const topic of topics) {
    for (const keyword of conditionKeywords) {
      if (topic.toLowerCase().includes(keyword.toLowerCase())) {
        // Capitalize first letter of each word
        const condition = keyword
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
          
        healthConditions.add(condition);
      }
    }
  }
  
  return Array.from(healthConditions);
}

// Extract body systems from topics
function extractBodySystems(primaryTopic?: string, secondaryTopic?: string, tertiaryTopic?: string): string[] {
  const bodySystems = new Set<string>();
  const topics = [primaryTopic, secondaryTopic, tertiaryTopic].filter(Boolean) as string[];
  
  const systemMap: Record<string, string> = {
    'brain': 'Neurological',
    'neuro': 'Neurological',
    'cognitive': 'Neurological',
    'memory': 'Neurological',
    'heart': 'Cardiovascular',
    'cardio': 'Cardiovascular',
    'vascular': 'Cardiovascular',
    'blood': 'Cardiovascular',
    'liver': 'Digestive',
    'gastric': 'Digestive',
    'stomach': 'Digestive',
    'intestine': 'Digestive',
    'gut': 'Digestive',
    'colon': 'Digestive',
    'lung': 'Respiratory',
    'pulmonary': 'Respiratory',
    'breathing': 'Respiratory',
    'respiratory': 'Respiratory',
    'kidney': 'Urinary',
    'renal': 'Urinary',
    'immune': 'Immune',
    'inflammation': 'Immune',
    'skin': 'Integumentary',
    'muscle': 'Musculoskeletal',
    'bone': 'Musculoskeletal',
    'joint': 'Musculoskeletal',
    'hormone': 'Endocrine',
    'metabolic': 'Endocrine',
    'thyroid': 'Endocrine',
    'insulin': 'Endocrine',
    'glucose': 'Endocrine'
  };
  
  for (const topic of topics) {
    for (const [keyword, system] of Object.entries(systemMap)) {
      if (topic.toLowerCase().includes(keyword.toLowerCase())) {
        bodySystems.add(system);
      }
    }
  }
  
  return Array.from(bodySystems);
}

// Check if journal is likely peer-reviewed
function isProbablyPeerReviewed(journal?: string): boolean {
  if (!journal) return false;
  
  const peerReviewedIndicators = [
    'journal', 'science', 'medicine', 'medical', 'biology', 'research',
    'physiology', 'biochemistry', 'cell', 'molecular', 'clinical',
    'lancet', 'jama', 'nejm', 'bmj', 'nature', 'proceedings'
  ];
  
  return peerReviewedIndicators.some(indicator => 
    journal.toLowerCase().includes(indicator.toLowerCase())
  );
}

export default router;