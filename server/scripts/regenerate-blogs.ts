/**
 * CLI Script: Batch regenerate blog articles with internal links and topic-specific images
 *
 * Existing blogs have generic images and no internal links in their content.
 * This script re-generates blog content using updated prompts that include
 * contextual internal links and topic-specific images.
 *
 * Usage:
 *   npx tsx server/scripts/regenerate-blogs.ts
 *   npx tsx server/scripts/regenerate-blogs.ts --batch 5
 *   npx tsx server/scripts/regenerate-blogs.ts --dry-run
 *   npx tsx server/scripts/regenerate-blogs.ts --images-only
 *   npx tsx server/scripts/regenerate-blogs.ts --batch 20 --dry-run
 */

import { db } from "../db";
import { blogArticles, studies } from "@shared/schema";
import { eq, and, sql, isNull, or, like } from "drizzle-orm";
import { ai } from "../services/ai-provider";
import { generateBlogImage } from "../services/image-generator";

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  batch: number;
  dryRun: boolean;
  imagesOnly: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = { batch: 10, dryRun: false, imagesOnly: false };

  const batchIdx = args.indexOf("--batch");
  if (batchIdx !== -1 && args[batchIdx + 1]) {
    const size = parseInt(args[batchIdx + 1], 10);
    if (!isNaN(size) && size > 0) {
      result.batch = size;
    } else {
      console.warn(`Invalid batch size "${args[batchIdx + 1]}", using default 10.`);
    }
  }

  if (args.includes("--dry-run")) result.dryRun = true;
  if (args.includes("--images-only")) result.imagesOnly = true;

  return result;
}

// ---------------------------------------------------------------------------
// Content prompt builder (mirrors createContentPrompt from blog-generator-enhanced)
// ---------------------------------------------------------------------------

function buildContentPrompt(
  study: { id: number; title: string; abstract: string | null; category: string | null; slug: string | null; healthConditions: string[] | null },
  articleType: string,
): string {
  const prompts: Record<string, string> = {
    overview: "Write a comprehensive overview article about this hydrogen therapy study. Include background, key findings, and implications. Use 6th grade reading level.",
    practical_application: "Write a practical guide on how the findings from this study could be applied in real-world health scenarios. Use 6th grade reading level.",
    comparison: "Compare this hydrogen therapy study with other treatments or approaches for similar conditions. Use 6th grade reading level.",
    simplified: "Explain this hydrogen therapy study in very simple terms that anyone can understand. Target 6th grade reading level.",
    benefits_focused: "Focus on the specific health benefits discovered in this hydrogen therapy study. Use 6th grade reading level.",
    future_implications: "Discuss the future implications and potential developments based on this hydrogen therapy research. Use 6th grade reading level.",
    faq_style: "Create an FAQ-style article answering common questions about this hydrogen therapy study. Use 6th grade reading level.",
    how_to_guide: "Create a how-to guide based on the practical applications of this hydrogen therapy research. Use 6th grade reading level.",
    tips: "Write an article with 7-10 practical tips for patients who want to benefit from the hydrogen therapy findings in this study. Make it actionable and easy to follow. Use 6th grade reading level.",
    patient_story: "Write an article from a patient's perspective about how hydrogen therapy could impact their daily life based on this study. Make it relatable and hopeful. Use 6th grade reading level.",
    myth_busting: "Write a myth-busting article addressing common misconceptions about hydrogen therapy based on what this study reveals. Format as 'Myth vs Fact'. Use 6th grade reading level.",
    daily_routine: "Create a daily routine guide showing how someone could incorporate hydrogen therapy into their life based on this study's findings. Include morning, afternoon, and evening suggestions. Use 6th grade reading level.",
    side_effects: "Write an informative article about what to expect from hydrogen therapy based on this study, including any side effects, safety considerations, and when to consult a healthcare provider. Be reassuring but honest. Use 6th grade reading level.",
  };

  const basePrompt = prompts[articleType] || prompts.overview;

  // Build internal link context
  const studySlug = study.slug || `id/${study.id}`;
  const category = study.category || "General Health";
  const categorySlug = category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const conditions = (study.healthConditions || []).slice(0, 3);

  const linkInstructions = `
INTERNAL LINKS — You MUST include these as markdown links naturally woven into the content:
1. Link to the source study: [original research study](/study/${studySlug}) — mention it at least once
2. Link to the category hub: [hydrogen ${category.toLowerCase()} research](/blog/category/${categorySlug}) — include once
3. Link to the research database: [hydrogen research database](/proxy/) — include once in the conclusion
${conditions.length > 0 ? `4. Mention these related health conditions and link them: ${conditions.map((c) => {
    const cSlug = c.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return `[${c}](/explore-by-condition/${cSlug})`;
  }).join(", ")}` : ""}

IMPORTANT: Links must feel natural in the sentence. Do NOT list them separately. Weave them into the narrative.
Example: "According to the [original research study](/study/${studySlug}), hydrogen water showed a 45% reduction..."`;

  return `${basePrompt}

Study Title: ${study.title}
Abstract: ${study.abstract || "No abstract available."}
Category: ${category}

${linkInstructions}

Content Requirements:
- Write at a 4th-6th grade reading level (Flesch-Kincaid score 60-70)
- Use short sentences and simple words — explain any scientific terms
- Include specific details from the study (numbers, percentages, outcomes)
- Structure with clear H2 (##) and H3 (###) headings that include keyword variations of "hydrogen therapy" or "hydrogen water"
- Include a "Key Takeaways" or "What This Means for You" section
- End with a brief disclaimer: "Consult your healthcare provider before starting any new health regimen"
- Aim for 600-900 words
- The content MUST contain at least 3 internal markdown links as specified above`;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** Blogs whose content has NO internal markdown links (pattern: `](/`) */
async function findBlogsNeedingContent(limit: number) {
  return db
    .select({
      id: blogArticles.id,
      studyId: blogArticles.studyId,
      title: blogArticles.title,
      slug: blogArticles.slug,
      articleType: blogArticles.articleType,
      imageUrl: blogArticles.imageUrl,
    })
    .from(blogArticles)
    .where(
      and(
        eq(blogArticles.isPublished, true),
        sql`${blogArticles.content} NOT LIKE '%](/%'`,
      ),
    )
    .limit(limit);
}

/** Blogs whose image is null or a fallback SVG */
async function findBlogsNeedingImages(limit: number) {
  return db
    .select({
      id: blogArticles.id,
      studyId: blogArticles.studyId,
      title: blogArticles.title,
      slug: blogArticles.slug,
      articleType: blogArticles.articleType,
      imageUrl: blogArticles.imageUrl,
    })
    .from(blogArticles)
    .where(
      and(
        eq(blogArticles.isPublished, true),
        or(
          isNull(blogArticles.imageUrl),
          like(blogArticles.imageUrl, "%fallback%"),
        ),
      ),
    )
    .limit(limit);
}

/** Fetch the study row needed by the content prompt builder */
async function fetchStudy(studyId: number) {
  const [study] = await db
    .select({
      id: studies.id,
      title: studies.title,
      abstract: studies.abstract,
      category: studies.category,
      slug: studies.slug,
      healthConditions: studies.healthConditions,
    })
    .from(studies)
    .where(eq(studies.id, studyId))
    .limit(1);
  return study ?? null;
}

// ---------------------------------------------------------------------------
// Regeneration logic
// ---------------------------------------------------------------------------

async function regenerateContent(
  blogId: number,
  study: NonNullable<Awaited<ReturnType<typeof fetchStudy>>>,
  articleType: string,
): Promise<void> {
  const prompt = buildContentPrompt(study, articleType || "overview");

  const content = await ai.generateText(
    "You are a scientific writer specializing in hydrogen therapy research. Write engaging, accurate content at a 6th grade reading level (Flesch-Kincaid score 60-70). Use simple words, short sentences, and clear explanations. Avoid medical jargon unless necessary, and always explain complex terms in simple language.",
    prompt,
    { maxTokens: 2000, temperature: 0.7 },
  );

  if (!content?.trim()) {
    throw new Error("AI returned empty content");
  }

  // Generate a fresh meta-description summary
  let summary: string;
  try {
    const generatedSummary = await ai.generateText(
      "Write a meta description for a blog post. Rules: 140-155 characters, include 'hydrogen' and the topic keyword naturally, plain language a 6th grader can understand, convey a clear benefit or finding, end with a hook. Respond with ONLY the description.",
      `Summarize this blog post in one sentence:\n\nTopic: ${study.category || "health"}\n\n${content.substring(0, 800)}`,
      { maxTokens: 60, temperature: 0.6 },
    );
    summary = generatedSummary?.trim() || content.split("\n\n")[0]?.substring(0, 300) || content.substring(0, 300);
  } catch {
    summary = content.split("\n\n")[0]?.substring(0, 300) || content.substring(0, 300);
  }

  await db
    .update(blogArticles)
    .set({
      content,
      summary: summary.substring(0, 300),
      metaDescription: summary.substring(0, 160),
      ogDescription: summary.substring(0, 200),
      twitterDescription: summary.substring(0, 200),
      updatedAt: new Date(),
      lastReviewed: new Date(),
    })
    .where(eq(blogArticles.id, blogId));
}

async function regenerateImage(blogId: number): Promise<boolean> {
  const result = await generateBlogImage(blogId);
  return result.success;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface Stats {
  total: number;
  regenerated: number;
  failed: number;
  skipped: number;
  errors: Array<{ blogId: number; title: string; error: string }>;
}

async function main() {
  const args = parseArgs();

  console.log("=== Blog Regeneration Script ===");
  console.log(`  Mode:       ${args.imagesOnly ? "images-only" : "full (content + images)"}`);
  console.log(`  Batch size: ${args.batch}`);
  console.log(`  Dry run:    ${args.dryRun}`);
  console.log("");

  // Check AI provider availability (unless dry-run)
  if (!args.dryRun) {
    const status = ai.getProviderStatus();
    if (status.primary === "none") {
      console.error("ERROR: No AI text provider configured (set ANTHROPIC_API_KEY or OPENAI_API_KEY).");
      process.exit(1);
    }
    if (args.imagesOnly && status.imageProvider === "none") {
      console.error("ERROR: No image provider configured (set XAI_API_KEY or OPENAI_API_KEY).");
      process.exit(1);
    }
    console.log(`AI provider:    ${status.primary}`);
    console.log(`Image provider: ${status.imageProvider}`);
    console.log("");
  }

  // Query candidates
  const blogs = args.imagesOnly
    ? await findBlogsNeedingImages(args.batch)
    : await findBlogsNeedingContent(args.batch);

  const stats: Stats = {
    total: blogs.length,
    regenerated: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  if (blogs.length === 0) {
    console.log("No blogs found that need regeneration.");
    process.exit(0);
  }

  console.log(`Found ${blogs.length} blog(s) to process.\n`);

  if (args.dryRun) {
    console.log("--- DRY RUN: Listing blogs that would be regenerated ---\n");
    for (const blog of blogs) {
      const needsImage = !blog.imageUrl || blog.imageUrl.includes("fallback");
      console.log(`  [ID ${blog.id}] "${blog.title}"`);
      console.log(`    slug:        ${blog.slug}`);
      console.log(`    studyId:     ${blog.studyId}`);
      console.log(`    articleType: ${blog.articleType || "unknown"}`);
      console.log(`    imageUrl:    ${blog.imageUrl || "(none)"}`);
      console.log(`    action:      ${args.imagesOnly ? "regenerate image" : `regenerate content${needsImage ? " + image" : ""}`}`);
      console.log("");
    }
    console.log(`Total: ${blogs.length} blog(s) would be regenerated.`);
    process.exit(0);
  }

  // Process each blog
  for (let i = 0; i < blogs.length; i++) {
    const blog = blogs[i];
    const label = `[${i + 1}/${blogs.length}] Blog #${blog.id}`;

    console.log(`${label}: "${blog.title}"`);

    try {
      if (args.imagesOnly) {
        // Images-only mode
        console.log(`  Regenerating image...`);
        const imageOk = await regenerateImage(blog.id);
        if (imageOk) {
          console.log(`  Image regenerated successfully.`);
          stats.regenerated++;
        } else {
          console.log(`  Image generation failed (non-fatal).`);
          stats.failed++;
          stats.errors.push({ blogId: blog.id, title: blog.title, error: "Image generation returned failure" });
        }
      } else {
        // Full regeneration: content + image
        const study = await fetchStudy(blog.studyId);
        if (!study) {
          console.log(`  SKIPPED: Study ${blog.studyId} not found in database.`);
          stats.skipped++;
          continue;
        }

        // Regenerate content
        console.log(`  Regenerating content (articleType: ${blog.articleType || "overview"})...`);
        await regenerateContent(blog.id, study, blog.articleType || "overview");
        console.log(`  Content regenerated with internal links.`);

        // Also regenerate image if it is missing or a fallback
        const needsImage = !blog.imageUrl || blog.imageUrl.includes("fallback");
        if (needsImage) {
          console.log(`  Regenerating image...`);
          const imageOk = await regenerateImage(blog.id);
          console.log(imageOk ? `  Image regenerated.` : `  Image generation failed (non-fatal).`);
        }

        stats.regenerated++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  FAILED: ${message}`);
      stats.failed++;
      stats.errors.push({ blogId: blog.id, title: blog.title, error: message });
    }

    // Rate limit: 5-second delay between blogs (skip after last one)
    if (i < blogs.length - 1) {
      console.log(`  Waiting 5 seconds...\n`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  // Final summary
  console.log("\n=== Regeneration Complete ===");
  console.log(`  Total:       ${stats.total}`);
  console.log(`  Regenerated: ${stats.regenerated}`);
  console.log(`  Failed:      ${stats.failed}`);
  console.log(`  Skipped:     ${stats.skipped}`);

  if (stats.errors.length > 0) {
    console.log("\n  Errors:");
    for (const e of stats.errors) {
      console.log(`    Blog #${e.blogId} ("${e.title}"): ${e.error}`);
    }
  }

  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
