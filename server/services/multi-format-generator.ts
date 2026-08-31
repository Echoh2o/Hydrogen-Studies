/**
 * Multi-Format Content Generator Service
 * Generates various content formats from research studies
 */

import { ai } from "./ai-provider";
import {
  Study,
  InsertMultiFormatContent,
  MultiFormatContent,
  multiFormatContent,
  studies,
} from "@shared/schema";
import {
  PodcastQASchema,
  ThreadContentSchema,
  VideoStoryboardSchema,
  KeyStatisticsSchema,
  validateOrFallback,
} from "@shared/schemas/multi-format";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import {
  handleOpenAIRequest,
  handleBatchOperation,
  withTimeout,
} from "../utils/service-error-handlers";
import { AppError, ErrorCode } from "../utils/app-errors";
import { withRetry } from "../utils/database-wrapper";

// Content format types
export enum ContentFormat {
  PODCAST = "podcast",
  INFOGRAPHIC = "infographic",
  SOCIAL_TWITTER = "social_twitter",
  SOCIAL_LINKEDIN = "social_linkedin",
  SOCIAL_INSTAGRAM = "social_instagram",
  SOCIAL_FACEBOOK = "social_facebook",
  SOCIAL_TIKTOK = "social_tiktok",
  VIDEO_YOUTUBE = "video_youtube",
  VIDEO_SHORT = "video_short",
  NEWSLETTER = "newsletter",
}

/**
 * Generate multiple format contents for a study
 */
export async function generateMultiFormatContent(
  study: Study,
  formats: ContentFormat[] = Object.values(ContentFormat),
  options: {
    fallbackToBasic?: boolean;
    batchGenerate?: boolean;
  } = {},
): Promise<{
  contents: InsertMultiFormatContent[];
  errors: Array<{ format: string; error: string }>;
  warnings: string[];
}> {
  const results = {
    contents: [] as InsertMultiFormatContent[],
    errors: [] as Array<{ format: string; error: string }>,
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

    // Default FALSE (was true): with the old default any AI failure silently
    // shipped generateBasicContent() template boilerplate into the database as
    // if it were generated content. Callers that genuinely want placeholder
    // output must now opt in explicitly.
    const fallbackToBasic = options.fallbackToBasic ?? false;

    // Check AI provider availability
    if (ai.getProviderStatus().primary === "none") {
      if (fallbackToBasic) {
        results.warnings.push("AI provider not available, generating basic content");
        for (const format of formats) {
          const basicContent = generateBasicContent(study, format);
          results.contents.push(basicContent);
        }
        return results;
      }
      throw new AppError(
        "AI provider not configured",
        503,
        ErrorCode.SERVICE_UNAVAILABLE,
      );
    }

    // Generate content for each format
    const batchResults = await handleBatchOperation(
      formats,
      async (format) => {
        return await withTimeout(
          () => generateSingleFormatContent(study, format),
          45000, // 45 second timeout per format
          `Content generation timeout for format: ${format}`,
        );
      },
      { continueOnError: true, maxConcurrent: 2 },
    );

    results.contents = batchResults.successful;

    // Process failures
    for (const failure of batchResults.failed) {
      results.errors.push({
        format: failure.item,
        error: failure.error,
      });

      // Generate fallback for failed formats if enabled
      if (fallbackToBasic) {
        const fallback = generateBasicContent(study, failure.item);
        results.contents.push(fallback);
        results.warnings.push(
          `Generated fallback content for format: ${failure.item}`,
        );
      }
    }

    // Save all generated content to database
    if (results.contents.length > 0) {
      await withRetry(
        async () => {
          await db.insert(multiFormatContent).values(results.contents);
        },
        { maxRetries: 2, retryDelay: 1000 },
      );
    }

    console.log(
      `Multi-format generation complete: ${results.contents.length} formats, ${results.errors.length} errors`,
    );

    return results;
  } catch (error) {
    console.error("Fatal error generating multi-format content:", error);
    throw error;
  }
}

/**
 * Generate content for a single format
 */
async function generateSingleFormatContent(
  study: Study,
  format: ContentFormat,
): Promise<InsertMultiFormatContent> {
  try {
    let content: InsertMultiFormatContent;

    switch (format) {
      case ContentFormat.PODCAST:
        content = await generatePodcastContent(study);
        break;
      case ContentFormat.INFOGRAPHIC:
        content = await generateInfographicContent(study);
        break;
      case ContentFormat.SOCIAL_TWITTER:
      case ContentFormat.SOCIAL_LINKEDIN:
      case ContentFormat.SOCIAL_INSTAGRAM:
      case ContentFormat.SOCIAL_FACEBOOK:
      case ContentFormat.SOCIAL_TIKTOK:
        content = await generateSocialMediaContent(study, format);
        break;
      case ContentFormat.VIDEO_YOUTUBE:
      case ContentFormat.VIDEO_SHORT:
        content = await generateVideoContent(study, format);
        break;
      case ContentFormat.NEWSLETTER:
        content = await generateNewsletterContent(study);
        break;
      default:
        throw new AppError(
          `Unknown format: ${format}`,
          400,
          ErrorCode.VALIDATION_ERROR,
        );
    }

    return content;
  } catch (error) {
    console.error(`Failed to generate ${format} content:`, error);
    throw error;
  }
}

/**
 * Generate podcast script content
 */
async function generatePodcastContent(
  study: Study,
): Promise<InsertMultiFormatContent> {
  const prompt = `
Convert this research study into an engaging 10-15 minute podcast script at a 6th grade reading level.

Study Title: ${study.title}
Abstract: ${study.abstract}
Key Findings: ${study.results || study.resultsShort || "Not available"}
Conclusion: ${study.conclusion || study.conclusionShort || "Not available"}

Create a complete podcast script with:
1. INTRO (30 seconds): Hook the listener with an intriguing question or fact
2. MAIN CONTENT (10-12 minutes): 
   - Explain the research in simple terms
   - Use analogies and examples
   - Break down complex concepts
   - Include 2-3 "Did you know?" moments
3. Q&A SEGMENT (2-3 minutes): Answer 3 common questions about this topic
4. OUTRO (30 seconds): Summarize key takeaways and call-to-action
5. SHOW NOTES: 5-7 bullet points summarizing the episode

Format the response as JSON with these fields:
- intro: string
- mainScript: string
- qaSegment: array of {question: string, answer: string}
- outro: string
- showNotes: array of strings
- estimatedDuration: number (in seconds)
`;

  let podcastData: any;
  try {
    const systemPrompt = "You are a science communicator who creates engaging podcast scripts that make complex research accessible to everyone. Use conversational language, avoid jargon, and maintain a 6th grade reading level.";

    podcastData = await ai.generateJSON(systemPrompt, prompt, {
      maxTokens: 3000,
      temperature: 0.7,
    });
  } catch (error) {
    // No canned fallback: persisting hardcoded template text as if it were
    // AI-generated content is the "dumb content" bug. Rethrow — the batch
    // handler records this format in results.errors honestly.
    throw error;
  }

  return {
    studyId: study.id!,
    formatType: ContentFormat.PODCAST,
    title: `Podcast: ${study.plainLanguageTitle || study.title}`,
    podcastScript: podcastData.mainScript,
    podcastIntro: podcastData.intro,
    podcastOutro: podcastData.outro,
    podcastQA: JSON.stringify(
      validateOrFallback(podcastData.qaSegment, PodcastQASchema, [], "podcastQA"),
    ),
    podcastShowNotes: podcastData.showNotes.join("\n"),
    podcastDuration: podcastData.estimatedDuration,
    readingLevel: "6th_grade",
    wordCount: podcastData.mainScript.split(" ").length,
    keywords: extractKeywords(study),
    generatedBy: "ai",
    generationModel: "gpt-4o",
    generationPrompt: prompt.substring(0, 500),
    metaDescription: `Podcast episode discussing ${study.title}`,
  };
}

/**
 * Generate infographic data content
 */
async function generateInfographicContent(
  study: Study,
): Promise<InsertMultiFormatContent> {
  const prompt = `
Extract key data points and statistics from this research study for an infographic.

Study Title: ${study.title}
Abstract: ${study.abstract}
Results: ${study.results || study.resultsShort || "Not available"}
Sample Size: ${study.sampleSize || "Not specified"}

Create infographic data with:
1. KEY STATISTICS: 5-7 most important numbers/percentages
2. COMPARISONS: 2-3 before/after or control/treatment comparisons
3. TIMELINE: Key milestones if applicable
4. VISUAL SUGGESTIONS: Design recommendations for charts/graphs
5. TITLE & SUBHEADINGS: Catchy, clear titles

Format as JSON with:
- title: string
- subheadings: array of strings
- keyStatistics: array of {label: string, value: string, context: string}
- comparisons: array of {label: string, before: string, after: string}
- visualSuggestions: array of {type: string, data: string, description: string}
`;

  let infographicData: any;
  try {
    const systemPrompt = "You are a data visualization expert who extracts key statistics and creates compelling visual narratives from research studies.";

    infographicData = await ai.generateJSON(systemPrompt, prompt, {
      maxTokens: 2000,
      temperature: 0.6,
    });
  } catch (error) {
    // No canned fallback: persisting hardcoded template text as if it were
    // AI-generated content is the "dumb content" bug. Rethrow — the batch
    // handler records this format in results.errors honestly.
    throw error;
  }

  return {
    studyId: study.id!,
    formatType: ContentFormat.INFOGRAPHIC,
    title: infographicData.title,
    infographicTitle: infographicData.title,
    infographicSubheadings: JSON.stringify(infographicData.subheadings),
    keyStatistics: JSON.stringify(
      validateOrFallback(infographicData.keyStatistics, KeyStatisticsSchema, [], "keyStatistics"),
    ),
    dataPoints: JSON.stringify(infographicData.comparisons),
    visualSuggestions: JSON.stringify(infographicData.visualSuggestions),
    readingLevel: "6th_grade",
    keywords: extractKeywords(study),
    generatedBy: "ai",
    generationModel: "gpt-4o",
    generationPrompt: prompt.substring(0, 500),
    metaDescription: `Infographic data for ${study.title}`,
  };
}

/**
 * Generate social media content
 */
async function generateSocialMediaContent(
  study: Study,
  platform: ContentFormat,
): Promise<InsertMultiFormatContent> {
  const platformConfig: Record<string, { maxLength: number; style: string; hashtagCount: number }> = {
    [ContentFormat.SOCIAL_TWITTER]: {
      maxLength: 280,
      style: "concise, punchy, uses threads",
      hashtagCount: 3,
    },
    [ContentFormat.SOCIAL_LINKEDIN]: {
      maxLength: 1300,
      style: "professional, informative",
      hashtagCount: 5,
    },
    [ContentFormat.SOCIAL_INSTAGRAM]: {
      maxLength: 2200,
      style: "engaging, visual, story-focused",
      hashtagCount: 10,
    },
    [ContentFormat.SOCIAL_FACEBOOK]: {
      maxLength: 500,
      style: "conversational, community-oriented",
      hashtagCount: 3,
    },
    [ContentFormat.SOCIAL_TIKTOK]: {
      maxLength: 150,
      style: "trendy, youth-oriented, fun facts",
      hashtagCount: 5,
    },
  };

  const config = platformConfig[platform];
  const isTwitter = platform === ContentFormat.SOCIAL_TWITTER;

  const prompt = `
Create ${platform.replace("social_", "").toUpperCase()} content about this research study.

Study Title: ${study.title}
Key Finding: ${study.conclusionShort || study.conclusion?.substring(0, 200) || study.abstract.substring(0, 200)}

Requirements:
- Style: ${config.style}
- Max length: ${config.maxLength} characters ${isTwitter ? "per tweet" : ""}
- Include ${config.hashtagCount} relevant hashtags
- 6th grade reading level
- ${isTwitter ? "Create a 3-5 tweet thread" : "Single post"}

Format as JSON:
${
  isTwitter
    ? "- thread: array of tweet texts (each under 280 chars)"
    : "- content: main post text"
}
- hashtags: array of hashtags (without #)
- callToAction: string
`;

  let socialData: any;
  try {
    const systemPrompt = `You are a social media expert who creates engaging, shareable content about health research. Adapt your style for ${platform}.`;

    socialData = await ai.generateJSON(systemPrompt, prompt, {
      maxTokens: 1000,
      temperature: 0.8,
    });
  } catch (error) {
    // No canned fallback: persisting hardcoded template text as if it were
    // AI-generated content is the "dumb content" bug. Rethrow — the batch
    // handler records this format in results.errors honestly.
    throw error;
  }

  return {
    studyId: study.id!,
    formatType: platform,
    title: `${platform.replace("social_", "").toUpperCase()} Post: ${study.title.substring(0, 50)}`,
    socialPlatform: platform.replace("social_", ""),
    socialContent: isTwitter ? socialData.thread[0] : socialData.content,
    threadContent: isTwitter
      ? JSON.stringify(
          validateOrFallback(socialData.thread, ThreadContentSchema, [], "threadContent"),
        )
      : undefined,
    hashtags: socialData.hashtags,
    characterCount: isTwitter
      ? socialData.thread.reduce(
          (acc: number, tweet: string) => acc + tweet.length,
          0,
        )
      : socialData.content.length,
    readingLevel: "6th_grade",
    keywords: extractKeywords(study),
    generatedBy: "ai",
    generationModel: "gpt-4o",
    generationPrompt: prompt.substring(0, 500),
    metaDescription: `${platform} post about ${study.title}`,
  };
}

/**
 * Generate video content
 */
async function generateVideoContent(
  study: Study,
  videoType: ContentFormat,
): Promise<InsertMultiFormatContent> {
  const isShortForm = videoType === ContentFormat.VIDEO_SHORT;
  const duration = isShortForm ? 60 : 300; // 60 seconds vs 5 minutes

  const prompt = `
Create a ${isShortForm ? "short-form (60 second)" : "YouTube explainer (5 minute)"} video script about this research.

Study: ${study.title}
Key Finding: ${study.conclusion || study.abstract.substring(0, 300)}

Create a complete video script with:
1. HOOK (${isShortForm ? "5" : "10"} seconds): Attention-grabbing opening
2. MAIN CONTENT: Clear explanation with visual cues
3. VISUAL STORYBOARD: Scene-by-scene breakdown with timing
4. CALL-TO-ACTION: End screen message

Format as JSON:
- script: full narration text
- storyboard: array of {time: string, scene: string, visuals: string, narration: string}
- duration: total seconds
- visualCues: array of visual direction notes
`;

  let videoData: any;
  try {
    const systemPrompt = "You are a video script writer who creates engaging, educational content that makes research accessible through visual storytelling.";

    videoData = await ai.generateJSON(systemPrompt, prompt, {
      maxTokens: 2500,
      temperature: 0.7,
    });
  } catch (error) {
    // No canned fallback: persisting hardcoded template text as if it were
    // AI-generated content is the "dumb content" bug. Rethrow — the batch
    // handler records this format in results.errors honestly.
    throw error;
  }

  return {
    studyId: study.id!,
    formatType: videoType,
    title: `${isShortForm ? "Short" : "YouTube"} Video: ${study.title.substring(0, 50)}`,
    videoScript: videoData.script,
    videoType: isShortForm ? "short_form" : "youtube_explainer",
    videoStoryboard: JSON.stringify(
      validateOrFallback(videoData.storyboard, VideoStoryboardSchema, [], "videoStoryboard"),
    ),
    videoDuration: videoData.duration,
    visualCues: JSON.stringify(videoData.visualCues),
    readingLevel: "6th_grade",
    wordCount: videoData.script.split(" ").length,
    keywords: extractKeywords(study),
    generatedBy: "ai",
    generationModel: "gpt-4o",
    generationPrompt: prompt.substring(0, 500),
    metaDescription: `Video script for ${study.title}`,
  };
}

/**
 * Generate newsletter content
 */
async function generateNewsletterContent(
  study: Study,
): Promise<InsertMultiFormatContent> {
  const prompt = `
Create an email newsletter section about this research study for a weekly health digest.

Study: ${study.title}
Abstract: ${study.abstract}
Conclusion: ${study.conclusion || study.conclusionShort || "Key findings"}

Create newsletter content with:
1. SUBJECT LINE: Compelling, under 50 characters
2. PREHEADER: Preview text, under 100 characters
3. HTML CONTENT: Mobile-responsive, with sections for:
   - Hero headline
   - Summary (2-3 paragraphs)
   - Key takeaways (3-5 bullet points)
   - Call-to-action button
4. PLAIN TEXT VERSION: For email clients without HTML support

Format as JSON:
- subjectLine: string
- preheader: string
- htmlContent: HTML string with inline CSS
- plainText: plain text version
- keyTakeaways: array of strings
`;

  let newsletterData: any;
  try {
    const systemPrompt = "You are an email marketing expert who creates engaging, informative newsletters about health research. Use clear, accessible language.";

    newsletterData = await ai.generateJSON(systemPrompt, prompt, {
      maxTokens: 3000,
      temperature: 0.7,
    });
  } catch (error) {
    // No canned fallback: persisting hardcoded template text as if it were
    // AI-generated content is the "dumb content" bug. Rethrow — the batch
    // handler records this format in results.errors honestly.
    throw error;
  }

  return {
    studyId: study.id!,
    formatType: ContentFormat.NEWSLETTER,
    title: `Newsletter: ${study.title.substring(0, 50)}`,
    newsletterSubjectLine: newsletterData.subjectLine,
    newsletterPreheader: newsletterData.preheader,
    newsletterHtml: newsletterData.htmlContent,
    newsletterPlainText: newsletterData.plainText,
    readingLevel: "6th_grade",
    wordCount: newsletterData.plainText.split(" ").length,
    keywords: extractKeywords(study),
    generatedBy: "ai",
    generationModel: "gpt-4o",
    generationPrompt: prompt.substring(0, 500),
    metaDescription: newsletterData.preheader,
  };
}

/**
 * Generate basic fallback content when AI is not available
 */
function generateBasicContent(
  study: Study,
  format: ContentFormat,
): InsertMultiFormatContent {
  const baseContent: InsertMultiFormatContent = {
    studyId: study.id!,
    formatType: format,
    title: `${format.replace(/_/g, " ").toUpperCase()}: ${study.title.substring(0, 50)}`,
    readingLevel: "6th_grade",
    generatedBy: "fallback",
    generationModel: "none",
    metaDescription: `${format} content for ${study.title}`,
    keywords: extractKeywords(study),
  };

  // Add format-specific fallback content
  switch (format) {
    case ContentFormat.PODCAST:
      return {
        ...baseContent,
        podcastScript: `This study explores ${study.title}. The research found that ${study.abstract.substring(0, 500)}...`,
        podcastIntro: `Welcome to our podcast discussing ${study.title}`,
        podcastOutro: "Thanks for listening!",
        podcastShowNotes: "Study overview and key findings",
        podcastDuration: 600,
      };

    case ContentFormat.INFOGRAPHIC:
      return {
        ...baseContent,
        infographicTitle: study.title,
        keyStatistics: JSON.stringify([
          {
            label: "Study Type",
            value: study.studyType || "Research",
            context: "",
          },
        ]),
        visualSuggestions: JSON.stringify([
          { type: "text", data: "title", description: "Display study title" },
        ]),
      };

    case ContentFormat.SOCIAL_TWITTER:
    case ContentFormat.SOCIAL_LINKEDIN:
    case ContentFormat.SOCIAL_INSTAGRAM:
    case ContentFormat.SOCIAL_FACEBOOK:
    case ContentFormat.SOCIAL_TIKTOK:
      return {
        ...baseContent,
        socialPlatform: format.replace("social_", ""),
        socialContent: `New research: ${study.title}. ${study.abstract.substring(0, 200)}...`,
        hashtags: ["research", "health", "science"],
      };

    case ContentFormat.VIDEO_YOUTUBE:
    case ContentFormat.VIDEO_SHORT:
      return {
        ...baseContent,
        videoScript: `Today we're discussing ${study.title}. This research shows ${study.abstract.substring(0, 300)}...`,
        videoType:
          format === ContentFormat.VIDEO_SHORT
            ? "short_form"
            : "youtube_explainer",
        videoDuration: format === ContentFormat.VIDEO_SHORT ? 60 : 300,
      };

    case ContentFormat.NEWSLETTER:
      return {
        ...baseContent,
        newsletterSubjectLine: `Research Update: ${study.title.substring(0, 30)}`,
        newsletterPreheader: "Latest findings in health research",
        newsletterPlainText: `${study.title}\n\n${study.abstract}\n\nRead more on our website.`,
        newsletterHtml: `<h1>${study.title}</h1><p>${study.abstract}</p>`,
      };

    default:
      return baseContent;
  }
}

/**
 * Extract keywords from study
 */
function extractKeywords(study: Study): string[] {
  const keywords: string[] = [];

  // Add existing keywords
  if (study.keywords && Array.isArray(study.keywords)) {
    keywords.push(...study.keywords);
  }

  // Add category
  if (study.category) {
    keywords.push(study.category.toLowerCase());
  }

  // Extract from title
  const titleWords = study.title
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 4)
    .slice(0, 5);
  keywords.push(...titleWords);

  // Remove duplicates and return
  return Array.from(new Set(keywords)).slice(0, 10);
}

/**
 * Get all generated content for a study
 */
export async function getStudyMultiFormatContent(
  studyId: number,
): Promise<MultiFormatContent[]> {
  try {
    const content = await db
      .select()
      .from(multiFormatContent)
      .where(eq(multiFormatContent.studyId, studyId));

    return content;
  } catch (error) {
    console.error("Error fetching multi-format content:", error);
    throw new AppError(
      "Failed to fetch content",
      500,
      ErrorCode.DATABASE_ERROR,
    );
  }
}

/**
 * Update multi-format content
 */
export async function updateMultiFormatContent(
  id: number,
  updates: Partial<InsertMultiFormatContent>,
): Promise<void> {
  try {
    await db
      .update(multiFormatContent)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(multiFormatContent.id, id));
  } catch (error) {
    console.error("Error updating multi-format content:", error);
    throw new AppError(
      "Failed to update content",
      500,
      ErrorCode.DATABASE_ERROR,
    );
  }
}

/**
 * Delete multi-format content
 */
export async function deleteMultiFormatContent(id: number): Promise<void> {
  try {
    await db.delete(multiFormatContent).where(eq(multiFormatContent.id, id));
  } catch (error) {
    console.error("Error deleting multi-format content:", error);
    throw new AppError(
      "Failed to delete content",
      500,
      ErrorCode.DATABASE_ERROR,
    );
  }
}

/**
 * Batch generate all formats for a study
 */
export async function batchGenerateAllFormats(studyId: number): Promise<{
  success: boolean;
  generated: number;
  errors: string[];
}> {
  try {
    // Fetch the study
    const study = await db.query.studies.findFirst({
      where: eq(studies.id, studyId),
    });

    if (!study) {
      throw new AppError("Study not found", 404, ErrorCode.NOT_FOUND);
    }

    // Generate all formats
    const results = await generateMultiFormatContent(
      study,
      Object.values(ContentFormat),
      { batchGenerate: true },
    );

    return {
      success: results.errors.length === 0,
      generated: results.contents.length,
      errors: results.errors.map((e) => `${e.format}: ${e.error}`),
    };
  } catch (error) {
    console.error("Error in batch generation:", error);
    throw error;
  }
}
