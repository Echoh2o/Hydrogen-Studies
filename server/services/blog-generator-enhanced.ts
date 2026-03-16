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
import { ai } from "./ai-provider";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    "You are a scientific writer specializing in hydrogen therapy research. Write engaging, accurate content at a 6th grade reading level (Flesch-Kincaid score 60-70). Use simple words, short sentences, and clear explanations. Avoid medical jargon unless necessary, and always explain complex terms in simple language.",
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

  // Map study categories to target SEO keywords for better search visibility
  const seoKeywords: Record<string, string> = {
    cardiovascular: "hydrogen water heart health",
    neurological: "hydrogen therapy brain health",
    metabolic: "hydrogen water diabetes",
    inflammation: "hydrogen water inflammation",
    respiratory: "hydrogen therapy lungs",
    gastrointestinal: "hydrogen water gut health",
    cancer: "hydrogen therapy cancer research",
    exercise: "hydrogen water athletic performance",
    skin: "hydrogen water skin benefits",
    aging: "hydrogen water anti-aging",
  };
  const targetKeyword = seoKeywords[category.toLowerCase()] || `hydrogen water ${category}`;

  const title = await ai.generateText(
    `You write SEO-optimized blog titles about hydrogen therapy and ${category}. Rules:
1. Under 60 characters
2. 4th-6th grade reading level — no medical jargon
3. Include one of these target keywords (or a close variation): "${targetKeyword}"
4. Make it compelling for someone who knows nothing about hydrogen therapy
5. Use power words like "surprising", "proven", "new research shows", "what science says"
6. Respond with ONLY the title text, nothing else`,
    `Create a title for a ${articleType} blog post.\n\nStudy topic: ${summary.substring(0, 200)}\nCategory: ${category}\nTarget SEO keyword: ${targetKeyword}`,
    { maxTokens: 50, temperature: 0.8 },
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
    const openaiClient = ai.getOpenAIClient();
    if (!openaiClient) {
      return getDefaultImage(study.category);
    }

    const prompt = `Scientific illustration for hydrogen therapy article: ${title}. Medical research visualization, clean professional style.`;

    const response = await openaiClient.images.generate({
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
      imageAlt: `${title} - hydrogen ${articleType.replace(/_/g, " ")} research illustration`,
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
- Write at a 4th-6th grade reading level (Flesch-Kincaid score 60-70)
- Use short sentences and simple words — explain any scientific terms
- Include specific details from the study (numbers, percentages, outcomes)
- Structure with clear H2 (##) and H3 (###) headings that include keyword variations of "hydrogen therapy" or "hydrogen water"
- Include a "Key Takeaways" or "What This Means for You" section
- End with a brief disclaimer: "Consult your healthcare provider before starting any new health regimen"
- Aim for 600-900 words`;
}
