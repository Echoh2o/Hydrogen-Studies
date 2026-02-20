import OpenAI from "openai";
import { db } from "../db";
import { blogArticles, studies } from "@shared/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import https from "https";
import { pipeline } from "stream/promises";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class MediaGenerator {
  private static instance: MediaGenerator;

  private constructor() {}

  public static getInstance(): MediaGenerator {
    if (!MediaGenerator.instance) {
      MediaGenerator.instance = new MediaGenerator();
    }
    return MediaGenerator.instance;
  }

  /**
   * Generate a Hero Image for a Blog Article
   */
  public async generateBlogHeroImage(articleId: number): Promise<string | null> {
    const article = await db.query.blogArticles.findFirst({
        where: eq(blogArticles.id, articleId)
    });

    if (!article) {
        console.error(`Article ${articleId} not found`);
        return null;
    }

    console.log(`Generating hero image for article: ${article.title}`);

    const prompt = `
      Create a modern, high-quality, photorealistic editorial illustration for a health blog post titled "${article.title}".
      The image should feature clean, bright aesthetics, water elements, molecular hydrogen concepts (subtle bubbles), and convey health/wellness.
      Style: Premium magazine photography, soft lighting, blue and white color palette.
      No text overlay.
    `;

    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "url"
      });

      const imageUrl = response.data?.[0]?.url;
      if (!imageUrl) throw new Error("No image URL returned");

      // Download and save the image locally (simulated for now, essentially standard Fetch)
      // In a real prod env with S3, we'd upload there. 
      // For this setup, we'll return the OpenAI URL or download it. 
      // OpenAI URLs expire, so downloading is CRITICAL.
      
      const filename = `hero-${article.slug}-${Date.now()}.png`;
      const relativePath = `/uploads/${filename}`;
      const localPath = path.join(process.cwd(), "uploads", filename);

      // Ensure uploads dir exists
      if (!fs.existsSync(path.join(process.cwd(), "uploads"))) {
          fs.mkdirSync(path.join(process.cwd(), "uploads"), { recursive: true });
      }

      // Download
      await this.downloadImage(imageUrl, localPath);

      // Update Article
      await db.update(blogArticles)
        .set({ imageUrl: relativePath })
        .where(eq(blogArticles.id, articleId));

      console.log(`✅ Hero image generated and saved: ${relativePath}`);
      return relativePath;

    } catch (error) {
       console.error("Error generating/saving image:", error);
       return null;
    }
  }

  private async downloadImage(url: string, dest: string) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      https.get(url, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(true);
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    });
  }
}

export const mediaGenerator = MediaGenerator.getInstance();
