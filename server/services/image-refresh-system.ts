/**
 * Image Refresh System
 *
 * Handles expired OpenAI DALL-E image URLs by regenerating them when needed
 */

import { sql } from "drizzle-orm";
import { db } from "./minimal-performance-core";

interface ImageRefreshResult {
  studyId: number;
  success: boolean;
  newImageUrl?: string;
  error?: string;
}

/**
 * Check if an OpenAI DALL-E URL has expired
 */
export function isOpenAIImageExpired(imageUrl: string): boolean {
  if (!imageUrl?.includes("oaidalleapiprodscus.blob.core.windows.net")) {
    return false; // Not an OpenAI image
  }

  try {
    const url = new URL(imageUrl);
    const seParam = url.searchParams.get("se"); // Expiration time

    if (!seParam) {
      return false;
    }

    const expirationTime = new Date(seParam);
    const now = new Date();

    return now > expirationTime;
  } catch (error) {
    console.error("Error checking image expiration:", error);
    return true; // Assume expired if we can't parse
  }
}

/**
 * Generate a new study image using OpenAI DALL-E
 */
async function generateNewStudyImage(study: any): Promise<string> {
  // Check for OpenAI API key
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.warn("OpenAI API key not available for image generation");
    return "";
  }

  try {
    const prompt = `Scientific illustration showing hydrogen therapy mechanisms for ${study.title}. Show molecular hydrogen (H2) interacting with cells, reducing oxidative stress, and providing therapeutic benefits. Medical research style, clean background, professional appearance.`;

    const response = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: prompt.substring(0, 1000), // DALL-E has prompt length limits
          n: 1,
          size: "1024x1024",
          quality: "standard",
          style: "natural",
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.data && data.data[0] && data.data[0].url) {
      return data.data[0].url;
    } else {
      throw new Error("No image URL in OpenAI response");
    }
  } catch (error) {
    console.error("Error generating new study image:", error);
    return "";
  }
}

/**
 * Refresh expired image for a single study
 */
export async function refreshStudyImage(
  studyId: number,
): Promise<ImageRefreshResult> {
  try {
    // Get current study data
    const result = await db.execute(sql`
      SELECT id, title, image_url, imageUrl FROM studies WHERE id = ${studyId}
    `);

    const study = (result as any).rows[0];
    if (!study) {
      return {
        studyId,
        success: false,
        error: "Study not found",
      };
    }

    const currentImageUrl = study.image_url || study.imageUrl;

    if (!currentImageUrl || !isOpenAIImageExpired(currentImageUrl)) {
      return {
        studyId,
        success: true,
        newImageUrl: currentImageUrl,
      };
    }

    // Generate new image
    const newImageUrl = await generateNewStudyImage(study);

    if (!newImageUrl) {
      return {
        studyId,
        success: false,
        error: "Failed to generate new image",
      };
    }

    // Update database with new image URL
    await db.execute(sql`
      UPDATE studies 
      SET image_url = ${newImageUrl}, 
          auto_generated_image = true,
          updated_at = NOW()
      WHERE id = ${studyId}
    `);

    return {
      studyId,
      success: true,
      newImageUrl,
    };
  } catch (error) {
    console.error(`Error refreshing image for study ${studyId}:`, error);
    return {
      studyId,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Find and refresh all expired images
 */
export async function refreshAllExpiredImages(): Promise<ImageRefreshResult[]> {
  try {
    // Get all studies with OpenAI image URLs
    const result = await db.execute(sql`
      SELECT id, title, image_url, imageUrl 
      FROM studies 
      WHERE (image_url IS NOT NULL OR imageUrl IS NOT NULL)
      AND (image_url LIKE '%oaidalleapiprodscus.blob.core.windows.net%' 
           OR imageUrl LIKE '%oaidalleapiprodscus.blob.core.windows.net%')
      LIMIT 100
    `);

    const studies = (result as any).rows || [];
    const results: ImageRefreshResult[] = [];

    console.log(`Found ${studies.length} studies with OpenAI images to check`);

    for (const study of studies) {
      const imageUrl = study.image_url || study.imageUrl;

      if (isOpenAIImageExpired(imageUrl)) {
        console.log(
          `Refreshing expired image for study ${study.id}: ${study.title}`,
        );
        const refreshResult = await refreshStudyImage(study.id);
        results.push(refreshResult);

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  } catch (error) {
    console.error("Error refreshing expired images:", error);
    return [];
  }
}

/**
 * Get image refresh statistics
 */
export async function getImageRefreshStats(): Promise<{
  totalImages: number;
  openaiImages: number;
  expiredImages: number;
  needsRefresh: number;
}> {
  try {
    const totalResult = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM studies 
      WHERE image_url IS NOT NULL OR imageUrl IS NOT NULL
    `);

    const openaiResult = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM studies 
      WHERE (image_url LIKE '%oaidalleapiprodscus.blob.core.windows.net%' 
             OR imageUrl LIKE '%oaidalleapiprodscus.blob.core.windows.net%')
    `);

    // Get OpenAI images to check expiration
    const imagesResult = await db.execute(sql`
      SELECT image_url, imageUrl 
      FROM studies 
      WHERE (image_url LIKE '%oaidalleapiprodscus.blob.core.windows.net%' 
             OR imageUrl LIKE '%oaidalleapiprodscus.blob.core.windows.net%')
    `);

    const images = (imagesResult as any).rows || [];
    let expiredCount = 0;

    for (const row of images) {
      const imageUrl = row.image_url || row.imageUrl;
      if (isOpenAIImageExpired(imageUrl)) {
        expiredCount++;
      }
    }

    return {
      totalImages: parseInt((totalResult as any).rows[0]?.count || "0"),
      openaiImages: parseInt((openaiResult as any).rows[0]?.count || "0"),
      expiredImages: expiredCount,
      needsRefresh: expiredCount,
    };
  } catch (error) {
    console.error("Error getting image refresh stats:", error);
    return {
      totalImages: 0,
      openaiImages: 0,
      expiredImages: 0,
      needsRefresh: 0,
    };
  }
}
