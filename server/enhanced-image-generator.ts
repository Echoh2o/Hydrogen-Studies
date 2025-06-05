/**
 * Enhanced Image Generator for Hydrogen Studies
 * 
 * Uses DALL-E 3 with improved prompting strategy based on:
 * - Specific health conditions from study data
 * - Related body systems
 * - Consistent scientific style
 */

import OpenAI from "openai";
import { db } from './db';
import { studies } from '../shared/schema';
import { eq } from 'drizzle-orm';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  imageDescription?: string;
  error?: string;
  studyId: number;
  prompt: string;
}

/**
 * Generate a contextual prompt based on study data
 */
function generateStudyPrompt(study: any): string {
  const healthCondition = study.healthConditions || study.category || 'general health';
  const bodySystem = study.bodySystems || 'human body';
  
  // Clean up condition and system names for better prompts
  const cleanCondition = healthCondition.replace(/[^a-zA-Z\s]/g, '').trim();
  const cleanBodySystem = bodySystem.replace(/[^a-zA-Z\s]/g, '').trim();
  
  // Base prompt with your improved structure
  let prompt = `Professional medical illustration showing ${cleanCondition} and related ${cleanBodySystem}, clean scientific minimalist style, medical journal quality, blue and white color scheme, no text overlays`;
  
  // Add specific context based on study content
  if (study.title.toLowerCase().includes('hydrogen water')) {
    prompt += ', molecular hydrogen therapy concept';
  } else if (study.title.toLowerCase().includes('gas') || study.title.toLowerCase().includes('inhalation')) {
    prompt += ', therapeutic gas delivery concept';
  } else if (study.vehicle && study.vehicle.toLowerCase().includes('water')) {
    prompt += ', hydrogen-enriched water treatment';
  }
  
  // Ensure medical accuracy
  prompt += ', anatomically accurate, professional medical illustration';
  
  return prompt;
}

/**
 * Generate SEO-optimized image description for alt tags
 */
async function generateImageDescription(study: any, prompt: string): Promise<string> {
  try {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an SEO expert creating alt text descriptions for medical research images. Create concise, descriptive alt text that includes relevant keywords while being natural and informative."
        },
        {
          role: "user",
          content: `Create SEO-optimized alt text for a medical illustration based on this research study:

Title: ${study.title}
Health Condition: ${study.healthConditions || study.category}
Body System: ${study.bodySystems || 'general'}
Abstract: ${study.abstract?.substring(0, 200)}...

Image prompt used: ${prompt}

Create alt text that:
1. Describes what the image shows
2. Includes key medical terms from the study
3. Is 150 characters or less
4. Is natural and readable
5. Helps with SEO for hydrogen research

Return only the alt text, no quotes or extra text.`
        }
      ],
      max_tokens: 100
    });

    return response.choices[0].message.content?.trim() || `Medical illustration for ${study.healthConditions || study.category} hydrogen research study`;
  } catch (error) {
    console.error('Error generating image description:', error);
    // Fallback description
    return `Medical illustration for ${study.healthConditions || study.category} hydrogen research study`;
  }
}

/**
 * Generate image for a single study using DALL-E 3
 */
export async function generateStudyImage(studyId: number): Promise<ImageGenerationResult> {
  try {
    console.log(`Generating image for study ${studyId}...`);
    
    // Get study data
    const studyResults = await db.select().from(studies).where(eq(studies.id, studyId)).limit(1);
    
    if (studyResults.length === 0) {
      return {
        success: false,
        error: 'Study not found',
        studyId,
        prompt: ''
      };
    }
    
    const study = studyResults[0];
    const prompt = generateStudyPrompt(study);
    
    console.log(`Generated prompt: ${prompt}`);
    
    // Generate image with DALL-E 3
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural"
    });
    
    const imageUrl = response.data?.[0]?.url;
    
    if (!imageUrl) {
      return {
        success: false,
        error: 'No image URL returned from DALL-E',
        studyId,
        prompt
      };
    }
    
    // Generate SEO-optimized description
    console.log('Generating SEO-optimized description...');
    const imageDescription = await generateImageDescription(study, prompt);
    
    // Update study with new image and description
    await db.update(studies)
      .set({ 
        autoGeneratedImage: imageUrl,
        images: JSON.stringify([imageUrl]),
        imageCaptions: JSON.stringify([imageDescription])
      })
      .where(eq(studies.id, studyId));
    
    console.log(`✓ Successfully generated image for study ${studyId}`);
    
    return {
      success: true,
      imageUrl,
      imageDescription,
      studyId,
      prompt
    };
    
  } catch (error) {
    console.error(`✗ Failed to generate image for study ${studyId}:`, error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      studyId,
      prompt: ''
    };
  }
}

/**
 * Generate images for multiple studies with rate limiting
 */
export async function generateImagesForStudies(studyIds: number[], batchSize: number = 5): Promise<ImageGenerationResult[]> {
  const results: ImageGenerationResult[] = [];
  
  console.log(`Starting image generation for ${studyIds.length} studies...`);
  
  // Process in batches to respect rate limits
  for (let i = 0; i < studyIds.length; i += batchSize) {
    const batch = studyIds.slice(i, i + batchSize);
    
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(studyIds.length / batchSize)}`);
    
    // Generate images for current batch
    const batchPromises = batch.map(studyId => generateStudyImage(studyId));
    const batchResults = await Promise.all(batchPromises);
    
    results.push(...batchResults);
    
    // Rate limiting delay between batches (DALL-E 3 has rate limits)
    if (i + batchSize < studyIds.length) {
      console.log('Waiting 10 seconds before next batch...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`Image generation complete: ${successful} successful, ${failed} failed`);
  
  return results;
}

/**
 * Generate images for all studies that don't have them
 */
export async function generateImagesForAllStudies(): Promise<void> {
  try {
    console.log('Finding studies without images...');
    
    // Get studies without images
    const studiesWithoutImages = await db.select({ id: studies.id })
      .from(studies)
      .where(eq(studies.autoGeneratedImage, null as any));
    
    const studyIds = studiesWithoutImages.map(s => s.id);
    
    if (studyIds.length === 0) {
      console.log('All studies already have images');
      return;
    }
    
    console.log(`Found ${studyIds.length} studies needing images`);
    
    // Generate images in batches
    await generateImagesForStudies(studyIds, 3); // Smaller batches for DALL-E 3
    
  } catch (error) {
    console.error('Error in batch image generation:', error);
    throw error;
  }
}

/**
 * Test image generation with a single study
 */
export async function testImageGeneration(studyId?: number): Promise<ImageGenerationResult> {
  try {
    // Use provided ID or find a study with good data
    let targetStudyId = studyId;
    
    if (!targetStudyId) {
      const testStudies = await db.select({ id: studies.id })
        .from(studies)
        .where(eq(studies.autoGeneratedImage, null as any))
        .limit(1);
      
      if (testStudies.length === 0) {
        throw new Error('No studies available for testing');
      }
      
      targetStudyId = testStudies[0].id;
    }
    
    console.log(`Testing image generation with study ${targetStudyId}`);
    
    const result = await generateStudyImage(targetStudyId);
    
    if (result.success) {
      console.log(`Test successful! Image URL: ${result.imageUrl}`);
      console.log(`Prompt used: ${result.prompt}`);
    } else {
      console.log(`Test failed: ${result.error}`);
    }
    
    return result;
    
  } catch (error) {
    console.error('Test image generation failed:', error);
    throw error;
  }
}