/**
 * Replace Placeholder Images with Custom Generated Images
 * 
 * Identifies studies with placeholder/default images and generates proper custom images
 */

import { db } from "./db";
import { studies } from "../shared/schema";
import { isNull, or, like, eq } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface PlaceholderStudy {
  id: number;
  title: string;
  abstract: string | null;
  imageUrl: string | null;
}

/**
 * Find all studies with placeholder or missing images
 */
async function findPlaceholderStudies(): Promise<PlaceholderStudy[]> {
  console.log("Finding studies with placeholder images...");
  
  const placeholderStudies = await db
    .select({
      id: studies.id,
      title: studies.title,
      abstract: studies.abstract,
      imageUrl: studies.imageUrl
    })
    .from(studies)
    .where(
      or(
        isNull(studies.imageUrl),
        like(studies.imageUrl, '%placeholder%'),
        like(studies.imageUrl, '%default%'),
        like(studies.imageUrl, '%generic%'),
        eq(studies.imageUrl, '')
      )
    );
    
  console.log(`Found ${placeholderStudies.length} studies needing custom images`);
  return placeholderStudies;
}

/**
 * Generate a custom image for a study
 */
async function generateCustomImage(study: PlaceholderStudy): Promise<string | null> {
  try {
    // Create a descriptive prompt based on the study
    const prompt = `Create a professional, scientific illustration representing hydrogen research study: "${study.title}". 
    ${study.abstract ? `Study focus: ${study.abstract.substring(0, 200)}...` : ''}
    Style: Clean, modern, scientific, medical illustration with molecular hydrogen themes. 
    No text overlays. Professional medical research aesthetic.`;

    console.log(`Generating image for study ${study.id}: ${study.title.substring(0, 50)}...`);

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    if (response.data && response.data[0] && response.data[0].url) {
      return response.data[0].url;
    }
    
    return null;
  } catch (error: any) {
    console.error(`Failed to generate image for study ${study.id}:`, error.message);
    return null;
  }
}

/**
 * Update study with new image URL
 */
async function updateStudyImage(studyId: number, imageUrl: string): Promise<void> {
  await db
    .update(studies)
    .set({ imageUrl })
    .where(eq(studies.id, studyId));
}

/**
 * Process studies in batches to avoid rate limits
 */
async function processBatch(batch: PlaceholderStudy[], batchNumber: number): Promise<void> {
  console.log(`\nProcessing batch ${batchNumber} (${batch.length} studies)...`);
  
  for (let i = 0; i < batch.length; i++) {
    const study = batch[i];
    
    try {
      const imageUrl = await generateCustomImage(study);
      
      if (imageUrl) {
        await updateStudyImage(study.id, imageUrl);
        console.log(`✓ Updated study ${study.id} with custom image`);
      } else {
        console.log(`✗ Failed to generate image for study ${study.id}`);
      }
      
      // Add delay between requests to respect rate limits
      if (i < batch.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
      
    } catch (error: any) {
      console.error(`Error processing study ${study.id}:`, error.message);
    }
  }
}

/**
 * Main function to replace all placeholder images
 */
export async function replacePlaceholderImages(): Promise<void> {
  try {
    console.log("Starting placeholder image replacement process...");
    
    const placeholderStudies = await findPlaceholderStudies();
    
    if (placeholderStudies.length === 0) {
      console.log("No placeholder images found - all studies have custom images!");
      return;
    }
    
    console.log(`\nProcessing ${placeholderStudies.length} studies with placeholder images...`);
    
    // Process in small batches to manage API rate limits
    const batchSize = 5;
    const batches: PlaceholderStudy[][] = [];
    
    for (let i = 0; i < placeholderStudies.length; i += batchSize) {
      batches.push(placeholderStudies.slice(i, i + batchSize));
    }
    
    console.log(`Will process ${batches.length} batches of ${batchSize} studies each`);
    
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < batches.length; i++) {
      await processBatch(batches[i], i + 1);
      
      // Count results
      successCount += batches[i].length; // Simplified for now
      
      // Add delay between batches
      if (i < batches.length - 1) {
        console.log("Waiting between batches...");
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay between batches
      }
    }
    
    console.log(`\n✅ Placeholder replacement complete!`);
    console.log(`Processed: ${placeholderStudies.length} studies`);
    
    // Verify final status
    const remainingPlaceholders = await findPlaceholderStudies();
    console.log(`Remaining placeholders: ${remainingPlaceholders.length}`);
    
  } catch (error: any) {
    console.error("Error in placeholder replacement process:", error.message);
    throw error;
  }
}

// Run the replacement process
replacePlaceholderImages()
  .then(() => {
    console.log("Process completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Process failed:", error);
    process.exit(1);
  });