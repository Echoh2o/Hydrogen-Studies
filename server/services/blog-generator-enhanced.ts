/**
 * Enhanced Blog Generator with comprehensive error handling
 * Demonstrates best practices for OpenAI API error handling
 */

import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import axios from "axios";
import slugify from "slugify";
import { Study, InsertBlogArticle, blogArticles } from "@shared/schema";
import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import {
  handleOpenAIRequest,
  handleBatchOperation,
  withTimeout,
} from "../utils/service-error-handlers";
import { AppError, ErrorCode } from "../utils/app-errors";
import { withRetry } from "../utils/database-wrapper";
import { ai, getImageModel } from "./ai-provider";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 3-article strategy: each study gets exactly 3 articles with distinct search intents
// 1. science_explainer  — Informational intent: ranks for "[condition] + hydrogen" queries
// 2. practical_guide    — Commercial intent: connects research to Echo Water products
// 3. faq                — Featured snippet intent: captures Q&A searches, builds trust
const BLOG_TYPES = [
  "science_explainer",
  "practical_guide",
  "faq",
];

/**
 * Generate multiple blog articles for a study with comprehensive error handling
 */
export async function generateBlogArticlesForStudy(
  study: Study,
  options: {
    count?: number;
    includeAllTypes?: boolean;
    fallbackToBasic?: boolean;
  } = {},
): Promise<{
  articles: InsertBlogArticle[];
  errors: Array<{ type: string; error: string }>;
  warnings: string[];
}> {
  const results = {
    articles: [] as InsertBlogArticle[],
    errors: [] as Array<{ type: string; error: string }>,
    warnings: [] as string[],
  };

  try {
    // Validate input
    if (!study || !study.id) {
      throw new AppError(
        "Invalid study data provided",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const count = Math.min(options.count || 3, BLOG_TYPES.length);
    const fallbackToBasic = options.fallbackToBasic ?? true;

    // Check AI provider availability
    const providerStatus = ai.getProviderStatus();
    if (providerStatus.primary === "none") {
      if (fallbackToBasic) {
        results.warnings.push(
          "No AI provider available, generating basic articles",
        );
        const basicArticle = generateBasicArticle(study);
        results.articles.push(basicArticle);
        return results;
      }
      throw new AppError(
        "No AI provider configured",
        503,
        ErrorCode.SERVICE_UNAVAILABLE,
      );
    }

    // Always generate all 3 strategic article types (or fewer if count is specified)
    const selectedTypes = BLOG_TYPES.slice(0, count);

    // Generate articles with batch error handling
    const batchResults = await handleBatchOperation(
      selectedTypes,
      async (type) => {
        return await withTimeout(
          () => generateSingleBlogArticle(study, type),
          45000, // 45 second timeout per article
          `Article generation timeout for type: ${type}`,
        );
      },
      { continueOnError: true, maxConcurrent: 2 },
    );

    results.articles = batchResults.successful;

    // Process failures
    for (const failure of batchResults.failed) {
      results.errors.push({
        type: failure.item,
        error: failure.error,
      });

      // Generate fallback for failed articles if enabled
      if (fallbackToBasic) {
        const fallback = generateBasicArticle(study, failure.item);
        results.articles.push(fallback);
        results.warnings.push(
          `Generated fallback article for type: ${failure.item}`,
        );
      }
    }

    // Log summary
    console.log(
      `Blog generation complete: ${results.articles.length} articles, ${results.errors.length} errors`,
    );

    return results;
  } catch (error) {
    console.error("Fatal error generating blog articles:", error);

    // Return at least one basic article on fatal error
    if (options.fallbackToBasic) {
      const basicArticle = generateBasicArticle(study);
      results.articles.push(basicArticle);
      results.errors.push({
        type: "general",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } else {
      throw error;
    }

    return results;
  }
}

/**
 * Generate a single blog article with error handling
 */
async function generateSingleBlogArticle(
  study: Study,
  articleType: string,
): Promise<InsertBlogArticle> {
  try {
    // Check for duplicate: skip if an article with this studyId + articleType already exists
    const [existing] = await db
      .select({ id: blogArticles.id })
      .from(blogArticles)
      .where(
        and(
          eq(blogArticles.studyId, study.id),
          eq(blogArticles.articleType, articleType),
        ),
      )
      .limit(1);

    if (existing) {
      throw new AppError(
        `Article already exists for study ${study.id} with type ${articleType} (article #${existing.id})`,
        409,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // 1. Generate content with fallback
    const blogContent = await handleOpenAIRequest(
      () => generateArticleContent(study, articleType),
      generateFallbackContent(study, articleType),
      {
        model: "claude-sonnet",
        prompt: `Generate ${articleType} article for study ${study.id}`,
      },
    );

    // 2. Generate title with fallback
    const blogTitle = await handleOpenAIRequest(
      () => generateArticleTitle(study, articleType, blogContent.summary),
      generateFallbackTitle(study, articleType),
      { model: "claude-sonnet", prompt: "Generate article title" },
    );

    // 3. Generate unique slug
    const baseSlug = slugify(blogTitle, { lower: true, strict: true });
    const timestamp = Date.now().toString().slice(-6);
    const slug = `${baseSlug}-${timestamp}`;

    // 4. Generate image with fallback
    const imageData = await generateArticleImageWithFallback(
      study,
      blogTitle,
      articleType,
    );

    // Create article object with full SEO fields
    const article: InsertBlogArticle = {
      title: blogTitle,
      slug,
      studyId: study.id,
      content: blogContent.fullContent,
      summary: blogContent.summary,
      imageUrl: imageData.imageUrl,
      imageAlt: imageData.imageUrl ? `Illustration for: ${blogTitle.substring(0, 110)}` : imageData.imageAlt,
      isPublished: true,
      articleType,
      metaDescription: blogContent.summary.substring(0, 160),
      semanticKeywords: extractKeywords(study, blogContent.summary),
      editorNotes:
        "AI-generated content with error handling. Review before publishing.",
      canonicalUrl: `https://hydrogenstudies.com/blog/${slug}`,
      ogTitle: blogTitle,
      ogDescription: blogContent.summary.substring(0, 200),
      ogImage: imageData.imageUrl || null,
      twitterCard: imageData.imageUrl ? "summary_large_image" : "summary",
      twitterTitle: blogTitle,
      twitterDescription: blogContent.summary.substring(0, 200),
      breadcrumbs: JSON.stringify([
        { name: "Home", url: "/" },
        { name: "Blog", url: "/blog" },
        { name: blogTitle, url: `/blog/${slug}` },
      ]),
      lastReviewed: new Date(),
    };

    // Save to database with retry logic
    await withRetry(
      async () => {
        await db.insert(blogArticles).values(article);
      },
      { maxRetries: 2, retryDelay: 1000 },
    );

    // Generate internal links for the new blog post and its source study
    try {
      const { generateBlogLinks, generateStudyLinks, saveLinks } = await import("./internal-linking-engine");
      // Get the newly inserted blog's ID
      const [inserted] = await db.select({ id: blogArticles.id })
        .from(blogArticles)
        .where(eq(blogArticles.studyId, study.id))
        .orderBy(desc(blogArticles.id))
        .limit(1);
      if (inserted) {
        const blogLinks = await generateBlogLinks(inserted.id);
        const studyLinks = await generateStudyLinks(study.id);
        const saved = await saveLinks([...blogLinks, ...studyLinks]);
        console.log(`[Blog Generator] Created ${saved} internal links for blog ${inserted.id}`);
      }
    } catch (linkError) {
      // Non-fatal: don't fail blog generation if linking fails
      console.warn("[Blog Generator] Internal linking failed:", linkError);
    }

    return article;
  } catch (error) {
    console.error(`Failed to generate ${articleType} article:`, error);

    // Throw enhanced error with context
    throw new AppError(
      `Blog generation failed for ${articleType}`,
      500,
      ErrorCode.INTERNAL_SERVER_ERROR,
      true,
      { studyId: study.id, articleType },
      error as Error,
    );
  }
}

/**
 * Generate article content using OpenAI
 */
async function generateArticleContent(
  study: Study,
  articleType: string,
): Promise<{ fullContent: string; summary: string }> {
  const prompt = createContentPrompt(study, articleType);

  const content = await ai.generateText(
    "You are a science writer for HydrogenStudies.com, the research arm of Echo Water (echowater.com). You translate peer-reviewed hydrogen research into clear, trustworthy content that helps people understand the science behind molecular hydrogen (H2) therapy. Write at a 6th grade reading level (Flesch-Kincaid 60-70). Use short sentences and simple words. Always explain scientific terms. Be accurate — never overstate findings. Distinguish between human trials and animal/in-vitro studies. Include specific numbers from studies when available.",
    prompt,
    { maxTokens: 2000, temperature: 0.7 },
  );

  if (!content) {
    throw new AppError(
      "Empty response from AI provider",
      500,
      ErrorCode.EXTERNAL_API_ERROR,
    );
  }

  // Generate a proper meta-description-style summary via AI
  let summary: string;
  try {
    const generatedSummary = await ai.generateText(
      "Write a meta description for a blog post. Rules: 140-155 characters, include 'hydrogen' and the topic keyword naturally, plain language a 6th grader can understand, convey a clear benefit or finding, end with a hook. Respond with ONLY the description.",
      `Summarize this blog post in one sentence:\n\nTopic: ${study.category || "health"}\n\n${content.substring(0, 800)}`,
      { maxTokens: 60, temperature: 0.6 },
    );
    summary = generatedSummary?.trim() || content.split("\n\n")[0]?.substring(0, 300) || content.substring(0, 300);
  } catch {
    // Fallback: use first paragraph
    const paragraphs = content.split("\n\n");
    summary = paragraphs[0] || content.substring(0, 300);
  }

  return {
    fullContent: content,
    summary: summary.substring(0, 300),
  };
}

/**
 * Generate article title using OpenAI
 */
async function generateArticleTitle(
  study: Study,
  articleType: string,
  summary: string,
): Promise<string> {
  const category = study.category || "health";

  // Map study categories (body-part-based from the spreadsheet) to target SEO keywords
  const seoKeywords: Record<string, string> = {
    "whole body": "hydrogen water health benefits",
    brain: "hydrogen water brain health",
    lung: "hydrogen therapy lung health",
    heart: "hydrogen water heart health",
    intestine: "hydrogen water gut health",
    liver: "hydrogen water liver health",
    skin: "hydrogen water skin benefits",
    kidney: "hydrogen water kidney health",
    bone: "hydrogen therapy bone health",
    eye: "hydrogen water eye health",
    mouth: "hydrogen water oral health",
    pregnancy: "hydrogen water pregnancy safety",
    ear: "hydrogen therapy hearing health",
    muscle: "hydrogen water muscle recovery",
    blood: "hydrogen water blood health",
    cancer: "hydrogen therapy cancer research",
    diabetes: "hydrogen water diabetes",
    exercise: "hydrogen water athletic performance",
    inflammation: "hydrogen water inflammation",
    aging: "hydrogen water anti-aging",
  };
  const targetKeyword = seoKeywords[category.toLowerCase()] || `hydrogen water ${category.toLowerCase()}`;

  const typeHint: Record<string, string> = {
    science_explainer: "Focus on the research finding. Pattern: 'Hydrogen Water and [Condition]: What [Year] Research Shows'",
    practical_guide: "Focus on application. Pattern: 'How to Use Hydrogen Water for [Benefit]: A Science-Backed Guide'",
    faq: "Focus on questions people ask. Pattern: 'Hydrogen Water for [Condition]: Your Questions Answered'",
  };

  const title = await ai.generateText(
    `You write SEO-optimized blog titles about hydrogen water and ${category}. Rules:
1. Under 60 characters
2. 4th-6th grade reading level — no medical jargon
3. Include this keyword (or a close variation): "${targetKeyword}"
4. ${typeHint[articleType] || "Make it compelling and specific"}
5. Respond with ONLY the title text, nothing else`,
    `Create a title for a ${articleType} blog post.\n\nStudy topic: ${summary.substring(0, 200)}\nCategory: ${category}\nTarget SEO keyword: ${targetKeyword}`,
    { maxTokens: 50, temperature: 0.7 },
  );

  if (!title?.trim()) {
    throw new AppError(
      "Failed to generate title",
      500,
      ErrorCode.EXTERNAL_API_ERROR,
    );
  }

  return title.trim().replace(/^["']|["']$/g, "");
}

/**
 * Generate article image with comprehensive fallback
 */
async function generateArticleImageWithFallback(
  study: Study,
  title: string,
  articleType: string,
): Promise<{ imageUrl: string; imageAlt: string }> {
  try {
    const xaiClient = ai.getXAIClient();
    const openaiClient = ai.getOpenAIClient();
    if (!xaiClient && !openaiClient) {
      return getDefaultImage(study.category);
    }

    // Build a unique, topic-specific prompt based on study content + article type
    const prompt = buildUniqueImagePrompt(study, title, articleType);

    const imageClient = xaiClient || openaiClient!;
    const provider = xaiClient ? "xai" : "openai";
    const generateParams: any = {
      model: getImageModel(provider),
      prompt: prompt.substring(0, 1000),
      n: 1,
      response_format: "url",
    };
    if (provider === "openai") {
      generateParams.size = "1024x1024";
      generateParams.quality = "standard";
    }

    const response = await imageClient.images.generate(generateParams);

    const imageUrl = response.data?.[0]?.url;

    if (!imageUrl) {
      throw new Error("No image URL in response");
    }

    // Download and save via storage utility (S3 or local fallback)
    const imageBuffer = await downloadImageToBuffer(imageUrl);
    const filename = `blog-${slugify(articleType)}-${study.id}-${Date.now()}.png`;
    const { uploadFile } = await import("../utils/storage");
    const storedUrl = await uploadFile(imageBuffer, `blog-images/${filename}`, "image/png");

    // Generate keyword-rich alt text unique to this article
    const altText = buildUniqueAltText(study, title, articleType);

    return {
      imageUrl: storedUrl,
      imageAlt: altText,
    };
  } catch (error) {
    // If xAI was used and failed, try OpenAI as fallback before giving up
    const xaiClient = ai.getXAIClient();
    const openaiClient = ai.getOpenAIClient();
    if (xaiClient && openaiClient) {
      console.warn("xAI image generation failed, trying OpenAI fallback:", error);
      try {
        const prompt = buildUniqueImagePrompt(study, title, articleType);
        const response = await openaiClient.images.generate({
          model: "dall-e-3",
          prompt: prompt.substring(0, 1000),
          n: 1,
          response_format: "url",
          size: "1024x1024",
          quality: "standard",
        });

        const imageUrl = response.data?.[0]?.url;
        if (!imageUrl) {
          throw new Error("No image URL in OpenAI fallback response");
        }

        const imageBuffer = await downloadImageToBuffer(imageUrl);
        const filename = `blog-${slugify(articleType)}-${study.id}-${Date.now()}.png`;
        const { uploadFile } = await import("../utils/storage");
        const storedUrl = await uploadFile(imageBuffer, `blog-images/${filename}`, "image/png");
        const altText = buildUniqueAltText(study, title, articleType);

        return {
          imageUrl: storedUrl,
          imageAlt: altText,
        };
      } catch (fallbackError) {
        console.warn("OpenAI fallback image generation also failed, using default:", fallbackError);
      }
    } else {
      console.warn("Image generation failed, using default:", error);
    }
    return getDefaultImage(study.category);
  }
}

/**
 * Build a unique image prompt based on study topic, category, and article type.
 * Each combination produces a visually distinct image.
 */
function buildUniqueImagePrompt(study: Study, title: string, articleType: string): string {
  const category = (study.category || "health").toLowerCase();
  const studyTitle = study.title || title;

  // Detect the specific health topic from title/abstract
  const topicHints = detectTopicVisuals(studyTitle, study.abstract || "");

  // Article-type-specific visual style for the 3 strategic types
  const styleByType: Record<string, string> = {
    science_explainer: "Clean scientific editorial illustration with subtle data visualization elements, modern medical journal aesthetic",
    practical_guide: "Person in a bright modern kitchen or wellness space drinking water, lifestyle photography with natural light",
    faq: "Friendly approachable illustration with question marks and clean design, warm inviting health education style",
  };

  const style = styleByType[articleType] || "Clean editorial health photography";

  return `${style}. Topic: ${topicHints}. Category: ${category}. Modern health magazine aesthetic. No text, no labels, no chemical formulas. Unique composition specific to ${title.substring(0, 60)}.`;
}

/**
 * Detect specific visual elements from the study topic
 */
function detectTopicVisuals(title: string, abstract: string): string {
  const text = `${title} ${abstract}`.toLowerCase();

  if (text.includes("diabetes") || text.includes("glucose") || text.includes("insulin"))
    return "blood glucose monitoring device, healthy meal prep, metabolic health";
  if (text.includes("brain") || text.includes("cognitive") || text.includes("neuro"))
    return "artistic brain visualization, neural pathways with warm lighting";
  if (text.includes("exercise") || text.includes("athletic") || text.includes("sport"))
    return "athlete hydrating after workout, fitness and recovery";
  if (text.includes("skin") || text.includes("dermat") || text.includes("aging"))
    return "radiant healthy skin close-up, skincare and wellness";
  if (text.includes("heart") || text.includes("cardiovascular") || text.includes("blood pressure"))
    return "anatomical heart illustration with modern design, cardiovascular wellness";
  if (text.includes("gut") || text.includes("intestin") || text.includes("microbiome"))
    return "colorful gut microbiome illustration, digestive health";
  if (text.includes("cancer") || text.includes("tumor") || text.includes("radiation"))
    return "hopeful cancer treatment scene, medical care with warm tones";
  if (text.includes("liver") || text.includes("hepat"))
    return "liver health visualization, organ health with clean design";
  if (text.includes("kidney") || text.includes("renal"))
    return "kidney health illustration, renal care";
  if (text.includes("arthritis") || text.includes("joint") || text.includes("inflammation"))
    return "person stretching comfortably, joint health and mobility";
  if (text.includes("parkinson") || text.includes("alzheimer") || text.includes("dementia"))
    return "elderly person engaging in activity, neuroprotection and healthy aging";
  if (text.includes("lung") || text.includes("respiratory") || text.includes("inhalation"))
    return "clean air and breathing, respiratory wellness";
  if (text.includes("fatigue") || text.includes("energy") || text.includes("mitochondri"))
    return "person feeling energized, morning vitality";
  if (text.includes("anxiety") || text.includes("stress") || text.includes("mood"))
    return "calm meditation scene, mental wellness and relaxation";
  if (text.includes("cholesterol") || text.includes("lipid"))
    return "heart-healthy foods arrangement, cardiovascular nutrition";
  if (text.includes("weight") || text.includes("obesity") || text.includes("metabol"))
    return "active lifestyle, healthy body composition";
  if (text.includes("allergy") || text.includes("immune"))
    return "immune system visualization, protective health imagery";

  // Generic fallback based on hydrogen water
  return "person drinking hydrogen-rich water, clean modern wellness setting";
}

/**
 * Generate keyword-rich alt text that describes the actual image content
 * and includes SEO-relevant terms for the article's topic.
 */
function buildUniqueAltText(study: Study, title: string, articleType: string): string {
  const category = study.category || "health";
  const typeLabel: Record<string, string> = {
    science_explainer: "research explainer",
    practical_guide: "practical guide",
    faq: "frequently asked questions",
  };
  const label = typeLabel[articleType] || "research article";

  // Extract key terms from the title for the alt text
  const keyTerms = title
    .replace(/[^a-zA-Z\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 4)
    .slice(0, 4)
    .join(", ");

  return `Hydrogen therapy ${label} illustration — ${category}: ${keyTerms}. Visual for: ${title.substring(0, 80)}`;
}

/**
 * Download image URL to a Buffer
 */
async function downloadImageToBuffer(url: string): Promise<Buffer> {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 15000,
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error("Failed to download image:", error);
    throw new AppError(
      "Image download failed",
      500,
      ErrorCode.EXTERNAL_API_ERROR,
    );
  }
}

// Fallback content generators
function generateFallbackContent(study: Study, articleType: string) {
  const title = study.title || "Hydrogen Therapy Study";
  const abstract =
    study.abstract || "This study explores the benefits of hydrogen therapy.";

  const content = `# ${title}

## Overview
${abstract}

## Key Points
This research examines the therapeutic applications of molecular hydrogen in medical treatment. The study provides valuable insights into how hydrogen therapy may benefit various health conditions.

## Study Details
- Category: ${study.category || "General Health"}
- Published: ${study.publishYear || "Recent"}
- Journal: ${study.journal || "Scientific Publication"}

## Importance
Understanding hydrogen therapy's mechanisms and benefits can help advance medical treatments and improve patient outcomes. This research contributes to our growing knowledge of alternative therapeutic approaches.

## Note
This is a simplified summary generated from available study data. For complete information, please refer to the original research publication.`;

  return {
    fullContent: content,
    summary: abstract.substring(0, 300),
  };
}

function generateFallbackTitle(study: Study, articleType: string): string {
  const baseTitle = study.title || "Hydrogen Water Research";
  const typeLabels: Record<string, string> = {
    science_explainer: "What the Research Shows",
    practical_guide: "A Practical Guide",
    faq: "Your Questions Answered",
  };

  const typeLabel = typeLabels[articleType] || "Research Summary";
  return `${baseTitle.substring(0, 40)}: ${typeLabel}`;
}

function generateBasicArticle(
  study: Study,
  articleType = "overview",
): InsertBlogArticle {
  const content = generateFallbackContent(study, articleType);
  const title = generateFallbackTitle(study, articleType);
  const slug = `${slugify(title, { lower: true, strict: true })}-${Date.now()}`;
  const image = getDefaultImage(study.category);

  return {
    title,
    slug,
    studyId: study.id,
    content: content.fullContent,
    summary: content.summary,
    imageUrl: image.imageUrl,
    imageAlt: image.imageUrl ? `Illustration for: ${title.substring(0, 110)}` : image.imageAlt,
    isPublished: true,
    articleType,
    metaDescription: content.summary.substring(0, 160),
    semanticKeywords: extractKeywords(study, content.summary),
    editorNotes: "Fallback content generated due to API unavailability.",
    canonicalUrl: `https://hydrogenstudies.com/blog/${slug}`,
    ogTitle: title,
    ogDescription: content.summary.substring(0, 200),
    ogImage: image.imageUrl || null,
    twitterCard: image.imageUrl ? "summary_large_image" : "summary",
    twitterTitle: title,
    twitterDescription: content.summary.substring(0, 200),
    breadcrumbs: JSON.stringify([
      { name: "Home", url: "/" },
      { name: "Blog", url: "/blog" },
      { name: title, url: `/blog/${slug}` },
    ]),
    lastReviewed: new Date(),
  };
}

function getDefaultImage(category?: string): {
  imageUrl: string;
  imageAlt: string;
} {
  // Use the actual fallback SVG that exists in the repository
  return {
    imageUrl: "/images/fallback-study-image.svg",
    imageAlt: `${category || "Hydrogen therapy"} research illustration`,
  };
}

function generateTags(study: Study, articleType: string): string[] {
  const tags = ["hydrogen therapy", "medical research"];

  if (study.category) {
    tags.push(study.category.toLowerCase());
  }

  tags.push(articleType.replace(/_/g, " "));

  return tags;
}

function extractKeywords(study: Study, summary: string): string[] {
  const keywords = ["hydrogen", "therapy", "health", "research"];

  // Extract potential keywords from title and summary
  const words = `${study.title} ${summary}`
    .toLowerCase()
    .split(/\W+/)
    .filter(
      (word) =>
        word.length > 4 && !["study", "research", "article"].includes(word),
    );

  // Add unique words as keywords (up to 10)
  const uniqueWords = Array.from(new Set(words)).slice(0, 5);
  keywords.push(...uniqueWords);

  return keywords;
}

function createContentPrompt(study: Study, articleType: string): string {
  const deliveryMethod = study.h2DeliveryMethod || "hydrogen-rich water";

  const prompts: Record<string, string> = {
    science_explainer: `Write a science explainer article about this hydrogen research study.

STRUCTURE:
1. Open with why this matters for the reader's health (1-2 sentences)
2. "What the Researchers Did" — brief methods in plain language
3. "What They Found" — key results with specific numbers from the study
4. "Why This Matters" — connect findings to real health outcomes
5. "The Bigger Picture" — how this fits into the growing body of hydrogen research
6. "Key Takeaways" — 3-4 bullet points summarizing the findings

TONE: Authoritative but accessible. You are a science journalist explaining a study to a curious reader. Write at a 6th grade reading level.`,

    practical_guide: `Write a practical guide connecting this study's findings to real-world hydrogen water use.

STRUCTURE:
1. Open with the health benefit this study supports (1-2 sentences)
2. "What the Research Shows" — summarize the key finding in 2-3 sentences
3. "How Hydrogen Water Delivery Works" — explain that molecular hydrogen (H2) can be delivered through drinking hydrogen-rich water produced by water ionizers and hydrogen water machines like those from Echo Water™. Briefly note the study used ${deliveryMethod}.
4. "How to Apply This" — practical guidance on incorporating hydrogen water, including how much, how often, and when (based on the study protocol if available)
5. "What to Look For" — what makes a quality hydrogen water machine (dissolved H2 concentration above 1.0 ppm, ORP levels, third-party testing)
6. "Key Takeaways" — 3-4 actionable bullet points

TONE: Helpful and practical, like a knowledgeable friend. NOT salesy — mention Echo Water naturally as one example, not as an advertisement. Write at a 6th grade reading level.`,

    faq: `Write a FAQ article answering the questions people would have after hearing about this study.

STRUCTURE — Use this EXACT format for each Q&A (important for schema.org FAQ markup):
## [Question in natural language?]
[2-4 sentence answer citing the study]

Generate 6-8 questions covering:
- "What did this study find?" (the core result)
- "Is hydrogen water safe for [the condition studied]?"
- "How does hydrogen water help with [condition]?"
- "How much hydrogen water should I drink?"
- "What type of hydrogen water was used in this study?" (mention the delivery method: ${deliveryMethod})
- "Where can I get hydrogen water?" (mention hydrogen water machines/ionizers as a reliable source of therapeutic-concentration H2, with Echo Water™ as one option)
- "Are there any side effects?"
- A skeptic question like "Is hydrogen water just a fad?" or "Does hydrogen water actually work?"

TONE: Direct and trustworthy. Answer each question honestly, cite the study, and acknowledge limitations. Write at a 6th grade reading level.`,
  };

  const basePrompt = prompts[articleType] || prompts.overview;

  // Build internal link context for the AI to embed in the content
  const studySlug = study.slug || `id/${study.id}`;
  const category = study.category || "General Health";
  const categorySlug = category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const conditions = (study.healthConditions || []).slice(0, 3);

  const linkInstructions = `
INTERNAL LINKS — You MUST include these as markdown links naturally woven into the content:
1. Link to the source study: [original research study](/study/${studySlug}) — mention it at least once
2. Link to the category hub: [hydrogen ${category.toLowerCase()} research](/blog/category/${categorySlug}) — include once
3. Link to the research database: [hydrogen research database](/proxy/) — include once in the conclusion
${conditions.length > 0 ? `4. Mention these related health conditions and link them: ${conditions.map(c => {
  const cSlug = c.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `[${c}](/explore-by-condition/${cSlug})`;
}).join(", ")}` : ""}

IMPORTANT: Links must feel natural in the sentence. Do NOT list them separately. Weave them into the narrative.
Example: "According to the [original research study](/study/${studySlug}), hydrogen water showed a 45% reduction..."`;

  // Prefer plain language fields over raw scientific abstract
  const plainSummary = study.tldr || (study as any).plainSummary || null;
  const studyContext = plainSummary
    ? `Plain Language Summary: ${plainSummary}\n\nStudy Title: ${study.title}\nCategory: ${category}${study.abstract ? `\n\nScientific Abstract (for reference — do NOT copy this tone, use the plain language summary above as your primary source):\n${study.abstract.substring(0, 500)}` : ""}`
    : `Study Title: ${study.title}\nAbstract: ${study.abstract}\nCategory: ${category}`;

  // Include tags/keywords if available for richer context
  const tags = [
    ...(study.tags || []),
    ...(study.keywords || []),
    ...(study.healthConditions || []),
  ].filter(Boolean).slice(0, 10);
  const tagContext = tags.length > 0 ? `\nTopic Tags: ${tags.join(", ")}` : "";

  return `${basePrompt}

${studyContext}${tagContext}

${linkInstructions}

Content Requirements:
- Write at a 4th-6th grade reading level (Flesch-Kincaid score 60-70)
- Use short sentences and simple words — explain any scientific terms
- Include specific details from the study (numbers, percentages, outcomes)
- Structure with clear H2 (##) and H3 (###) headings that include keyword variations of "hydrogen therapy" or "hydrogen water"
- Include a "Key Takeaways" or "What This Means for You" section
- End with a brief disclaimer: "Consult your healthcare provider before starting any new health regimen"
- Aim for 600-900 words
- The content MUST contain at least 3 internal markdown links as specified above`;
}
