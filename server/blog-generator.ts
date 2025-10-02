import OpenAI from "openai";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import axios from "axios";
import slugify from "slugify";
import { Study, InsertBlogArticle, blogArticles } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

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
  "comparison",
  "elon_simple", // Elon Musk's voice at a 6th grade level
  "elon_benefits", // Benefits focused in Elon's voice at 6th grade level
  "elon_future", // Future implications in Elon's voice at 6th grade level
  "elon_faq", // FAQ style in Elon's voice at 6th grade level
  "elon_howto", // How-to guide in Elon's voice at 6th grade level
];

// Default system role for blog generation
let systemRole =
  "You are a scientific writer specializing in making complex research accessible to the general public. Write engaging, accurate content at a 6th grade reading level.";

/**
 * Generate multiple blog articles for a study
 * @param study Study object to generate blog articles for
 * @param options Optional configuration for article generation
 * @returns Array of created blog article objects
 */
export async function generateBlogArticlesForStudy(
  study: Study,
  options: {
    count?: number;
    includeElonStyle?: boolean;
    standardCount?: number;
    elonCount?: number;
  } = {},
): Promise<InsertBlogArticle[]> {
  try {
    const articles: InsertBlogArticle[] = [];

    // Default options
    const count = options.count || 5; // Default to 5 total articles
    const includeElonStyle =
      options.includeElonStyle !== undefined ? options.includeElonStyle : true;
    const standardCount = options.standardCount || 2; // Default to 2 standard articles
    const elonCount = options.elonCount || 3; // Default to 3 Elon style articles

    // Separate the blog types
    const standardTypes = BLOG_TYPES.filter(
      (type) => !type.startsWith("elon_"),
    );
    const elonTypes = BLOG_TYPES.filter((type) => type.startsWith("elon_"));

    // Select random types based on the count
    if (includeElonStyle) {
      // Generate both standard and Elon style articles
      const selectedStandardTypes = standardTypes
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.min(standardCount, standardTypes.length));

      const selectedElonTypes = elonTypes
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.min(elonCount, elonTypes.length));

      // Combine the selected types
      const selectedTypes = [...selectedStandardTypes, ...selectedElonTypes];

      // Generate the articles
      for (const type of selectedTypes) {
        const article = await generateSingleBlogArticle(study, type);
        articles.push(article);
      }
    } else {
      // Only generate standard style articles
      const selectedTypes = standardTypes
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.min(count, standardTypes.length));

      // Generate the articles
      for (const type of selectedTypes) {
        const article = await generateSingleBlogArticle(study, type);
        articles.push(article);
      }
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
async function generateSingleBlogArticle(
  study: Study,
  articleType: string,
): Promise<InsertBlogArticle> {
  try {
    // 1. Generate the article content
    const blogContent = await generateArticleContent(study, articleType);

    // 2. Generate a title for the article
    const blogTitle = await generateArticleTitle(
      study,
      articleType,
      blogContent.summary,
    );

    // 3. Generate a unique slug
    const baseSlug = slugify(blogTitle, { lower: true, strict: true });
    const timestamp = Date.now().toString().slice(-6);
    const slug = `${baseSlug}-${timestamp}`;

    // 4. Generate an image for the article
    const { imageUrl, imageAlt } = await generateArticleImage(
      study,
      blogTitle,
      articleType,
    );

    // Generate appropriate editor notes based on article type
    let editorNotes = "AI-generated content. Please review before publishing.";

    if (articleType.startsWith("elon_")) {
      editorNotes +=
        " This is an Elon Musk style article written at a 6th grade reading level.";

      if (articleType === "elon_simple") {
        editorNotes +=
          " Overview article focusing on making research accessible.";
      } else if (articleType === "elon_benefits") {
        editorNotes +=
          " Focuses on practical benefits and applications of the research.";
      } else if (articleType === "elon_future") {
        editorNotes +=
          " Discusses future implications and potential of the research.";
      } else if (articleType === "elon_faq") {
        editorNotes +=
          " FAQ format addressing common questions about the research.";
      }
    } else {
      editorNotes +=
        " This is a standard scientific article written at a 6th grade reading level.";

      if (articleType === "overview") {
        editorNotes += " General overview of the research findings.";
      } else if (articleType === "practical_application") {
        editorNotes += " Focuses on real-world applications of the research.";
      } else if (articleType === "comparison") {
        editorNotes +=
          " Compares hydrogen approaches with conventional treatments.";
      }
    }

    // 5. Create the blog article object
    const blogArticle: InsertBlogArticle = {
      studyId: study.id,
      title: blogTitle,
      slug: slug,
      summary: blogContent.summary,
      content: blogContent.mainContent,
      imageUrl: imageUrl,
      imageAlt: imageAlt,
      readingLevel: "general",
      articleType: articleType,
      isPublished: false,
      editorNotes: editorNotes,
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
async function generateArticleContent(
  study: Study,
  articleType: string,
): Promise<{ summary: string; mainContent: string }> {
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
    } else if (articleType === "practical_application") {
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
    } else if (articleType === "comparison") {
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
    // Elon Musk style blogs at 6th grade reading level
    else if (articleType === "elon_simple") {
      // Change system prompt for Elon's voice
      systemRole =
        "You are Elon Musk explaining complex scientific concepts in simple terms that a 6th grader could understand. You're enthusiastic, visionary, and occasionally make bold statements, but you keep your language very simple and accessible.";

      prompt = `Write a blog post explaining this hydrogen study in extremely simple terms:
      
      Study Title: ${study.title}
      Authors: ${study.authors}
      Abstract: ${study.abstract}
      
      Write an SEO-optimized article with this structure:
      1. Title (H1): Include "hydrogen health benefits" as your primary keyword and make it click-worthy
      2. Introduction (1-2 paragraphs): Hook the reader with something mind-blowing about hydrogen
      3. Body Content with H2/H3 subheadings:
         - Each section should be 200-300 words
         - Include lists (bullets or numbered)
         - Use short paragraphs (2-4 sentences max)
         - Bold important text for emphasis
      4. FAQ Section: Add 3-5 common questions using long-tail keywords
      5. Conclusion: Summarize key takeaways and why people should be excited
      
      Keep the reading level at exactly 6th grade (Flesch-Kincaid level 6.0).
      Write in Elon Musk's distinctive voice and style, but simplified for a young audience.
      Include analogies and metaphors that make the scientific concepts crystal clear.
      Make it exciting and emphasize why this matters for the future.
      Explain any scientific terms as if to a child - don't assume any prior knowledge.
      The blog should be around 1000 words and include an "insanely exciting" hook at the start.`;
    } else if (articleType === "elon_benefits") {
      // Change system prompt for Elon's voice
      systemRole =
        "You are Elon Musk explaining complex scientific concepts in simple terms that a 6th grader could understand. You're enthusiastic, visionary, and occasionally make bold statements, but you keep your language very simple and accessible.";

      prompt = `Write a blog post focusing on the practical benefits of this hydrogen research:
      
      Study Title: ${study.title}
      Authors: ${study.authors}
      Abstract: ${study.abstract}
      
      Write an SEO-optimized article with this structure:
      1. Title (H1): Include "hydrogen therapy benefits" as your primary keyword and make it click-worthy
      2. Introduction (1-2 paragraphs): Hook the reader with the most incredible benefit
      3. Body Content with H2/H3 subheadings:
         - Each section should focus on a different benefit
         - Include lists (bullets or numbered)
         - Use short paragraphs (2-4 sentences max)
         - Bold important text for emphasis
      4. Section titled "Why This Is Revolutionary" 
      5. FAQ Section: Add 3-5 common questions about benefits
      6. Conclusion: Summarize key benefits and encourage action
      
      Keep the reading level at exactly 6th grade (Flesch-Kincaid level 6.0).
      Write in Elon Musk's distinctive voice and style, but simplified for a young audience.
      Focus on the specific health benefits that real people might experience.
      Tie the benefits to everyday life - how would someone feel different?
      The blog should have a bold, attention-grabbing title.`;
    } else if (articleType === "elon_future") {
      // Change system prompt for Elon's voice
      systemRole =
        "You are Elon Musk explaining complex scientific concepts in simple terms that a 6th grader could understand. You're enthusiastic, visionary, and occasionally make bold statements, but you keep your language very simple and accessible.";

      prompt = `Write a blog post about the future implications of this hydrogen research:
      
      Study Title: ${study.title}
      Authors: ${study.authors}
      Abstract: ${study.abstract}
      
      Write an SEO-optimized article with this structure:
      1. Title (H1): Include "future of hydrogen therapy" as your primary keyword and make it sound visionary
      2. Introduction (1-2 paragraphs): Make a bold prediction about the future
      3. Body Content with H2/H3 subheadings:
         - "How This Changes Everything"
         - "The Next 5 Years in Hydrogen Research"
         - "Why Traditional Medicine Will Have to Adapt"
         - "The Breakthrough Moment We're Waiting For"
      4. FAQ Section: Add 3-5 future-oriented questions
      5. Conclusion: Paint an exciting picture of what's possible
      
      Keep the reading level at exactly 6th grade (Flesch-Kincaid level 6.0).
      Write in Elon Musk's distinctive voice and style, but simplified for a young audience.
      Focus on how this research might change the future of healthcare and wellness.
      Include bold predictions about how this technology could evolve.
      Tie it to other futuristic technologies where relevant.
      Maintain a sense of wonder and excitement throughout.`;
    } else if (articleType === "elon_faq") {
      // Change system prompt for Elon's voice
      systemRole =
        "You are Elon Musk explaining complex scientific concepts in simple terms that a 6th grader could understand. You're enthusiastic, visionary, and occasionally make bold statements, but you keep your language very simple and accessible.";

      prompt = `Write a FAQ-style blog post about this hydrogen research:
      
      Study Title: ${study.title}
      Authors: ${study.authors}
      Abstract: ${study.abstract}
      
      Write an SEO-optimized article with this structure:
      1. Title (H1): Include "hydrogen therapy explained" as your primary keyword
      2. Introduction (1-2 paragraphs): Explain why people have questions about hydrogen
      3. 10 FAQ sections with H2 headings for each question:
         - Start with basic questions: "What is hydrogen therapy?"
         - Include practical questions: "How can I try hydrogen therapy?"
         - Add advanced questions: "Could hydrogen therapy replace medications?"
      4. Conclusion: Summarize key takeaways and encourage exploration
      
      Keep the reading level at exactly 6th grade (Flesch-Kincaid level 6.0).
      Write in Elon Musk's distinctive voice and style, but simplified for a young audience.
      Make sure each answer is genuinely informative but extremely easy to understand.
      Use analogies and examples that kids would understand.
      Bold important terms and keep answers concise but complete.`;
    } else if (articleType === "elon_howto") {
      // Change system prompt for Elon's voice
      systemRole =
        "You are Elon Musk explaining complex scientific concepts in simple terms that a 6th grader could understand. You're enthusiastic, visionary, and occasionally make bold statements, but you keep your language very simple and accessible.";

      prompt = `Write a how-to guide blog post based on this hydrogen research:
      
      Study Title: ${study.title}
      Authors: ${study.authors}
      Abstract: ${study.abstract}
      
      Write an SEO-optimized article with this structure:
      1. Title (H1): Include "how to use hydrogen therapy" as your primary keyword
      2. Introduction (1-2 paragraphs): Explain why this guide matters
      3. "What You'll Need" section with a bulleted list
      4. Step-by-step guide with numbered steps and H2 headings
      5. "Safety Considerations" section
      6. "Common Challenges and Solutions" section
      7. FAQ Section: Add 3-5 practical questions
      8. Conclusion: Encourage readers to try it and report back
      
      Keep the reading level at exactly 6th grade (Flesch-Kincaid level 6.0).
      Write in Elon Musk's distinctive voice and style, but simplified for a young audience.
      Include step-by-step instructions on how someone might apply this research.
      Make it both practical and inspiring - explain not just how, but why it matters.
      Bold important instructions and warnings.`;
    }

    // Generate the blog content
    const contentResponse = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: systemRole,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = contentResponse.choices[0].message.content || "";

    // Generate a summary - adjust the system prompt based on the article type
    let summarySystemRole =
      "Create a concise 2-3 sentence summary of the following blog post. Keep it engaging and informative.";

    // If it's an Elon style article, use Elon's voice for the summary too
    if (articleType.startsWith("elon_")) {
      summarySystemRole =
        "You are Elon Musk. Create a concise 2-3 sentence summary of the following blog post. Use simple language at a 6th grade reading level. Be enthusiastic and forward-thinking like Elon would be.";
    }

    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: summarySystemRole,
        },
        {
          role: "user",
          content: content,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    const summary = summaryResponse.choices[0].message.content || "";

    return {
      summary: summary.trim(),
      mainContent: content.trim(),
    };
  } catch (error) {
    console.error("Error generating article content:", error);
    throw error;
  }
}

/**
 * Generate a title for the blog article
 */
async function generateArticleTitle(
  study: Study,
  articleType: string,
  summary: string,
): Promise<string> {
  try {
    let titlePrompt = "";

    if (articleType === "overview") {
      titlePrompt = `Create an engaging title for a blog post explaining this hydrogen study to general readers. 
      Study: "${study.title}"
      Blog summary: "${summary}"
      
      Make the title catchy, around 50-70 characters, and include the word "hydrogen". It should appeal to people interested in health benefits.`;
    } else if (articleType === "practical_application") {
      titlePrompt = `Create a practical, action-oriented title for a blog post about applying this hydrogen research in daily life.
      Study: "${study.title}"
      Blog summary: "${summary}"
      
      Make the title start with a number or "How to..." Include the word "hydrogen" and focus on practical benefits. Around 50-70 characters.`;
    } else if (articleType === "comparison") {
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
          content:
            "You are a headline writer for health and science content. Create engaging, accurate titles.",
        },
        {
          role: "user",
          content: titlePrompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 50,
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
async function generateArticleImage(
  study: Study,
  blogTitle: string,
  articleType: string,
): Promise<{ imageUrl: string; imageAlt: string }> {
  try {
    // Create a prompt based on the article type and title
    let imagePrompt = "";

    // Default prompt in case no specific type matches (prevents empty prompt errors)
    const defaultPrompt = `Create a scientific illustration related to this blog title: "${blogTitle}" about hydrogen research. Clean, professional style suitable for a health blog. No text in the image.`;

    // Standard article types
    if (articleType === "overview") {
      imagePrompt = `Create a scientific illustration related to this blog title: "${blogTitle}" about hydrogen research. Show hydrogen molecules (small white spheres) in a medical/scientific context. Clean, professional style suitable for a health blog. No text in the image.`;
    } else if (articleType === "practical_application") {
      imagePrompt = `Create a practical lifestyle image related to this blog title: "${blogTitle}" about using hydrogen for health. Show someone incorporating hydrogen water or therapy in daily life. Clean, bright aesthetic. No text in the image.`;
    } else if (articleType === "comparison") {
      imagePrompt = `Create a side-by-side comparison illustration related to this blog title: "${blogTitle}". Show traditional treatment on one side and hydrogen-based approach on the other. Use visual metaphors to highlight differences. Clean, professional style. No text in the image.`;
    }
    // Elon-style article types
    else if (articleType === "elon_simple") {
      imagePrompt = `Create a visually stunning, simplified illustration for this blog title: "${blogTitle}" about hydrogen health benefits. A futuristic yet accessible image showing hydrogen molecules in a human body. Vibrant colors, clean design, inspirational feel. No text in the image.`;
    } else if (articleType === "elon_benefits") {
      imagePrompt = `Create a benefits-focused illustration for this blog title: "${blogTitle}" about hydrogen health applications. Show a person experiencing improved health with visual indicators of hydrogen benefits like energy, reduced inflammation, or cell repair. Optimistic, bright style. No text in the image.`;
    } else if (articleType === "elon_future") {
      imagePrompt = `Create a futuristic illustration for this blog title: "${blogTitle}" about the future of hydrogen health technology. Show advanced hydrogen therapy devices or futuristic medical applications. Advanced, sleek, optimistic aesthetic. No text in the image.`;
    } else if (articleType === "elon_faq") {
      imagePrompt = `Create an explanatory illustration for this blog title: "${blogTitle}" about common questions on hydrogen therapy. Show a simplified diagram of hydrogen's effects on the human body with visual indicators of different benefits. Clear, educational style. No text in the image.`;
    }

    // If no prompt was set, use the default
    if (!imagePrompt) {
      console.log(
        `No specific image prompt found for article type: ${articleType}, using default`,
      );
      imagePrompt = defaultPrompt;
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
    const uploadDir = path.join(__dirname, "..", "public", "uploads", "blog");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Create filename and path
    const timestamp = Date.now();
    const safeTitle = slugify(blogTitle.substring(0, 30), {
      lower: true,
      strict: true,
    });
    const filename = `blog-${safeTitle}-${timestamp}.png`;
    const filepath = path.join(uploadDir, filename);

    // Download image
    const imageResponse = await axios({
      url: imageUrl,
      method: "GET",
      responseType: "stream",
    });

    // Save the image
    const writer = fs.createWriteStream(filepath);
    imageResponse.data.pipe(writer);

    // Wait for the image to be saved
    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    // Generate alt text
    const altText = `Illustrated visualization for article: ${blogTitle} related to hydrogen research`;

    return {
      imageUrl: `/uploads/blog/${filename}`,
      imageAlt: altText,
    };
  } catch (error) {
    console.error("Error generating article image:", error);

    // Return placeholder values if image generation fails
    return {
      imageUrl: "/uploads/default-blog-image.png",
      imageAlt: `Illustration for article: ${blogTitle}`,
    };
  }
}

/**
 * Save generated blog articles to the database
 */
export async function saveBlogArticles(
  articles: InsertBlogArticle[],
): Promise<number[]> {
  try {
    const savedArticleIds: number[] = [];

    for (const article of articles) {
      const [savedArticle] = await db
        .insert(blogArticles)
        .values(article)
        .returning({ id: blogArticles.id });
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
export async function getBlogArticlesForStudy(studyId: number): Promise<any[]> {
  try {
    const articles = await db
      .select()
      .from(blogArticles)
      .where(eq(blogArticles.studyId, studyId));
    return articles;
  } catch (error) {
    console.error("Error fetching blog articles for study:", error);
    throw error;
  }
}
