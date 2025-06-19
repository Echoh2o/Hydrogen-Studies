/**
 * Blog Article Recommendation System
 * Automatically recommends studies for blog creation and handles bulk generation
 */

import OpenAI from "openai";
import { db } from "./db";
import { studies, blogArticles } from "@shared/schema";
import { sql, eq, notInArray, desc, and, isNull, ne } from "drizzle-orm";
import slugify from 'slugify';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface BlogRecommendation {
  studyId: number;
  studyTitle: string;
  studyAbstract: string;
  studyAuthors: string;
  studyJournal: string;
  studyCategory: string;
  studyPublishDate: string;
  priority: 'high' | 'medium' | 'low';
  reasonForRecommendation: string;
  suggestedBlogTypes: string[];
  estimatedReadership: string;
  seoKeywords: string[];
  potentialTitle: string;
  hasExistingBlogs: boolean;
  existingBlogCount: number;
}

export interface BulkGenerationRequest {
  selectedStudyIds: number[];
  articleTypes: string[];
  readingLevel: string;
  includeImages: boolean;
  includeSEO: boolean;
}

export interface GeneratedBlogContent {
  title: string;
  slug: string;
  summary: string;
  content: string;
  articleType: string;
  readingLevel: string;
  imagePrompt?: string;
  imageUrl?: string;
  imageAlt?: string;
  seoTitle?: string;
  seoDescription?: string;
  tags?: string[];
  keywords?: string[];
}

export interface BulkGenerationResult {
  studyId: number;
  studyTitle: string;
  generatedBlogs: GeneratedBlogContent[];
  success: boolean;
  error?: string;
}

/**
 * Get blog article recommendations based on studies without blogs or with few blogs
 */
export async function getBlogRecommendations(limit: number = 20): Promise<BlogRecommendation[]> {
  try {
    console.log('Fetching blog recommendations...');
    
    // Get studies with their blog counts
    const studiesWithBlogCounts = await db
      .select({
        id: studies.id,
        title: studies.title,
        abstract: studies.abstract,
        authors: studies.authors,
        journal: studies.journal,
        category: studies.category,
        publishDate: studies.publishDate,
        journalPublishDate: studies.journalPublishDate,
        blogCount: sql<number>`COALESCE(COUNT(${blogArticles.id}), 0)`
      })
      .from(studies)
      .leftJoin(blogArticles, eq(studies.id, blogArticles.studyId))
      .groupBy(studies.id)
      .having(sql`COUNT(${blogArticles.id}) < 3`) // Studies with fewer than 3 blogs
      .orderBy(desc(studies.id))
      .limit(limit * 2); // Get more to filter through

    console.log(`Found ${studiesWithBlogCounts.length} studies with < 3 blogs`);

    if (!studiesWithBlogCounts.length) {
      return [];
    }

    // Check if OpenAI API key is available
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    console.log(`OpenAI available: ${hasOpenAI}`);

    const recommendations: BlogRecommendation[] = [];
    
    for (const study of studiesWithBlogCounts.slice(0, limit)) {
      try {
        let aiAnalysis;
        
        if (hasOpenAI) {
          // Try AI analysis with timeout
          try {
            aiAnalysis = await Promise.race([
              analyzeStudyForBlogPotential(study),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('AI analysis timeout')), 10000)
              )
            ]);
          } catch (aiError) {
            console.log(`AI analysis failed for study ${study.id}, using fallback`);
            aiAnalysis = null;
          }
        }
        
        if (aiAnalysis) {
          recommendations.push({
            studyId: study.id,
            studyTitle: study.title,
            studyAbstract: study.abstract,
            studyAuthors: study.authors,
            studyJournal: study.journal,
            studyCategory: study.category,
            studyPublishDate: study.publishDate || study.journalPublishDate || 'Unknown',
            priority: aiAnalysis.priority,
            reasonForRecommendation: aiAnalysis.reason,
            suggestedBlogTypes: aiAnalysis.suggestedTypes,
            estimatedReadership: aiAnalysis.estimatedReadership,
            seoKeywords: aiAnalysis.seoKeywords,
            potentialTitle: aiAnalysis.potentialTitle,
            hasExistingBlogs: study.blogCount > 0,
            existingBlogCount: study.blogCount
          });
        } else {
          // Use rule-based analysis for fallback
          const ruleBasedAnalysis = createRuleBasedRecommendation(study);
          recommendations.push({
            studyId: study.id,
            studyTitle: study.title,
            studyAbstract: study.abstract,
            studyAuthors: study.authors,
            studyJournal: study.journal,
            studyCategory: study.category,
            studyPublishDate: study.publishDate || study.journalPublishDate || 'Unknown',
            priority: ruleBasedAnalysis.priority,
            reasonForRecommendation: ruleBasedAnalysis.reason,
            suggestedBlogTypes: ruleBasedAnalysis.suggestedTypes,
            estimatedReadership: ruleBasedAnalysis.estimatedReadership,
            seoKeywords: ruleBasedAnalysis.seoKeywords,
            potentialTitle: ruleBasedAnalysis.potentialTitle,
            hasExistingBlogs: study.blogCount > 0,
            existingBlogCount: study.blogCount
          });
        }
      } catch (error) {
        console.error(`Error processing study ${study.id}:`, error);
      }
    }

    // Sort by priority (high, medium, low) and return
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

  } catch (error) {
    console.error('Error getting blog recommendations:', error);
    return [];
  }
}

/**
 * Create rule-based recommendation without AI
 */
function createRuleBasedRecommendation(study: any): {
  priority: 'high' | 'medium' | 'low';
  reason: string;
  suggestedTypes: string[];
  estimatedReadership: string;
  seoKeywords: string[];
  potentialTitle: string;
} {
  const title = study.title.toLowerCase();
  const abstract = (study.abstract || '').toLowerCase();
  const category = (study.category || '').toLowerCase();
  
  // Determine priority based on keywords and category
  let priority: 'high' | 'medium' | 'low' = 'medium';
  let reason = 'Study has limited blog coverage and could benefit from consumer-friendly articles';
  
  const highPriorityKeywords = ['clinical trial', 'human study', 'therapeutic', 'treatment', 'therapy', 'health benefits'];
  const mediumPriorityKeywords = ['research', 'study', 'analysis', 'investigation'];
  
  if (highPriorityKeywords.some(keyword => title.includes(keyword) || abstract.includes(keyword))) {
    priority = 'high';
    reason = 'High-impact clinical research with direct therapeutic applications - excellent for consumer education';
  } else if (study.blogCount === 0) {
    priority = 'high';
    reason = 'No existing blog coverage - high opportunity for new content creation';
  }
  
  // Suggest article types based on content
  const suggestedTypes = ['explainer', 'summary'];
  if (title.includes('clinical') || abstract.includes('patients')) {
    suggestedTypes.push('clinical-insights');
  }
  if (title.includes('mechanism') || abstract.includes('molecular')) {
    suggestedTypes.push('science-breakdown');
  }
  
  // Generate SEO keywords
  const seoKeywords = ['hydrogen therapy', 'research'];
  if (category) seoKeywords.push(category);
  
  // Extract key terms for additional keywords
  const keyTerms = title.split(' ').filter(word => 
    word.length > 4 && !['study', 'research', 'analysis', 'investigation'].includes(word.toLowerCase())
  ).slice(0, 2);
  seoKeywords.push(...keyTerms);
  
  // Generate potential title
  const titleWords = study.title.split(' ').slice(0, 8).join(' ');
  const potentialTitle = titleWords.length > 50 
    ? `${titleWords.substring(0, 47)}...` 
    : `Understanding ${titleWords}`;
  
  return {
    priority,
    reason,
    suggestedTypes,
    estimatedReadership: priority === 'high' ? 'High' : 'Medium',
    seoKeywords,
    potentialTitle
  };
}

/**
 * Analyze study using AI to determine blog potential
 */
async function analyzeStudyForBlogPotential(study: any): Promise<{
  priority: 'high' | 'medium' | 'low';
  reason: string;
  suggestedTypes: string[];
  estimatedReadership: string;
  seoKeywords: string[];
  potentialTitle: string;
}> {
  const prompt = `Analyze this hydrogen therapy research study for blog article potential:

Title: ${study.title}
Abstract: ${study.abstract}
Journal: ${study.journal}
Category: ${study.category}
Authors: ${study.authors}
Existing blog count: ${study.blogCount}

Please analyze and provide:
1. Priority level (high/medium/low) based on public interest, SEO potential, and educational value
2. Reason for this priority level (2-3 sentences)
3. Suggested article types (choose 2-3 from: explainer, summary, implications, timeline, benefits, how-to)
4. Estimated readership appeal (High/Medium/Low)
5. 5-8 SEO keywords that would rank well
6. A potential blog title that would be compelling and SEO-friendly

Respond in JSON format:
{
  "priority": "high|medium|low",
  "reason": "explanation",
  "suggestedTypes": ["type1", "type2"],
  "estimatedReadership": "High|Medium|Low",
  "seoKeywords": ["keyword1", "keyword2"],
  "potentialTitle": "compelling title"
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    messages: [
      {
        role: "system",
        content: "You are an expert content strategist specializing in health and medical research content. Analyze research studies for their blog potential, considering SEO, public interest, and educational value."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 500
  });

  try {
    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    return {
      priority: analysis.priority || 'medium',
      reason: analysis.reason || 'Study has potential for blog coverage',
      suggestedTypes: analysis.suggestedTypes || ['explainer', 'summary'],
      estimatedReadership: analysis.estimatedReadership || 'Medium',
      seoKeywords: analysis.seoKeywords || ['hydrogen therapy', 'research'],
      potentialTitle: analysis.potentialTitle || study.title
    };
  } catch (error) {
    console.error('Error parsing AI analysis:', error);
    throw error;
  }
}

/**
 * Generate multiple blog articles for selected studies
 */
export async function generateBulkBlogs(request: BulkGenerationRequest): Promise<BulkGenerationResult[]> {
  const results: BulkGenerationResult[] = [];

  for (const studyId of request.selectedStudyIds) {
    try {
      // Get study details
      const [study] = await db
        .select()
        .from(studies)
        .where(eq(studies.id, studyId))
        .limit(1);

      if (!study) {
        results.push({
          studyId,
          studyTitle: 'Unknown Study',
          generatedBlogs: [],
          success: false,
          error: 'Study not found'
        });
        continue;
      }

      const generatedBlogs: GeneratedBlogContent[] = [];

      // Generate blogs for each requested article type
      for (const articleType of request.articleTypes) {
        try {
          const blogContent = await generateSingleBlogContent(
            study,
            articleType,
            request.readingLevel,
            request.includeImages,
            request.includeSEO
          );
          
          generatedBlogs.push(blogContent);
        } catch (error) {
          console.error(`Error generating ${articleType} blog for study ${studyId}:`, error);
        }
      }

      results.push({
        studyId,
        studyTitle: study.title,
        generatedBlogs,
        success: generatedBlogs.length > 0,
        error: generatedBlogs.length === 0 ? 'Failed to generate any blog content' : undefined
      });

    } catch (error) {
      console.error(`Error processing study ${studyId}:`, error);
      results.push({
        studyId,
        studyTitle: 'Error',
        generatedBlogs: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return results;
}

/**
 * Generate a single blog article with full content and SEO optimization
 */
async function generateSingleBlogContent(
  study: any,
  articleType: string,
  readingLevel: string,
  includeImages: boolean,
  includeSEO: boolean
): Promise<GeneratedBlogContent> {
  
  // Generate main content
  const contentPrompt = createContentPrompt(study, articleType, readingLevel);
  
  const contentResponse = await openai.chat.completions.create({
    model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    messages: [
      {
        role: "system",
        content: `You are an expert medical content writer specializing in making complex research accessible. Write engaging, accurate blog content about hydrogen therapy research.`
      },
      {
        role: "user",
        content: contentPrompt
      }
    ],
    temperature: 0.7,
    max_tokens: 2000
  });

  const content = contentResponse.choices[0].message.content || '';

  // Generate title and summary
  const metaPrompt = `Based on this blog content about hydrogen therapy research, provide:
1. An engaging, SEO-optimized title (60 characters or less)
2. A compelling 2-3 sentence summary for previews and social sharing
3. A URL-friendly slug

Content preview: ${content.substring(0, 500)}...

Respond in JSON format:
{
  "title": "engaging title",
  "summary": "compelling summary",
  "slug": "url-friendly-slug"
}`;

  const metaResponse = await openai.chat.completions.create({
    model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    messages: [
      {
        role: "system", 
        content: "You are an SEO and content marketing expert. Create optimized titles, summaries, and slugs for blog articles."
      },
      {
        role: "user",
        content: metaPrompt
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 300
  });

  const meta = JSON.parse(metaResponse.choices[0].message.content || '{}');

  const result: GeneratedBlogContent = {
    title: meta.title || `Understanding ${study.title.split(' ').slice(0, 6).join(' ')}`,
    slug: meta.slug || slugify(meta.title || study.title, { lower: true, strict: true }),
    summary: meta.summary || 'Exploring the latest research in hydrogen therapy and its potential health benefits.',
    content: content,
    articleType: articleType,
    readingLevel: readingLevel
  };

  // Generate image if requested
  if (includeImages) {
    try {
      const imageData = await generateBlogImage(study, result.title);
      result.imagePrompt = imageData.prompt;
      result.imageUrl = imageData.url;
      result.imageAlt = imageData.alt;
    } catch (error) {
      console.error('Error generating image:', error);
    }
  }

  // Generate SEO data if requested
  if (includeSEO) {
    try {
      const seoData = await generateSEOData(study, result);
      result.seoTitle = seoData.title;
      result.seoDescription = seoData.description;
      result.tags = seoData.tags;
      result.keywords = seoData.keywords;
    } catch (error) {
      console.error('Error generating SEO data:', error);
    }
  }

  return result;
}

/**
 * Create content generation prompt based on article type
 */
function createContentPrompt(study: any, articleType: string, readingLevel: string): string {
  const baseInfo = `
Study Title: ${study.title}
Abstract: ${study.abstract}
Authors: ${study.authors}
Journal: ${study.journal}
Category: ${study.category}
`;

  const readingLevelInstruction = readingLevel === '6th' 
    ? 'Write at a 6th grade reading level (ages 11-12) using simple words and short sentences.'
    : readingLevel === 'high-school'
    ? 'Write at a high school level (ages 14-18) with moderate complexity.'
    : 'Write for a general adult audience with accessible but comprehensive language.';

  switch (articleType) {
    case 'explainer':
      return `${baseInfo}

Write a comprehensive explainer article (800-1200 words) that breaks down this hydrogen therapy research study. ${readingLevelInstruction}

Structure:
1. Engaging introduction explaining why this research matters
2. What the researchers did (methodology in simple terms)
3. What they discovered (key findings)
4. Why it matters for health and medicine
5. What comes next in research
6. Conclusion with key takeaways

Make it engaging, accurate, and easy to understand. Use headings and bullet points where helpful.`;

    case 'summary':
      return `${baseInfo}

Write a concise research summary article (400-600 words) about this hydrogen therapy study. ${readingLevelInstruction}

Structure:
1. Brief introduction to the research question
2. Key methodology points
3. Main findings and results
4. Clinical implications
5. Bottom line for readers

Focus on the most important takeaways that readers need to know.`;

    case 'implications':
      return `${baseInfo}

Write an article (600-800 words) focusing on the health implications and real-world applications of this hydrogen therapy research. ${readingLevelInstruction}

Structure:
1. Introduction to the potential health benefits
2. What this research tells us about hydrogen therapy
3. Practical applications for healthcare
4. Who might benefit from these findings
5. Future directions and next steps
6. Conclusion with actionable insights

Emphasize practical relevance and potential impact on health and wellness.`;

    case 'benefits':
      return `${baseInfo}

Write a benefits-focused article (600-800 words) about the potential health advantages revealed by this hydrogen therapy research. ${readingLevelInstruction}

Structure:
1. Overview of hydrogen therapy benefits
2. Specific benefits found in this study
3. How these benefits might work (mechanisms)
4. Who could potentially benefit
5. How to interpret these research findings
6. What to expect from future research

Focus on evidence-based benefits while being clear about research limitations.`;

    case 'how-to':
      return `${baseInfo}

Write a practical how-to article (700-900 words) that helps readers understand and potentially apply insights from this hydrogen therapy research. ${readingLevelInstruction}

Structure:
1. Introduction to hydrogen therapy basics
2. What this research teaches us
3. Practical considerations for implementation
4. Safety considerations and precautions
5. How to stay updated on research developments
6. Resources for further learning

Be practical and actionable while emphasizing the importance of medical consultation.`;

    default:
      return `${baseInfo}

Write an informative article (600-800 words) about this hydrogen therapy research study. ${readingLevelInstruction}

Make it engaging, accurate, and accessible to your target audience. Include key findings, significance, and implications for health and wellness.`;
  }
}

/**
 * Generate image for blog article using DALL-E
 */
async function generateBlogImage(study: any, title: string): Promise<{
  prompt: string;
  url: string;
  alt: string;
}> {
  const imagePrompt = `Create a professional, scientific illustration representing hydrogen therapy research. The image should be modern, clean, and educational, showing molecular hydrogen (H2) in a medical/health context. Include visual elements that suggest cellular health, medical research, or therapeutic benefits. Style: Clean, modern, professional medical illustration with soft blue and white colors. No text or people in the image.`;

  const imageResponse = await openai.images.generate({
    model: "dall-e-3",
    prompt: imagePrompt,
    n: 1,
    size: "1024x1024",
    quality: "standard",
  });

  const imageUrl = imageResponse.data?.[0]?.url;
  
  if (!imageUrl) {
    throw new Error('Failed to generate image');
  }

  return {
    prompt: imagePrompt,
    url: imageUrl,
    alt: `Scientific illustration representing hydrogen therapy research: ${title}`
  };
}

/**
 * Generate SEO optimization data
 */
async function generateSEOData(study: any, blogContent: GeneratedBlogContent): Promise<{
  title: string;
  description: string;
  tags: string[];
  keywords: string[];
}> {
  const seoPrompt = `Generate SEO optimization data for this hydrogen therapy blog article:

Title: ${blogContent.title}
Summary: ${blogContent.summary}
Study Category: ${study.category}
Content Preview: ${blogContent.content.substring(0, 300)}...

Provide:
1. SEO-optimized title (55-60 characters, includes primary keyword)
2. Meta description (150-160 characters, compelling and keyword-rich)
3. 5-8 relevant tags for categorization
4. 8-12 SEO keywords (mix of long-tail and short-tail)

Focus on keywords people would search for when looking for hydrogen therapy information.

Respond in JSON format:
{
  "title": "SEO title",
  "description": "meta description",
  "tags": ["tag1", "tag2"],
  "keywords": ["keyword1", "keyword2"]
}`;

  const seoResponse = await openai.chat.completions.create({
    model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    messages: [
      {
        role: "system",
        content: "You are an SEO expert specializing in health and medical content optimization."
      },
      {
        role: "user",
        content: seoPrompt
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 400
  });

  const seoData = JSON.parse(seoResponse.choices[0].message.content || '{}');
  
  return {
    title: seoData.title || blogContent.title,
    description: seoData.description || blogContent.summary,
    tags: seoData.tags || ['hydrogen therapy', 'research', 'health'],
    keywords: seoData.keywords || ['hydrogen therapy', 'molecular hydrogen', 'health benefits', 'medical research']
  };
}

/**
 * Save generated blogs to database
 */
export async function saveBulkGeneratedBlogs(results: BulkGenerationResult[]): Promise<{
  saved: number;
  failed: number;
  errors: string[];
}> {
  let saved = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const result of results) {
    if (!result.success) {
      failed++;
      errors.push(`Study ${result.studyId}: ${result.error}`);
      continue;
    }

    for (const blog of result.generatedBlogs) {
      try {
        await db.insert(blogArticles).values({
          studyId: result.studyId,
          title: blog.title,
          slug: blog.slug,
          summary: blog.summary,
          content: blog.content,
          articleType: blog.articleType,
          readingLevel: blog.readingLevel,
          imageUrl: blog.imageUrl || null,
          imageAlt: blog.imageAlt || null,
          isPublished: false, // Start as draft
        });
        saved++;
      } catch (error) {
        failed++;
        errors.push(`Failed to save blog for study ${result.studyId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  return { saved, failed, errors };
}