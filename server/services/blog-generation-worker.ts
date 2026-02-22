/**
 * Blog Generation Worker
 *
 * Background processor for bulk blog generation jobs.
 * Processes jobs from the blog_generation_jobs table, generating articles
 * one at a time with progress tracking and resume capability.
 */
import { db } from "../db";
import { blogGenerationJobs, blogArticles, studies } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ai } from "./ai-provider";

// Worker state
let isProcessing = false;
let currentJobId: number | null = null;
let shouldStop = false;

// Configurable settings
const DELAY_BETWEEN_ARTICLES_MS = 2000; // 2s between articles to avoid rate limits
const AI_TIMEOUT_MS = 30000; // 30s timeout for AI calls
const MAX_RETRIES = 2;

/**
 * Start or resume a blog generation job
 */
export async function startJob(jobId: number): Promise<{ success: boolean; message: string }> {
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
        // Check for stop signal
        if (shouldStop) {
          await db.update(blogGenerationJobs).set({
            status: "paused",
            currentStudyIndex: si,
            currentTypeIndex: ti,
            completedItems,
            failedItems,
            savedItems,
            errors: JSON.stringify(errorLog),
            updatedAt: new Date(),
          }).where(eq(blogGenerationJobs.id, jobId));

          console.log(`[BlogWorker] Job #${jobId} paused at study ${si}/${studyIds.length}, type ${ti}/${articleTypes.length}`);
          return;
        }

        const articleType = articleTypes[ti];

        try {
          const blog = await generateArticle(study, articleType, readingLevel);

          // Save to database
          const slug = (blog.title || "untitled")
            .toLowerCase()
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-+|-+$/g, "")
            .substring(0, 100) || "untitled-blog";

          await db.insert(blogArticles).values({
            title: blog.title,
            slug: `${slug}-${Date.now()}`,
            summary: blog.summary,
            content: blog.content,
            studyId: study.id,
            articleType,
            readingLevel,
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
  } finally {
    isProcessing = false;
    currentJobId = null;
    shouldStop = false;
  }
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
