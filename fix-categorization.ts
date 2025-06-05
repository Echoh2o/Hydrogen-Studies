#!/usr/bin/env tsx

/**
 * Direct script to fix consumer categorization data integrity issue
 * 
 * Problem: All 1,326 studies are marked as "General Wellness" instead of proper JSON categorizations
 * Solution: Run AI-powered categorization to assign proper health conditions, body systems, and life stages
 */

import { db } from './server/db';
import { studies as studiesTable } from './shared/schema';
import { eq, isNull, sql } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Consumer-friendly categories that the AI should use
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

async function categorizeStudy(study: any): Promise<StudyCategorization> {
  const prompt = `
You are a medical research categorization expert. Analyze this hydrogen research study and categorize it into consumer-friendly categories.

Study Title: "${study.title}"
Abstract: "${study.abstract || 'No abstract available'}"

Categorize this study into the following categories. Select ALL relevant options from each category:

HEALTH CONDITIONS (select all that apply):
${HEALTH_CONDITIONS.map((c, i) => `${i + 1}. ${c}`).join('\n')}

BODY SYSTEMS (select all that apply):
${BODY_SYSTEMS.map((c, i) => `${i + 1}. ${c}`).join('\n')}

LIFE STAGES (select all that apply):
${LIFE_STAGES.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Return your response as a JSON object with this exact format:
{
  "condition": ["exact category names here"],
  "bodySystem": ["exact category names here"], 
  "lifeStage": ["exact category names here"]
}

Use the exact category names provided above. Select multiple categories if the study applies to multiple areas.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a medical research categorization expert. Always respond with valid JSON using the exact category names provided.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.1,
    response_format: { type: "json_object" }
  });

  const result = JSON.parse(response.choices[0].message.content!);
  return result;
}

async function updateStudyCategories(studyId: number, categories: StudyCategorization): Promise<void> {
  await db.update(studiesTable)
    .set({
      consumerCategories: JSON.stringify(categories)
    })
    .where(eq(studiesTable.id, studyId));
}

async function main() {
  console.log('🔍 Starting consumer categorization fix...');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found. Please set your OpenAI API key.');
    process.exit(1);
  }

  // Get studies that need categorization (NULL, empty, or "General Wellness")
  const studies = await db.select()
    .from(studiesTable)
    .where(
      sql`consumer_categories IS NULL OR consumer_categories = 'General Wellness' OR consumer_categories = ''`
    )
    .limit(100); // Process more studies in batches

  console.log(`📊 Found ${studies.length} studies to categorize`);

  let processed = 0;
  let errors = 0;

  for (const study of studies) {
    try {
      console.log(`\n🔄 Processing study ${study.id}: "${study.title.substring(0, 80)}..."`);
      
      const categories = await categorizeStudy(study);
      await updateStudyCategories(study.id, categories);
      
      console.log(`✅ Categorized study ${study.id}:`);
      console.log(`   Conditions: ${categories.condition.join(', ')}`);
      console.log(`   Body Systems: ${categories.bodySystem.join(', ')}`);
      console.log(`   Life Stages: ${categories.lifeStage.join(', ')}`);
      
      processed++;
      
      // Add delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Error processing study ${study.id}:`, error);
      errors++;
    }
  }

  console.log(`\n📈 Categorization complete:`);
  console.log(`   ✅ Successfully processed: ${processed}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📊 Total studies remaining: ${studies.length - processed}`);

  if (processed > 0) {
    console.log('\n🎉 Categories have been updated! The homepage should now show proper study counts for each health condition.');
  }
}

main().catch(console.error);