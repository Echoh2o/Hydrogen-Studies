/**
 * Accelerated Image Generation System
 * Processes multiple concurrent batches to complete all 767 remaining studies faster
 */

import { sql } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';

let activeBatches = 0;
let totalGenerated = 0;
let totalFailed = 0;

/**
 * Generate image for a single study with optimized processing
 */
async function generateStudyImageFast(study: any, db: any): Promise<boolean> {
  if (!process.env.OPENAI_API_KEY) {
    return false;
  }

  const prompt = `Professional medical illustration: hydrogen therapy for "${study.title}". Molecular hydrogen (H2) cellular interactions, oxidative stress reduction, therapeutic benefits. Medical research style, scientific accuracy.`;

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
      throw new Error('No image URL');
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

    totalGenerated++;
    console.log(`✓ Generated image ${totalGenerated} for study ${study.id}`);
    return true;
  } catch (error) {
    totalFailed++;
    console.error(`✗ Failed study ${study.id}:`, error);
    return false;
  }
}

/**
 * Process a batch of studies with minimal delay
 */
async function processBatchFast(studies: any[], db: any, batchId: number): Promise<void> {
  activeBatches++;
  console.log(`Starting accelerated batch ${batchId} with ${studies.length} studies`);
  
  for (const study of studies) {
    await generateStudyImageFast(study, db);
    // Optimal rate limiting to avoid 429 errors - 4 seconds
    await new Promise(resolve => setTimeout(resolve, 4000));
  }
  
  activeBatches--;
  console.log(`Completed accelerated batch ${batchId}`);
}

/**
 * Start accelerated generation with multiple concurrent batches
 */
export async function startAcceleratedGeneration(db: any): Promise<{success: boolean, message: string}> {
  try {
    // Get all studies without images
    const result = await db.execute(sql`
      SELECT id, title, abstract
      FROM studies 
      WHERE image_url IS NULL
      ORDER BY id
      LIMIT 200
    `);
    
    const studies = (result as any).rows || [];
    console.log(`Starting accelerated generation for ${studies.length} studies`);
    
    // Split into 4 concurrent batches of 50 studies each
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < studies.length; i += batchSize) {
      batches.push(studies.slice(i, i + batchSize));
    }
    
    // Start all batches concurrently with staggered timing
    batches.forEach((batch, index) => {
      setTimeout(() => {
        processBatchFast(batch, db, index + 1);
      }, index * 5000); // 5 second stagger between batch starts
    });
    
    return {
      success: true,
      message: `Started ${batches.length} accelerated batches processing ${studies.length} studies`
    };
  } catch (error) {
    console.error('Error starting accelerated generation:', error);
    return {
      success: false,
      message: 'Failed to start accelerated generation'
    };
  }
}

/**
 * Get accelerated generation status
 */
export function getAcceleratedStatus() {
  return {
    activeBatches,
    totalGenerated,
    totalFailed,
    isGenerating: activeBatches > 0
  };
}