/**
 * Blog Generation Worker
 *
 * Background processor for bulk blog generation jobs.
 * Processes jobs from the blog_generation_jobs table, generating articles
 * one at a time with progress tracking and resume capability.
 */
import { db } from "../db";
import { blogGenerationJobs, blogArticles, studies } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { ai, getImageModel } from "./ai-provider";
import { withAdvisoryLock } from "../utils/advisory-lock";

// Worker state
let isProcessing = false;
let currentJobId: number | null = null;
let shouldStop = false;
let tableExists: boolean | null = null; // cached after first check

// Configurable settings
const DELAY_BETWEEN_ARTICLES_MS = 2000; // 2s between articles to avoid rate limits
const AI_TIMEOUT_MS = 30000; // 30s timeout for AI calls
const MAX_RETRIES = 2;

/**
 * Check if the blog_generation_jobs table exists in the database.
 * Result is cached after first successful check (table found).
 */
async function ensureTableExists(): Promise<boolean> {
  if (tableExists === true) return true;
  try {
    const result = await db.execute(
      sql`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'blog_generation_jobs') AS "exists"`
    );
    const exists = (result as any).rows?.[0]?.exists === true || (result as any)[0]?.exists === true;
    if (exists) tableExists = true;
    return exists;
  } catch {
    return false;
  }
}

/**
 * Start or resume a blog generation job
 */
export async function startJob(jobId: number): Promise<{ success: boolean; message: string }> {
  if (!(await ensureTableExists())) {
    return { success: false, message: "Job queue table not yet created. Deploy with db:push first." };
  }

  if (isProcessing) {
    return { success: false, message: `Worker is busy with job #${currentJobId}` };
  }

  const [job] = await db
    .select()
    .from(blogGenerationJobs)
    .where(eq(blogGenerationJobs.id, jobId));

  if (!job) {
    return { success: false, message: "Job not found" };
  }

  if (job.status === "completed" || job.status === "cancelled") {
    return { success: false, message: `Job is already ${job.status}` };
  }

  // Mark as running
  await db
    .update(blogGenerationJobs)
    .set({
      status: "running",
      startedAt: job.startedAt || new Date(),
      updatedAt: new Date(),
    })
    .where(eq(blogGenerationJobs.id, jobId));

  // Process in background
  shouldStop = false;
  processJob(jobId).catch((err) => {
    console.error(`Blog generation job #${jobId} crashed:`, err);
    db.update(blogGenerationJobs)
      .set({
        status: "failed",
        lastError: err.message || "Worker crashed",
        updatedAt: new Date(),
      })
      .where(eq(blogGenerationJobs.id, jobId))
      .catch(console.error);
    isProcessing = false;
    currentJobId = null;
  });

  return { success: true, message: `Job #${jobId} started` };
}

/**
 * Pause the currently running job
 */
export async function pauseJob(jobId: number): Promise<{ success: boolean; message: string }> {
  if (!(await ensureTableExists())) {
    return { success: false, message: "Job queue table not yet created." };
  }
  if (currentJobId !== jobId) {
    return { success: false, message: "This job is not currently running" };
  }
  shouldStop = true;
  return { success: true, message: "Job will pause after current article completes" };
}

/**
 * Cancel a job
 */
export async function cancelJob(jobId: number): Promise<{ success: boolean; message: string }> {
  if (!(await ensureTableExists())) {
    return { success: false, message: "Job queue table not yet created." };
  }
  if (currentJobId === jobId) {
    shouldStop = true;
  }

  await db
    .update(blogGenerationJobs)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
    })
    .where(eq(blogGenerationJobs.id, jobId));

  return { success: true, message: "Job cancelled" };
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: number) {
  if (!(await ensureTableExists())) return null;

  const [job] = await db
    .select()
    .from(blogGenerationJobs)
    .where(eq(blogGenerationJobs.id, jobId));

  if (!job) return null;

  const progress = job.totalItems > 0
    ? Math.round(((job.completedItems + job.failedItems) / job.totalItems) * 100)
    : 0;

  return {
    ...job,
    progress,
    isRunning: currentJobId === job.id && isProcessing,
  };
}

/**
 * Get all jobs
 */
export async function listJobs() {
  if (!(await ensureTableExists())) return [];

  const jobs = await db
    .select()
    .from(blogGenerationJobs)
    .orderBy(blogGenerationJobs.id);

  return jobs.map((job) => ({
    ...job,
    progress: job.totalItems > 0
      ? Math.round(((job.completedItems + job.failedItems) / job.totalItems) * 100)
      : 0,
    isRunning: currentJobId === job.id && isProcessing,
  }));
}

/**
 * Create a new generation job
 */
export async function createJob(config: {
  studyIds: number[];
  articleTypes: string[];
  readingLevel?: string;
  includeImages?: boolean;
  includeSEO?: boolean;
}): Promise<{ success: boolean; jobId?: number; message: string }> {
  if (!(await ensureTableExists())) {
    return { success: false, message: "Job queue table not yet created. The database migration will run on next deploy." };
  }

  const totalItems = config.studyIds.length * config.articleTypes.length;

  if (totalItems === 0) {
    return { success: false, message: "No studies or article types selected" };
  }

  const [job] = await db
    .insert(blogGenerationJobs)
    .values({
      studyIds: config.studyIds,
      articleTypes: config.articleTypes,
      readingLevel: config.readingLevel || "general",
      includeImages: config.includeImages ?? true,
      includeSEO: config.includeSEO ?? true,
      totalItems,
      status: "pending",
    })
    .returning();

  return { success: true, jobId: job.id, message: `Job created with ${totalItems} articles to generate` };
}

/**
 * Main processing loop
 */
async function processJob(jobId: number) {
  isProcessing = true;
  currentJobId = jobId;

  try {
    // Cross-process exclusion: a second Railway replica (or old+new overlap
    // during a rolling deploy) must not process the same job concurrently —
    // that doubles AI spend and races the per-article dedupe check. The
    // in-process isProcessing flag only guards this instance; the advisory
    // lock guards across instances. If another instance holds it, skip.
    const ran = await withAdvisoryLock(`blog-job:${jobId}`, () => runJob(jobId));
    if (ran === null) {
      console.warn(`[BlogWorker] Job #${jobId} is already running on another instance — skipping`);
    }
  } finally {
    isProcessing = false;
    currentJobId = null;
    shouldStop = false;
  }
}

/**
 * Determine whether the running job should stop, and with what final status.
 * Re-reads the DB so a cancellation issued on ANOTHER instance is honored
 * (cross-process), and so an in-process cancel (which set status='cancelled')
 * is never resurrected as a resumable 'paused'.
 */
async function getStopAction(jobId: number): Promise<"cancelled" | "paused" | null> {
  const [current] = await db
    .select({ status: blogGenerationJobs.status })
    .from(blogGenerationJobs)
    .where(eq(blogGenerationJobs.id, jobId));
  const status = current?.status;
  // A cancel (this instance or another) writes status='cancelled' — preserve it.
  if (status === "cancelled") return "cancelled";
  // An in-process pause request stops only while the job is still running.
  if (shouldStop && status === "running") return "paused";
  return null;
}

/**
 * Main processing loop — runs inside the advisory lock (see processJob).
 */
async function runJob(jobId: number) {
    const [job] = await db
      .select()
      .from(blogGenerationJobs)
      .where(eq(blogGenerationJobs.id, jobId));

    if (!job) throw new Error("Job not found");

    const { studyIds, articleTypes, readingLevel } = job;
    let { currentStudyIndex, currentTypeIndex, completedItems, failedItems, savedItems } = job;
    const errorLog: Array<{ studyId: number; articleType: string; error: string }> =
      job.errors ? JSON.parse(job.errors) : [];

    console.log(`[BlogWorker] Starting job #${jobId}: ${studyIds.length} studies x ${articleTypes.length} types = ${job.totalItems} articles`);

    // Resume from where we left off
    for (let si = currentStudyIndex; si < studyIds.length; si++) {
      const studyId = studyIds[si];

      // Fetch study once per study
      const [study] = await db
        .select({
          id: studies.id,
          title: studies.title,
          abstract: studies.abstract,
          authors: studies.authors,
          journal: studies.journal,
          category: studies.category,
          publishDate: studies.publishDate,
          methods: studies.methods,
          results: studies.results,
          conclusion: studies.conclusion,
        })
        .from(studies)
        .where(eq(studies.id, studyId))
        .limit(1);

      if (!study) {
        // Skip missing studies, count all types as failed
        const skipCount = si === currentStudyIndex
          ? articleTypes.length - currentTypeIndex
          : articleTypes.length;
        failedItems += skipCount;
        for (let ti = (si === currentStudyIndex ? currentTypeIndex : 0); ti < articleTypes.length; ti++) {
          errorLog.push({ studyId, articleType: articleTypes[ti], error: "Study not found" });
        }
        currentTypeIndex = 0;
        continue;
      }

      const startType = si === currentStudyIndex ? currentTypeIndex : 0;

      for (let ti = startType; ti < articleTypes.length; ti++) {
        // Check for stop signal. Re-reads DB status each article so a cancel
        // issued on another instance is honored (cross-process) and a cancel
        // is never overwritten back to a resumable 'paused'.
        const stopAction = await getStopAction(jobId);
        if (stopAction) {
          await db.update(blogGenerationJobs).set({
            status: stopAction,
            currentStudyIndex: si,
            currentTypeIndex: ti,
            completedItems,
            failedItems,
            savedItems,
            errors: JSON.stringify(errorLog),
            updatedAt: new Date(),
          }).where(eq(blogGenerationJobs.id, jobId));

          console.log(`[BlogWorker] Job #${jobId} ${stopAction} at study ${si}/${studyIds.length}, type ${ti}/${articleTypes.length}`);
          return;
        }

        const articleType = articleTypes[ti];

        try {
          // Check for duplicate: skip if an article with this studyId + articleType already exists
          const [existing] = await db
            .select({ id: blogArticles.id })
            .from(blogArticles)
            .where(
              and(
                eq(blogArticles.studyId, studyId),
                eq(blogArticles.articleType, articleType),
              ),
            )
            .limit(1);

          if (existing) {
            console.log(`[BlogWorker] Skipping duplicate: study ${studyId}, type ${articleType} (article #${existing.id} exists)`);
            completedItems++; // Count as completed (already done)
            // Update progress and continue
            await db.update(blogGenerationJobs).set({
              currentStudyIndex: si,
              currentTypeIndex: ti + 1,
              completedItems,
              failedItems,
              savedItems,
              updatedAt: new Date(),
            }).where(eq(blogGenerationJobs.id, jobId));
            await sleep(500); // Short delay for skips
            continue;
          }

          const blog = await generateArticle(study, articleType, readingLevel);

          // Save to database
          const slug = (blog.title || "untitled")
            .toLowerCase()
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-+|-+$/g, "")
            .substring(0, 100) || "untitled-blog";

          // Generate image for the blog article if configured
          let imageUrl: string | null = null;
          let imageAlt: string | null = null;
          if (job.includeImages) {
            try {
              const imageResult = await generateBlogImageForWorker(study, blog.title, articleType);
              imageUrl = imageResult.imageUrl;
              imageAlt = imageResult.imageAlt;
            } catch (imgErr: any) {
              console.warn(`[BlogWorker] Image generation failed for study ${studyId}, type ${articleType}: ${imgErr.message}`);
              // Continue without image — don't fail the article
            }
          }

          await db.insert(blogArticles).values({
            title: blog.title,
            slug: `${slug}-${Date.now()}`,
            summary: blog.summary,
            content: blog.content,
            studyId: study.id,
            articleType,
            readingLevel,
            imageUrl,
            imageAlt,
            isPublished: false,
          });

          completedItems++;
          savedItems++;
        } catch (err: any) {
          failedItems++;
          errorLog.push({
            studyId,
            articleType,
            error: err.message || "Unknown error",
          });
          console.error(`[BlogWorker] Failed: study ${studyId}, type ${articleType}: ${err.message}`);
        }

        // Update progress periodically (every article)
        await db.update(blogGenerationJobs).set({
          currentStudyIndex: si,
          currentTypeIndex: ti + 1,
          completedItems,
          failedItems,
          savedItems,
          errors: errorLog.length > 0 ? JSON.stringify(errorLog.slice(-100)) : null, // Keep last 100 errors
          updatedAt: new Date(),
        }).where(eq(blogGenerationJobs.id, jobId));

        // Delay between articles to avoid rate limits
        await sleep(DELAY_BETWEEN_ARTICLES_MS);
      }

      currentTypeIndex = 0; // Reset for next study
    }

    // Job complete
    await db.update(blogGenerationJobs).set({
      status: "completed",
      completedItems,
      failedItems,
      savedItems,
      errors: errorLog.length > 0 ? JSON.stringify(errorLog.slice(-100)) : null,
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(blogGenerationJobs.id, jobId));

    console.log(`[BlogWorker] Job #${jobId} completed: ${completedItems} succeeded, ${failedItems} failed, ${savedItems} saved`);
}

/**
 * Generate a single article using AI
 */
async function generateArticle(
  study: any,
  articleType: string,
  readingLevel: string,
): Promise<{ title: string; summary: string; content: string }> {
  const typeLabels: Record<string, string> = {
    explainer: "a clear, educational explainer",
    summary: "a concise research summary",
    implications: "a health implications analysis",
    benefits: "a benefits-focused overview",
    "how-to": "a practical how-to guide",
    timeline: "a historical timeline article",
    faq: "an FAQ-style article",
    overview: "a comprehensive overview",
  };

  const typeDesc = typeLabels[articleType] || `a ${articleType} article`;
  const levelDesc = readingLevel === "6th" ? "6th grade" : readingLevel === "high_school" ? "high school" : "general adult";

  const systemPrompt = `You are an expert health science writer. Write engaging, accurate content about hydrogen therapy research at a ${levelDesc} reading level. Output HTML using <h2>, <p>, <ul>, <li> tags. Do not include <h1> tags.`;

  const userPrompt = `Write ${typeDesc} based on this study:

Title: ${study.title}
Abstract: ${study.abstract || "Not available"}
Methods: ${study.methods || "Not available"}
Results: ${study.results || "Not available"}
Conclusion: ${study.conclusion || "Not available"}
Journal: ${study.journal}
Category: ${study.category}

Write 800-1200 words with clear sections. Include: Introduction, Key Findings, Practical Implications, and Conclusion.`;

  let content: string;
  let retries = 0;

  while (retries <= MAX_RETRIES) {
    try {
      content = await Promise.race([
        ai.generateText(systemPrompt, userPrompt, {
          temperature: 0.7,
          maxTokens: 2048,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("AI timeout")), AI_TIMEOUT_MS),
        ),
      ]);
      break;
    } catch (err) {
      retries++;
      if (retries > MAX_RETRIES) throw err;
      await sleep(3000 * retries); // Exponential backoff
    }
  }

  // Generate title and summary from content
  const titleMatch = study.title.split(" ").slice(0, 10).join(" ");
  const typeSuffix = articleType !== "summary" ? ` — ${articleType.charAt(0).toUpperCase() + articleType.slice(1)}` : "";
  const title = `${titleMatch}${typeSuffix}`.substring(0, 120);

  const summary = study.abstract
    ? study.abstract.substring(0, 200) + "..."
    : `Research on ${study.title.substring(0, 100)}...`;

  return { title, summary, content: content! };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate an image for a blog article during bulk generation.
 * Uses xAI (Grok) if available, falls back to DALL-E (OpenAI), otherwise returns a category-based default.
 */
async function generateBlogImageForWorker(
  study: any,
  title: string,
  articleType: string,
): Promise<{ imageUrl: string | null; imageAlt: string | null }> {
  const xaiClient = ai.getXAIClient();
  const openaiClient = ai.getOpenAIClient();
  if (!xaiClient && !openaiClient) {
    // No image generation key — return a default placeholder based on category
    return getDefaultCategoryImage(study.category);
  }

  const imageClient = xaiClient || openaiClient!;
  const provider = xaiClient ? "xai" : "openai";

  // Build a unique prompt based on study content, not a generic one
  const { buildWorkerImagePrompt, buildWorkerAltText } = getWorkerImageHelpers();
  const prompt = buildWorkerImagePrompt(study, title, articleType).substring(0, 1000);

  const generateParams: any = {
    model: getImageModel(provider),
    prompt,
    n: 1,
    size: "1024x1024",
    response_format: "url",
  };
  if (provider === "openai") {
    generateParams.quality = "standard";
  }

  const response = await imageClient.images.generate(generateParams);

  const generatedUrl = response.data?.[0]?.url;
  if (!generatedUrl) {
    return getDefaultCategoryImage(study.category);
  }

  // Download and save via storage utility (S3 or local fallback)
  const axiosMod = await import("axios");
  const axiosClient = axiosMod.default;
  const imgResponse = await axiosClient.get(generatedUrl, { responseType: "arraybuffer", timeout: 15000 });
  const imageBuffer = Buffer.from(imgResponse.data);

  const safeType = articleType.replace(/[^a-z0-9-]/g, "-");
  const filename = `blog-${safeType}-${study.id}-${Date.now()}.png`;

  const { uploadFile } = await import("../utils/storage");
  const storedUrl = await uploadFile(imageBuffer, `blog-images/${filename}`, "image/png");

  return {
    imageUrl: storedUrl,
    imageAlt: buildWorkerAltText(study, title, articleType),
  };
}

/**
 * Returns a default placeholder image path based on study category.
 */
function getDefaultCategoryImage(category?: string): { imageUrl: string | null; imageAlt: string | null } {
  // Use the fallback SVG that actually exists in the repo
  return {
    imageUrl: "/images/fallback-study-image.svg",
    imageAlt: `${category || "Hydrogen therapy"} research illustration`,
  };
}

/**
 * Helper functions for unique image prompts in the worker
 */
function getWorkerImageHelpers() {
  return {
    buildWorkerImagePrompt(study: any, title: string, articleType: string): string {
      const category = (study.category || "health").toLowerCase();
      const text = `${study.title || ""} ${study.abstract || ""}`.toLowerCase();

      // Detect topic-specific visuals
      let topicVisual = "person drinking hydrogen-rich water, wellness setting";
      if (text.includes("diabetes") || text.includes("glucose")) topicVisual = "blood glucose monitoring, healthy meal, metabolic health";
      else if (text.includes("brain") || text.includes("cognitive")) topicVisual = "brain visualization, neural pathways";
      else if (text.includes("exercise") || text.includes("athletic")) topicVisual = "athlete hydrating, fitness recovery";
      else if (text.includes("skin") || text.includes("aging")) topicVisual = "healthy radiant skin, skincare";
      else if (text.includes("heart") || text.includes("cardiovascular")) topicVisual = "heart health, cardiovascular wellness";
      else if (text.includes("gut") || text.includes("microbiome")) topicVisual = "gut health illustration, digestive wellness";
      else if (text.includes("cancer") || text.includes("radiation")) topicVisual = "hopeful medical care, warm clinical tones";
      else if (text.includes("arthritis") || text.includes("joint")) topicVisual = "joint mobility, person stretching";
      else if (text.includes("liver") || text.includes("hepat")) topicVisual = "liver health visualization";
      else if (text.includes("kidney") || text.includes("renal")) topicVisual = "kidney health illustration";
      else if (text.includes("fatigue") || text.includes("energy")) topicVisual = "person feeling energized, morning vitality";
      else if (text.includes("anxiety") || text.includes("stress")) topicVisual = "calm meditation, mental wellness";

      const styleByType: Record<string, string> = {
        overview: "Scientific editorial style with data elements",
        practical_application: "Lifestyle photography, person in wellness setting",
        simplified: "Friendly colorful illustration, approachable",
        patient_story: "Warm portrait of healthy person",
        myth_busting: "Split-frame contrast composition",
        daily_routine: "Morning wellness routine with natural light",
        side_effects: "Calming clinical setting, reassuring",
        tips: "Organized wellness flat-lay, top-down editorial",
      };
      const style = styleByType[articleType] || "Clean editorial health photography";

      return `${style}. Subject: ${topicVisual}. Category: ${category}. No text, no labels, no formulas. Unique to: ${title.substring(0, 60)}.`;
    },

    buildWorkerAltText(study: any, title: string, articleType: string): string {
      const category = study.category || "health";
      const typeLabel: Record<string, string> = {
        overview: "research overview", practical_application: "practical guide",
        simplified: "simple explanation", patient_story: "patient perspective",
        myth_busting: "myths vs facts", daily_routine: "daily routine",
        side_effects: "safety guide", tips: "practical tips",
      };
      const label = typeLabel[articleType] || "article";
      const keyTerms = title.replace(/[^a-zA-Z\s]/g, "").split(/\s+/).filter(w => w.length > 4).slice(0, 4).join(", ");
      return `Hydrogen therapy ${label} — ${category}: ${keyTerms}. ${title.substring(0, 80)}`;
    },
  };
}

/**
 * Check if worker is busy
 */
export function isWorkerBusy(): boolean {
  return isProcessing;
}

/**
 * Get current worker state
 */
export function getWorkerState() {
  return {
    isProcessing,
    currentJobId,
  };
}
