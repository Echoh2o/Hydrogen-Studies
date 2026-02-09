import fs from "fs";
import path from "path";
import { sql, eq } from "drizzle-orm"; // These are safe to import statically as they don't have side effects

// Manually load .env file if it exists (since we don't have dotenv)
// We must do this BEFORE importing files that rely on process.env (like db.ts)
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf-8");
  envConfig.split("\n").forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^"(.*)"$/, "$1");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
  console.log("✅ Loaded environment variables from .env");
} else {
    console.log("⚠️ No .env file found. Relying on system environment variables.");
}

async function run() {
  console.log("🧪 Starting Manual Content Generation Test...");

  try {
    // Dynamic imports to ensure modules load AFTER env vars are set
    const { db } = await import("../server/db");
    const { studies, blogArticles } = await import("@shared/schema");
    const { contentGenerator } = await import("../server/services/content-generator");
    const { mediaGenerator } = await import("../server/services/media-generator");

    // 1. Find a candidate study (enriched)
    const [study] = await db.select().from(studies)
      .where(sql`${studies.conclusion} IS NOT NULL`)
      .limit(1);

    if (!study) {
      console.error("❌ No enriched studies found. Run targeted enrichment first.");
      process.exit(1);
    }

    console.log(`Found candidate study: ${study.title} (ID: ${study.id})`);

    // 2. Generate Blog Post
    console.log("📝 Generating Blog Post...");
    const contentResult = await contentGenerator.generateBlogPost(study.id);

    if (!contentResult) {
      console.error("❌ Failed to generate blog post.");
      process.exit(1);
    }

    console.log(`✅ Blog Post Generated: "${contentResult.title}" (ID: ${contentResult.articleId})`);

    // 3. Generate Media
    console.log("🎨 Generating Hero Image...");
    const imagePath = await mediaGenerator.generateBlogHeroImage(contentResult.articleId);

    if (!imagePath) {
      console.error("❌ Failed to generate hero image.");
      process.exit(1);
    }

    console.log(`✅ Hero Image Generated: ${imagePath}`);

    // 4. Verify File Exists
    const fullPath = path.join(process.cwd(), imagePath); // imagePath starts with /uploads
    // remove leading slash for path.join if necessary, but path.join handles it usually? 
    // actually imagePath is /uploads/filename.png. path.join(cwd, /uploads/...) might treat /uploads as root.
    // Let's strip the leading slash.
    const relativePath = imagePath.startsWith("/") ? imagePath.slice(1) : imagePath;
    const absolutePath = path.join(process.cwd(), relativePath);

    if (fs.existsSync(absolutePath)) {
        console.log(`✅ File verified on disk: ${absolutePath}`);
    } else {
        console.error(`❌ File NOT found on disk: ${absolutePath}`);
    }

  } catch (error) {
    console.error("💥 Error during test:", error);
  } finally {
    process.exit(0);
  }
}

run();

