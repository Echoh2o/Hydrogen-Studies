/**
 * SEO Title Generator for Study Pages
 * 
 * Generates plain language, SEO-optimized titles that summarize study content
 * for better search engine visibility and user comprehension
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface PlainLanguageTitleResult {
  studyId: number;
  originalTitle: string;
  plainLanguageTitle: string;
  success: boolean;
  error?: string;
}

/**
 * Generate a plain language SEO title for a study
 */
async function generatePlainLanguageTitle(study: any): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert at creating SEO-optimized, plain language titles for scientific studies. Your goal is to make hydrogen research accessible to consumers while maintaining accuracy.

Guidelines:
- Create titles that are 40-70 characters for optimal SEO
- Use simple, everyday language (6th grade reading level)
- Focus on the health benefit or outcome
- Include "hydrogen" if relevant
- Make it compelling and clickable
- Avoid jargon, complex terms, or abbreviations
- Structure: [Health Benefit/Outcome] + [Method/Context] + "Study"

Examples:
- "Hydrogen Water Reduces Inflammation in Athletes - Japanese Study"
- "Drinking Hydrogen Water Improves Heart Health - Clinical Trial"
- "Hydrogen Gas Therapy Helps Brain Recovery After Stroke"
- "Hydrogen-Rich Water Fights Aging in Skin Cells - Research"`
        },
        {
          role: "user",
          content: `Create a plain language SEO title for this study:

Title: ${study.title}
Abstract: ${study.abstract?.substring(0, 500)}
Category: ${study.category}
Health Conditions: ${study.health_conditions || 'Not specified'}
Body Systems: ${study.body_systems || 'Not specified'}

Return only the plain language title, nothing else.`
        }
      ],
      max_tokens: 100,
      temperature: 0.3,
    });

    const plainTitle = response.choices[0].message.content?.trim();
    
    if (!plainTitle) {
      throw new Error("No title generated");
    }

    // Ensure title is within SEO limits (40-70 characters)
    if (plainTitle.length > 70) {
      return plainTitle.substring(0, 67) + "...";
    }

    return plainTitle;

  } catch (error) {
    console.error("Error generating plain language title:", error);
    
    // Fallback: Create a simple descriptive title
    const category = study.category || "Health";
    const healthCondition = study.health_conditions?.split(',')[0]?.trim() || category;
    return `Hydrogen Study on ${healthCondition} - Research Findings`;
  }
}

/**
 * Process a single study to add plain language title
 */
async function processStudyTitle(study: any): Promise<PlainLanguageTitleResult> {
  try {
    const plainLanguageTitle = await generatePlainLanguageTitle(study);

    // Update the database
    await db.execute(sql`
      UPDATE studies 
      SET plain_language_title = ${plainLanguageTitle}
      WHERE id = ${study.id}
    `);

    return {
      studyId: study.id,
      originalTitle: study.title,
      plainLanguageTitle,
      success: true
    };

  } catch (error) {
    console.error(`Error processing study ${study.id}:`, error);
    return {
      studyId: study.id,
      originalTitle: study.title,
      plainLanguageTitle: "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Generate plain language titles for all studies that don't have them
 */
export async function generateAllPlainLanguageTitles(): Promise<{
  totalProcessed: number;
  successful: number;
  failed: number;
  results: PlainLanguageTitleResult[];
}> {
  console.log("Starting plain language title generation...");

  // Get studies without plain language titles
  const studiesResult = await db.execute(sql`
    SELECT id, title, abstract, category, health_conditions, body_systems
    FROM studies 
    WHERE plain_language_title IS NULL 
    OR plain_language_title = ''
    ORDER BY id
    LIMIT 50
  `);

  const studies = studiesResult.rows;
  console.log(`Found ${studies.length} studies needing plain language titles`);

  const results: PlainLanguageTitleResult[] = [];
  let successful = 0;
  let failed = 0;

  // Process in small batches to avoid API rate limits
  for (let i = 0; i < studies.length; i += 5) {
    const batch = studies.slice(i, i + 5);
    
    const batchPromises = batch.map(study => processStudyTitle(study));
    const batchResults = await Promise.all(batchPromises);
    
    batchResults.forEach(result => {
      results.push(result);
      if (result.success) {
        successful++;
        console.log(`✓ Study ${result.studyId}: "${result.plainLanguageTitle}"`);
      } else {
        failed++;
        console.log(`✗ Study ${result.studyId}: ${result.error}`);
      }
    });

    // Small delay between batches
    if (i + 5 < studies.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\nTitle generation complete:`);
  console.log(`- Processed: ${studies.length}`);
  console.log(`- Successful: ${successful}`);
  console.log(`- Failed: ${failed}`);

  return {
    totalProcessed: studies.length,
    successful,
    failed,
    results
  };
}

/**
 * Get statistics on plain language title coverage
 */
export async function getPlainLanguageTitleStats() {
  const result = await db.execute(sql`
    SELECT 
      COUNT(*) as total_studies,
      COUNT(CASE WHEN plain_language_title IS NOT NULL AND plain_language_title != '' THEN 1 END) as with_plain_titles,
      COUNT(CASE WHEN plain_language_title IS NULL OR plain_language_title = '' THEN 1 END) as without_plain_titles
    FROM studies
  `);

  const stats = result.rows[0];
  const completionPercentage = Math.round((Number(stats.with_plain_titles) / Number(stats.total_studies)) * 100);

  return {
    totalStudies: Number(stats.total_studies),
    withPlainTitles: Number(stats.with_plain_titles),
    withoutPlainTitles: Number(stats.without_plain_titles),
    completionPercentage
  };
}

// If running directly, start the generation process
if (require.main === module) {
  generateAllPlainLanguageTitles()
    .then(results => {
      console.log("\nFinal Results:", results);
      process.exit(0);
    })
    .catch(error => {
      console.error("Error:", error);
      process.exit(1);
    });
}