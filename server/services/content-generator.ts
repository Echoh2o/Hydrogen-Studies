import { db } from "../db";
import { blogArticles, studies } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { ai } from "./ai-provider";

interface ContentGenerationResult {
  articleId: number;
  title: string;
  type: string;
}

/**
 * Content Generator Service
 * Automatically creates SEO-optimized content from research studies.
 */
export class ContentGenerator {
  private static instance: ContentGenerator;

  private constructor() {}

  public static getInstance(): ContentGenerator {
    if (!ContentGenerator.instance) {
      ContentGenerator.instance = new ContentGenerator();
    }
    return ContentGenerator.instance;
  }

  /**
   * Generate a blog post for a specific study
   */
  public async generateBlogPost(studyId: number): Promise<ContentGenerationResult | null> {
    const study = await db.query.studies.findFirst({
        where: eq(studies.id, studyId)
    });

    if (!study) {
        console.error(`Study ${studyId} not found`);
        return null;
    }

    // Check for duplicate: skip if a blog_post already exists for this study
    const [existing] = await db
      .select({ id: blogArticles.id })
      .from(blogArticles)
      .where(
        and(
          eq(blogArticles.studyId, studyId),
          eq(blogArticles.articleType, "blog_post"),
        ),
      )
      .limit(1);

    if (existing) {
      console.log(`Blog post already exists for study ${studyId} (article #${existing.id}), skipping`);
      return null;
    }

    console.log(`Generating blog post for study: ${study.title}`);

    // Generate Content
    const prompt = `
      Write an engaging, 4th-grade reading level blog post based on this scientific study.
      
      Study Title: ${study.title}
      Abstract: ${study.abstract}
      Conclusion: ${study.conclusion || study.results || "No conclusion provided"}
      
      Requirements:
      1. Catchy, click-worthy title (H1)
      2. Friendly, conversational tone ("Did you know hydrogen water could help with X?")
      3. Simplify complex terms (explain "oxidative stress" generally as "rust in the body")
      4. Structure with H2 headings
      5. Include a "Key Takeaways" section
      6. Mention "Echo Water" or "Hydrogen Water" naturally as a solution where appropriate, but keep it educational.
      7. SEO Keyword focus: Hydrogen Water, ${study.category}, Recovery, Health.
      
      Format the output as JSON:
      {
        "title": "String",
        "slug": "kebab-case-slug",
        "summary": "2-sentence teaser",
        "content": "Markdown content",
        "keywords": ["tag1", "tag2"]
      }
    `;

    try {
      const data = await ai.generateJSON(
        "You are an expert health blogger who simplifies complex science for the general public.",
        prompt,
        { maxTokens: 4096, temperature: 0.7 },
      );
      
      // Inject internal links to specific Echo products if keywords match
      let content = data.content;
      content = this.injectLinks(content);
      
      // Save to Database
      const [article] = await db.insert(blogArticles).values({
          studyId: study.id,
          title: data.title,
          slug: `${data.slug}-${Date.now()}`, // Ensure uniqueness
          summary: data.summary,
          content: content,
          articleType: "blog_post",
          readingLevel: "general",
          isPublished: false, // Draft mode by default
          semanticKeywords: data.keywords,
          authorBio: "Hydrogen Studies AI",
          metaTitle: data.title,
          metaDescription: data.summary
      }).returning();
      
      console.log(`✅ Blog post created: ${article.title} (ID: ${article.id})`);
      
      return {
          articleId: article.id,
          title: article.title,
          type: "blog_post"
      };

    } catch (error) {
        console.error("Error generating blog post:", error);
        return null;
    }
  }

  /**
   * Inject SEO links into content
   */
  private injectLinks(content: string): string {
      // Simple string replacement for now, could be more sophisticated
      const replacements = [
          { term: "hydrogen water", url: "https://echowater.com" },
          { term: "antioxidant", url: "https://echowater.com/education" },
          { term: "recovery", url: "https://echowater.com/athlete-recovery" }
      ];
      
      let newContent = content;
      replacements.forEach(r => {
          // Replace first occurrence only to avoid spamminess
          const regex = new RegExp(`\\b${r.term}\\b`, 'i');
          newContent = newContent.replace(regex, `[${r.term}](${r.url})`);
      });
      
      return newContent;
  }
}

export const contentGenerator = ContentGenerator.getInstance();
