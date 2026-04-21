/**
 * Image Generator Service for Hydrogen Studies
 *
 * Generates scientific images for studies that don't have any associated media
 * using AI-based image generation technology.
 *
 * Images are uploaded to S3-compatible cloud storage when configured,
 * falling back to local filesystem otherwise.
 */
import fs from "fs";
import path from "path";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import { studies as studiesTable, blogArticles } from "../../shared/schema";
import { eq, isNull, or } from "drizzle-orm";
import { ai, getImageModel } from "./ai-provider";
import { logger } from "../utils/logger";
import { uploadFile, isCloudStorageConfigured } from "../utils/storage";

/**
 * Extract the generated image as a Buffer, whichever response shape the
 * provider returned. OpenAI gives us a `url` when we ask for one; xAI's
 * grok-imagine-image returns `b64_json` inline (no `url` field). Some
 * providers also return `url` without being asked.
 */
async function extractImageBuffer(response: any): Promise<Buffer | null> {
  const item = response?.data?.[0];
  if (!item) return null;
  if (typeof item.url === "string" && item.url) {
    const imageResponse = await axios.get(item.url, {
      responseType: "arraybuffer",
      timeout: 30_000,
      maxContentLength: 20 * 1024 * 1024,
    });
    return Buffer.from(imageResponse.data);
  }
  if (typeof item.b64_json === "string" && item.b64_json) {
    return Buffer.from(item.b64_json, "base64");
  }
  return null;
}

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
    // xAI's grok-imagine-image doesn't support `size`, `response_format`,
    // `quality`, or `style` — only DALL-E does. Keep the xAI request minimal.
    const generateParams: any = {
      model: getImageModel(provider),
      prompt: prompt,
      n: 1,
    };

    if (provider === "openai") {
      generateParams.size = "1024x1024";
      generateParams.response_format = "url";
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
    // xAI's grok-imagine-image doesn't support `size`, `response_format`,
    // `quality`, or `style` — only DALL-E does. Keep the xAI request minimal.
    const generateParams: any = {
      model: getImageModel(provider),
      prompt: prompt,
      n: 1,
    };

    if (provider === "openai") {
      generateParams.size = "1024x1024";
      generateParams.response_format = "url";
      generateParams.quality = "standard";
      generateParams.style = "natural";
    }

    const response = await client!.images.generate(generateParams);

    const imageBuffer = await extractImageBuffer(response);

    if (!imageBuffer) {
      return {
        success: false,
        message: "Failed to generate image — provider returned no url or b64_json",
      };
    }

    const imageName = `blog_${blogId}_${uuidv4()}.png`;
    const storageKey = `blog-images/${imageName}`;

    // Upload via storage utility (cloud or local fallback)
    const storedUrl = await uploadFile(imageBuffer, storageKey, "image/png");

    // Update the blog record with the new image
    await db
      ?.update(blogArticles)
      .set({
        imageUrl: storedUrl,
      })
      .where(eq(blogArticles.id, blogId));

    return {
      success: true,
      imageUrl: storedUrl,
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
    // Prefer TLDR/plain summary over raw abstract for better visual cues
    const title = study.title || "";
    const category = study.category || "";

    // Fetch TLDR for richer, more human-readable image context
    let plainText = "";
    try {
      const [fullStudy] = await db!.select({ tldr: studiesTable.tldr, plainSummary: studiesTable.plainSummary })
        .from(studiesTable).where(eq(studiesTable.id, studyId)).limit(1);
      plainText = fullStudy?.tldr || fullStudy?.plainSummary || "";
    } catch { /* non-fatal */ }

    const abstract = plainText || study.abstract || "";
    const methods = study.methods || "";
    const focus = category;
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

    const { client, provider } = getImageClient();

    // Generate the image using Grok or DALL-E
    // xAI's grok-imagine-image doesn't support `size`, `response_format`,
    // `quality`, or `style` — only DALL-E does. Keep the xAI request minimal.
    const generateParams: any = {
      model: getImageModel(provider),
      prompt: prompt,
      n: 1,
    };

    if (provider === "openai") {
      generateParams.size = "1024x1024";
      generateParams.response_format = "url";
      generateParams.quality = "standard";
      generateParams.style = "natural";
    }

    const response = await client!.images.generate(generateParams);

    const imageBuffer = await extractImageBuffer(response);

    if (!imageBuffer) {
      return {
        success: false,
        message: "Failed to generate image — provider returned no url or b64_json",
      };
    }

    const imageName = `study_${studyId}_${uuidv4()}.png`;
    const storageKey = `study-images/${imageName}`;

    // Upload via storage utility (cloud or local fallback)
    const storedUrl = await uploadFile(imageBuffer, storageKey, "image/png");

    // Update the study record with the new image
    await db
      ?.update(studiesTable)
      .set({
        imageUrl: storedUrl,
        // Set imageAlt with a descriptive alt text for better SEO
        imageAlt: `Scientific visualization of hydrogen therapy research for ${title}`,
        autoGeneratedImage: true,
      })
      .where(eq(studiesTable.id, studyId));

    return {
      success: true,
      message: "Successfully generated and saved image",
      imageUrl: storedUrl,
      imagePath: storedUrl,
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
  // Extract study-specific visual cues from the title and abstract
  const text = `${title} ${abstract}`.toLowerCase();
  const deliveryMethod = determineHydrogenDeliveryMethod(title + " " + abstract + " " + methods);

  // Detect the specific subject matter for unique imagery
  const subjectVisual = detectSubjectVisual(text);

  // Detect the delivery method visual
  const deliveryVisual = deliveryMethod === "inhalation"
    ? "hydrogen gas inhalation therapy equipment"
    : deliveryMethod === "injection"
      ? "medical saline IV setup in clinical setting"
      : deliveryMethod === "bath"
        ? "therapeutic hydrogen spa bath"
        : "clear glass of hydrogen-rich water with tiny bubbles";

  // Extract 2-3 specific terms from the title for uniqueness
  const specificTerms = title
    .replace(/[^a-zA-Z\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 5 && !["study", "effect", "effects", "hydrogen", "molecular", "research", "treatment", "therapy", "induced", "against"].includes(w.toLowerCase()))
    .slice(0, 3)
    .join(", ");

  // Build a unique prompt that combines subject + delivery + study specifics
  const prompt = [
    `Editorial health magazine photograph.`,
    subjectVisual,
    specificTerms ? `Visual elements related to: ${specificTerms}.` : "",
    `Subtle reference to ${deliveryVisual}.`,
    `Category: ${category.toLowerCase()} health.`,
    `Modern, clean composition. Soft natural lighting. Warm, hopeful mood.`,
    `Photorealistic editorial style — NOT a diagram, NOT a textbook illustration.`,
    `No text, no labels, no chemical formulas, no molecules, no watermarks.`,
  ].filter(Boolean).join(" ");

  return prompt;
}

/**
 * Detect specific visual subject matter from study content.
 * Returns a detailed visual description unique to the study topic.
 */
function detectSubjectVisual(text: string): string {
  // Specific conditions/topics (checked first for more precise matching)
  if (text.includes("parkinson")) return "Elderly person walking confidently in a sunlit garden, movement and vitality.";
  if (text.includes("alzheimer") || text.includes("dementia")) return "Warm scene of person doing a puzzle or reading, cognitive clarity.";
  if (text.includes("diabetes") || text.includes("glucose") || text.includes("insulin")) return "Fresh colorful meal prep with a glucose monitor nearby, metabolic wellness.";
  if (text.includes("arthritis") || text.includes("joint")) return "Person stretching outdoors at sunrise, joint mobility and comfort.";
  if (text.includes("sepsis")) return "ICU recovery scene with warm morning light, medical hope.";
  if (text.includes("wound") || text.includes("burn") || text.includes("skin injury")) return "Clean wound care in modern clinical setting, healing process.";
  if (text.includes("retina") || text.includes("eye") || text.includes("vision") || text.includes("cornea")) return "Macro close-up of a healthy human eye with natural lighting, vibrant iris detail.";
  if (text.includes("hearing") || text.includes("ear") || text.includes("cochlea") || text.includes("auditory")) return "Person enjoying music in peaceful setting, auditory wellness.";
  if (text.includes("pregnancy") || text.includes("fetal") || text.includes("maternal")) return "Serene pregnant woman in natural light, maternal wellness.";
  if (text.includes("exercise") || text.includes("athletic") || text.includes("sport") || text.includes("fatigue")) return "Athlete recovering after workout, drinking water, fitness recovery.";
  if (text.includes("obesity") || text.includes("weight") || text.includes("fat diet")) return "Active person on morning walk in nature, healthy lifestyle.";
  if (text.includes("sleep") || text.includes("circadian")) return "Peaceful bedroom scene with soft morning light, restful sleep.";
  if (text.includes("anxiety") || text.includes("stress") || text.includes("depress")) return "Person meditating by water, calm and mental clarity.";
  if (text.includes("asthma") || text.includes("copd") || text.includes("airway")) return "Person breathing freely outdoors in clean mountain air, respiratory freedom.";
  if (text.includes("cancer") || text.includes("tumor")) return "Hopeful medical scene with warm sunlight through hospital window, cancer care.";
  if (text.includes("colitis") || text.includes("ibd") || text.includes("bowel")) return "Colorful probiotic foods and healthy gut illustration, digestive wellness.";
  if (text.includes("periodont") || text.includes("dental") || text.includes("oral")) return "Bright confident smile, modern dental wellness.";
  if (text.includes("osteoporosis") || text.includes("bone density") || text.includes("fracture")) return "Active older person doing tai chi, bone strength and balance.";
  if (text.includes("ischemia") || text.includes("stroke") || text.includes("cerebral")) return "Brain health visualization with warm colors, neuroprotection.";
  if (text.includes("myocard") || text.includes("cardiac") || text.includes("heart attack")) return "Anatomical heart illustration in modern art style, cardiac resilience.";
  if (text.includes("kidney") || text.includes("renal") || text.includes("nephro")) return "Abstract kidney illustration in watercolor style, renal health.";
  if (text.includes("liver") || text.includes("hepat") || text.includes("cirrhosis")) return "Liver health visualization with clean medical illustration style.";
  if (text.includes("lung") || text.includes("pulmonary") || text.includes("respiratory")) return "Healthy lungs breathing clean air, respiratory vitality illustration.";
  if (text.includes("skin") || text.includes("dermat") || text.includes("wrinkle") || text.includes("aging")) return "Radiant healthy skin in natural light, skincare and rejuvenation.";
  if (text.includes("cholesterol") || text.includes("lipid") || text.includes("atherosclerosis")) return "Heart-healthy Mediterranean meal arrangement, cardiovascular nutrition.";
  if (text.includes("microbiome") || text.includes("gut bacteria") || text.includes("flora")) return "Colorful artistic microbiome illustration, beneficial bacteria.";
  if (text.includes("radiation") || text.includes("radiotherapy")) return "Modern radiotherapy room with hopeful lighting, radiation protection.";
  if (text.includes("neonatal") || text.includes("newborn") || text.includes("infant")) return "Tender newborn care scene in soft pastel light, neonatal health.";

  // Body system fallbacks
  if (text.includes("brain") || text.includes("neuro") || text.includes("cognitive")) return "Artistic brain visualization with neural pathways in warm colors.";
  if (text.includes("heart") || text.includes("cardiovascular") || text.includes("blood pressure")) return "Modern heart health illustration with clean editorial style.";
  if (text.includes("intestin") || text.includes("gut") || text.includes("digest")) return "Colorful digestive wellness illustration, gut health.";
  if (text.includes("muscle") || text.includes("skeletal")) return "Athletic person stretching, muscular health and recovery.";
  if (text.includes("immune") || text.includes("inflamma")) return "Abstract immune system shield visualization, body defense.";
  if (text.includes("blood") || text.includes("hematol")) return "Artistic blood cell illustration in warm tones, circulatory health.";

  // Generic fallback — still unique per study via the specificTerms in the parent function
  return "Person drinking a glass of clear water in a bright modern wellness space.";
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
    // Find studies that have no real images (NULL, empty, placeholder, or fallback SVG)
    const { sql } = await import("drizzle-orm");
    const studiesWithoutImages = await db
      ?.select({ id: studiesTable.id })
      .from(studiesTable)
      .where(or(
        isNull(studiesTable.imageUrl),
        eq(studiesTable.imageUrl, ""),
        sql`${studiesTable.imageUrl} LIKE '%placehold%'`,
        sql`${studiesTable.imageUrl} LIKE '%fallback%'`,
      ))
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
