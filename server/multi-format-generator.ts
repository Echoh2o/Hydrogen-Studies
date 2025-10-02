/**
 * Multi-Format Content Generator Service
 * Generates various content formats from research studies
 */

import OpenAI from "openai";
import {
  Study,
  InsertMultiFormatContent,
  multiFormatContent,
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import {
  handleOpenAIRequest,
  handleBatchOperation,
  withTimeout,
} from "./utils/service-error-handlers";
import { AppError, ErrorCode } from "./utils/app-errors";
import { withRetry } from "./utils/database-wrapper";

// Initialize OpenAI client
const initializeOpenAI = (): OpenAI | null => {
  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      "OpenAI API key not configured - content generation will use fallback content",
    );
    return null;
  }

  try {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000,
      maxRetries: 2,
    });
  } catch (error) {
    console.error("Failed to initialize OpenAI client:", error);
    return null;
  }
};

const openai = initializeOpenAI();

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

    const fallbackToBasic = options.fallbackToBasic ?? true;

    // Check OpenAI availability
    if (!openai) {
      if (fallbackToBasic) {
        results.warnings.push("OpenAI not available, generating basic content");
        for (const format of formats) {
          const basicContent = generateBasicContent(study, format);
          results.contents.push(basicContent);
        }
        return results;
      }
      throw new AppError(
        "OpenAI API not configured",
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

  const response = await handleOpenAIRequest(
    async () => {
      if (!openai) throw new Error("OpenAI not initialized");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are a science communicator who creates engaging podcast scripts that make complex research accessible to everyone. Use conversational language, avoid jargon, and maintain a 6th grade reading level.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 3000,
        temperature: 0.7,
        response_format: { type: "json_object" },
      });
      return completion.choices[0]?.message?.content || "{}";
    },
    () =>
      JSON.stringify({
        intro: `Welcome to our health science podcast! Today we're exploring fascinating research about ${study.title.substring(0, 100)}...`,
        mainScript: `This study investigates ${study.abstract.substring(0, 500)}...`,
        qaSegment: [
          {
            question: "What does this mean for everyday health?",
            answer: "This research suggests practical applications...",
          },
          {
            question: "How was this study conducted?",
            answer: "Researchers used scientific methods to...",
          },
          {
            question: "What are the next steps?",
            answer: "Future research will explore...",
          },
        ],
        outro:
          "Thanks for listening! Remember, science is always evolving. Stay curious!",
        showNotes: [
          `Study: ${study.title}`,
          "Key findings discussed",
          "Practical applications",
          "Future research directions",
        ],
        estimatedDuration: 720,
      }),
    { model: "gpt-4o", prompt: "Generate podcast script" },
  );

  const podcastData = JSON.parse(response);

  return {
    studyId: study.id!,
    formatType: ContentFormat.PODCAST,
    title: `Podcast: ${study.plainLanguageTitle || study.title}`,
    podcastScript: podcastData.mainScript,
    podcastIntro: podcastData.intro,
    podcastOutro: podcastData.outro,
    podcastQA: JSON.stringify(podcastData.qaSegment),
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

  const response = await handleOpenAIRequest(
    async () => {
      if (!openai) throw new Error("OpenAI not initialized");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are a data visualization expert who extracts key statistics and creates compelling visual narratives from research studies.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.6,
        response_format: { type: "json_object" },
      });
      return completion.choices[0]?.message?.content || "{}";
    },
    () =>
      JSON.stringify({
        title: `Key Findings: ${study.title.substring(0, 50)}`,
        subheadings: ["Research Overview", "Key Results", "Impact"],
        keyStatistics: [
          {
            label: "Sample Size",
            value: study.sampleSize?.toString() || "N/A",
            context: "participants studied",
          },
          {
            label: "Duration",
            value: study.duration?.toString() || "N/A",
            context: "days of research",
          },
        ],
        comparisons: [],
        visualSuggestions: [
          {
            type: "bar_chart",
            data: "results",
            description: "Compare key outcomes",
          },
        ],
      }),
    { model: "gpt-4o", prompt: "Generate infographic data" },
  );

  const infographicData = JSON.parse(response);

  return {
    studyId: study.id!,
    formatType: ContentFormat.INFOGRAPHIC,
    title: infographicData.title,
    infographicTitle: infographicData.title,
    infographicSubheadings: JSON.stringify(infographicData.subheadings),
    keyStatistics: JSON.stringify(infographicData.keyStatistics),
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
  const platformConfig = {
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

  const response = await handleOpenAIRequest(
    async () => {
      if (!openai) throw new Error("OpenAI not initialized");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a social media expert who creates engaging, shareable content about health research. Adapt your style for ${platform}.`,
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 1000,
        temperature: 0.8,
        response_format: { type: "json_object" },
      });
      return completion.choices[0]?.message?.content || "{}";
    },
    () => {
      if (isTwitter) {
        return JSON.stringify({
          thread: [
            `New research reveals: ${study.title.substring(0, 200)}... 🧵`,
            `Key finding: ${study.abstract.substring(0, 250)}...`,
            `What this means for you: Better understanding leads to better health choices!`,
          ],
          hashtags: ["HealthResearch", "Science", "Wellness"],
          callToAction: "Follow for more health insights!",
        });
      } else {
        return JSON.stringify({
          content: `Exciting research update! ${study.title.substring(0, 200)}... ${study.abstract.substring(0, 300)}`,
          hashtags: ["HealthResearch", "Science", "Wellness", "HealthyLiving"],
          callToAction: "Learn more about this breakthrough research!",
        });
      }
    },
    { model: "gpt-4o", prompt: `Generate ${platform} content` },
  );

  const socialData = JSON.parse(response);

  return {
    studyId: study.id!,
    formatType: platform,
    title: `${platform.replace("social_", "").toUpperCase()} Post: ${study.title.substring(0, 50)}`,
    socialPlatform: platform.replace("social_", ""),
    socialContent: isTwitter ? socialData.thread[0] : socialData.content,
    threadContent: isTwitter ? JSON.stringify(socialData.thread) : undefined,
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

  const response = await handleOpenAIRequest(
    async () => {
      if (!openai) throw new Error("OpenAI not initialized");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are a video script writer who creates engaging, educational content that makes research accessible through visual storytelling.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 2500,
        temperature: 0.7,
        response_format: { type: "json_object" },
      });
      return completion.choices[0]?.message?.content || "{}";
    },
    () =>
      JSON.stringify({
        script: `Have you ever wondered about ${study.title}? Today we'll explore groundbreaking research that could change how we think about health...`,
        storyboard: [
          {
            time: "0:00-0:10",
            scene: "Opening",
            visuals: "Title card with study topic",
            narration: "Introduction hook",
          },
          {
            time: "0:10-0:40",
            scene: "Main content",
            visuals: "Data visualizations",
            narration: "Key findings explained",
          },
          {
            time: "0:40-0:60",
            scene: "Conclusion",
            visuals: "Summary points",
            narration: "Call to action",
          },
        ],
        duration: duration,
        visualCues: [
          "Use animations for data",
          "Include b-roll footage",
          "Add text overlays for key points",
        ],
      }),
    { model: "gpt-4o", prompt: `Generate ${videoType} script` },
  );

  const videoData = JSON.parse(response);

  return {
    studyId: study.id!,
    formatType: videoType,
    title: `${isShortForm ? "Short" : "YouTube"} Video: ${study.title.substring(0, 50)}`,
    videoScript: videoData.script,
    videoType: isShortForm ? "short_form" : "youtube_explainer",
    videoStoryboard: JSON.stringify(videoData.storyboard),
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

  const response = await handleOpenAIRequest(
    async () => {
      if (!openai) throw new Error("OpenAI not initialized");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are an email marketing expert who creates engaging, informative newsletters about health research. Use clear, accessible language.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 3000,
        temperature: 0.7,
        response_format: { type: "json_object" },
      });
      return completion.choices[0]?.message?.content || "{}";
    },
    () =>
      JSON.stringify({
        subjectLine: `New Research: ${study.title.substring(0, 30)}...`,
        preheader: `Discover the latest findings about ${study.category || "health"}`,
        htmlContent: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <h1 style="color: #333; font-size: 24px;">${study.title}</h1>
          <p style="color: #666; line-height: 1.6;">${study.abstract.substring(0, 300)}...</p>
          <h2 style="color: #333; font-size: 18px;">Key Takeaways:</h2>
          <ul style="color: #666;">
            <li>Important finding from the research</li>
            <li>Practical application for readers</li>
            <li>Future implications</li>
          </ul>
          <a href="#" style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Read Full Study</a>
        </div>
      `,
        plainText: `${study.title}\n\n${study.abstract.substring(0, 300)}...\n\nKey Takeaways:\n- Important finding\n- Practical application\n- Future implications\n\nRead more at our website.`,
        keyTakeaways: [
          "Important finding from the research",
          "Practical application for readers",
          "Future implications of this study",
        ],
      }),
    { model: "gpt-4o", prompt: "Generate newsletter content" },
  );

  const newsletterData = JSON.parse(response);

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
  return [...new Set(keywords)].slice(0, 10);
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
