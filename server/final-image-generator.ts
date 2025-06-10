/**
 * Final Image Generation System
 * Conservative single-threaded approach with proper rate limiting
 */

import { sql } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import OpenAI from 'openai';

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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Create an advanced image prompt using AI and category-specific optimizations
 */
async function createAdvancedImagePrompt(study: any): Promise<string> {
  const category = study.category || 'General';
  const title = study.title || '';
  const abstract = study.abstract || '';
  
  // Determine hydrogen delivery method
  const deliveryMethod = determineHydrogenDeliveryMethod(title + ' ' + abstract);
  
  try {
    // Use AI to generate detailed prompt
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert scientific illustrator specializing in hydrogen health research. 
          Create detailed, scientifically accurate prompts for generating medical/scientific illustrations.
          Focus on creating prompts that would yield realistic, professional images suitable for scientific publications.
          Do not include text labels in the image description as they will appear distorted.
          Avoid references to specific people, brands, or copyrighted concepts.`
        },
        {
          role: "user",
          content: `Create a detailed prompt for generating a scientific illustration for a hydrogen health study:
          
          TITLE: ${title}
          ABSTRACT: ${abstract.substring(0, 300)}
          CATEGORY: ${category}
          DELIVERY METHOD: ${deliveryMethod}
          
          The image should be:
          1. Scientifically accurate and professionally styled
          2. Suitable for a medical or scientific publication
          3. Clear and focused on the hydrogen therapy mechanism
          4. Without any text labels or annotations
          5. In a modern scientific illustration style with a clean background
          
          Provide only the image generation prompt with no additional explanation.`
        }
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const generatedPrompt = response.choices[0]?.message.content?.trim();
    
    if (generatedPrompt) {
      return `Scientific illustration for hydrogen therapy research: ${generatedPrompt}. Professional medical illustration in a hyper-realistic style with clean lighting and neutral background. No text or labels.`;
    }
  } catch (error) {
    console.error('Error creating AI-enhanced prompt:', error);
  }
  
  // Fallback to category-specific prompt
  return createCategoryOptimizedPrompt(study, deliveryMethod);
}

/**
 * Create category-optimized prompt as fallback
 */
function createCategoryOptimizedPrompt(study: any, deliveryMethod: string): string {
  const category = study.category || 'General';
  let basePrompt = "Professional medical illustration, clean and modern style, ";
  
  // Add category-specific elements
  switch (category.toLowerCase()) {
    case 'cardiovascular':
      basePrompt += "heart and cardiovascular system, ";
      break;
    case 'neurological':
      basePrompt += "brain and nervous system, ";
      break;
    case 'respiratory':
      basePrompt += "lungs and respiratory system, ";
      break;
    case 'gastrointestinal':
      basePrompt += "digestive system, ";
      break;
    case 'cancer research':
      basePrompt += "cellular health and protection, ";
      break;
    case 'metabolic':
      basePrompt += "metabolism and cellular energy, ";
      break;
    case 'dermatology':
      basePrompt += "skin health and cellular regeneration, ";
      break;
    default:
      basePrompt += "general health and wellness, ";
  }

  // Add delivery method context
  if (deliveryMethod.toLowerCase().includes('water')) {
    basePrompt += "hydrogen-rich water therapy, ";
  } else if (deliveryMethod.toLowerCase().includes('inhalation')) {
    basePrompt += "hydrogen gas inhalation therapy, ";
  } else {
    basePrompt += "hydrogen therapy, ";
  }
  
  basePrompt += `molecular hydrogen (H2) interacting with cells, reducing oxidative stress, therapeutic benefits. Clean background, no text labels, scientifically accurate, medical research publication quality.`;
  
  return basePrompt;
}

/**
 * Determine hydrogen delivery method from study content
 */
function determineHydrogenDeliveryMethod(content: string): string {
  const lowerContent = content.toLowerCase();
  
  if (lowerContent.includes('hydrogen-rich water') || lowerContent.includes('hydrogen water') || lowerContent.includes('drinking')) {
    return 'Hydrogen-rich water';
  } else if (lowerContent.includes('inhalation') || lowerContent.includes('breathing') || lowerContent.includes('gas')) {
    return 'Hydrogen gas inhalation';
  } else if (lowerContent.includes('injection') || lowerContent.includes('infusion')) {
    return 'Hydrogen injection/infusion';
  } else if (lowerContent.includes('bath') || lowerContent.includes('topical')) {
    return 'Hydrogen bath/topical';
  } else {
    return 'General hydrogen therapy';
  }
}

async function generateImage(study: any, db: any): Promise<boolean> {
  if (!process.env.OPENAI_API_KEY) {
    console.log('No OpenAI API key - skipping image generation');
    return false;
  }

  // Use our fine-tuned advanced prompt system
  const prompt = await createAdvancedImagePrompt(study);

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
        // Get larger batch of 30 studies for faster processing
        const result = await db.execute(sql`
          SELECT id, title, abstract
          FROM studies 
          WHERE image_url IS NULL
          ORDER BY id
          LIMIT 30
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
          
          // Optimized rate limiting - 4 seconds between requests (15 per minute)
          await new Promise(resolve => setTimeout(resolve, 4000));
          
          // Update time estimate
          const elapsed = (Date.now() - progress.startTime.getTime()) / 1000 / 60;
          const rate = progress.completed / elapsed;
          const remaining = progress.totalRemaining - progress.completed - progress.failed;
          progress.estimatedMinutesRemaining = rate > 0 ? Math.ceil(remaining / rate) : remaining * 0.2;
        }
        
        // Shorter break between batches for faster processing
        if (studies.length > 0 && progress.isActive) {
          console.log(`Completed batch ${progress.currentBatch}, waiting 10 seconds before next batch...`);
          await new Promise(resolve => setTimeout(resolve, 10000));
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