/**
 * Optimal Image Generation System
 * Single-threaded processing with proper rate limiting to avoid API errors
 */

import { sql } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';

let isRunning = false;
let stats = {
  processed: 0,
  successful: 0,
  failed: 0,
  startTime: new Date(),
  currentStudy: 0
};

async function generateSingleImage(study: any, db: any): Promise<boolean> {
  if (!process.env.OPENAI_API_KEY) {
    return false;
  }

  const prompt = `Medical illustration: hydrogen therapy for "${study.title}". Show H2 molecules reducing oxidative stress in cells. Scientific, professional medical research style.`;

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt.substring(0, 1000),
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        style: 'natural'
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const imageUrl = data.data[0]?.url;
    
    if (!imageUrl) {
      throw new Error('No image URL returned');
    }

    const imageResponse = await fetch(imageUrl);
    const buffer = await imageResponse.arrayBuffer();
    
    const uploadsDir = path.join(process.cwd(), 'uploads', 'study-images');
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

    stats.successful++;
    console.log(`✓ Generated image ${stats.successful} for study ${study.id}`);
    return true;
  } catch (error) {
    stats.failed++;
    console.error(`✗ Failed study ${study.id}: ${error}`);
    return false;
  }
}

export async function startOptimalGeneration(db: any): Promise<{success: boolean, message: string, stats: any}> {
  if (isRunning) {
    return {
      success: false,
      message: 'Generation already running',
      stats
    };
  }

  isRunning = true;
  stats = {
    processed: 0,
    successful: 0,
    failed: 0,
    startTime: new Date(),
    currentStudy: 0
  };

  // Start processing in background
  setTimeout(async () => {
    try {
      while (isRunning) {
        // Get next batch of studies without images
        const result = await db.execute(sql`
          SELECT id, title, abstract
          FROM studies 
          WHERE image_url IS NULL
          ORDER BY id
          LIMIT 20
        `);
        
        const studies = (result as any).rows || [];
        
        if (studies.length === 0) {
          console.log('All studies have images - generation complete');
          break;
        }
        
        console.log(`Processing ${studies.length} studies (batch ${Math.floor(stats.processed / 20) + 1})`);
        
        for (const study of studies) {
          if (!isRunning) break;
          
          stats.currentStudy = study.id;
          await generateSingleImage(study, db);
          stats.processed++;
          
          // Conservative rate limiting - 6 seconds between requests
          await new Promise(resolve => setTimeout(resolve, 6000));
        }
        
        // Longer break between batches
        if (studies.length === 20 && isRunning) {
          console.log('Completed batch, waiting 30 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 30000));
        }
      }
    } catch (error) {
      console.error('Error in optimal generation:', error);
    } finally {
      isRunning = false;
      console.log(`Generation complete. Success: ${stats.successful}, Failed: ${stats.failed}`);
    }
  }, 1000);

  return {
    success: true,
    message: 'Started optimal generation with conservative rate limiting',
    stats
  };
}

export function getOptimalStatus() {
  return {
    isRunning,
    stats,
    estimatedRemaining: isRunning ? Math.max(0, 755 - stats.processed) : 0
  };
}

export function stopOptimalGeneration() {
  isRunning = false;
  return { success: true, message: 'Stopped optimal generation' };
}