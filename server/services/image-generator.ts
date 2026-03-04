/**
 * Image Generator Service for Hydrogen Studies
 *
 * Generates scientific images for studies that don't have any associated media
 * using AI-based image generation technology.
 */
import fs from "fs";
import path from "path";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import { studies as studiesTable, blogArticles } from "../../shared/schema";
import { eq, isNull, or } from "drizzle-orm";
import { ai } from "./ai-provider";
import { logger } from "../utils/logger";

function getOpenAI() {
  const client = ai.getOpenAIClient();
  if (!client) throw new Error("OpenAI API key not configured for image generation");
  return client;
}

/**
 * Generate a scientific image based on text content
 * This function is used for generic image generation based on scientific text
 * @param content Text content to generate an image for
 * @returns Generated image URL
 */
export async function generateScientificImage(
  content: string,
): Promise<{ success: boolean; imageUrl?: string; message?: string }> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        success: false,
        message: "OPENAI_API_KEY not set, unable to generate image",
      };
    }

    // Create a simplified prompt for generic scientific images
    const prompt = `Scientific illustration of ${content}. Professional medical illustration in hyper-realistic style with clean lighting and neutral background. No text or labels.`;

    // Generate the image using DALL-E 3
    const response = await getOpenAI().images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural",
    });

    const imageUrl = response.data?.[0]?.url;

    if (!imageUrl) {
      return {
        success: false,
        message: "Failed to generate image - no URL returned",
      };
    }

    return {
      success: true,
      imageUrl: imageUrl,
    };
  } catch (error) {
    logger.error("Error generating scientific image", error, "ImageGenerator");
    return {
      success: false,
      message: `Error generating image: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Generate an image for a blog article
 * @param blogId ID of the blog to generate an image for
 * @returns Object containing the result of image generation
 */
export async function generateBlogImage(blogId: number): Promise<{
  success: boolean;
  imageUrl?: string;
  message?: string;
}> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        success: false,
        message: "OPENAI_API_KEY not set, unable to generate image",
      };
    }

    // Get the blog data
    const [blog] =
      (await db
        ?.select()
        .from(blogArticles)
        .where(eq(blogArticles.id, blogId))) || [];

    if (!blog) {
      return {
        success: false,
        message: `Blog with ID ${blogId} not found`,
      };
    }

    // Extract relevant information for image generation
    const title = blog.title || "";
    const summary = blog.summary || "";
    const content = blog.content || "";

    // Create a simplified prompt for blog image
    const prompt = `Create a modern, engaging image to represent a blog article titled "${title}" about ${summary}. The image should be appropriate for a health and wellness website focused on hydrogen research. Use a clean, professional style with subtle medical/scientific elements. No text in the image.`;

    // Generate the image using DALL-E 3
    const response = await getOpenAI().images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural",
    });

    const imageUrl = response.data?.[0]?.url;

    if (!imageUrl) {
      return {
        success: false,
        message: "Failed to generate image - no URL returned",
      };
    }

    // Ensure uploads directory exists
    const uploadDir = path.join(process.cwd(), "uploads", "blog-images");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Download the image
    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });
    const imageName = `blog_${blogId}_${uuidv4()}.png`;
    const imagePath = path.join(uploadDir, imageName);

    // Save the image to disk
    fs.writeFileSync(imagePath, imageResponse.data);

    // Get the relative path for storage in the database
    const relativeImagePath = path.join("uploads", "blog-images", imageName);

    // Update the blog record with the new image
    await db
      ?.update(blogArticles)
      .set({
        imageUrl: relativeImagePath,
      })
      .where(eq(blogArticles.id, blogId));

    return {
      success: true,
      imageUrl: relativeImagePath,
    };
  } catch (error) {
    logger.error("Error generating blog image", error, "ImageGenerator");
    return {
      success: false,
      message: `Error generating image: ${error instanceof Error ? error.message : "Unknown error"}`,
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
        message: "OPENAI_API_KEY not set, unable to generate image",
      };
    }

    // Get the study data using only existing columns
    const [study] =
      (await db
        ?.select({
          id: studiesTable.id,
          title: studiesTable.title,
          abstract: studiesTable.abstract,
          methods: studiesTable.methods,
          results: studiesTable.results,
          conclusion: studiesTable.conclusion,
          category: studiesTable.category,
          imageUrl: studiesTable.imageUrl,
          imageAlt: studiesTable.imageAlt,
          autoGeneratedImage: studiesTable.autoGeneratedImage,
        })
        .from(studiesTable)
        .where(eq(studiesTable.id, studyId))) || [];

    if (!study) {
      return {
        success: false,
        message: `Study with ID ${studyId} not found`,
      };
    }

    // Extract relevant information for image generation
    const title = study.title || "";
    const abstract = study.abstract || "";
    const methods = study.methods || "";
    const category = study.category || "";
    // Use category as focus since we don't have a separate focus field
    const focus = category;
    // Default empty array for health benefits
    const healthBenefits: string[] = [];

    // Create a detailed prompt for image generation
    const prompt = await createImagePrompt(
      title,
      abstract,
      methods,
      category,
      focus,
      healthBenefits,
    );

    // Ensure uploads directory exists
    const uploadDir = path.join(process.cwd(), "uploads", "study-images");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate the image using DALL-E 3
    const response = await getOpenAI().images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural",
    });

    // Safely access response data
    const imageUrl = response.data?.[0]?.url;

    if (!imageUrl) {
      return {
        success: false,
        message: "Failed to generate image - no URL returned",
      };
    }

    // Download the image
    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });
    const imageName = `study_${studyId}_${uuidv4()}.png`;
    const imagePath = path.join(uploadDir, imageName);

    // Save the image to disk
    fs.writeFileSync(imagePath, imageResponse.data);

    // Get the relative path for storage in the database - use forward slashes for web URLs
    const relativeImagePath = `/uploads/study-images/${imageName}`;

    // Update the study record with the new image
    await db
      ?.update(studiesTable)
      .set({
        imageUrl: relativeImagePath,
        // Set imageAlt with a descriptive alt text for better SEO
        imageAlt: `Scientific visualization of hydrogen therapy research for ${title}`,
        autoGeneratedImage: true,
      })
      .where(eq(studiesTable.id, studyId));

    return {
      success: true,
      message: "Successfully generated and saved image",
      imageUrl: relativeImagePath,
      imagePath,
    };
  } catch (error) {
    logger.error("Error generating image", error, "ImageGenerator");
    return {
      success: false,
      message: `Error generating image: ${error instanceof Error ? error.message : "Unknown error"}`,
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
  healthBenefits: string[],
): Promise<string> {
  // Use AI to generate a more creative prompt based on study content
  try {
    // Prepare context from available study data
    const abstractSummary =
      abstract.length > 300 ? abstract.substring(0, 300) + "..." : abstract;

    // Determine the hydrogen delivery method from the content
    const deliveryMethod = determineHydrogenDeliveryMethod(
      title + " " + abstract + " " + methods,
    );

    // Use AI to generate a detailed image prompt
    const generatedPrompt = (await ai.generateText(
      `You are an expert scientific illustrator specializing in hydrogen health research.
      Your task is to create detailed, scientifically accurate prompts for generating medical/scientific illustrations.
      Focus on creating prompts that would yield realistic, professional images suitable for scientific publications.
      Do not include text labels in the image description as they will appear distorted.
      Avoid references to specific people, brands, or copyrighted concepts.`,
      `Create a detailed prompt for generating a scientific illustration for a hydrogen health study with the following details:

      TITLE: ${title}

      ABSTRACT: ${abstractSummary}

      CATEGORY: ${category}

      FOCUS: ${focus}

      DELIVERY METHOD: ${deliveryMethod}

      HEALTH BENEFITS: ${healthBenefits.join(", ")}

      The image should be:
      1. Scientifically accurate and professionally styled
      2. Suitable for a medical or scientific publication
      3. Clear and focused on the hydrogen therapy mechanism
      4. Without any text labels or annotations
      5. In a modern scientific illustration style with a clean background

      Provide only the image generation prompt with no additional explanation or commentary.`,
      { maxTokens: 300, temperature: 0.7 },
    ))?.trim();

    if (!generatedPrompt) {
      // Fallback to a generic prompt if AI generation fails
      const detectedDeliveryMethod = determineHydrogenDeliveryMethod(
        title + " " + abstract + " " + methods,
      );
      return createGenericPrompt(title, category, detectedDeliveryMethod);
    }

    // Ensure the prompt is suitable for DALL-E by adding some guardrails
    const enhancedPrompt = `Scientific illustration for hydrogen therapy research: ${generatedPrompt}. Create a professional medical illustration in a hyper-realistic style with clean lighting and neutral background. No text or labels.`;

    return enhancedPrompt;
  } catch (error) {
    logger.error("Error creating image prompt with AI", error, "ImageGenerator");
    // Fallback to a generic prompt
    const detectedDeliveryMethod = determineHydrogenDeliveryMethod(
      title + " " + abstract + " " + methods,
    );
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
  deliveryMethod?: string,
): string {
  // Format the category for better prompting
  const formattedCategory = category.toLowerCase();

  // Based on delivery method, create appropriate visualization
  let basePrompt = "";
  if (deliveryMethod === "water") {
    basePrompt = `Scientific illustration of hydrogen-rich water therapy for ${formattedCategory}. Glass of clear water with visible hydrogen molecules, medical setting, photorealistic.`;
  } else if (deliveryMethod === "inhalation") {
    basePrompt = `Scientific illustration of hydrogen gas inhalation therapy for ${formattedCategory}. Medical-grade inhalation device, visible hydrogen gas, clinical setting, photorealistic.`;
  } else if (deliveryMethod === "injection") {
    basePrompt = `Scientific illustration of hydrogen-rich saline injection for ${formattedCategory}. Medical syringe with hydrogen-enriched solution, clinical setting, photorealistic.`;
  } else if (deliveryMethod === "bath") {
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

  if (
    normalizedContent.includes("hydrogen water") ||
    normalizedContent.includes("hydrogen-rich water") ||
    normalizedContent.includes("hydrogen enriched water") ||
    normalizedContent.includes("hydrogenated water") ||
    normalizedContent.includes("h2 water")
  ) {
    return "water";
  }

  if (
    normalizedContent.includes("hydrogen gas") ||
    normalizedContent.includes("h2 gas") ||
    normalizedContent.includes("hydrogen inhalation") ||
    normalizedContent.includes("inhaled hydrogen")
  ) {
    return "inhalation";
  }

  if (
    normalizedContent.includes("hydrogen injection") ||
    normalizedContent.includes("injected hydrogen") ||
    normalizedContent.includes("hydrogen-rich saline") ||
    normalizedContent.includes("intravenous") ||
    normalizedContent.includes("i.v.")
  ) {
    return "injection";
  }

  if (
    normalizedContent.includes("hydrogen bath") ||
    normalizedContent.includes("bathing") ||
    normalizedContent.includes("hydrogen spa")
  ) {
    return "bath";
  }

  // Default to most common method if we can't determine
  return "water";
}

/**
 * Find studies that need images
 * @param limit Maximum number of studies to return
 * @returns Array of study IDs that need images
 */
export async function findStudiesNeedingImages(
  limit: number = 20,
): Promise<number[]> {
  try {
    // Find studies that have no images (both NULL and empty string values)
    const studiesWithoutImages = await db
      ?.select({ id: studiesTable.id })
      .from(studiesTable)
      .where(or(isNull(studiesTable.imageUrl), eq(studiesTable.imageUrl, "")))
      .limit(limit);

    if (!studiesWithoutImages || studiesWithoutImages.length === 0) {
      logger.info("No studies found that need images", "ImageGenerator");
      return [];
    }

    logger.info("Found studies that need images", "ImageGenerator", { count: studiesWithoutImages.length });
    return studiesWithoutImages.map((study) => study.id);
  } catch (error) {
    logger.error("Error finding studies needing images", error, "ImageGenerator");
    return [];
  }
}

/**
 * Batch generate images for multiple studies
 * @param studyIdsOrLimit Array of study IDs to process, or a number indicating maximum studies to process
 * @returns Results of batch processing
 */
export async function batchGenerateImagesForStudies(
  studyIdsOrLimit: number[] | number = 10,
): Promise<{
  total: number;
  success: number;
  failed: number;
  errors: Array<{ studyId: number; error: string }>;
}> {
  const results = {
    total: 0,
    success: 0,
    failed: 0,
    errors: [] as Array<{ studyId: number; error: string }>,
  };

  try {
    // Determine if we're given an array of study IDs or a limit
    let studyIds: number[];
    if (Array.isArray(studyIdsOrLimit)) {
      studyIds = studyIdsOrLimit;
      logger.info("Processing specified studies", "ImageGenerator", { count: studyIds.length });
    } else {
      // Find studies that need images up to the limit
      studyIds = await findStudiesNeedingImages(studyIdsOrLimit);
      logger.info("Found studies that need images", "ImageGenerator", { count: studyIds.length, limit: studyIdsOrLimit });
    }

    results.total = studyIds.length;

    if (studyIds.length === 0) {
      logger.info("No studies to process for image generation", "ImageGenerator");
      return results;
    }

    // Check if API key is set
    if (!process.env.OPENAI_API_KEY) {
      logger.error("OPENAI_API_KEY not set, batch processing aborted", undefined, "ImageGenerator");
      results.errors.push({
        studyId: 0,
        error: "OPENAI_API_KEY not set in environment variables",
      });
      return results;
    }

    // Process each study with a delay to avoid rate limits
    for (const studyId of studyIds) {
      try {
        logger.info("Generating image for study", "ImageGenerator", { studyId });
        const result = await generateImageForStudy(studyId);

        if (result.success) {
          results.success++;
          logger.info("Successfully generated image for study", "ImageGenerator", { studyId, imagePath: result.imagePath });
        } else {
          results.failed++;
          results.errors.push({
            studyId,
            error: result.message || "Unknown error",
          });
          logger.error("Failed to generate image for study", result.message || "Unknown error", "ImageGenerator", { studyId });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          studyId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        logger.error("Error generating image for study", error, "ImageGenerator", { studyId });
      }

      // Add a delay to avoid rate limits
      if (studyIds.indexOf(studyId) < studyIds.length - 1) {
        logger.debug("Waiting 10 seconds before processing next study", "ImageGenerator");
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }

    logger.info("Batch processing complete", "ImageGenerator", { success: results.success, failed: results.failed });
    return results;
  } catch (error) {
    logger.error("Error in batch image generation", error, "ImageGenerator");
    return results;
  }
}
