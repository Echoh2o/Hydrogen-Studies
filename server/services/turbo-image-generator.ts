/**
 * Turbo Image Generation System
 * Maximizes 15 images per minute rate limit with parallel processing
 */

import { sql } from "drizzle-orm";
import path from "path";
import fs from "fs";

let isRunning = false;
let processed = 0;
let successful = 0;
let failed = 0;
let startTime = new Date();

async function generateImageTurbo(study: any, db: any): Promise<boolean> {
  if (!process.env.OPENAI_API_KEY) {
    return false;
  }

  const prompt = `Medical illustration: hydrogen therapy for "${study.title}". Scientific visualization of H2 molecular interactions, cellular benefits, therapeutic mechanisms. Professional medical research style.`;

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

    successful++;
    console.log(`Generated turbo image ${successful} for study ${study.id}`);
    return true;
  } catch (error) {
    failed++;
    console.error(`Failed turbo study ${study.id}:`, error);
    return false;
  }
}

export async function startTurboGeneration(
  db: any,
): Promise<{ success: boolean; message: string }> {
  if (isRunning) {
    return {
      success: false,
      message: "Turbo generation already running",
    };
  }

  isRunning = true;
  processed = 0;
  successful = 0;
  failed = 0;
  startTime = new Date();

  console.log("Starting turbo image generation (15 per minute optimized)");

  setTimeout(async () => {
    try {
      while (isRunning) {
        const result = await db.execute(sql`
          SELECT id, title, abstract
          FROM studies 
          WHERE image_url IS NULL
          ORDER BY id
          LIMIT 100
        `);

        const studies = (result as any).rows || [];

        if (studies.length === 0) {
          console.log("Turbo generation complete - all studies have images");
          break;
        }

        console.log(`Turbo processing ${studies.length} studies`);

        // Process in chunks of 15 every minute for optimal rate usage
        for (let i = 0; i < studies.length; i += 15) {
          if (!isRunning) break;

          const chunk = studies.slice(i, i + 15);
          console.log(`Processing chunk of ${chunk.length} studies`);

          // Process chunk with 4-second intervals (15 per minute)
          for (const study of chunk) {
            if (!isRunning) break;

            await generateImageTurbo(study, db);
            processed++;

            // 4-second intervals for exactly 15 per minute
            await new Promise((resolve) => setTimeout(resolve, 4000));
          }

          // If more chunks remain, brief pause to maintain rate
          if (i + 15 < studies.length && isRunning) {
            console.log(
              "Completed 15 images, brief pause before next chunk...",
            );
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }

        // Check for more studies
        if (studies.length === 100 && isRunning) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    } catch (error) {
      console.error("Error in turbo generation:", error);
    } finally {
      isRunning = false;
      const duration = (Date.now() - startTime.getTime()) / 1000 / 60;
      console.log(
        `Turbo generation complete. Success: ${successful}, Failed: ${failed}, Duration: ${Math.round(duration)} minutes`,
      );
    }
  }, 1000);

  return {
    success: true,
    message: "Started turbo generation optimized for 15 images per minute",
  };
}

export function getTurboStatus() {
  const elapsed = (Date.now() - startTime.getTime()) / 1000 / 60;
  const rate = successful / Math.max(elapsed, 0.1);
  const remaining = Math.max(0, 726 - successful);

  return {
    isRunning,
    processed,
    successful,
    failed,
    elapsed: Math.round(elapsed * 10) / 10,
    rate: Math.round(rate * 10) / 10,
    estimatedMinutesRemaining:
      rate > 0 ? Math.ceil(remaining / rate) : Math.ceil(remaining / 15),
  };
}

export function stopTurboGeneration() {
  isRunning = false;
  return { success: true, message: "Stopped turbo generation" };
}
