import OpenAI from "openai";
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import slugify from 'slugify';
import { Study, InsertBlogArticle } from "@shared/schema";
import { db } from "./db";
import { blogArticles } from "@shared/schema";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Blog article types
const BLOG_TYPES = [
  "overview", 
  "practical_application", 
  "comparison"
];

/**
 * Generate multiple blog articles for a study
 * @param study Study object to generate blog articles for
 * @returns Array of created blog article objects
 */
export async function generateBlogArticlesForStudy(study: Study): Promise<InsertBlogArticle[]> {
  try {
    const articles: InsertBlogArticle[] = [];
    
    // Generate different types of articles for the study
    for (const type of BLOG_TYPES) {
      const article = await generateSingleBlogArticle(study, type);
      articles.push(article);
    }
    
    return articles;
  } catch (error) {
    console.error("Error generating blog articles:", error);
    throw error;
  }
}

/**
 * Generate a single blog article of a specific type for a study
 * @param study Study to generate article for
 * @param articleType Type of article to generate
 * @returns Generated blog article
 */
async function generateSingleBlogArticle(study: Study, articleType: string): Promise<InsertBlogArticle> {
  try {
    // 1. Generate the article content
    const blogContent = await generateArticleContent(study, articleType);
    
    // 2. Generate a title for the article
    const blogTitle = await generateArticleTitle(study, articleType, blogContent.summary);
    
    // 3. Generate a unique slug
    const baseSlug = slugify(blogTitle, { lower: true, strict: true });
    const timestamp = Date.now().toString().slice(-6);
    const slug = `${baseSlug}-${timestamp}`;
    
    // 4. Generate an image for the article
    const { imageUrl, imageAlt } = await generateArticleImage(study, blogTitle, articleType);
    
    // 5. Create the blog article object
    const blogArticle: InsertBlogArticle = {
      studyId: study.id,
      title: blogTitle,
      slug: slug,
      summary: blogContent.summary,
      content: blogContent.mainContent,
      imageUrl: imageUrl,
      imageAlt: imageAlt,
      readingLevel: "general"
    };
    
    return blogArticle;
  } catch (error) {
    console.error(`Error generating ${articleType} article:`, error);
    throw error;
  }
}

/**
 * Generate content for an article using OpenAI
 */
async function generateArticleContent(study: Study, articleType: string): Promise<{ summary: string, mainContent: string }> {
  try {
    // Create different prompts based on article type
    let prompt = "";
    
    if (articleType === "overview") {
      prompt = `Write a scientific blog post about the following hydrogen study at a 6th grade reading level. 
      Make it informative yet approachable for general readers.
      
      Study Title: ${study.title}
      Authors: ${study.authors}
      Abstract: ${study.abstract}
      
      Present this as a friendly explanation of the research that shows how hydrogen can benefit health.
      Include sections with clear headings: Introduction, What the Researchers Found, Why This Matters, and Conclusion.
      Write in an engaging style that makes scientific concepts accessible without oversimplifying.
      Format the content with proper Markdown including headers, lists, and emphasis where appropriate.
      Aim for about 800-1000 words.`;
    } 
    else if (articleType === "practical_application") {
      prompt = `Write a practical blog post about how the average person can apply findings from this hydrogen study in their daily life.
      Write at a 6th grade reading level so it's accessible to general readers.
      
      Study Title: ${study.title}
      Authors: ${study.authors}
      Abstract: ${study.abstract}
      Category: ${study.category}
      
      Focus on real-world applications of this research. Include sections like:
      - Easy Ways to Incorporate Hydrogen in Your Life
      - Potential Health Benefits Based on This Research
      - Simple Steps to Start Today
      - What to Watch For
      
      Make it actionable with specific tips. Use an encouraging tone that emphasizes how hydrogen can be a practical health solution.
      Format with proper Markdown including headers, bullet points, and emphasis.
      Aim for about 800-1000 words.`;
    }
    else if (articleType === "comparison") {
      prompt = `Write a blog post comparing this hydrogen study with conventional approaches to the health issue it addresses.
      Write at a 6th grade reading level so it's accessible to general readers.
      
      Study Title: ${study.title}
      Authors: ${study.authors}
      Abstract: ${study.abstract}
      
      Compare hydrogen therapy/treatment with traditional approaches for this health condition.
      Include sections like:
      - The Traditional Approach (what's commonly recommended)
      - The Hydrogen Approach (based on this research)
      - Advantages and Potential Benefits of Hydrogen
      - How They Might Work Together
      - What This Means For You
      
      Present hydrogen as a promising solution backed by science, without making medical claims.
      Format with proper Markdown including headers, comparison tables if relevant, and emphasis.
      Aim for about 800-1000 words.`;
    }
    
    // Generate the blog content
    const contentResponse = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a scientific writer specializing in making complex research accessible to the general public. Write engaging, accurate content at a 6th grade reading level."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });
    
    const content = contentResponse.choices[0].message.content || "";
    
    // Generate a summary
    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Create a concise 2-3 sentence summary of the following blog post. Keep it engaging and informative."
        },
        {
          role: "user",
          content: content
        }
      ],
      temperature: 0.7,
      max_tokens: 150
    });
    
    const summary = summaryResponse.choices[0].message.content || "";
    
    return {
      summary: summary.trim(),
      mainContent: content.trim()
    };
  } catch (error) {
    console.error("Error generating article content:", error);
    throw error;
  }
}

/**
 * Generate a title for the blog article
 */
async function generateArticleTitle(study: Study, articleType: string, summary: string): Promise<string> {
  try {
    let titlePrompt = "";
    
    if (articleType === "overview") {
      titlePrompt = `Create an engaging title for a blog post explaining this hydrogen study to general readers. 
      Study: "${study.title}"
      Blog summary: "${summary}"
      
      Make the title catchy, around 50-70 characters, and include the word "hydrogen". It should appeal to people interested in health benefits.`;
    }
    else if (articleType === "practical_application") {
      titlePrompt = `Create a practical, action-oriented title for a blog post about applying this hydrogen research in daily life.
      Study: "${study.title}"
      Blog summary: "${summary}"
      
      Make the title start with a number or "How to..." Include the word "hydrogen" and focus on practical benefits. Around 50-70 characters.`;
    }
    else if (articleType === "comparison") {
      titlePrompt = `Create a comparative title for a blog post that contrasts hydrogen therapy with traditional approaches based on this research.
      Study: "${study.title}" 
      Blog summary: "${summary}"
      
      Title should include a comparison phrase like "vs." or "compared to" or "better than". Include the word "hydrogen" and be around 50-70 characters.`;
    }
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a headline writer for health and science content. Create engaging, accurate titles."
        },
        {
          role: "user",
          content: titlePrompt
        }
      ],
      temperature: 0.8,
      max_tokens: 50
    });
    
    let title = response.choices[0].message.content || "";
    
    // Remove quotes if present
    title = title.replace(/^["']|["']$/g, "").trim();
    
    return title;
  } catch (error) {
    console.error("Error generating article title:", error);
    throw error;
  }
}

/**
 * Generate an image for the blog article
 */
async function generateArticleImage(study: Study, blogTitle: string, articleType: string): Promise<{ imageUrl: string, imageAlt: string }> {
  try {
    // Create a prompt based on the article type and title
    let imagePrompt = "";
    
    if (articleType === "overview") {
      imagePrompt = `Create a scientific illustration related to this blog title: "${blogTitle}" about hydrogen research. Show hydrogen molecules (small white spheres) in a medical/scientific context. Clean, professional style suitable for a health blog. No text in the image.`;
    }
    else if (articleType === "practical_application") {
      imagePrompt = `Create a practical lifestyle image related to this blog title: "${blogTitle}" about using hydrogen for health. Show someone incorporating hydrogen water or therapy in daily life. Clean, bright aesthetic. No text in the image.`;
    }
    else if (articleType === "comparison") {
      imagePrompt = `Create a side-by-side comparison illustration related to this blog title: "${blogTitle}". Show traditional treatment on one side and hydrogen-based approach on the other. Use visual metaphors to highlight differences. Clean, professional style. No text in the image.`;
    }
    
    // Generate the image
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });
    
    const imageUrl = response.data?.[0]?.url;
    
    if (!imageUrl) {
      throw new Error("Failed to generate image: No URL returned from API");
    }
    
    // Download and save the image
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'blog');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // Create filename and path
    const timestamp = Date.now();
    const safeTitle = slugify(blogTitle.substring(0, 30), { lower: true, strict: true });
    const filename = `blog-${safeTitle}-${timestamp}.png`;
    const filepath = path.join(uploadDir, filename);
    
    // Download image
    const imageResponse = await axios({
      url: imageUrl,
      method: 'GET',
      responseType: 'stream'
    });
    
    // Save the image
    const writer = fs.createWriteStream(filepath);
    imageResponse.data.pipe(writer);
    
    // Wait for the image to be saved
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    // Generate alt text
    const altText = `Illustrated visualization for article: ${blogTitle} related to hydrogen research`;
    
    return {
      imageUrl: `/uploads/blog/${filename}`,
      imageAlt: altText
    };
  } catch (error) {
    console.error("Error generating article image:", error);
    
    // Return placeholder values if image generation fails
    return {
      imageUrl: "/uploads/default-blog-image.png",
      imageAlt: `Illustration for article: ${blogTitle}`
    };
  }
}

/**
 * Save generated blog articles to the database
 */
export async function saveBlogArticles(articles: InsertBlogArticle[]): Promise<number[]> {
  try {
    const savedArticleIds: number[] = [];
    
    for (const article of articles) {
      const [savedArticle] = await db.insert(blogArticles).values(article).returning({ id: blogArticles.id });
      savedArticleIds.push(savedArticle.id);
    }
    
    return savedArticleIds;
  } catch (error) {
    console.error("Error saving blog articles:", error);
    throw error;
  }
}

/**
 * Get blog articles for a specific study
 */
export async function getBlogArticlesForStudy(studyId: number): Promise<BlogArticle[]> {
  try {
    const articles = await db.select().from(blogArticles).where({ studyId: studyId });
    return articles;
  } catch (error) {
    console.error("Error fetching blog articles for study:", error);
    throw error;
  }
}