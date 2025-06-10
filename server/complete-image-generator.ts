/**
 * Complete Image Generation System
 * Generates images for all studies missing visuals using OpenAI DALL-E 3
 */

import { sql } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';

interface ImageGenResult {
  studyId: number;
  success: boolean;
  imageUrl?: string;
  error?: string;
}

let isGenerating = false;
let generationStats = {
  total: 0,
  completed: 0,
  failed: 0,
  startTime: new Date()
};

/**
 * Generate image for a single study
 */
async function generateStudyImage(study: any, db: any): Promise<ImageGenResult> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      studyId: study.id,
      success: false,
      error: 'No OpenAI API key available'
    };
  }

  const prompt = `Professional medical illustration: hydrogen therapy mechanisms for "${study.title}". Show molecular hydrogen (H2) interacting with cells, reducing oxidative stress, providing therapeutic benefits. Medical research style, clean background, scientific accuracy.`;

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
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const imageUrl = data.data[0]?.url;
    
    if (!imageUrl) {
      throw new Error('No image URL in response');
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
    
    // Update database using proper SQL
    await db.execute(sql`
      UPDATE studies 
      SET image_url = ${webPath},
          auto_generated_image = true
      WHERE id = ${study.id}
    `);

    console.log(`✓ Generated image for study ${study.id}`);
    generationStats.completed++;
    
    return {
      studyId: study.id,
      success: true,
      imageUrl: webPath
    };
  } catch (error) {
    console.error(`✗ Failed to generate image for study ${study.id}:`, error);
    generationStats.failed++;
    
    return {
      studyId: study.id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Start bulk generation process
 */
export async function startCompleteImageGeneration(db: any): Promise<{success: boolean, message: string, stats: any}> {
  if (isGenerating) {
    return {
      success: false,
      message: 'Generation already in progress',
      stats: generationStats
    };
  }

  isGenerating = true;
  generationStats = {
    total: 0,
    completed: 0,
    failed: 0,
    startTime: new Date()
  };

  try {
    // Get all studies without images
    const result = await db.execute(sql`
      SELECT id, title, abstract
      FROM studies 
      WHERE image_url IS NULL
      ORDER BY id
      LIMIT 50
    `);
    
    const studies = (result as any).rows || [];
    generationStats.total = studies.length;
    
    console.log(`Starting image generation for ${studies.length} studies`);

    // Process studies with rate limiting
    setTimeout(async () => {
      for (const study of studies) {
        if (!isGenerating) break; // Allow stopping
        
        await generateStudyImage(study, db);
        
        // Rate limit: 3 seconds between requests
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      isGenerating = false;
      console.log(`Image generation complete. Success: ${generationStats.completed}, Failed: ${generationStats.failed}`);
    }, 100);

    return {
      success: true,
      message: `Started generating images for ${studies.length} studies`,
      stats: generationStats
    };
  } catch (error) {
    isGenerating = false;
    console.error('Error starting image generation:', error);
    return {
      success: false,
      message: 'Failed to start generation',
      stats: generationStats
    };
  }
}

/**
 * Get current generation status
 */
export function getGenerationStatus() {
  return {
    isGenerating,
    stats: generationStats
  };
}

/**
 * Stop generation process
 */
export function stopGeneration() {
  isGenerating = false;
  return { success: true, message: 'Generation stopped' };
}