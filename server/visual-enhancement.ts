/**
 * Visual Enhancement Phase 3
 * 
 * Generates AI images for studies that don't have them and improves visual assets
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface VisualEnhancementResult {
  studyId: number;
  title: string;
  success: boolean;
  imageGenerated: boolean;
  imageUrl?: string;
  error?: string;
}

interface VisualEnhancementStats {
  totalProcessed: number;
  successful: number;
  failed: number;
  imagesGenerated: number;
  startTime: Date;
  endTime?: Date;
  results: VisualEnhancementResult[];
}

let currentStats: VisualEnhancementStats = {
  totalProcessed: 0,
  successful: 0,
  failed: 0,
  imagesGenerated: 0,
  startTime: new Date(),
  results: []
};

/**
 * Generate an AI image for a study
 */
async function generateStudyImage(study: any): Promise<{ success: boolean; imageUrl?: string; message?: string }> {
  try {
    // Create a focused prompt for the study image
    const imagePrompt = createImagePrompt(study);
    
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      size: "1024x1024",
      quality: "standard",
      n: 1,
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      return { success: false, message: "No image URL returned from API" };
    }

    return { success: true, imageUrl, message: "Image generated successfully" };

  } catch (error) {
    console.error(`Image generation error for study ${study.id}:`, error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "Unknown image generation error"
    };
  }
}

/**
 * Create an optimized image prompt for a hydrogen study
 */
function createImagePrompt(study: any): string {
  const category = study.category || 'General';
  const healthConditions = study.health_conditions || '';
  const deliveryMethod = study.delivery_method || '';
  
  // Base prompt components
  let basePrompt = "Professional medical illustration, clean and modern style, ";
  
  // Add category-specific elements
  switch (category.toLowerCase()) {
    case 'cardiovascular':
      basePrompt += "heart and cardiovascular system, ";
      break;
    case 'neurological':
      basePrompt += "brain and nervous system, ";
      break;
    case 'respiratory':
      basePrompt += "lungs and respiratory system, ";
      break;
    case 'gastrointestinal':
      basePrompt += "digestive system, ";
      break;
    case 'cancer research':
      basePrompt += "cellular health and protection, ";
      break;
    case 'metabolic':
      basePrompt += "metabolism and cellular energy, ";
      break;
    case 'dermatology':
      basePrompt += "skin health and cellular regeneration, ";
      break;
    default:
      basePrompt += "general health and wellness, ";
  }

  // Add delivery method context
  if (deliveryMethod.toLowerCase().includes('water') || deliveryMethod.toLowerCase().includes('drink')) {
    basePrompt += "hydrogen-rich water glass, ";
  } else if (deliveryMethod.toLowerCase().includes('inhalation') || deliveryMethod.toLowerCase().includes('gas')) {
    basePrompt += "hydrogen gas therapy, ";
  } else {
    basePrompt += "hydrogen therapy, ";
  }

  // Add molecular representation
  basePrompt += "subtle H2 molecular symbols, ";
  
  // Add health improvement visualization
  basePrompt += "showing cellular health improvement, antioxidant effects, ";
  
  // Style specifications
  basePrompt += "soft blue and white color scheme, minimalist design, ";
  basePrompt += "scientific accuracy, no text overlays, ";
  basePrompt += "suitable for medical website, professional lighting, ";
  basePrompt += "high quality, detailed but not complex";

  return basePrompt;
}

/**
 * Process a single study for visual enhancement
 */
async function processStudyVisualEnhancement(study: any): Promise<VisualEnhancementResult> {
  try {
    // Check if study already has an image
    if (study.image_url && study.image_url.trim() !== '') {
      return {
        studyId: study.id,
        title: study.title,
        success: true,
        imageGenerated: false
      };
    }

    // Generate new image
    const imageResult = await generateStudyImage(study);
    
    if (imageResult.success && imageResult.imageUrl) {
      // Update database with new image
      await db.execute(sql`
        UPDATE studies SET image_url = ${imageResult.imageUrl} WHERE id = ${study.id}
      `);

      console.log(`✓ Study ${study.id}: Generated image`);
      currentStats.imagesGenerated++;

      return {
        studyId: study.id,
        title: study.title,
        success: true,
        imageGenerated: true,
        imageUrl: imageResult.imageUrl
      };
    } else {
      console.error(`✗ Study ${study.id}: ${imageResult.message}`);
      return {
        studyId: study.id,
        title: study.title,
        success: false,
        imageGenerated: false,
        error: imageResult.message
      };
    }

  } catch (error) {
    console.error(`✗ Study ${study.id}: ${error}`);
    return {
      studyId: study.id,
      title: study.title,
      success: false,
      imageGenerated: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Generate images for all studies that need them
 */
export async function generateAllStudyImages(): Promise<VisualEnhancementStats> {
  console.log("🎨 Starting visual enhancement for studies...");

  // Reset stats
  currentStats = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    imagesGenerated: 0,
    startTime: new Date(),
    results: []
  };

  try {
    // Get studies that need images
    const studiesResult = await db.execute(sql`
      SELECT id, title, category, health_conditions, delivery_method, image_url
      FROM studies 
      WHERE image_url IS NULL OR image_url = ''
      ORDER BY id
      LIMIT 50
    `);

    const studies = studiesResult.rows;
    console.log(`🖼️ Found ${studies.length} studies needing images`);

    if (studies.length === 0) {
      console.log("✅ All studies already have images!");
      return currentStats;
    }

    // Process in small batches to manage API rate limits
    const batchSize = 2;
    const totalBatches = Math.ceil(studies.length / batchSize);

    for (let i = 0; i < studies.length; i += batchSize) {
      const batchNumber = Math.floor(i / batchSize) + 1;
      const batch = studies.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${batchNumber}/${totalBatches}: ${batch.length} studies`);

      // Process batch sequentially to avoid overwhelming the API
      for (const study of batch) {
        const result = await processStudyVisualEnhancement(study);
        
        currentStats.results.push(result);
        currentStats.totalProcessed++;
        if (result.success) {
          currentStats.successful++;
        } else {
          currentStats.failed++;
        }

        // Delay between studies for API rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log(`✓ Batch ${batchNumber} completed`);

      // Longer delay between batches
      if (i + batchSize < studies.length) {
        console.log("⏳ Waiting 5 seconds before next batch...");
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    currentStats.endTime = new Date();
    const duration = Math.round((currentStats.endTime.getTime() - currentStats.startTime.getTime()) / 1000);

    console.log("\n🎉 Visual enhancement completed!");
    console.log(`📊 Results:`);
    console.log(`   - Total processed: ${currentStats.totalProcessed}`);
    console.log(`   - Successful: ${currentStats.successful}`);
    console.log(`   - Failed: ${currentStats.failed}`);
    console.log(`   - Images generated: ${currentStats.imagesGenerated}`);
    console.log(`   - Duration: ${duration} seconds`);

    return currentStats;

  } catch (error) {
    console.error("❌ Error in visual enhancement:", error);
    currentStats.endTime = new Date();
    throw error;
  }
}

/**
 * Get current visual enhancement statistics
 */
export function getVisualEnhancementStats(): VisualEnhancementStats {
  return currentStats;
}

/**
 * Get statistics on image coverage
 */
export async function getImageCoverage() {
  const result = await db.execute(sql`
    SELECT 
      COUNT(*) as total_studies,
      COUNT(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 END) as with_images
    FROM studies
  `);

  const stats = result.rows[0];
  
  return {
    totalStudies: Number(stats.total_studies),
    withImages: Number(stats.with_images),
    withoutImages: Number(stats.total_studies) - Number(stats.with_images),
    imagePercentage: Math.round((Number(stats.with_images) / Number(stats.total_studies)) * 100)
  };
}