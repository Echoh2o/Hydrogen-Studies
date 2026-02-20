/**
 * Enhanced Blog Generator with comprehensive error handling
 * Demonstrates best practices for OpenAI API error handling
 */

import OpenAI from "openai";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import axios from "axios";
import slugify from "slugify";
import { Study, InsertBlogArticle, blogArticles } from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";
import {
  handleOpenAIRequest,
  handleBatchOperation,
  withTimeout,
} from "../utils/service-error-handlers";
import { AppError, ErrorCode } from "../utils/app-errors";
import { withRetry } from "../utils/database-wrapper";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize OpenAI client with error handling
const initializeOpenAI = (): OpenAI | null => {
  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      "OpenAI API key not configured - blog generation will use fallback content",
    );
    return null;
  }

  try {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000, // 30 second timeout
      maxRetries: 2,
    });
  } catch (error) {
    console.error("Failed to initialize OpenAI client:", error);
    return null;
  }
};

const openai = initializeOpenAI();

// Blog article types - expanded set for comprehensive coverage
const BLOG_TYPES = [
  "overview",
  "practical_application",
  "comparison",
  "simplified",
  "benefits_focused",
  "future_implications",
  "faq_style",
  "how_to_guide",
  "tips", // New: Practical tips for patients
  "patient_story", // New: Relatable patient perspective
  "myth_busting", // New: Common misconceptions
  "daily_routine", // New: Daily implementation guide
  "side_effects", // New: What to expect, safety considerations
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

    const count = Math.min(options.count || 7, BLOG_TYPES.length);
    const fallbackToBasic = options.fallbackToBasic ?? true;

    // Check OpenAI availability
    if (!openai) {
      if (fallbackToBasic) {
        results.warnings.push(
          "OpenAI not available, generating basic articles",
        );
        const basicArticle = generateBasicArticle(study);
        results.articles.push(basicArticle);
        return results;
      }
      throw new AppError(
        "OpenAI API not configured",
        503,
        ErrorCode.SERVICE_UNAVAILABLE,
      );
    }

    // Select random types
    const selectedTypes = BLOG_TYPES.sort(() => 0.5 - Math.random()).slice(
      0,
      count,
    );

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
    // 1. Generate content with fallback
    const blogContent = await handleOpenAIRequest(
      () => generateArticleContent(study, articleType),
      generateFallbackContent(study, articleType),
      {
        model: "gpt-4o",
        prompt: `Generate ${articleType} article for study ${study.id}`,
      },
    );

    // 2. Generate title with fallback
    const blogTitle = await handleOpenAIRequest(
      () => generateArticleTitle(study, articleType, blogContent.summary),
      generateFallbackTitle(study, articleType),
      { model: "gpt-4o", prompt: "Generate article title" },
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

    // Create article object
    const article: InsertBlogArticle = {
      title: blogTitle,
      slug,
      studyId: study.id,
      content: blogContent.fullContent,
      summary: blogContent.summary,
      imageUrl: imageData.imageUrl,
      imageAlt: imageData.imageAlt,
      isPublished: false,
      articleType,
      metaDescription: blogContent.summary.substring(0, 160),
      semanticKeywords: extractKeywords(study, blogContent.summary),
      editorNotes:
        "AI-generated content with error handling. Review before publishing.",
    };

    // Save to database with retry logic
    await withRetry(
      async () => {
        await db.insert(blogArticles).values(article);
      },
      { maxRetries: 2, retryDelay: 1000 },
    );

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
  if (!openai) {
    throw new AppError(
      "OpenAI not initialized",
      503,
      ErrorCode.SERVICE_UNAVAILABLE,
    );
  }

  const prompt = createContentPrompt(study, articleType);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a scientific writer specializing in hydrogen therapy research. Write engaging, accurate content at a 6th grade reading level (Flesch-Kincaid score 60-70). Use simple words, short sentences, and clear explanations. Avoid medical jargon unless necessary, and always explain complex terms in simple language.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 2000,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content || "";

  if (!content) {
    throw new AppError(
      "Empty response from OpenAI",
      500,
      ErrorCode.EXTERNAL_API_ERROR,
    );
  }

  // Extract summary (first paragraph or first 200 words)
  const paragraphs = content.split("\n\n");
  const summary = paragraphs[0] || content.substring(0, 500);

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
  if (!openai) {
    throw new AppError(
      "OpenAI not initialized",
      503,
      ErrorCode.SERVICE_UNAVAILABLE,
    );
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "Create engaging, SEO-friendly titles for health articles. Keep titles under 60 characters.",
      },
      {
        role: "user",
        content: `Create a title for a ${articleType} article about: ${summary.substring(0, 200)}`,
      },
    ],
    max_tokens: 50,
    temperature: 0.8,
  });

  const title = response.choices[0]?.message?.content?.trim() || "";

  if (!title) {
    throw new AppError(
      "Failed to generate title",
      500,
      ErrorCode.EXTERNAL_API_ERROR,
    );
  }

  return title;
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
    if (!openai) {
      return getDefaultImage(study.category);
    }

    const prompt = `Scientific illustration for hydrogen therapy article: ${title}. Medical research visualization, clean professional style.`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt.substring(0, 1000),
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    const imageUrl = response.data?.[0]?.url;

    if (!imageUrl) {
      throw new Error("No image URL in response");
    }

    // Download and save locally with error handling
    const localPath = await downloadImage(imageUrl, study.id, articleType);

    return {
      imageUrl: localPath,
      imageAlt: `Illustration for ${title}`,
    };
  } catch (error) {
    console.warn("Image generation failed, using default:", error);
    return getDefaultImage(study.category);
  }
}

/**
 * Download and save image locally with error handling
 */
async function downloadImage(
  url: string,
  studyId: number,
  articleType: string,
): Promise<string> {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 10000,
    });

    const uploadDir = path.join(process.cwd(), "public", "uploads", "blog");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `blog-${slugify(articleType)}-${studyId}-${Date.now()}.png`;
    const filepath = path.join(uploadDir, filename);

    fs.writeFileSync(filepath, Buffer.from(response.data));

    return `/uploads/blog/${filename}`;
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
  const baseTitle = study.title || "Hydrogen Therapy Research";
  const typeLabels: Record<string, string> = {
    overview: "Overview",
    practical_application: "Practical Guide",
    comparison: "Comparative Analysis",
    simplified: "Simple Explanation",
    benefits_focused: "Health Benefits",
    future_implications: "Future Impact",
    faq_style: "Common Questions",
    how_to_guide: "How-To Guide",
    tips: "Practical Tips",
    patient_story: "Patient Perspective",
    myth_busting: "Myths vs Facts",
    daily_routine: "Daily Guide",
    side_effects: "What to Expect",
  };

  const typeLabel = typeLabels[articleType] || "Analysis";
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
    imageAlt: image.imageAlt,
    isPublished: false,
    articleType,
    metaDescription: content.summary.substring(0, 160),
    semanticKeywords: extractKeywords(study, content.summary),
    editorNotes: "Fallback content generated due to API unavailability.",
  };
}

function getDefaultImage(category?: string): {
  imageUrl: string;
  imageAlt: string;
} {
  const categoryImages: Record<string, string> = {
    Neurological: "/images/default-neuro.svg",
    Cardiovascular: "/images/default-cardio.svg",
    Cancer: "/images/default-cancer.svg",
    "Sports Performance": "/images/default-sports.svg",
    "General Health": "/images/default-health.svg",
  };

  const imageUrl =
    categoryImages[category || ""] || "/images/default-study.svg";

  return {
    imageUrl,
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
  const prompts: Record<string, string> = {
    overview: `Write a comprehensive overview article about this hydrogen therapy study. Include background, key findings, and implications. Use 6th grade reading level.`,
    practical_application: `Write a practical guide on how the findings from this study could be applied in real-world health scenarios. Use 6th grade reading level.`,
    comparison: `Compare this hydrogen therapy study with other treatments or approaches for similar conditions. Use 6th grade reading level.`,
    simplified: `Explain this hydrogen therapy study in very simple terms that anyone can understand. Target 6th grade reading level.`,
    benefits_focused: `Focus on the specific health benefits discovered in this hydrogen therapy study. Use 6th grade reading level.`,
    future_implications: `Discuss the future implications and potential developments based on this hydrogen therapy research. Use 6th grade reading level.`,
    faq_style: `Create an FAQ-style article answering common questions about this hydrogen therapy study. Use 6th grade reading level.`,
    how_to_guide: `Create a how-to guide based on the practical applications of this hydrogen therapy research. Use 6th grade reading level.`,
    tips: `Write an article with 7-10 practical tips for patients who want to benefit from the hydrogen therapy findings in this study. Make it actionable and easy to follow. Use 6th grade reading level.`,
    patient_story: `Write an article from a patient's perspective about how hydrogen therapy could impact their daily life based on this study. Make it relatable and hopeful. Use 6th grade reading level.`,
    myth_busting: `Write a myth-busting article addressing common misconceptions about hydrogen therapy based on what this study reveals. Format as 'Myth vs Fact'. Use 6th grade reading level.`,
    daily_routine: `Create a daily routine guide showing how someone could incorporate hydrogen therapy into their life based on this study's findings. Include morning, afternoon, and evening suggestions. Use 6th grade reading level.`,
    side_effects: `Write an informative article about what to expect from hydrogen therapy based on this study, including any side effects, safety considerations, and when to consult a healthcare provider. Be reassuring but honest. Use 6th grade reading level.`,
  };

  const basePrompt = prompts[articleType] || prompts.overview;

  return `${basePrompt}

Study Title: ${study.title}
Abstract: ${study.abstract}
Category: ${study.category || "General Health"}

Requirements:
- Write at a 6th grade reading level
- Include specific details from the study
- Make it engaging and informative
- Keep it factual and scientifically accurate
- Structure with clear sections and headings
- Aim for 500-800 words`;
}
