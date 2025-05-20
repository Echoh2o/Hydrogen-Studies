/**
 * Image Generator Service for Hydrogen Studies
 * 
 * Generates scientific images for studies that don't have any associated media
 * using AI-based image generation technology.
 */
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { db } from './db';
import { studies as studiesTable, blogArticles } from '../shared/schema';
import { eq, isNull } from 'drizzle-orm';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate a scientific image based on text content
 * This function is used for generic image generation based on scientific text
 * @param content Text content to generate an image for
 * @returns Generated image URL
 */
export async function generateScientificImage(content: string): Promise<{ success: boolean, imageUrl?: string, message?: string }> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        success: false,
        message: 'OPENAI_API_KEY not set, unable to generate image'
      };
    }

    // Create a simplified prompt for generic scientific images
    const prompt = `Scientific illustration of ${content}. Professional medical illustration in hyper-realistic style with clean lighting and neutral background. No text or labels.`;
    
    // Generate the image using DALL-E 3
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural"
    });

    const imageUrl = response.data?.[0]?.url;
    
    if (!imageUrl) {
      return {
        success: false,
        message: 'Failed to generate image - no URL returned'
      };
    }

    return {
      success: true,
      imageUrl: imageUrl
    };
  } catch (error) {
    console.error('Error generating scientific image:', error);
    return {
      success: false,
      message: `Error generating image: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Generate an image for a blog article
 * @param blogId ID of the blog to generate an image for
 * @returns Object containing the result of image generation
 */
export async function generateBlogImage(blogId: number): Promise<{ 
  success: boolean, 
  imageUrl?: string, 
  message?: string 
}> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        success: false,
        message: 'OPENAI_API_KEY not set, unable to generate image'
      };
    }

    // Get the blog data
    const [blog] = await db?.select().from(blogArticles).where(eq(blogArticles.id, blogId)) || [];
    
    if (!blog) {
      return {
        success: false,
        message: `Blog with ID ${blogId} not found`
      };
    }

    // Extract relevant information for image generation
    const title = blog.title || '';
    const summary = blog.summary || '';
    const content = blog.content || '';
    
    // Create a simplified prompt for blog image
    const prompt = `Create a modern, engaging image to represent a blog article titled "${title}" about ${summary}. The image should be appropriate for a health and wellness website focused on hydrogen research. Use a clean, professional style with subtle medical/scientific elements. No text in the image.`;
    
    // Generate the image using DALL-E 3
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural"
    });

    const imageUrl = response.data?.[0]?.url;
    
    if (!imageUrl) {
      return {
        success: false,
        message: 'Failed to generate image - no URL returned'
      };
    }

    // Ensure uploads directory exists
    const uploadDir = path.join(process.cwd(), 'uploads', 'blog-images');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Download the image
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageName = `blog_${blogId}_${uuidv4()}.png`;
    const imagePath = path.join(uploadDir, imageName);
    
    // Save the image to disk
    fs.writeFileSync(imagePath, imageResponse.data);
    
    // Get the relative path for storage in the database
    const relativeImagePath = path.join('uploads', 'blog-images', imageName);
    
    // Update the blog record with the new image
    await db?.update(blogArticles)
      .set({
        imageUrl: relativeImagePath
      })
      .where(eq(blogArticles.id, blogId));

    return {
      success: true,
      imageUrl: relativeImagePath
    };
  } catch (error) {
    console.error('Error generating blog image:', error);
    return {
      success: false,
      message: `Error generating image: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Generate an image for a study based on its content
 * @param studyId ID of the study to generate an image for
 * @returns Object containing the result of image generation
 */
export async function generateImageForStudy(studyId: number): Promise<{
  success: boolean;
  message: string;
  imageUrl?: string;
  imagePath?: string;
}> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        success: false,
        message: 'OPENAI_API_KEY not set, unable to generate image'
      };
    }

    // Get the study data
    const [study] = await db?.select().from(studiesTable).where(eq(studiesTable.id, studyId)) || [];
    
    if (!study) {
      return {
        success: false,
        message: `Study with ID ${studyId} not found`
      };
    }

    // Extract relevant information for image generation
    const title = study.title || '';
    const abstract = study.abstract || '';
    const methods = study.methods || '';
    const category = study.category || '';
    // Use category as focus since we don't have a separate focus field
    const focus = category;
    // Default empty array for health benefits
    const healthBenefits: string[] = [];

    // Create a detailed prompt for image generation
    const prompt = await createImagePrompt(title, abstract, methods, category, focus, healthBenefits);
    
    // Ensure uploads directory exists
    const uploadDir = path.join(process.cwd(), 'uploads', 'study-images');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate the image using DALL-E 3
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural"
    });

    // Safely access response data
    const imageUrl = response.data?.[0]?.url;
    
    if (!imageUrl) {
      return {
        success: false,
        message: 'Failed to generate image - no URL returned'
      };
    }

    // Download the image
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageName = `study_${studyId}_${uuidv4()}.png`;
    const imagePath = path.join(uploadDir, imageName);
    
    // Save the image to disk
    fs.writeFileSync(imagePath, imageResponse.data);
    
    // Get the relative path for storage in the database
    const relativeImagePath = path.join('uploads', 'study-images', imageName);
    
    // Update the study record with the new image
    await db?.update(studiesTable)
      .set({
        imageUrl: relativeImagePath,
        // Set imageAlt with a descriptive alt text
        imageAlt: `AI-generated scientific illustration for hydrogen study: ${title}`
      })
      .where(eq(studiesTable.id, studyId));

    return {
      success: true,
      message: 'Successfully generated and saved image',
      imageUrl: relativeImagePath,
      imagePath
    };
  } catch (error) {
    console.error('Error generating image:', error);
    return {
      success: false,
      message: `Error generating image: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Create a detailed prompt for image generation based on study content
 * @param title Study title
 * @param abstract Study abstract
 * @param methods Study methods
 * @param category Study category
 * @param focus Study focus
 * @param healthBenefits Health benefits
 * @returns Generated prompt for image creation
 */
async function createImagePrompt(
  title: string, 
  abstract: string, 
  methods: string,
  category: string,
  focus: string,
  healthBenefits: string[]
): Promise<string> {
  // Use AI to generate a more creative prompt based on study content
  try {
    // Prepare context from available study data
    const abstractSummary = abstract.length > 300 ? 
      abstract.substring(0, 300) + '...' : 
      abstract;
    
    // Determine the hydrogen delivery method from the content
    const deliveryMethod = determineHydrogenDeliveryMethod(title + ' ' + abstract + ' ' + methods);
    
    // Use OpenAI to generate a detailed image prompt
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: `You are an expert scientific illustrator specializing in hydrogen health research. 
          Your task is to create detailed, scientifically accurate prompts for generating medical/scientific illustrations.
          Focus on creating prompts that would yield realistic, professional images suitable for scientific publications.
          Do not include text labels in the image description as they will appear distorted.
          Avoid references to specific people, brands, or copyrighted concepts.`
        },
        {
          role: "user",
          content: `Create a detailed prompt for generating a scientific illustration for a hydrogen health study with the following details:
          
          TITLE: ${title}
          
          ABSTRACT: ${abstractSummary}
          
          CATEGORY: ${category}
          
          FOCUS: ${focus}
          
          DELIVERY METHOD: ${deliveryMethod}
          
          HEALTH BENEFITS: ${healthBenefits.join(', ')}
          
          The image should be:
          1. Scientifically accurate and professionally styled
          2. Suitable for a medical or scientific publication
          3. Clear and focused on the hydrogen therapy mechanism
          4. Without any text labels or annotations
          5. In a modern scientific illustration style with a clean background
          
          Provide only the image generation prompt with no additional explanation or commentary.`
        }
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const generatedPrompt = response.choices[0]?.message.content?.trim();
    
    if (!generatedPrompt) {
      // Fallback to a generic prompt if AI generation fails
      const detectedDeliveryMethod = determineHydrogenDeliveryMethod(title + ' ' + abstract + ' ' + methods);
      return createGenericPrompt(title, category, detectedDeliveryMethod);
    }
    
    // Ensure the prompt is suitable for DALL-E by adding some guardrails
    const enhancedPrompt = `Scientific illustration for hydrogen therapy research: ${generatedPrompt}. Create a professional medical illustration in a hyper-realistic style with clean lighting and neutral background. No text or labels.`;
    
    return enhancedPrompt;
  } catch (error) {
    console.error('Error creating image prompt with AI:', error);
    // Fallback to a generic prompt
    const detectedDeliveryMethod = determineHydrogenDeliveryMethod(title + ' ' + abstract + ' ' + methods);
    return createGenericPrompt(title, category, detectedDeliveryMethod);
  }
}

/**
 * Create a generic image prompt if AI-based generation fails
 * @param title Study title
 * @param category Study category
 * @param deliveryMethod Hydrogen delivery method
 * @returns Generic image prompt
 */
function createGenericPrompt(
  title: string,
  category: string,
  deliveryMethod?: string
): string {
  // Format the category for better prompting
  const formattedCategory = category.toLowerCase();

  // Based on delivery method, create appropriate visualization
  let basePrompt = '';
  if (deliveryMethod === 'water') {
    basePrompt = `Scientific illustration of hydrogen-rich water therapy for ${formattedCategory}. Glass of clear water with visible hydrogen molecules, medical setting, photorealistic.`;
  } else if (deliveryMethod === 'inhalation') {
    basePrompt = `Scientific illustration of hydrogen gas inhalation therapy for ${formattedCategory}. Medical-grade inhalation device, visible hydrogen gas, clinical setting, photorealistic.`;
  } else if (deliveryMethod === 'injection') {
    basePrompt = `Scientific illustration of hydrogen-rich saline injection for ${formattedCategory}. Medical syringe with hydrogen-enriched solution, clinical setting, photorealistic.`;
  } else if (deliveryMethod === 'bath') {
    basePrompt = `Scientific illustration of hydrogen-rich water bath therapy for ${formattedCategory}. Therapeutic bath with dissolved hydrogen, medical setting, photorealistic.`;
  } else {
    basePrompt = `Scientific illustration of molecular hydrogen therapy for ${formattedCategory}. Hydrogen molecules interacting with human cells, medical setting, photorealistic.`;
  }

  // Add style guidance for consistent scientific illustration
  return `${basePrompt} Professional medical illustration in hyper-realistic style with clean lighting and neutral background. No text or labels.`;
}

/**
 * Determine the hydrogen delivery method based on study content
 * @param content Combined study content
 * @returns Detected delivery method
 */
function determineHydrogenDeliveryMethod(content: string): string {
  const normalizedContent = content.toLowerCase();
  
  if (normalizedContent.includes('hydrogen water') || 
      normalizedContent.includes('hydrogen-rich water') || 
      normalizedContent.includes('hydrogen enriched water') ||
      normalizedContent.includes('hydrogenated water') ||
      normalizedContent.includes('h2 water')) {
    return 'water';
  }
  
  if (normalizedContent.includes('hydrogen gas') || 
      normalizedContent.includes('h2 gas') || 
      normalizedContent.includes('hydrogen inhalation') ||
      normalizedContent.includes('inhaled hydrogen')) {
    return 'inhalation';
  }
  
  if (normalizedContent.includes('hydrogen injection') || 
      normalizedContent.includes('injected hydrogen') || 
      normalizedContent.includes('hydrogen-rich saline') ||
      normalizedContent.includes('intravenous') ||
      normalizedContent.includes('i.v.')) {
    return 'injection';
  }
  
  if (normalizedContent.includes('hydrogen bath') || 
      normalizedContent.includes('bathing') || 
      normalizedContent.includes('hydrogen spa')) {
    return 'bath';
  }
  
  // Default to most common method if we can't determine
  return 'water';
}

/**
 * Find studies that need images
 * @param limit Maximum number of studies to return
 * @returns Array of study IDs that need images
 */
export async function findStudiesNeedingImages(limit: number = 20): Promise<number[]> {
  try {
    // Find studies that have no images
    const studiesWithoutImages = await db?.select({ id: studiesTable.id })
      .from(studiesTable)
      .where(
        isNull(studiesTable.imageUrl)
      )
      .limit(limit);
      
    if (!studiesWithoutImages || studiesWithoutImages.length === 0) {
      console.log('No studies found that need images');
      return [];
    }
    
    console.log(`Found ${studiesWithoutImages.length} studies that need images`);
    return studiesWithoutImages.map(study => study.id);
  } catch (error) {
    console.error('Error finding studies needing images:', error);
    return [];
  }
}

/**
 * Batch generate images for multiple studies
 * @param limit Maximum number of studies to process
 * @returns Results of batch processing
 */
export async function batchGenerateImagesForStudies(limit: number = 10): Promise<{
  total: number;
  success: number;
  failed: number;
  errors: Array<{studyId: number; error: string}>;
}> {
  const results = {
    total: 0,
    success: 0,
    failed: 0,
    errors: [] as Array<{studyId: number; error: string}>
  };
  
  try {
    // Find studies that need images
    const studyIds = await findStudiesNeedingImages(limit);
    results.total = studyIds.length;
    
    if (studyIds.length === 0) {
      return results;
    }
    
    // Process each study with a delay to avoid rate limits
    for (const studyId of studyIds) {
      try {
        console.log(`Generating image for study ${studyId}...`);
        const result = await generateImageForStudy(studyId);
        
        if (result.success) {
          results.success++;
          console.log(`Successfully generated image for study ${studyId}: ${result.imagePath}`);
        } else {
          results.failed++;
          results.errors.push({
            studyId,
            error: result.message
          });
          console.error(`Failed to generate image for study ${studyId}: ${result.message}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          studyId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.error(`Error generating image for study ${studyId}:`, error);
      }
      
      // Add a delay to avoid rate limits
      console.log('Waiting 10 seconds before processing next study...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    return results;
  } catch (error) {
    console.error('Error in batch image generation:', error);
    return results;
  }
}