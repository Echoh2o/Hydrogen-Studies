/**
 * Fixed Image Generator for Visual Content Completion
 * 
 * Generates scientific images using the correct database schema
 * without referencing non-existent columns
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  message?: string;
}

/**
 * Generate and save image for a specific study using correct schema
 */
export async function generateImageForStudyFixed(studyId: number): Promise<ImageGenerationResult> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        success: false,
        message: 'OpenAI API key not available for image generation'
      };
    }

    // Get study data using existing columns only
    const studyResult = await db.execute(sql`
      SELECT id, title, category, abstract, methods_short, results_short, conclusion_short
      FROM studies 
      WHERE id = ${studyId}
      LIMIT 1
    `);

    const study = studyResult.rows[0];
    if (!study) {
      return {
        success: false,
        message: `Study with ID ${studyId} not found`
      };
    }

    // Create content for image generation using available data
    const imageContent = [
      study.title,
      study.abstract || '',
      study.methods_short || '',
      study.results_short || ''
    ].filter(content => content && content.trim() !== '').join(' ').substring(0, 500);

    // Generate scientific image prompt
    const prompt = `Professional scientific illustration depicting hydrogen therapy research in ${study.category}. 
    Study focus: ${study.title}. 
    Style: Clean medical illustration, molecular hydrogen visualization, professional healthcare setting, 
    blue and white color scheme, no text labels, hyper-realistic scientific accuracy.`;

    console.log(`Generating image for study ${studyId}: ${study.title}`);

    // Generate image using OpenAI DALL-E
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt.substring(0, 1000), // DALL-E has prompt limits
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural"
    });

    const imageUrl = response.data?.[0]?.url;
    
    if (!imageUrl) {
      return {
        success: false,
        message: 'No image URL returned from OpenAI'
      };
    }

    // Update the study with the generated image URL
    await db.execute(sql`
      UPDATE studies 
      SET image_url = ${imageUrl}, 
          image_alt = ${`Scientific illustration for ${study.title}`}
      WHERE id = ${studyId}
    `);

    return {
      success: true,
      imageUrl: imageUrl,
      message: 'Image generated and saved successfully'
    };

  } catch (error) {
    console.error(`Error generating image for study ${studyId}:`, error);
    return {
      success: false,
      message: `Error generating image: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Complete visual content generation for all remaining studies
 */
export async function completeAllVisualContent(): Promise<void> {
  try {
    console.log('Starting complete visual content generation...');
    
    let processed = 0;
    let successful = 0;
    let failed = 0;
    
    while (true) {
      // Get next batch of studies without images
      const studiesResult = await db.execute(sql`
        SELECT id, title, category 
        FROM studies 
        WHERE image_url IS NULL OR image_url = ''
        ORDER BY id
        LIMIT 3
      `);

      const studies = studiesResult.rows;
      
      if (studies.length === 0) {
        console.log(`✅ Visual content generation completed! Processed: ${processed}, Successful: ${successful}, Failed: ${failed}`);
        break;
      }

      console.log(`Processing batch of ${studies.length} studies...`);

      // Process each study in the batch
      for (const study of studies) {
        try {
          const result = await generateImageForStudyFixed(study.id);
          
          if (result.success) {
            successful++;
            console.log(`✅ Generated image for study ${study.id}`);
          } else {
            failed++;
            console.log(`❌ Failed to generate image for study ${study.id}: ${result.message}`);
          }
          
          processed++;
          
          // Small delay between requests to respect API limits
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          failed++;
          processed++;
          console.error(`Error processing study ${study.id}:`, error);
        }
      }

      // Progress update
      const remainingResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM studies 
        WHERE image_url IS NULL OR image_url = ''
      `);
      
      const remaining = Number(remainingResult.rows[0]?.count) || 0;
      console.log(`Progress: ${processed} processed, ${remaining} remaining`);
      
      // Delay between batches
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
  } catch (error) {
    console.error('Error in complete visual content generation:', error);
  }
}