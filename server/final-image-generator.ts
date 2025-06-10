/**
 * Final Image Generation System
 * Conservative single-threaded approach with proper rate limiting
 */

import { sql } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';

interface GenerationProgress {
  isActive: boolean;
  totalRemaining: number;
  completed: number;
  failed: number;
  currentBatch: number;
  estimatedMinutesRemaining: number;
  startTime: Date;
}

let progress: GenerationProgress = {
  isActive: false,
  totalRemaining: 0,
  completed: 0,
  failed: 0,
  currentBatch: 0,
  estimatedMinutesRemaining: 0,
  startTime: new Date()
};

async function generateImage(study: any, db: any): Promise<boolean> {
  if (!process.env.OPENAI_API_KEY) {
    console.log('No OpenAI API key - skipping image generation');
    return false;
  }

  const prompt = `Medical research illustration: hydrogen therapy mechanisms for "${study.title}". Professional scientific visualization showing H2 molecular interactions with cells, oxidative stress reduction, therapeutic benefits. Clean medical research style.`;

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
      if (response.status === 429) {
        console.log(`Rate limit hit for study ${study.id}, waiting longer...`);
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30 second wait
        return false; // Will retry in next batch
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const imageUrl = data.data[0]?.url;
    
    if (!imageUrl) {
      throw new Error('No image URL returned');
    }

    // Download and save locally
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
    
    // Update database
    await db.execute(sql`
      UPDATE studies 
      SET image_url = ${webPath},
          auto_generated_image = true
      WHERE id = ${study.id}
    `);

    progress.completed++;
    console.log(`Generated image ${progress.completed} for study ${study.id}: ${study.title.substring(0, 50)}...`);
    return true;
  } catch (error) {
    progress.failed++;
    console.error(`Failed to generate image for study ${study.id}:`, error);
    return false;
  }
}

export async function startFinalGeneration(db: any): Promise<{success: boolean, message: string}> {
  if (progress.isActive) {
    return {
      success: false,
      message: 'Generation already active'
    };
  }

  // Get total count of studies needing images
  const countResult = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM studies 
    WHERE image_url IS NULL
  `);
  
  const totalRemaining = parseInt((countResult as any).rows[0].count);
  
  progress = {
    isActive: true,
    totalRemaining,
    completed: 0,
    failed: 0,
    currentBatch: 0,
    estimatedMinutesRemaining: Math.ceil(totalRemaining * 0.2), // 12 seconds per image average
    startTime: new Date()
  };

  console.log(`Starting final image generation for ${totalRemaining} studies`);

  // Process in background with very conservative rate limiting
  setTimeout(async () => {
    try {
      while (progress.isActive && progress.completed + progress.failed < progress.totalRemaining) {
        // Get small batch of 10 studies
        const result = await db.execute(sql`
          SELECT id, title, abstract
          FROM studies 
          WHERE image_url IS NULL
          ORDER BY id
          LIMIT 10
        `);
        
        const studies = (result as any).rows || [];
        
        if (studies.length === 0) {
          console.log('No more studies need images - generation complete');
          break;
        }
        
        progress.currentBatch++;
        console.log(`Processing batch ${progress.currentBatch} with ${studies.length} studies`);
        
        // Process each study with generous delays
        for (const study of studies) {
          if (!progress.isActive) break;
          
          await generateImage(study, db);
          
          // Conservative rate limiting - 10 seconds between requests
          await new Promise(resolve => setTimeout(resolve, 10000));
          
          // Update time estimate
          const elapsed = (Date.now() - progress.startTime.getTime()) / 1000 / 60;
          const rate = progress.completed / elapsed;
          const remaining = progress.totalRemaining - progress.completed - progress.failed;
          progress.estimatedMinutesRemaining = rate > 0 ? Math.ceil(remaining / rate) : remaining * 0.2;
        }
        
        // Longer break between batches to be extra conservative
        if (studies.length > 0 && progress.isActive) {
          console.log(`Completed batch ${progress.currentBatch}, waiting 60 seconds before next batch...`);
          await new Promise(resolve => setTimeout(resolve, 60000));
        }
      }
    } catch (error) {
      console.error('Error in final generation process:', error);
    } finally {
      progress.isActive = false;
      console.log(`Final generation complete. Success: ${progress.completed}, Failed: ${progress.failed}`);
    }
  }, 1000);

  return {
    success: true,
    message: `Started conservative generation for ${totalRemaining} studies with 10-second intervals`
  };
}

export function getFinalProgress(): GenerationProgress {
  return { ...progress };
}

export function stopFinalGeneration(): {success: boolean, message: string} {
  progress.isActive = false;
  return {
    success: true,
    message: 'Stopped final generation process'
  };
}