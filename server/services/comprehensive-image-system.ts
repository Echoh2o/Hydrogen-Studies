/**
 * Comprehensive Image System
 * Ensures all studies have AI-generated images with SEO and performance optimization
 */

import { db } from "../db";
import { studies } from "../../shared/schema";
import { sql, isNull, or, eq } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { ai } from "./ai-provider";

function getOpenAI() {
  const client = ai.getOpenAIClient();
  if (!client) throw new Error("OpenAI API key not configured for image generation");
  return client;
}

interface ImageOptimizationResult {
  studyId: number;
  success: boolean;
  imageUrl?: string;
  webpUrl?: string;
  altText?: string;
  error?: string;
  fileSize?: number;
  optimizedSize?: number;
}

interface SystemStatus {
  totalStudies: number;
  studiesWithImages: number;
  studiesNeedingImages: number;
  isProcessing: boolean;
  lastProcessed: Date;
}

let processingStatus = {
  isRunning: false,
  processed: 0,
  failed: 0,
  startTime: new Date(),
};

/**
 * Main function to ensure all studies have optimized images
 */
export async function ensureAllStudiesHaveOptimizedImages(): Promise<{
  success: boolean;
  message: string;
  status: SystemStatus;
}> {
  try {
    const status = await getSystemStatus();

    if (status.studiesNeedingImages === 0) {
      return {
        success: true,
        message: "All studies already have images",
        status,
      };
    }

    if (processingStatus.isRunning) {
      return {
        success: false,
        message: "Image processing already in progress",
        status,
      };
    }

    // Start background processing
    setTimeout(() => {
      processAllMissingImages();
    }, 1000);

    return {
      success: true,
      message: `Started processing ${status.studiesNeedingImages} studies`,
      status,
    };
  } catch (error) {
    console.error("Error in ensureAllStudiesHaveOptimizedImages:", error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      status: await getSystemStatus(),
    };
  }
}

/**
 * Process all studies that need images
 */
async function processAllMissingImages(): Promise<void> {
  if (processingStatus.isRunning) return;

  processingStatus.isRunning = true;
  processingStatus.processed = 0;
  processingStatus.failed = 0;
  processingStatus.startTime = new Date();

  try {
    console.log("🚀 Starting comprehensive image processing...");

    while (true) {
      // Get next batch of studies without images
      const studiesNeedingImages = await getStudiesNeedingImages(10);

      if (studiesNeedingImages.length === 0) {
        console.log("✅ All studies now have optimized images!");
        break;
      }

      console.log(
        `Processing batch of ${studiesNeedingImages.length} studies...`,
      );

      // Process each study in the batch
      for (const study of studiesNeedingImages) {
        try {
          const result = await generateAndOptimizeStudyImage(study);

          if (result.success) {
            processingStatus.processed++;
            console.log(`✓ Study ${study.id}: Image generated and optimized`);
          } else {
            processingStatus.failed++;
            console.log(`✗ Study ${study.id}: ${result.error}`);
          }

          // Rate limiting between requests (6 seconds for OpenAI)
          await new Promise((resolve) => setTimeout(resolve, 6000));
        } catch (error) {
          processingStatus.failed++;
          console.error(`Error processing study ${study.id}:`, error);
        }
      }

      // Longer break between batches
      console.log("Batch complete, waiting 30 seconds before next batch...");
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }
  } catch (error) {
    console.error("Error in processAllMissingImages:", error);
  } finally {
    processingStatus.isRunning = false;
    console.log(
      `Processing complete: ${processingStatus.processed} successful, ${processingStatus.failed} failed`,
    );
  }
}

/**
 * Generate and optimize image for a single study
 */
async function generateAndOptimizeStudyImage(
  study: any,
): Promise<ImageOptimizationResult> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      studyId: study.id,
      success: false,
      error: "OpenAI API key not available",
    };
  }

  try {
    // Generate SEO-optimized prompt
    const prompt = await createSEOOptimizedPrompt(study);

    // Generate image with DALL-E
    const response = await getOpenAI().images.generate({
      model: "dall-e-3",
      prompt: prompt.substring(0, 1000),
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural",
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error("No image URL returned from OpenAI");
    }

    // Download and optimize the image
    const optimizationResult = await downloadAndOptimizeImage(imageUrl, study);

    if (!optimizationResult.success) {
      throw new Error(optimizationResult.error || "Image optimization failed");
    }

    // Generate SEO-optimized alt text
    const altText = generateSEOAltText(study);

    // Update database with optimized image data
    await db
      .update(studies)
      .set({
        imageUrl: optimizationResult.webpUrl,
        imageAlt: altText,
        autoGeneratedImage: true,
      })
      .where(eq(studies.id, study.id));

    return {
      studyId: study.id,
      success: true,
      imageUrl: optimizationResult.originalUrl,
      webpUrl: optimizationResult.webpUrl,
      altText: altText,
      fileSize: optimizationResult.originalSize,
      optimizedSize: optimizationResult.optimizedSize,
    };
  } catch (error) {
    console.error(`Error generating image for study ${study.id}:`, error);
    return {
      studyId: study.id,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create SEO-optimized prompt for image generation
 */
async function createSEOOptimizedPrompt(study: any): Promise<string> {
  const title = study.title || "";
  const abstract = study.abstract || "";
  const category = study.category || "";

  // Create a simple, artistic prompt based on the study topic
  const basePrompt = `Beautiful, artistic editorial photo related to ${category || "health and wellness"} research. Simple, clean, modern health magazine style with soft natural lighting.`;

  return `${basePrompt} No text, labels, molecules, or complex scientific diagrams.`;
}

/**
 * Download and optimize image for web performance
 */
async function downloadAndOptimizeImage(
  imageUrl: string,
  study: any,
): Promise<{
  success: boolean;
  originalUrl?: string;
  webpUrl?: string;
  originalSize?: number;
  optimizedSize?: number;
  error?: string;
}> {
  try {
    // Ensure directories exist
    const uploadsDir = path.join(process.cwd(), "uploads", "study-images");
    const optimizedDir = path.join(
      process.cwd(),
      "uploads",
      "study-images",
      "optimized",
    );

    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.mkdir(optimizedDir, { recursive: true });

    // Download original image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const originalBuffer = Buffer.from(buffer);

    // Generate filenames
    const timestamp = Date.now();
    const originalFilename = `study-${study.id}-${timestamp}.png`;
    const webpFilename = `study-${study.id}-${timestamp}.webp`;

    // Save original image
    const originalPath = path.join(uploadsDir, originalFilename);
    await fs.writeFile(originalPath, originalBuffer);

    // Optimize and convert to WebP using Sharp
    const optimizedBuffer = await sharp(originalBuffer)
      .resize(800, 600, {
        fit: "cover",
        position: "center",
      })
      .webp({
        quality: 85,
        effort: 6,
      })
      .toBuffer();

    // Save optimized WebP
    const webpPath = path.join(optimizedDir, webpFilename);
    await fs.writeFile(webpPath, optimizedBuffer);

    // Generate web-accessible URLs
    const originalUrl = `/uploads/study-images/${originalFilename}`;
    const webpUrl = `/uploads/study-images/optimized/${webpFilename}`;

    return {
      success: true,
      originalUrl,
      webpUrl,
      originalSize: originalBuffer.length,
      optimizedSize: optimizedBuffer.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate SEO-optimized alt text
 */
function generateSEOAltText(study: any): string {
  const title = study.title || "";
  const category = study.category || "";

  // Create descriptive alt text for SEO
  const baseAlt = `Scientific illustration of hydrogen therapy research`;
  const categoryText = category ? ` for ${category.toLowerCase()}` : "";
  const studyContext = title ? ` - ${title.substring(0, 60)}` : "";

  return `${baseAlt}${categoryText}${studyContext}`.substring(0, 125);
}

/**
 * Determine hydrogen delivery method from study content
 */
function determineDeliveryMethod(content: string): string {
  const lowerContent = content.toLowerCase();

  if (
    lowerContent.includes("water") ||
    lowerContent.includes("drinking") ||
    lowerContent.includes("hydrogen-rich water")
  ) {
    return "water";
  } else if (
    lowerContent.includes("inhal") ||
    lowerContent.includes("gas") ||
    lowerContent.includes("breathing")
  ) {
    return "inhalation";
  } else if (
    lowerContent.includes("inject") ||
    lowerContent.includes("saline") ||
    lowerContent.includes("intravenous")
  ) {
    return "injection";
  } else {
    return "general";
  }
}

/**
 * Get studies that need images
 */
async function getStudiesNeedingImages(limit: number = 20): Promise<any[]> {
  try {
    const result = await db
      .select({
        id: studies.id,
        title: studies.title,
        abstract: studies.abstract,
        category: studies.category,
      })
      .from(studies)
      .where(or(isNull(studies.imageUrl), eq(studies.imageUrl, "")))
      .limit(limit);

    return result;
  } catch (error) {
    console.error("Error getting studies needing images:", error);
    return [];
  }
}

/**
 * Get system status
 */
export async function getSystemStatus(): Promise<SystemStatus> {
  try {
    const totalResult = await db.execute(
      sql`SELECT COUNT(*) as count FROM studies`,
    );
    const withImagesResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM studies 
      WHERE image_url IS NOT NULL AND image_url != ''
    `);

    const totalStudies = parseInt((totalResult as any).rows[0]?.count || "0");
    const studiesWithImages = parseInt(
      (withImagesResult as any).rows[0]?.count || "0",
    );
    const studiesNeedingImages = totalStudies - studiesWithImages;

    return {
      totalStudies,
      studiesWithImages,
      studiesNeedingImages,
      isProcessing: processingStatus.isRunning,
      lastProcessed: processingStatus.startTime,
    };
  } catch (error) {
    console.error("Error getting system status:", error);
    return {
      totalStudies: 0,
      studiesWithImages: 0,
      studiesNeedingImages: 0,
      isProcessing: false,
      lastProcessed: new Date(),
    };
  }
}

/**
 * Get processing statistics
 */
export function getProcessingStats() {
  return {
    isRunning: processingStatus.isRunning,
    processed: processingStatus.processed,
    failed: processingStatus.failed,
    startTime: processingStatus.startTime,
    estimatedTimeRemaining: processingStatus.isRunning
      ? Math.ceil(
          ((Date.now() - processingStatus.startTime.getTime()) /
            processingStatus.processed) *
            10,
        )
      : 0,
  };
}

/**
 * Stop processing
 */
export function stopProcessing(): { success: boolean; message: string } {
  if (!processingStatus.isRunning) {
    return {
      success: false,
      message: "No processing currently running",
    };
  }

  processingStatus.isRunning = false;
  return {
    success: true,
    message: "Processing stopped successfully",
  };
}
