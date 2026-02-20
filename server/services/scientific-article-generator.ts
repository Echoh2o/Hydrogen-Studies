/**
 * Scientific Article Generator
 * Generates in-depth, longer-form scientific articles about hydrogen therapy studies
 */

import OpenAI from "openai";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import axios from "axios";
import slugify from "slugify";
import {
  Study,
  InsertScientificArticle,
  scientificArticles,
} from "@shared/schema";
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
      "OpenAI API key not configured - scientific article generation will use fallback content",
    );
    return null;
  }

  try {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 60000, // 60 second timeout for longer content
      maxRetries: 2,
    });
  } catch (error) {
    console.error("Failed to initialize OpenAI client:", error);
    return null;
  }
};

const openai = initializeOpenAI();

// Article types for scientific content
const ARTICLE_TYPES = ["comprehensive_review", "clinical_applications"];

/**
 * Generate scientific articles for a study
 */
export async function generateScientificArticlesForStudy(
  study: Study,
  options: {
    fallbackToBasic?: boolean;
  } = {},
): Promise<{
  articles: InsertScientificArticle[];
  errors: Array<{ type: string; error: string }>;
  warnings: string[];
}> {
  const results = {
    articles: [] as InsertScientificArticle[],
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

    const fallbackToBasic = options.fallbackToBasic ?? true;

    // Check OpenAI availability
    if (!openai) {
      if (fallbackToBasic) {
        results.warnings.push(
          "OpenAI not available, generating basic scientific articles",
        );
        for (const type of ARTICLE_TYPES) {
          const basicArticle = generateBasicScientificArticle(study, type);
          results.articles.push(basicArticle);
        }
        return results;
      }
      throw new AppError(
        "OpenAI API not configured",
        503,
        ErrorCode.SERVICE_UNAVAILABLE,
      );
    }

    // Generate articles with batch error handling
    const batchResults = await handleBatchOperation(
      ARTICLE_TYPES,
      async (type) => {
        return await withTimeout(
          () => generateSingleScientificArticle(study, type),
          90000, // 90 second timeout per article (longer content)
          `Scientific article generation timeout for type: ${type}`,
        );
      },
      { continueOnError: true, maxConcurrent: 1 }, // Sequential to avoid rate limits
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
        const fallback = generateBasicScientificArticle(study, failure.item);
        results.articles.push(fallback);
        results.warnings.push(
          `Generated fallback scientific article for type: ${failure.item}`,
        );
      }
    }

    // Log summary
    console.log(
      `Scientific article generation complete: ${results.articles.length} articles, ${results.errors.length} errors`,
    );

    return results;
  } catch (error) {
    console.error("Fatal error generating scientific articles:", error);

    // Return basic articles on fatal error
    if (options.fallbackToBasic) {
      for (const type of ARTICLE_TYPES) {
        const basicArticle = generateBasicScientificArticle(study, type);
        results.articles.push(basicArticle);
      }
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
 * Generate a single scientific article
 */
async function generateSingleScientificArticle(
  study: Study,
  articleType: string,
): Promise<InsertScientificArticle> {
  try {
    // 1. Generate comprehensive content
    const sections = await generateArticleSections(study, articleType);

    // 2. Generate title
    const title = await generateScientificTitle(study, articleType);

    // 3. Generate unique slug
    const baseSlug = slugify(title, { lower: true, strict: true });
    const timestamp = Date.now().toString().slice(-6);
    const slug = `scientific-${baseSlug}-${timestamp}`;

    // 4. Generate image
    const imageData = await generateScientificImage(study, title, articleType);

    // 5. Calculate word count and reading time
    const fullContent = combineContentSections(sections);
    const wordCount = fullContent.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200); // Average reading speed

    // 6. Extract keywords
    const keywords = await extractScientificKeywords(study, sections.abstract);

    // Create article object
    const article: InsertScientificArticle = {
      studyId: study.id,
      title,
      slug,
      articleType,
      content: fullContent,
      summary: sections.summary,
      abstract: sections.abstract,
      introduction: sections.introduction,
      methodology: sections.methodology,
      results: sections.results,
      discussion: sections.discussion,
      conclusion: sections.conclusion,
      references: sections.references,
      keywords,
      authors: study.authors,
      readingLevel: "8th-10th grade",
      wordCount,
      readingTime,
      metaTitle: title.substring(0, 60),
      metaDescription: sections.summary.substring(0, 160),
      canonicalUrl: `/scientific-articles/${slug}`,
      imageUrl: imageData.imageUrl,
      imageAlt: imageData.imageAlt,
      figures: [],
      figuresCaptions: [],
      isPublished: false,
      peerReviewed: false,
      qualityScore: null,
      reviewNotes:
        "AI-generated scientific article. Requires expert review before publication.",
    };

    // Save to database with retry logic
    await withRetry(
      async () => {
        await db.insert(scientificArticles).values(article);
      },
      { maxRetries: 2, retryDelay: 1000 },
    );

    return article;
  } catch (error) {
    console.error(
      `Failed to generate ${articleType} scientific article:`,
      error,
    );

    throw new AppError(
      `Scientific article generation failed for ${articleType}`,
      500,
      ErrorCode.INTERNAL_SERVER_ERROR,
      true,
      { studyId: study.id, articleType },
      error as Error,
    );
  }
}

/**
 * Generate all sections of a scientific article
 */
async function generateArticleSections(
  study: Study,
  articleType: string,
): Promise<{
  summary: string;
  abstract: string;
  introduction: string;
  methodology: string;
  results: string;
  discussion: string;
  conclusion: string;
  references: string[];
}> {
  if (!openai) {
    throw new AppError(
      "OpenAI not initialized",
      503,
      ErrorCode.SERVICE_UNAVAILABLE,
    );
  }

  const prompt = createScientificPrompt(study, articleType);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a scientific writer specializing in hydrogen therapy research. Write detailed, accurate scientific content at an 8th-10th grade reading level. Structure your response with clear sections: ABSTRACT, INTRODUCTION, METHODOLOGY, RESULTS, DISCUSSION, CONCLUSION, and REFERENCES. Each section should be substantial and informative.`,
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 4000, // Allow for longer content
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

  // Parse sections from the response
  const sections = parseScientificSections(content);

  // Generate a concise summary separately
  const summaryResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "Write a concise executive summary (150-200 words) of the following scientific article content.",
      },
      { role: "user", content: content.substring(0, 2000) },
    ],
    max_tokens: 300,
    temperature: 0.7,
  });

  const summary =
    summaryResponse.choices[0]?.message?.content ||
    sections.abstract.substring(0, 200);

  return {
    summary,
    ...sections,
  };
}

/**
 * Parse scientific sections from generated content
 */
function parseScientificSections(content: string): {
  abstract: string;
  introduction: string;
  methodology: string;
  results: string;
  discussion: string;
  conclusion: string;
  references: string[];
} {
  const sections = {
    abstract: "",
    introduction: "",
    methodology: "",
    results: "",
    discussion: "",
    conclusion: "",
    references: [] as string[],
  };

  // Define section markers
  const sectionMarkers = [
    "ABSTRACT",
    "INTRODUCTION",
    "METHODOLOGY",
    "METHODS",
    "RESULTS",
    "DISCUSSION",
    "CONCLUSION",
    "REFERENCES",
  ];

  // Split content by section headers
  const lines = content.split("\n");
  let currentSection = "";
  let sectionContent: string[] = [];

  for (const line of lines) {
    const upperLine = line.toUpperCase().trim();
    const isHeader = sectionMarkers.some(
      (marker) => upperLine.startsWith(marker) || upperLine === marker,
    );

    if (isHeader) {
      // Save previous section
      if (currentSection && sectionContent.length > 0) {
        saveSectionContent(sections, currentSection, sectionContent.join("\n"));
      }

      // Start new section
      currentSection = upperLine.replace(/[:#]/g, "").trim();
      sectionContent = [];
    } else {
      sectionContent.push(line);
    }
  }

  // Save last section
  if (currentSection && sectionContent.length > 0) {
    saveSectionContent(sections, currentSection, sectionContent.join("\n"));
  }

  // Ensure all sections have content
  ensureAllSections(sections, content);

  return sections;
}

function saveSectionContent(
  sections: any,
  sectionName: string,
  content: string,
): void {
  const cleanContent = content.trim();

  switch (sectionName) {
    case "ABSTRACT":
      sections.abstract = cleanContent;
      break;
    case "INTRODUCTION":
      sections.introduction = cleanContent;
      break;
    case "METHODOLOGY":
    case "METHODS":
      sections.methodology = cleanContent;
      break;
    case "RESULTS":
      sections.results = cleanContent;
      break;
    case "DISCUSSION":
      sections.discussion = cleanContent;
      break;
    case "CONCLUSION":
      sections.conclusion = cleanContent;
      break;
    case "REFERENCES":
      // Parse references into array
      sections.references = cleanContent
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => line.trim());
      break;
  }
}

function ensureAllSections(sections: any, fullContent: string): void {
  // If any section is missing, extract from full content or provide default
  if (!sections.abstract) {
    sections.abstract = fullContent.substring(0, 300) + "...";
  }
  if (!sections.introduction) {
    sections.introduction =
      "This article provides a comprehensive analysis of hydrogen therapy research findings.";
  }
  if (!sections.methodology) {
    sections.methodology =
      "The methodology employed in this study utilized established research protocols.";
  }
  if (!sections.results) {
    sections.results =
      "The results demonstrate significant findings in hydrogen therapy applications.";
  }
  if (!sections.discussion) {
    sections.discussion =
      "These findings have important implications for clinical practice and future research.";
  }
  if (!sections.conclusion) {
    sections.conclusion =
      "This research contributes valuable insights to the field of hydrogen therapy.";
  }
  if (sections.references.length === 0) {
    sections.references = [
      "Original study publication",
      "Related hydrogen therapy research",
    ];
  }
}

/**
 * Combine content sections into full article
 */
function combineContentSections(sections: any): string {
  return `
# Abstract
${sections.abstract}

# Introduction
${sections.introduction}

# Methodology
${sections.methodology}

# Results
${sections.results}

# Discussion
${sections.discussion}

# Conclusion
${sections.conclusion}

# References
${sections.references.map((ref: string, i: number) => `${i + 1}. ${ref}`).join("\n")}
`.trim();
}

/**
 * Generate scientific title
 */
async function generateScientificTitle(
  study: Study,
  articleType: string,
): Promise<string> {
  if (!openai) {
    return generateFallbackScientificTitle(study, articleType);
  }

  try {
    const typePrompts: Record<string, string> = {
      comprehensive_review:
        "Generate a scientific title for a comprehensive review article",
      clinical_applications:
        "Generate a scientific title for a clinical applications article",
    };

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Generate concise, professional scientific article titles.",
        },
        {
          role: "user",
          content: `${typePrompts[articleType] || typePrompts.comprehensive_review} about this hydrogen therapy study: "${study.title}". Keep it under 100 characters.`,
        },
      ],
      max_tokens: 50,
      temperature: 0.7,
    });

    const title = response.choices[0]?.message?.content?.trim() || "";
    return title || generateFallbackScientificTitle(study, articleType);
  } catch (error) {
    console.warn("Failed to generate scientific title:", error);
    return generateFallbackScientificTitle(study, articleType);
  }
}

function generateFallbackScientificTitle(
  study: Study,
  articleType: string,
): string {
  const baseTitle = study.title || "Hydrogen Therapy Research";
  const typeLabels: Record<string, string> = {
    comprehensive_review: "A Comprehensive Review",
    clinical_applications: "Clinical Applications and Implications",
  };

  const typeLabel = typeLabels[articleType] || "Scientific Analysis";
  return `${baseTitle.substring(0, 50)}: ${typeLabel}`;
}

/**
 * Generate scientific image
 */
async function generateScientificImage(
  study: Study,
  title: string,
  articleType: string,
): Promise<{ imageUrl: string; imageAlt: string }> {
  try {
    if (!openai) {
      return getDefaultScientificImage(study.category);
    }

    const prompt = `Scientific diagram for hydrogen therapy research article: ${title}. Medical illustration with molecular structures, clinical data visualization, professional academic style.`;

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

    // Download and save locally
    const localPath = await downloadScientificImage(
      imageUrl,
      study.id,
      articleType,
    );

    return {
      imageUrl: localPath,
      imageAlt: `Scientific illustration for ${title}`,
    };
  } catch (error) {
    console.warn("Scientific image generation failed, using default:", error);
    return getDefaultScientificImage(study.category);
  }
}

async function downloadScientificImage(
  url: string,
  studyId: number,
  articleType: string,
): Promise<string> {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 10000,
    });

    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "scientific",
    );
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `scientific-${articleType}-${studyId}-${Date.now()}.png`;
    const filepath = path.join(uploadDir, filename);

    fs.writeFileSync(filepath, Buffer.from(response.data));

    return `/uploads/scientific/${filename}`;
  } catch (error) {
    console.error("Failed to download scientific image:", error);
    throw new AppError(
      "Scientific image download failed",
      500,
      ErrorCode.EXTERNAL_API_ERROR,
    );
  }
}

function getDefaultScientificImage(category?: string): {
  imageUrl: string;
  imageAlt: string;
} {
  return {
    imageUrl: "/images/default-scientific.svg",
    imageAlt: `Scientific research illustration for ${category || "hydrogen therapy"}`,
  };
}

/**
 * Extract scientific keywords
 */
async function extractScientificKeywords(
  study: Study,
  abstract: string,
): Promise<string[]> {
  const baseKeywords = [
    "hydrogen therapy",
    "molecular hydrogen",
    "clinical research",
    "medical applications",
  ];

  // Add study-specific keywords
  if (study.keywords && Array.isArray(study.keywords)) {
    baseKeywords.push(...study.keywords);
  }

  // Extract additional keywords from abstract
  const words = abstract
    .toLowerCase()
    .split(/\W+/)
    .filter(
      (word) =>
        word.length > 6 &&
        !["research", "study", "article", "therapy"].includes(word),
    );

  const uniqueWords = Array.from(new Set(words)).slice(0, 5);
  baseKeywords.push(...uniqueWords);

  return Array.from(new Set(baseKeywords)).slice(0, 15);
}

/**
 * Create scientific content prompt
 */
function createScientificPrompt(study: Study, articleType: string): string {
  const prompts: Record<string, string> = {
    comprehensive_review: `Write a comprehensive scientific review article (2000-3000 words) about this hydrogen therapy study. Include:
    
    ABSTRACT (200-250 words): Summarize the study's objectives, methods, key findings, and implications.
    
    INTRODUCTION (400-500 words): Provide background on hydrogen therapy, its mechanisms, current state of research, and the significance of this particular study.
    
    METHODOLOGY (400-500 words): Analyze the research methodology, study design, participant selection, intervention protocols, and statistical methods used.
    
    RESULTS (500-600 words): Detail the key findings, statistical significance, effect sizes, and any subgroup analyses or secondary outcomes.
    
    DISCUSSION (600-700 words): Interpret the results in context of existing literature, discuss clinical implications, limitations, and potential mechanisms.
    
    CONCLUSION (200-250 words): Summarize key takeaways and future research directions.
    
    REFERENCES: List key citations.`,

    clinical_applications: `Write a detailed clinical applications article (2000-3000 words) about implementing this hydrogen therapy research in clinical practice. Include:
    
    ABSTRACT (200-250 words): Summarize the clinical relevance and practical applications.
    
    INTRODUCTION (400-500 words): Discuss the clinical need, current treatment landscape, and how hydrogen therapy fits in.
    
    METHODOLOGY (400-500 words): Describe how the research methods translate to clinical protocols and implementation strategies.
    
    RESULTS (500-600 words): Focus on clinically relevant outcomes, patient selection criteria, dosing, and treatment protocols.
    
    DISCUSSION (600-700 words): Address practical considerations, patient safety, contraindications, monitoring requirements, and integration with existing treatments.
    
    CONCLUSION (200-250 words): Provide clear clinical recommendations and implementation guidelines.
    
    REFERENCES: List relevant clinical guidelines and studies.`,
  };

  const basePrompt = prompts[articleType] || prompts.comprehensive_review;

  return `${basePrompt}

Study Title: ${study.title}
Abstract: ${study.abstract}
Authors: ${study.authors}
Journal: ${study.journal}
${study.methods ? `Methods: ${study.methods}` : ""}
${study.results ? `Results: ${study.results}` : ""}
${study.conclusion ? `Conclusion: ${study.conclusion}` : ""}

Write at an 8th-10th grade reading level while maintaining scientific accuracy. Use clear language and define technical terms when first introduced.`;
}

/**
 * Generate basic fallback scientific article
 */
function generateBasicScientificArticle(
  study: Study,
  articleType: string,
): InsertScientificArticle {
  const title = generateFallbackScientificTitle(study, articleType);
  const slug = `scientific-${slugify(title, { lower: true, strict: true })}-${Date.now()}`;
  const image = getDefaultScientificImage(study.category);

  const abstract =
    study.abstract || "This study investigates hydrogen therapy applications.";
  const content = `
# Abstract
${abstract}

# Introduction
Hydrogen therapy represents an emerging field in medical research with potential applications across various health conditions. This article provides a detailed analysis of recent research findings.

# Methodology
The research employed standard scientific protocols to investigate the therapeutic effects of molecular hydrogen.

# Results
The study demonstrated measurable outcomes in the application of hydrogen therapy for the specified conditions.

# Discussion
These findings contribute to our understanding of hydrogen therapy's mechanisms and potential clinical applications. Further research is needed to fully establish treatment protocols.

# Conclusion
This research adds valuable insights to the growing body of evidence supporting hydrogen therapy as a therapeutic intervention.

# References
1. Original research publication
2. Related hydrogen therapy studies
`.trim();

  const wordCount = content.split(/\s+/).length;

  return {
    studyId: study.id,
    title,
    slug,
    articleType,
    content,
    summary: abstract.substring(0, 200),
    abstract,
    introduction:
      "Hydrogen therapy represents an emerging field in medical research.",
    methodology: "The research employed standard scientific protocols.",
    results: "The study demonstrated measurable outcomes.",
    discussion: "These findings contribute to our understanding.",
    conclusion: "This research adds valuable insights.",
    references: ["Original research publication"],
    keywords: ["hydrogen therapy", "medical research", "clinical applications"],
    authors: study.authors,
    readingLevel: "8th-10th grade",
    wordCount,
    readingTime: Math.ceil(wordCount / 200),
    metaTitle: title.substring(0, 60),
    metaDescription: abstract.substring(0, 160),
    imageUrl: image.imageUrl,
    imageAlt: image.imageAlt,
    isPublished: false,
    reviewNotes: "Fallback content generated due to API unavailability.",
  };
}

export default {
  generateScientificArticlesForStudy,
};
