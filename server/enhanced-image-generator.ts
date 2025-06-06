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
  // Map complex categories to simple, visual body systems
  const categoryToBodySystem = {
    'Cardiovascular': 'heart and blood vessels',
    'Liver': 'liver and digestive system',
    'Gastrointestinal': 'digestive system and stomach',
    'Respiratory': 'lungs and respiratory system',
    'Neurological': 'brain and nervous system',
    'Kidney': 'kidneys and urinary system',
    'Metabolic': 'metabolism and cellular energy',
    'Cancer Research': 'cellular health and immune system',
    'Dermatology': 'skin and tissue health',
    'Fitness': 'muscles and exercise physiology',
    'Aging': 'healthy aging and cellular renewal',
    'Inflammation': 'immune system and healing'
  };
  
  // Get the simple, visual body system
  const bodySystem = categoryToBodySystem[study.category] || 'human health and wellness';
  
  // Create simple, clear base prompt
  let prompt = `Clean medical illustration of ${bodySystem}, professional healthcare style, blue and white colors, simple and clear`;
  
  // Add hydrogen therapy context based on study content
  if (study.title.toLowerCase().includes('water') || study.title.toLowerCase().includes('drinking')) {
    prompt += ', showing hydrogen-rich water therapy';
  } else if (study.title.toLowerCase().includes('gas') || study.title.toLowerCase().includes('inhalation')) {
    prompt += ', showing hydrogen gas therapy';
  } else {
    prompt += ', showing hydrogen therapy benefits';
  }
  
  // Keep it medical but simple
  prompt += ', medical textbook style, no text or labels';
  
  return prompt;
}

/**
 * Generate SEO-optimized image description for alt tags
 */
async function generateImageDescription(study: any, prompt: string): Promise<string> {
  try {
    // Extract key terms from study
    const healthCondition = study.healthConditions || study.category || 'general health';
    const bodySystem = study.bodySystems || '';
    const studyType = extractStudyType(study.title);
    const therapyType = extractTherapyType(study.title);
    
    // Create SEO-optimized description based on study content
    const baseDescription = `Medical illustration showing ${getBodySystemDescription(healthCondition)} with ${therapyType} for ${healthCondition.toLowerCase()}`;
    
    // Add specific study context if available
    let specificContext = '';
    if (study.abstract) {
      const abstract = study.abstract.toLowerCase();
      if (abstract.includes('randomized') || abstract.includes('clinical trial')) {
        specificContext = ' from clinical trial research';
      } else if (abstract.includes('systematic review') || abstract.includes('meta-analysis')) {
        specificContext = ' from systematic review';
      } else if (abstract.includes('animal') || abstract.includes('rats') || abstract.includes('mice')) {
        specificContext = ' from preclinical study';
      }
    }
    
    const fullDescription = `${baseDescription}${specificContext}`;
    
    // Ensure description is under 160 characters for SEO
    if (fullDescription.length > 160) {
      return `${getBodySystemDescription(healthCondition)} hydrogen therapy illustration for ${healthCondition.toLowerCase()}`;
    }
    
    return fullDescription;
  } catch (error) {
    console.error('Error generating image description:', error);
    // Fallback to specific description
    const condition = study.healthConditions || study.category || 'general health';
    return `Medical illustration of hydrogen therapy benefits for ${condition.toLowerCase()} treatment`;
  }
}

function getBodySystemDescription(category: string): string {
  const categoryMap: Record<string, string> = {
    'Cardiovascular': 'heart and cardiovascular system',
    'Respiratory': 'lungs and respiratory system',
    'Liver': 'liver and hepatic system',
    'Neurological': 'brain and nervous system',
    'Gastrointestinal': 'digestive system',
    'Metabolic': 'metabolic processes',
    'Inflammation': 'immune system and anti-inflammatory effects',
    'Athletic Performance': 'exercise performance and recovery',
    'General Wellness': 'overall health and wellness'
  };
  
  return categoryMap[category] || 'therapeutic effects';
}

function extractStudyType(title: string): string {
  const titleLower = title.toLowerCase();
  if (titleLower.includes('randomized') || titleLower.includes('clinical trial')) {
    return 'clinical trial';
  } else if (titleLower.includes('systematic review') || titleLower.includes('meta-analysis')) {
    return 'systematic review';
  } else if (titleLower.includes('animal') || titleLower.includes('rats') || titleLower.includes('mice')) {
    return 'preclinical study';
  }
  return 'research study';
}

function extractTherapyType(title: string): string {
  const titleLower = title.toLowerCase();
  if (titleLower.includes('water') || titleLower.includes('drinking')) {
    return 'hydrogen-rich water therapy';
  } else if (titleLower.includes('gas') || titleLower.includes('inhalation')) {
    return 'hydrogen gas therapy';
  } else if (titleLower.includes('saline')) {
    return 'hydrogen saline therapy';
  }
  return 'hydrogen therapy';
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
        autoGeneratedImage: true,
        imageUrl: imageUrl,
        imageAlt: imageDescription,
        images: [imageUrl],
        imageCaptions: [imageDescription]
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
    
    // Get studies without images (check imageUrl instead of boolean flag)
    const studiesWithoutImages = await db.select({ id: studies.id })
      .from(studies)
      .where(eq(studies.imageUrl, null as any));
    
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