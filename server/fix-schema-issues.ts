/**
 * Schema Issues Fix Script
 * 
 * Fixes critical TypeScript and schema issues identified in the audit
 */

import { db } from './db';
import { studies, consumerCategories } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Fix missing consumer categories data by creating basic entries
 */
async function createBasicConsumerCategories() {
  console.log('Creating basic consumer categories...');
  
  const categories = [
    // Health conditions
    { name: 'Heart Disease & Hypertension', categoryModel: 'condition', slug: 'heart-disease-hypertension', description: 'Studies related to cardiovascular health and blood pressure' },
    { name: 'Brain & Neurological Disorders', categoryModel: 'condition', slug: 'brain-neurological', description: 'Studies on cognitive function and neurological health' },
    { name: 'Diabetes & Metabolic Health', categoryModel: 'condition', slug: 'diabetes-metabolic', description: 'Studies on blood sugar regulation and metabolism' },
    { name: 'Arthritis & Inflammation', categoryModel: 'condition', slug: 'arthritis-inflammation', description: 'Studies on joint health and inflammatory conditions' },
    
    // Body systems
    { name: 'Cardiovascular System', categoryModel: 'body_system', slug: 'cardiovascular', description: 'Heart and blood vessel related studies' },
    { name: 'Nervous System', categoryModel: 'body_system', slug: 'nervous-system', description: 'Brain and nerve related studies' },
    { name: 'Respiratory System', categoryModel: 'body_system', slug: 'respiratory', description: 'Lung and breathing related studies' },
    { name: 'Digestive System', categoryModel: 'body_system', slug: 'digestive', description: 'Gut and digestive health studies' },
    
    // Life stages
    { name: 'Adults', categoryModel: 'life_stage', slug: 'adults', description: 'Studies on adult populations' },
    { name: 'Older Adults', categoryModel: 'life_stage', slug: 'older-adults', description: 'Studies on elderly populations' },
    { name: 'Athletes & Fitness', categoryModel: 'life_stage', slug: 'athletes-fitness', description: 'Studies on athletic performance and fitness' }
  ];

  try {
    for (const category of categories) {
      await db.insert(consumerCategories)
        .values(category)
        .onConflictDoNothing();
    }
    console.log('✅ Basic consumer categories created');
  } catch (error) {
    console.error('Error creating consumer categories:', error);
  }
}

/**
 * Run all schema fixes
 */
async function runSchemaFixes() {
  console.log('🔧 Starting schema fixes...');
  
  try {
    await createBasicConsumerCategories();
    console.log('✅ All schema fixes completed');
  } catch (error) {
    console.error('❌ Schema fixes failed:', error);
  }
}

// Run if called directly
runSchemaFixes()
  .then(() => console.log('Schema fixes completed'))
  .catch((error) => {
    console.error('Fatal error:', error);
  });

export { runSchemaFixes, createBasicConsumerCategories };