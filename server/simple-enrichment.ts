/**
 * Simple Database Enrichment
 * Works with your existing database structure to enhance all 1,326 hydrogen studies
 */

import { pool } from './db';
import OpenAI from 'openai';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function enrichAllStudies() {
  console.log('🚀 Starting enrichment of all hydrogen studies...');
  
  try {
    // Get all studies from the database using raw SQL
    const result = await pool.query('SELECT id, title, abstract, category, keywords, health_conditions, body_systems, consumer_categories FROM studies ORDER BY id');
    const allStudies = result.rows;
    
    console.log(`📊 Found ${allStudies.length} hydrogen studies to enrich`);

    let processed = 0;
    let enriched = 0;
    let failed = 0;

    // Process studies in batches of 10
    const batchSize = 10;
    
    for (let i = 0; i < allStudies.length; i += batchSize) {
      const batch = allStudies.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allStudies.length / batchSize)}`);

      for (const study of batch) {
        try {
          console.log(`Processing study ${study.id}: ${study.title.substring(0, 50)}...`);
          
          const updates = [];
          const values = [];
          let updateIndex = 1;
          let hasUpdates = false;

          // Generate keywords if missing
          if (!study.keywords || study.keywords.length === 0) {
            const keywords = await generateKeywords(study);
            if (keywords && keywords.length > 0) {
              updates.push(`keywords = $${updateIndex++}`);
              values.push(keywords);
              hasUpdates = true;
              console.log(`  ✅ Generated ${keywords.length} keywords`);
            }
          }

          // Generate health conditions if missing
          if (!study.health_conditions || study.health_conditions.trim() === '') {
            const healthConditions = await generateHealthConditions(study);
            if (healthConditions) {
              updates.push(`health_conditions = $${updateIndex++}`);
              values.push(healthConditions);
              hasUpdates = true;
              console.log(`  ✅ Generated health conditions: ${healthConditions}`);
            }
          }

          // Generate body systems if missing
          if (!study.body_systems || study.body_systems.trim() === '') {
            const bodySystems = await generateBodySystems(study);
            if (bodySystems) {
              updates.push(`body_systems = $${updateIndex++}`);
              values.push(bodySystems);
              hasUpdates = true;
              console.log(`  ✅ Generated body systems: ${bodySystems}`);
            }
          }

          // Generate consumer categories if missing
          if (!study.consumer_categories || study.consumer_categories.trim() === '') {
            const consumerCategories = await generateConsumerCategories(study);
            if (consumerCategories) {
              updates.push(`consumer_categories = $${updateIndex++}`);
              values.push(consumerCategories);
              hasUpdates = true;
              console.log(`  ✅ Generated consumer category: ${consumerCategories}`);
            }
          }

          // Update the study if we have improvements
          if (hasUpdates) {
            values.push(study.id);
            const query = `UPDATE studies SET ${updates.join(', ')} WHERE id = $${updateIndex}`;
            await pool.query(query, values);
            enriched++;
            console.log(`  🎉 Successfully enriched study ${study.id}`);
          } else {
            console.log(`  ⏭️  Study ${study.id} already has all fields`);
          }

        } catch (error) {
          failed++;
          console.error(`  ❌ Failed to enrich study ${study.id}:`, error);
        }
        
        processed++;
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log(`📈 Progress: ${processed}/${allStudies.length} processed, ${enriched} enriched, ${failed} failed`);
    }

    console.log('🎉 Enrichment completed!');
    console.log(`📊 Final results: ${enriched} studies enriched, ${failed} failed out of ${allStudies.length} total`);

  } catch (error) {
    console.error('❌ Error during enrichment:', error);
  }
}

async function generateKeywords(study: any): Promise<string[] | null> {
  try {
    const prompt = `Based on this hydrogen research study, generate 5-8 relevant keywords that would help people find this research. Focus on medical conditions, treatment methods, and key findings.

Study Title: ${study.title}
Abstract: ${study.abstract || 'No abstract available'}
Category: ${study.category || 'Not specified'}

Return only a JSON object with a keywords array, like: {"keywords": ["keyword1", "keyword2", "keyword3"]}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 200
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result.keywords || null;
  } catch (error) {
    console.error('Error generating keywords:', error);
    return null;
  }
}

async function generateHealthConditions(study: any): Promise<string | null> {
  try {
    const prompt = `Based on this hydrogen research study, identify the main health condition(s) being studied. Be specific and use medical terminology.

Study Title: ${study.title}
Abstract: ${study.abstract || 'No abstract available'}

Return only the health condition name(s), separated by commas if multiple. Examples: "Cardiovascular disease", "Type 2 diabetes", "Exercise-induced oxidative stress"`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 100
    });

    return response.choices[0].message.content?.trim() || null;
  } catch (error) {
    console.error('Error generating health conditions:', error);
    return null;
  }
}

async function generateBodySystems(study: any): Promise<string | null> {
  try {
    const prompt = `Based on this hydrogen research study, identify which body system(s) are being studied. Choose from: Cardiovascular, Respiratory, Nervous, Digestive, Musculoskeletal, Immune, Endocrine, Reproductive, Urinary, Integumentary.

Study Title: ${study.title}
Abstract: ${study.abstract || 'No abstract available'}

Return only the body system name(s), separated by commas if multiple.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 50
    });

    return response.choices[0].message.content?.trim() || null;
  } catch (error) {
    console.error('Error generating body systems:', error);
    return null;
  }
}

async function generateConsumerCategories(study: any): Promise<string | null> {
  try {
    const prompt = `Based on this hydrogen research study, choose the most appropriate consumer-friendly category from: Sports & Fitness, Heart Health, Brain Health, Skin Health, Anti-Aging, Energy & Metabolism, Pain Relief, General Wellness.

Study Title: ${study.title}
Abstract: ${study.abstract || 'No abstract available'}

Return only one category name that best fits this research.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 20
    });

    return response.choices[0].message.content?.trim() || null;
  } catch (error) {
    console.error('Error generating consumer categories:', error);
    return null;
  }
}

// Run the enrichment
enrichAllStudies();