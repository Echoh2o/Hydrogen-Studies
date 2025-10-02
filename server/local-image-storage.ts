/**
 * Local Image Storage System
 *
 * Downloads and stores OpenAI DALL-E images locally to prevent expiration
 */

import { sql } from "drizzle-orm";
import { db } from "./db";
import fs from "fs/promises";
import path from "path";

interface ImageDownloadResult {
  studyId: number;
  success: boolean;
  localPath?: string;
  error?: string;
}

/**
 * Ensure uploads directory exists
 */
async function ensureUploadsDirectory(): Promise<void> {
  const uploadsDir = path.join(process.cwd(), "uploads");
  const imagesDir = path.join(uploadsDir, "study-images");

  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.mkdir(imagesDir, { recursive: true });
  } catch (error) {
    console.error("Error creating uploads directory:", error);
  }
}

/**
 * Download image from URL and save locally
 */
async function downloadAndSaveImage(
  imageUrl: string,
  studyId: number,
): Promise<string> {
  await ensureUploadsDirectory();

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const filename = `study-${studyId}-${Date.now()}.png`;
  const localPath = path.join(
    process.cwd(),
    "uploads",
    "study-images",
    filename,
  );

  await fs.writeFile(localPath, Buffer.from(buffer));

  // Return the web-accessible path
  return `/uploads/study-images/${filename}`;
}

/**
 * Download and store a single study's image locally
 */
export async function downloadStudyImage(
  studyId: number,
): Promise<ImageDownloadResult> {
  try {
    // Get current study data
    const result = await db.execute(sql`
      SELECT id, title, image_url FROM studies WHERE id = ${studyId}
    `);

    const study = (result as any).rows[0];
    if (!study) {
      return {
        studyId,
        success: false,
        error: "Study not found",
      };
    }

    const currentImageUrl = study.image_url;

    if (!currentImageUrl) {
      return {
        studyId,
        success: false,
        error: "No image URL found",
      };
    }

    // Check if it's already a local path
    if (currentImageUrl.startsWith("/uploads/")) {
      return {
        studyId,
        success: true,
        localPath: currentImageUrl,
      };
    }

    // Check if OpenAI URL is expired
    if (currentImageUrl.includes("oaidalleapiprodscus.blob.core.windows.net")) {
      try {
        const url = new URL(currentImageUrl);
        const seParam = url.searchParams.get("se");
        if (seParam) {
          const expirationTime = new Date(seParam);
          const now = new Date();
          if (now > expirationTime) {
            // Clear expired image URL from database
            await db.execute(sql`
              UPDATE studies 
              SET image_url = NULL
              WHERE id = ${studyId}
            `);
            return {
              studyId,
              success: true,
              localPath: null,
            };
          }
        }
      } catch (error) {
        console.error("Error checking expiration:", error);
      }
    }

    // Download and save the image
    const localPath = await downloadAndSaveImage(currentImageUrl, studyId);

    // Update database with local path
    await db.execute(sql`
      UPDATE studies 
      SET image_url = ${localPath},
          local_image_path = ${localPath},
          updated_at = NOW()
      WHERE id = ${studyId}
    `);

    return {
      studyId,
      success: true,
      localPath,
    };
  } catch (error) {
    console.error(`Error downloading image for study ${studyId}:`, error);
    return {
      studyId,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Download all OpenAI images and store them locally
 */
export async function downloadAllOpenAIImages(): Promise<
  ImageDownloadResult[]
> {
  try {
    // Get all studies with OpenAI image URLs that aren't already local
    const result = await db.execute(sql`
      SELECT id, title, image_url 
      FROM studies 
      WHERE image_url IS NOT NULL
      AND image_url LIKE '%oaidalleapiprodscus.blob.core.windows.net%'
      AND image_url NOT LIKE '/uploads/%'
      LIMIT 50
    `);

    const studies = (result as any).rows || [];
    const results: ImageDownloadResult[] = [];

    console.log(
      `Found ${studies.length} studies with OpenAI images to download`,
    );

    for (const study of studies) {
      console.log(`Downloading image for study ${study.id}: ${study.title}`);
      const downloadResult = await downloadStudyImage(study.id);
      results.push(downloadResult);

      // Small delay to avoid overwhelming the system
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return results;
  } catch (error) {
    console.error("Error downloading OpenAI images:", error);
    return [];
  }
}

/**
 * Get local image storage statistics
 */
export async function getLocalImageStats(): Promise<{
  totalImages: number;
  localImages: number;
  openaiImages: number;
  needsDownload: number;
}> {
  try {
    const totalResult = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM studies 
      WHERE image_url IS NOT NULL
    `);

    const localResult = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM studies 
      WHERE image_url LIKE '/uploads/%'
    `);

    const openaiResult = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM studies 
      WHERE image_url LIKE '%oaidalleapiprodscus.blob.core.windows.net%'
    `);

    const needsDownloadResult = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM studies 
      WHERE image_url LIKE '%oaidalleapiprodscus.blob.core.windows.net%'
      AND image_url NOT LIKE '/uploads/%'
    `);

    return {
      totalImages: parseInt((totalResult as any).rows[0]?.count || "0"),
      localImages: parseInt((localResult as any).rows[0]?.count || "0"),
      openaiImages: parseInt((openaiResult as any).rows[0]?.count || "0"),
      needsDownload: parseInt(
        (needsDownloadResult as any).rows[0]?.count || "0",
      ),
    };
  } catch (error) {
    console.error("Error getting local image stats:", error);
    return {
      totalImages: 0,
      localImages: 0,
      openaiImages: 0,
      needsDownload: 0,
    };
  }
}
