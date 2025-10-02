/**
 * Comprehensive Bulk Image Generator
 * Generates images for all 771 studies missing visuals using OpenAI DALL-E 3
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import path from "path";
import fs from "fs";

interface GenerationStats {
  totalToProcess: number;
  completed: number;
  failed: number;
  inProgress: boolean;
  startTime: Date;
  estimatedCompletion?: Date;
}

let generationStats: GenerationStats = {
  totalToProcess: 0,
  completed: 0,
  failed: 0,
  inProgress: false,
  startTime: new Date(),
};

/**
 * Generate image for a single study
 */
async function generateImageForStudy(study: any): Promise<boolean> {
  if (!process.env.OPENAI_API_KEY) {
    console.log(`Skipping study ${study.id} - no OpenAI API key`);
    return false;
  }

  const prompt = `Professional medical illustration showing hydrogen therapy mechanisms for ${study.title}. Show molecular hydrogen (H2) interacting with cells, reducing oxidative stress, and providing therapeutic benefits. Medical research style, clean background, professional appearance, scientific accuracy.`;

  try {
    const response = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: prompt.substring(0, 1000),
          n: 1,
          size: "1024x1024",
          quality: "standard",
          style: "natural",
        }),
      },
    );

    if (!response.ok) {
      console.error(
        `OpenAI API error for study ${study.id}: ${response.status}`,
      );
      return false;
    }

    const data = await response.json();
    const imageUrl = data.data[0]?.url;

    if (!imageUrl) {
      console.error(`No image URL returned for study ${study.id}`);
      return false;
    }

    // Download and save locally
    const imageResponse = await fetch(imageUrl);
    const buffer = await imageResponse.arrayBuffer();

    const uploadsDir = path.join(process.cwd(), "uploads", "study-images");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `study-${study.id}-${Date.now()}.png`;
    const localPath = path.join(uploadsDir, filename);
    const webPath = `/uploads/study-images/${filename}`;

    fs.writeFileSync(localPath, Buffer.from(buffer));

    // Update database
    await db.execute(sql`
      UPDATE studies 
      SET image_url = ${webPath},
          auto_generated_image = true
      WHERE id = ${study.id}
    `);

    console.log(
      `✓ Generated image for study ${study.id}: ${study.title.substring(0, 60)}...`,
    );
    generationStats.completed++;
    return true;
  } catch (error) {
    console.error(`✗ Failed to generate image for study ${study.id}:`, error);
    generationStats.failed++;
    return false;
  }
}

/**
 * Process all studies missing images in chunks
 */
export async function generateAllMissingImages(): Promise<GenerationStats> {
  if (generationStats.inProgress) {
    return generationStats;
  }

  generationStats.inProgress = true;
  generationStats.startTime = new Date();
  generationStats.completed = 0;
  generationStats.failed = 0;

  try {
    // Get all studies without images
    const result = await db.execute(sql`
      SELECT id, title, abstract
      FROM studies 
      WHERE image_url IS NULL
      ORDER BY id
    `);

    const studies = (result as any).rows || [];
    generationStats.totalToProcess = studies.length;

    console.log(`Starting bulk image generation for ${studies.length} studies`);

    // Process in chunks of 50 with rate limiting
    const chunkSize = 50;
    for (let i = 0; i < studies.length; i += chunkSize) {
      const chunk = studies.slice(i, i + chunkSize);

      console.log(
        `Processing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(studies.length / chunkSize)} (${chunk.length} studies)`,
      );

      // Process chunk with rate limiting
      for (const study of chunk) {
        await generateImageForStudy(study);
        // Rate limit: 2 seconds between requests
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Longer break between chunks
      if (i + chunkSize < studies.length) {
        console.log(`Completed chunk, waiting 10 seconds before next chunk...`);
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }

    console.log(
      `✅ Bulk image generation complete. Processed: ${generationStats.completed}, Failed: ${generationStats.failed}`,
    );
  } catch (error) {
    console.error("Error in bulk image generation:", error);
  } finally {
    generationStats.inProgress = false;
  }

  return generationStats;
}

/**
 * Get current generation statistics
 */
export function getGenerationStats(): GenerationStats {
  return { ...generationStats };
}

/**
 * Start bulk generation in background
 */
export function startBulkGeneration(): void {
  if (!generationStats.inProgress) {
    generateAllMissingImages();
  }
}
