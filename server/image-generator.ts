import OpenAI from "openai";
import fs from "fs";
import path from "path";
import axios from "axios";
import { fileURLToPath } from 'url';
import { Study } from "@shared/schema";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate a scientific image based on study content
 * @param study Study object to generate image for
 * @returns Object containing image URL and alt text
 */
export async function generateScientificImage(study: Study): Promise<{ imageUrl: string, imageAlt: string }> {
  try {
    // Extract keywords from study
    const keywords = extractKeywords(study);
    
    // Generate prompt for image creation
    const prompt = generateImagePrompt(study, keywords);
    
    // Create image using DALL-E
    const response = await openai.images.generate({
      model: "dall-e-3", // the newest model
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });
    
    // Get image URL
    const imageUrl = response.data?.[0]?.url;
    
    if (!imageUrl) {
      throw new Error("Failed to generate image: No URL returned from API");
    }
    
    // Download and save the image
    const savedImagePath = await downloadAndSaveImage(imageUrl, study.id);
    
    // Generate alt text
    const imageAlt = generateImageAltText(study, keywords);
    
    return {
      imageUrl: savedImagePath,
      imageAlt
    };
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
}

/**
 * Extract relevant keywords from study content
 */
function extractKeywords(study: Study): string[] {
  // Extract words from title and abstract
  const text = `${study.title} ${study.abstract}`;
  
  // Remove common words, keep scientific terms
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => 
      word.length > 4 && 
      !['the', 'this', 'that', 'with', 'from', 'study', 'research'].includes(word)
    );
  
  // Get unique words
  const uniqueWords = [...new Set(words)];
  
  // Include hydrogen in keywords
  const keywords = uniqueWords.slice(0, 10);
  if (!keywords.includes('hydrogen')) {
    keywords.push('hydrogen');
  }
  
  return keywords;
}

/**
 * Generate a prompt for DALL-E image creation
 */
function generateImagePrompt(study: Study, keywords: string[]): string {
  // Base scientific visualization style
  const basePrompt = "Create a scientific visualization for a research study";
  
  // Add study context
  const context = `about ${study.title.substring(0, 50)}...`;
  
  // Add scientific visualization elements
  const elements = [
    "modern scientific visualization",
    "hydrogen molecules",
    "abstract science background",
    "research diagram",
    "molecular structure",
    "scientific data visualization",
    "clean white laboratory setting"
  ];
  
  // Select random elements to make each image unique
  const selectedElements = elements
    .sort(() => 0.5 - Math.random())
    .slice(0, 3)
    .join(", ");
  
  // Add keywords to make image relevant to the study
  const keywordString = keywords.join(", ");
  
  // Create final prompt
  return `${basePrompt} ${context}. The image should include ${selectedElements} and visually represent concepts like ${keywordString}. Make it look professional, scientific, and suitable for a medical or scientific journal. The style should be clean, modern, and use a color palette that includes blues and whites with hydrogen-themed accents. Avoid text in the image. Make it abstract enough to be broadly applicable to hydrogen research.`;
}

/**
 * Generate alt text for the image
 */
function generateImageAltText(study: Study, keywords: string[]): string {
  const categoryText = study.category ? `related to ${study.category}` : '';
  const keywordText = keywords.slice(0, 5).join(", ");
  
  return `Scientific visualization for research study "${study.title}" ${categoryText} showing concepts of ${keywordText}`;
}

/**
 * Download and save an image from a URL
 */
async function downloadAndSaveImage(imageUrl: string, studyId: number): Promise<string> {
  try {
    // Create directory if it doesn't exist
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // Download image
    const response = await axios({
      url: imageUrl,
      method: 'GET',
      responseType: 'stream'
    });
    
    // Create filename and path
    const timestamp = Date.now();
    const filename = `study-${studyId}-${timestamp}.png`;
    const filepath = path.join(uploadDir, filename);
    
    // Save the image
    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);
    
    // Return the relative path to the image
    return `/uploads/${filename}`;
  } catch (error) {
    console.error('Error downloading and saving image:', error);
    throw error;
  }
}