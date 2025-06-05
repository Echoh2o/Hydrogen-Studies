#!/usr/bin/env tsx

/**
 * Batch categorization script to efficiently categorize all uncategorized studies
 */

import { db } from './server/db';
import { studies as studiesTable } from './shared/schema';
import { sql } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const HEALTH_CONDITIONS = [
  "Heart Disease & Hypertension",
  "Brain & Neurological Disorders", 
  "Diabetes & Metabolic Health",
  "Arthritis & Inflammation",
  "Lung & Respiratory Conditions",
  "Digestive Health (Gut/Liver)",
  "Cancer Supportive Care"
];

const BODY_SYSTEMS = [
  "Cardiovascular System",
  "Nervous System",
  "Respiratory System", 
  "Digestive System",
  "Immune System",
  "Musculoskeletal System",
  "Renal System",
  "Integumentary System"
];

const LIFE_STAGES = [
  "Infants & Newborns",
  "Children & Adolescents", 
  "Adults",
  "Older Adults",
  "Athletes & Fitness"
];

interface StudyCategorization {
  condition: string[];
  bodySystem: string[];
  lifeStage: string[];
}

async function categorizeStudyBatch(studies: any[]): Promise<StudyCategorization[]> {
  const batchPrompt = `
You are a medical research categorization expert. Analyze these hydrogen research studies and categorize each into consumer-friendly categories.

STUDIES TO CATEGORIZE:
${studies.map((study, i) => `
STUDY ${i + 1}:
Title: "${study.title}"
Abstract: "${study.abstract?.substring(0, 500) || 'No abstract available'}"
`).join('\n')}

For each study, categorize into these categories:

HEALTH CONDITIONS: ${HEALTH_CONDITIONS.join(', ')}
BODY SYSTEMS: ${BODY_SYSTEMS.join(', ')}
LIFE STAGES: ${LIFE_STAGES.join(', ')}

Return a JSON array with one object per study in this exact format:
[
  {
    "condition": ["exact category names"],
    "bodySystem": ["exact category names"], 
    "lifeStage": ["exact category names"]
  }
]

Use exact category names. Select multiple if applicable.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a medical research categorization expert. Always respond with valid JSON arrays using exact category names.'
      },
      {
        role: 'user',
        content: batchPrompt
      }
    ],
    temperature: 0.1,
    response_format: { type: "json_object" }
  });

  const result = JSON.parse(response.choices[0].message.content!);
  return result.studies || result;
}

async function main() {
  console.log('Starting batch categorization...');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not found. Please set your OpenAI API key.');
    process.exit(1);
  }

  // Get total count of uncategorized studies
  const totalResult = await db.execute(
    sql`SELECT COUNT(*) as count FROM studies WHERE consumer_categories IS NULL OR consumer_categories = 'General Wellness' OR consumer_categories = ''`
  );
  const totalUncategorized = Number(totalResult.rows[0].count);
  
  console.log(`Total uncategorized studies: ${totalUncategorized}`);

  let processed = 0;
  let errors = 0;
  const batchSize = 20; // Process 20 studies at a time

  while (processed < totalUncategorized) {
    try {
      // Get next batch of uncategorized studies
      const studies = await db.select()
        .from(studiesTable)
        .where(
          sql`consumer_categories IS NULL OR consumer_categories = 'General Wellness' OR consumer_categories = ''`
        )
        .limit(batchSize);

      if (studies.length === 0) break;

      console.log(`Processing batch: ${processed + 1} to ${processed + studies.length} of ${totalUncategorized}`);
      
      // Categorize the batch
      const categories = await categorizeStudyBatch(studies);
      
      // Update each study with its categorization
      for (let i = 0; i < studies.length && i < categories.length; i++) {
        const study = studies[i];
        const category = categories[i];
        
        await db.update(studiesTable)
          .set({
            consumerCategories: JSON.stringify(category)
          })
          .where(sql`id = ${study.id}`);
          
        console.log(`✅ Study ${study.id}: ${category.condition.join(', ')}`);
      }
      
      processed += studies.length;
      
      // Add delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`Error processing batch:`, error);
      errors++;
      
      if (errors > 5) {
        console.error('Too many errors, stopping...');
        break;
      }
      
      // Wait longer on error
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log(`\nCategorization complete:`);
  console.log(`Successfully processed: ${processed}`);
  console.log(`Errors: ${errors}`);
}

main().catch(console.error);