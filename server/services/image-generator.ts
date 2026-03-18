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

/**
 * Get the image generation client.
 * Prefers xAI (Grok) if XAI_API_KEY is set, falls back to OpenAI (DALL-E).
 */
function getImageClient(): { client: ReturnType<typeof ai.getXAIClient>; provider: "xai" | "openai" } {
  const xaiClient = ai.getXAIClient();
  if (xaiClient) {
    return { client: xaiClient, provider: "xai" };
  }
  const openaiClient = ai.getOpenAIClient();
  if (openaiClient) {
    return { client: openaiClient, provider: "openai" };
  }
  throw new Error("No image generation API key configured (set XAI_API_KEY or OPENAI_API_KEY)");
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
    if (!process.env.XAI_API_KEY && !process.env.OPENAI_API_KEY) {
      return {
        success: false,
        message: "No image generation API key set (XAI_API_KEY or OPENAI_API_KEY), unable to generate image",
      };
    }

    // Create a simplified prompt for artistic health images
    const prompt = `Beautiful, artistic editorial photo representing ${content}. Simple, clean, modern health magazine style with soft natural lighting. No text, labels, or scientific diagrams.`;

    const { client, provider } = getImageClient();

    // Generate the image using Grok or DALL-E
    const generateParams: any = {
      model: provider === "xai" ? "grok-2-image" : "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      response_format: "url",
    };

    // DALL-E supports style/quality params, xAI does not
    if (provider === "openai") {
      generateParams.quality = "standard";
      generateParams.style = "natural";
    }

    const response = await client!.images.generate(generateParams);

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
    if (!process.env.XAI_API_KEY && !process.env.OPENAI_API_KEY) {
      return {
        success: false,
        message: "No image generation API key set (XAI_API_KEY or OPENAI_API_KEY), unable to generate image",
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

    const { client, provider } = getImageClient();

    // Generate the image using Grok or DALL-E
    const generateParams: any = {
      model: provider === "xai" ? "grok-2-image" : "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      response_format: "url",
    };

    if (provider === "openai") {
      generateParams.quality = "standard";
      generateParams.style = "natural";
    }

    const response = await client!.images.generate(generateParams);

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
    if (!process.env.XAI_API_KEY && !process.env.OPENAI_API_KEY) {
      return {
        success: false,
        message: "No image generation API key set (XAI_API_KEY or OPENAI_API_KEY), unable to generate image",
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

    const { client, provider } = getImageClient();

    // Generate the image using Grok or DALL-E
    const generateParams: any = {
      model: provider === "xai" ? "grok-2-image" : "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      response_format: "url",
    };

    if (provider === "openai") {
      generateParams.quality = "standard";
      generateParams.style = "natural";
    }

    const response = await client!.images.generate(generateParams);

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
      `You are an art director creating simple, beautiful editorial images for a health and wellness website.
      Your images should be artistic and visually appealing, NOT complex scientific diagrams.
      Think editorial photography or clean illustration style — like what you'd see in a modern health magazine.
      Do not include text, labels, molecules, chemical formulas, or complex scientific diagrams.
      Avoid references to specific people, brands, or copyrighted concepts.`,
      `Create a simple, artistic image prompt for a health study about:

      TOPIC: ${title}

      CATEGORY: ${category}

      The image should be:
      1. Simple, clean, and artistic — like editorial health photography
      2. Related to the study topic (e.g., cancer study = artistic cancer ribbon or cells, eye study = close-up of an eye or eye drops, gut health = stomach/digestive imagery)
      3. Beautiful and calming with soft, natural colors
      4. WITHOUT any text, labels, molecules, chemical structures, or complex scientific diagrams
      5. More like a magazine cover photo than a textbook illustration

      Provide only the image generation prompt with no additional explanation.`,
      { maxTokens: 200, temperature: 0.7 },
    ))?.trim();

    if (!generatedPrompt) {
      // Fallback to a generic prompt if AI generation fails
      const detectedDeliveryMethod = determineHydrogenDeliveryMethod(
        title + " " + abstract + " " + methods,
      );
      return createGenericPrompt(title, category, detectedDeliveryMethod);
    }

    // Ensure the prompt is suitable for image generation by adding some guardrails
    const enhancedPrompt = `${generatedPrompt}. Simple, artistic, editorial health photography style. Soft natural lighting. Clean composition. No text, labels, or scientific diagrams.`;

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

  // Create a simple, artistic image prompt based on the study topic
  const basePrompt = `Beautiful, artistic editorial photo representing ${formattedCategory} health and wellness. Simple, clean composition with soft natural lighting.`;

  return `${basePrompt} Modern health magazine style. No text, labels, or scientific diagrams.`;
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

    // Check if an image generation API key is set
    if (!process.env.XAI_API_KEY && !process.env.OPENAI_API_KEY) {
      logger.error("No image generation API key set (XAI_API_KEY or OPENAI_API_KEY), batch processing aborted", undefined, "ImageGenerator");
      results.errors.push({
        studyId: 0,
        error: "No image generation API key set (XAI_API_KEY or OPENAI_API_KEY)",
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
