/**
 * Image URL Handler for Study Images
 * 
 * Handles expired OpenAI DALL-E URLs and provides fallback image generation
 */

import { db } from "./db";
import { studies } from "../shared/schema";
import { eq } from "drizzle-orm";

interface ImageValidationResult {
  isValid: boolean;
  needsReplacement: boolean;
  imageUrl?: string;
}

/**
 * Check if an image URL is accessible
 */
export async function validateImageUrl(url: string): Promise<boolean> {
  try {
    // For OpenAI URLs, check if they contain expired tokens
    if (url.includes('oaidalleapi') && url.includes('se=')) {
      const match = url.match(/se=([^&]+)/);
      if (match) {
        const expiryDate = new Date(decodeURIComponent(match[1]));
        if (expiryDate < new Date()) {
          return false; // URL has expired
        }
      }
    }
    
    // For other URLs, attempt a HEAD request (optional - can be resource intensive)
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get valid image URL for a study, handling expired URLs
 */
export async function getValidImageUrl(studyId: number): Promise<ImageValidationResult> {
  try {
    const [study] = await db
      .select({ imageUrl: studies.imageUrl })
      .from(studies)
      .where(eq(studies.id, studyId));

    if (!study?.imageUrl) {
      return { isValid: false, needsReplacement: true };
    }

    const isValid = await validateImageUrl(study.imageUrl);
    
    return {
      isValid,
      needsReplacement: !isValid,
      imageUrl: isValid ? study.imageUrl : undefined
    };
  } catch (error) {
    console.error('Error validating image URL:', error);
    return { isValid: false, needsReplacement: false };
  }
}

/**
 * Generate fallback image for studies with expired URLs
 */
export async function generateFallbackImage(studyId: number): Promise<string | null> {
  try {
    // For now, return null as the image generation function needs to be identified
    // This would typically call an image generation service
    
    // Get study data for image generation
    const [study] = await db
      .select({
        title: studies.title,
        abstract: studies.abstract,
        category: studies.category
      })
      .from(studies)
      .where(eq(studies.id, studyId));

    if (!study) {
      return null;
    }

    // Generate new image
    const imagePrompt = `Scientific illustration representing hydrogen research: ${study.title}. Focus on molecular hydrogen therapy, cellular mechanisms, and health benefits related to ${study.category}.`;
    
    const result = await generateStudyImage(imagePrompt, study.title);
    
    if (result.success && result.imageUrl) {
      // Update study with new image URL
      await db
        .update(studies)
        .set({ 
          imageUrl: result.imageUrl,
          imageAlt: result.imageAlt || `Scientific visualization for ${study.title}`
        })
        .where(eq(studies.id, studyId));
      
      return result.imageUrl;
    }
    
    return null;
  } catch (error) {
    console.error('Error generating fallback image:', error);
    return null;
  }
}

/**
 * Batch process studies with expired image URLs
 */
export async function processExpiredImages(limit: number = 10): Promise<{
  processed: number;
  updated: number;
  failed: number;
}> {
  let processed = 0;
  let updated = 0;
  let failed = 0;

  try {
    // Get studies with OpenAI image URLs
    const studiesWithImages = await db
      .select({ id: studies.id, imageUrl: studies.imageUrl })
      .from(studies)
      .where(eq(studies.imageUrl, studies.imageUrl))
      .limit(limit);

    for (const study of studiesWithImages) {
      if (!study.imageUrl) continue;
      
      processed++;
      
      // Check if image URL is expired
      if (study.imageUrl.includes('oaidalleapi')) {
        const isValid = await validateImageUrl(study.imageUrl);
        
        if (!isValid) {
          console.log(`Regenerating expired image for study ${study.id}`);
          const newImageUrl = await generateFallbackImage(study.id);
          
          if (newImageUrl) {
            updated++;
            console.log(`Updated image for study ${study.id}`);
          } else {
            failed++;
            console.log(`Failed to update image for study ${study.id}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error processing expired images:', error);
  }

  return { processed, updated, failed };
}