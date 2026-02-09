/**
 * Fast Image Generation System
 * Optimized for 15 images per minute DALL-E rate limit
 */

import { sql } from "drizzle-orm";
import path from "path";
import fs from "fs";

let isGenerating = false;
let totalGenerated = 0;
let totalFailed = 0;
let startTime = new Date();

async function generateImageFast(study: any, db: any): Promise<boolean> {
  if (!process.env.OPENAI_API_KEY) {
    return false;
  }

  const prompt = `Medical research illustration: hydrogen therapy for "${study.title}". Professional scientific visualization showing H2 molecular interactions, cellular benefits, therapeutic mechanisms. Clean medical style.`;

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
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const imageUrl = data.data[0]?.url;

    if (!imageUrl) {
      throw new Error("No image URL");
    }

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

    await db.execute(sql`
      UPDATE studies 
      SET image_url = ${webPath},
          auto_generated_image = true
      WHERE id = ${study.id}
    `);

    totalGenerated++;
    console.log(
      `✓ Fast generated image ${totalGenerated} for study ${study.id}`,
    );
    return true;
  } catch (error) {
    totalFailed++;
    console.error(`✗ Fast failed study ${study.id}:`, error);
    return false;
  }
}

export async function startFastGeneration(
  db: any,
): Promise<{ success: boolean; message: string }> {
  if (isGenerating) {
    return {
      success: false,
      message: "Fast generation already running",
    };
  }

  isGenerating = true;
  totalGenerated = 0;
  totalFailed = 0;
  startTime = new Date();

  console.log("Starting fast image generation (15 per minute)");

  setTimeout(async () => {
    try {
      while (isGenerating) {
        const result = await db.execute(sql`
          SELECT id, title, abstract
          FROM studies 
          WHERE image_url IS NULL
          ORDER BY id
          LIMIT 50
        `);

        const studies = (result as any).rows || [];

        if (studies.length === 0) {
          console.log("Fast generation complete - all studies have images");
          break;
        }

        console.log(`Fast processing ${studies.length} studies`);

        for (const study of studies) {
          if (!isGenerating) break;

          await generateImageFast(study, db);

          // 4-second intervals for 15 per minute
          await new Promise((resolve) => setTimeout(resolve, 4000));
        }

        // Short 5-second break between batches
        if (studies.length > 0 && isGenerating) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    } catch (error) {
      console.error("Error in fast generation:", error);
    } finally {
      isGenerating = false;
      console.log(
        `Fast generation complete. Success: ${totalGenerated}, Failed: ${totalFailed}`,
      );
    }
  }, 1000);

  return {
    success: true,
    message: "Started fast generation with 4-second intervals (15 per minute)",
  };
}

export function getFastStatus() {
  const elapsed = (Date.now() - startTime.getTime()) / 1000 / 60;
  const rate = totalGenerated / elapsed;

  return {
    isGenerating,
    totalGenerated,
    totalFailed,
    elapsed: Math.round(elapsed),
    rate: Math.round(rate * 10) / 10,
    estimatedRemaining:
      rate > 0 ? Math.ceil((730 - totalGenerated) / rate) : 50,
  };
}

export function stopFastGeneration() {
  isGenerating = false;
  return { success: true, message: "Stopped fast generation" };
}
