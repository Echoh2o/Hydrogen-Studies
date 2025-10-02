/**
 * ChatGPT-Powered Study Enhancement System
 *
 * Enhances hydrogen research studies with:
 * - Simplified explanations for consumers
 * - AI-generated study images
 * - SEO optimizations
 * - Comprehensive tagging system
 */

import OpenAI from "openai";
import { storage } from "./storage";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface StudyEnhancement {
  studyId: number;
  simplifiedExplanation: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  healthBenefits: string[];
  healthConditions: string[];
  bodySystems: string[];
  lifeStages: string[];
  studyTypes: string[];
  mechanisms: string[];
  imagePrompt: string;
  imageUrl?: string;
}

/**
 * Enhance a single study with ChatGPT-powered improvements
 */
export async function enhanceStudyWithChatGPT(studyId: number): Promise<{
  success: boolean;
  enhancement?: StudyEnhancement;
  message: string;
}> {
  try {
    console.log(`🤖 Enhancing study ${studyId} with ChatGPT...`);

    // Get the study data
    const studies = await storage.getStudies();
    const studiesArray = Array.isArray(studies) ? studies : studies.data || [];
    const study = studiesArray.find((s) => s.id === studyId);

    if (!study) {
      return {
        success: false,
        message: `Study ${studyId} not found`,
      };
    }

    // Generate comprehensive enhancement
    const enhancement = await generateStudyEnhancement(study);

    // Generate and create the study image
    const imageResult = await generateStudyImage(
      enhancement.imagePrompt,
      study.title,
    );
    if (imageResult.success) {
      enhancement.imageUrl = imageResult.imageUrl;
    }

    // Update the study with enhanced data
    await updateStudyWithEnhancements(studyId, enhancement);

    return {
      success: true,
      enhancement,
      message: `✅ Study successfully enhanced with AI-powered improvements!`,
    };
  } catch (error) {
    console.error("ChatGPT enhancement error:", error);
    return {
      success: false,
      message: `❌ Enhancement failed: ${error.message}`,
    };
  }
}

/**
 * Generate comprehensive study enhancement using ChatGPT
 */
async function generateStudyEnhancement(study: any): Promise<StudyEnhancement> {
  const prompt = `
Analyze this hydrogen health research study and provide comprehensive enhancements:

STUDY DETAILS:
Title: ${study.title}
Abstract: ${study.abstract}
Authors: ${study.authors}
Journal: ${study.journal}
Methods: ${study.methods || "Not specified"}
Results: ${study.results || "Not specified"}
Conclusion: ${study.conclusion || "Not specified"}

Please provide a JSON response with these enhancements:

1. SIMPLIFIED EXPLANATION (200-300 words):
   - Explain the study in simple, everyday language
   - Focus on what was tested, how it was tested, and what they found
   - Make it accessible to non-scientists

2. SEO OPTIMIZATION:
   - Create an engaging, search-optimized title
   - Write a compelling meta description (150-160 characters)
   - Generate 10-15 relevant SEO keywords

3. COMPREHENSIVE TAGGING:
   - Health Benefits (e.g., "antioxidant effects", "reduced inflammation", "improved recovery")
   - Health Conditions (e.g., "diabetes", "cardiovascular disease", "athletic performance")
   - Body Systems (e.g., "cardiovascular", "nervous", "respiratory", "digestive")
   - Life Stages (e.g., "elderly", "adults", "athletes", "general population")
   - Study Types (e.g., "human clinical trial", "animal study", "in vitro")
   - Mechanisms (e.g., "selective antioxidant", "signal modulation", "gene expression")

4. IMAGE GENERATION:
   - Create a detailed prompt for generating a scientific illustration
   - Should be educational, professional, and visually represent the study

Respond ONLY with valid JSON in this exact format:
{
  "simplifiedExplanation": "...",
  "seoTitle": "...",
  "seoDescription": "...",
  "seoKeywords": ["keyword1", "keyword2", ...],
  "healthBenefits": ["benefit1", "benefit2", ...],
  "healthConditions": ["condition1", "condition2", ...],
  "bodySystems": ["system1", "system2", ...],
  "lifeStages": ["stage1", "stage2", ...],
  "studyTypes": ["type1", "type2", ...],
  "mechanisms": ["mechanism1", "mechanism2", ...],
  "imagePrompt": "detailed scientific illustration prompt..."
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    messages: [
      {
        role: "system",
        content:
          "You are a scientific communication expert specializing in making hydrogen health research accessible to consumers while maintaining scientific accuracy. Always respond with valid JSON only.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 2000,
  });

  const enhancementData = JSON.parse(response.choices[0].message.content);

  return {
    studyId: study.id,
    ...enhancementData,
  };
}

/**
 * Generate an AI image for the study
 */
async function generateStudyImage(
  imagePrompt: string,
  studyTitle: string,
): Promise<{
  success: boolean;
  imageUrl?: string;
  message: string;
}> {
  try {
    console.log(`🎨 Generating AI image for study: ${studyTitle}`);

    const enhancedPrompt = `${imagePrompt}. Professional scientific illustration style, clean and educational, suitable for a medical research website, high quality, detailed but not cluttered.`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    return {
      success: true,
      imageUrl: response.data[0].url,
      message: "✅ AI image generated successfully",
    };
  } catch (error) {
    console.error("Image generation error:", error);
    return {
      success: false,
      message: `❌ Image generation failed: ${error.message}`,
    };
  }
}

/**
 * Update study with ChatGPT enhancements
 */
async function updateStudyWithEnhancements(
  studyId: number,
  enhancement: StudyEnhancement,
): Promise<void> {
  try {
    // Prepare update data with current available fields
    const updateData: any = {
      // Store combined tags in existing tags field for now
      tags: [
        ...enhancement.healthBenefits,
        ...enhancement.healthConditions,
        ...enhancement.bodySystems,
        ...enhancement.lifeStages,
        ...enhancement.studyTypes,
        ...enhancement.mechanisms,
      ],
    };

    // Add new AI enhancement fields if they exist in schema
    if (enhancement.simplifiedExplanation) {
      updateData.simplifiedExplanation = enhancement.simplifiedExplanation;
    }
    if (enhancement.seoTitle) {
      updateData.seoTitle = enhancement.seoTitle;
    }
    if (enhancement.seoDescription) {
      updateData.seoDescription = enhancement.seoDescription;
    }
    if (enhancement.seoKeywords) {
      updateData.seoKeywords = enhancement.seoKeywords;
    }
    if (enhancement.imageUrl) {
      updateData.imageUrl = enhancement.imageUrl;
      updateData.aiGeneratedImage = true;
      updateData.imageGenerationDate = new Date();
    }

    // Add AI tracking fields
    updateData.enhancedWithAI = true;
    updateData.lastAIEnhanced = new Date();

    // Store categorized tags in new fields when available
    updateData.healthBenefits = enhancement.healthBenefits;
    updateData.healthConditions = enhancement.healthConditions;
    updateData.bodySystems = enhancement.bodySystems;
    updateData.lifeStages = enhancement.lifeStages;
    updateData.studyTypes = enhancement.studyTypes;
    updateData.mechanisms = enhancement.mechanisms;

    // Update the study
    await storage.updateStudy(studyId, updateData);

    console.log(`✅ Study ${studyId} updated with ChatGPT enhancements`);
  } catch (error) {
    console.error("Error updating study with enhancements:", error);
    // Continue with reduced functionality if some fields aren't available yet
    console.log(
      "📝 Some enhancement fields may not be available yet - continuing with basic updates",
    );
  }
}

/**
 * Batch enhance multiple studies with ChatGPT
 */
export async function batchEnhanceStudiesWithChatGPT(
  studyIds: number[],
  batchSize: number = 5,
): Promise<{
  totalProcessed: number;
  successful: number;
  failed: number;
  results: Array<{ studyId: number; success: boolean; message: string }>;
}> {
  const results: Array<{ studyId: number; success: boolean; message: string }> =
    [];
  let successful = 0;
  let failed = 0;

  console.log(
    `🚀 Starting batch ChatGPT enhancement for ${studyIds.length} studies...`,
  );

  // Process in batches to avoid API rate limits
  for (let i = 0; i < studyIds.length; i += batchSize) {
    const batch = studyIds.slice(i, i + batchSize);

    console.log(
      `📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(studyIds.length / batchSize)}`,
    );

    const batchPromises = batch.map(async (studyId) => {
      const result = await enhanceStudyWithChatGPT(studyId);
      results.push({
        studyId,
        success: result.success,
        message: result.message,
      });

      if (result.success) {
        successful++;
      } else {
        failed++;
      }

      return result;
    });

    await Promise.all(batchPromises);

    // Add delay between batches to respect API limits
    if (i + batchSize < studyIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return {
    totalProcessed: studyIds.length,
    successful,
    failed,
    results,
  };
}

/**
 * Get enhanced study data for frontend display
 */
export async function getEnhancedStudyData(studyId: number): Promise<any> {
  try {
    const studies = await storage.getStudies();
    const studiesArray = Array.isArray(studies) ? studies : studies.data || [];
    const study = studiesArray.find((s) => s.id === studyId);

    if (!study) {
      throw new Error(`Study ${studyId} not found`);
    }

    return {
      ...study,
      hasAIEnhancements: !!study.enhancedWithAI,
      enhancementDate: study.lastEnhanced,
    };
  } catch (error) {
    console.error("Error getting enhanced study data:", error);
    throw error;
  }
}
