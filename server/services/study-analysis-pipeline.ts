/**
 * AI Study Analysis Pipeline
 *
 * Processes queued studies through 6 idempotent AI steps:
 * 0: Plain language title generation
 * 1: Health condition / body system / life stage categorization
 * 2: Key findings extraction (sample size, outcomes, methodology)
 * 3: Evidence quality scoring (0-100)
 * 4: Consumer summaries (50/100/200 word tiers)
 * 5: SEO metadata (slug, meta description, semantic keywords)
 * Final: Creates study record from accumulated results
 *
 * Each step stores its output in step_results JSON — pipeline resumes from
 * the last completed step on retry.
 */

import { db } from "../db";
import { pipelineQueue, studies } from "@shared/schema";
import type { PipelineQueueItem } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { ai } from "./ai-provider";
import { logger } from "../utils/logger";

const MAX_ITEMS_PER_CYCLE = 10;
const TOTAL_STEPS = 6; // Steps 0-5

// Cost-efficient model for pipeline processing
const PIPELINE_MODEL = "claude-sonnet-4-20250514";

interface StepResults {
  [key: string]: any;
}

function parseStepResults(raw: string): StepResults {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Step 0: Generate a plain-language title
 */
async function runStep0(item: PipelineQueueItem, results: StepResults): Promise<StepResults> {
  if (results.step0) return results;

  const response = await ai.generateJSON<{ plainLanguageTitle: string }>(
    `You are a science communicator. Generate a clear, consumer-friendly title for a research paper.
The title should be understandable by a general audience, mention hydrogen specifically, and be compelling for SEO.
Keep it under 80 characters.`,
    `Original title: ${item.title}
${item.abstract ? `Abstract excerpt: ${item.abstract.substring(0, 500)}` : ""}
Journal: ${item.journal || "Unknown"}`,
    { model: PIPELINE_MODEL, maxTokens: 200 },
  );

  return { ...results, step0: response };
}

/**
 * Step 1: Categorize by health condition, body system, life stage
 */
async function runStep1(item: PipelineQueueItem, results: StepResults): Promise<StepResults> {
  if (results.step1) return results;

  const response = await ai.generateJSON<{
    healthConditions: string[];
    bodySystems: string[];
    lifeStages: string[];
    category: string;
    studyType: string;
  }>(
    `You are a biomedical research classifier. Categorize this hydrogen research study.

Return JSON with:
- healthConditions: array of relevant health conditions (e.g., "diabetes", "inflammation", "oxidative stress")
- bodySystems: array of body systems studied (e.g., "cardiovascular", "nervous", "digestive")
- lifeStages: array of applicable life stages (e.g., "adult", "elderly", "pediatric")
- category: primary category (one of: "Oxidative Stress", "Inflammation", "Neuroprotection", "Cardiovascular", "Metabolic", "Cancer", "Exercise & Recovery", "Gut Health", "Skin & Beauty", "Respiratory", "Kidney & Liver", "General Wellness", "Other")
- studyType: one of "human", "animal", "in vitro", "review", "meta-analysis"`,
    `Title: ${item.title}
${item.abstract ? `Abstract: ${item.abstract.substring(0, 1000)}` : ""}
Authors: ${item.authors || "Unknown"}
Journal: ${item.journal || "Unknown"}`,
    { model: PIPELINE_MODEL, maxTokens: 500 },
  );

  return { ...results, step1: response };
}

/**
 * Step 2: Extract key findings
 */
async function runStep2(item: PipelineQueueItem, results: StepResults): Promise<StepResults> {
  if (results.step2) return results;

  const response = await ai.generateJSON<{
    sampleSize: number | null;
    duration: number | null;
    methodology: string;
    keyOutcomes: string[];
    outcome: string;
    mechanisms: string[];
  }>(
    `You are a research analyst. Extract key findings from this hydrogen research study.

Return JSON with:
- sampleSize: number of participants/subjects (null if not clear)
- duration: study duration in days (null if not clear)
- methodology: brief methodology description (1-2 sentences)
- keyOutcomes: array of 2-4 key findings (brief, factual statements)
- outcome: overall outcome classification (one of: "positive", "neutral", "negative", "mixed")
- mechanisms: array of molecular mechanisms mentioned (e.g., "ROS scavenging", "NF-kB inhibition")`,
    `Title: ${item.title}
${item.abstract ? `Abstract: ${item.abstract}` : "No abstract available — infer from title and journal."}
Journal: ${item.journal || "Unknown"}`,
    { model: PIPELINE_MODEL, maxTokens: 600 },
  );

  return { ...results, step2: response };
}

/**
 * Step 3: Evidence quality scoring
 */
async function runStep3(item: PipelineQueueItem, results: StepResults): Promise<StepResults> {
  if (results.step3) return results;

  const step1 = results.step1 || {};
  const step2 = results.step2 || {};

  const response = await ai.generateJSON<{
    evidenceScore: number;
    scoreBreakdown: { criterion: string; score: number; maxScore: number }[];
    peerReviewed: boolean;
    limitations: string[];
  }>(
    `You are a research quality assessor. Score this hydrogen study's evidence quality on a 0-100 scale.

Consider:
- Study design (RCT > cohort > case-control > case report > in vitro)
- Sample size adequacy
- Peer review status
- Journal reputation
- Statistical rigor
- Conflict of interest transparency
- Replicability

Return JSON with:
- evidenceScore: integer 0-100
- scoreBreakdown: array of { criterion, score, maxScore } items
- peerReviewed: boolean (best guess based on journal)
- limitations: array of 1-3 notable limitations`,
    `Title: ${item.title}
Journal: ${item.journal || "Unknown"}
Study Type: ${step1.studyType || "unknown"}
Sample Size: ${step2.sampleSize || "unknown"}
Duration: ${step2.duration ? `${step2.duration} days` : "unknown"}
Methodology: ${step2.methodology || "unknown"}
${item.abstract ? `Abstract excerpt: ${item.abstract.substring(0, 800)}` : ""}`,
    { model: PIPELINE_MODEL, maxTokens: 600 },
  );

  return { ...results, step3: response };
}

/**
 * Step 4: Consumer summaries at 3 tiers
 */
async function runStep4(item: PipelineQueueItem, results: StepResults): Promise<StepResults> {
  if (results.step4) return results;

  const step2 = results.step2 || {};

  const response = await ai.generateJSON<{
    summary50: string;
    summary100: string;
    summary200: string;
    objective: string;
    conclusionShort: string;
  }>(
    `You are a health science writer for a general audience. Write consumer-friendly summaries of this hydrogen research study.

Guidelines:
- Use plain language a non-scientist can understand
- Mention "molecular hydrogen" or "hydrogen water" when relevant
- Be accurate but accessible
- Include practical implications when possible

Return JSON with:
- summary50: exactly ~50 word summary (tweet-length)
- summary100: exactly ~100 word summary (quick read)
- summary200: exactly ~200 word summary (detailed overview)
- objective: 1-sentence study objective in plain language
- conclusionShort: 1-2 sentence conclusion in plain language`,
    `Title: ${item.title}
${item.abstract ? `Abstract: ${item.abstract}` : ""}
Key Outcomes: ${JSON.stringify(step2.keyOutcomes || [])}
Outcome: ${step2.outcome || "unknown"}`,
    { model: PIPELINE_MODEL, maxTokens: 1000 },
  );

  return { ...results, step4: response };
}

/**
 * Step 5: SEO metadata
 */
async function runStep5(item: PipelineQueueItem, results: StepResults): Promise<StepResults> {
  if (results.step5) return results;

  const step0 = results.step0 || {};
  const step1 = results.step1 || {};

  const response = await ai.generateJSON<{
    slug: string;
    metaTitle: string;
    metaDescription: string;
    semanticKeywords: string[];
    ogTitle: string;
    ogDescription: string;
  }>(
    `You are an SEO specialist for a hydrogen research database (hydrogenstudies.com).

Generate SEO metadata for this study page. The site aims to be THE authority on hydrogen health research.

Return JSON with:
- slug: URL-friendly slug (lowercase, hyphens, no special chars, max 60 chars)
- metaTitle: SEO title tag (max 60 chars, include "hydrogen" and primary condition)
- metaDescription: meta description (max 155 chars, compelling, includes key finding)
- semanticKeywords: array of 5-8 LSI keywords for topical relevance
- ogTitle: Open Graph title (can be slightly longer than metaTitle)
- ogDescription: Open Graph description (max 200 chars)`,
    `Plain Language Title: ${step0.plainLanguageTitle || item.title}
Original Title: ${item.title}
Category: ${step1.category || "General"}
Health Conditions: ${JSON.stringify(step1.healthConditions || [])}
Body Systems: ${JSON.stringify(step1.bodySystems || [])}`,
    { model: PIPELINE_MODEL, maxTokens: 500 },
  );

  return { ...results, step5: response };
}

/**
 * Final: Create the study record from accumulated pipeline results
 */
async function createStudyFromResults(
  item: PipelineQueueItem,
  results: StepResults,
): Promise<number> {
  const step0 = results.step0 || {};
  const step1 = results.step1 || {};
  const step2 = results.step2 || {};
  const step3 = results.step3 || {};
  const step4 = results.step4 || {};
  const step5 = results.step5 || {};

  const [inserted] = await db
    .insert(studies)
    .values({
      title: item.title,
      abstract: item.abstract || "Abstract not available.",
      authors: item.authors || "Unknown",
      journal: item.journal || "Unknown Journal",
      publishDate: item.publishDate || new Date().toISOString().split("T")[0],
      journalPublishDate: item.publishDate || null,
      category: step1.category || "Other",
      doi: item.doi || null,
      url: item.sourceUrl || null,
      sourcePlatform: item.sourcePlatform || null,
      sourceUrl: item.sourceUrl || null,
      peerReviewed: step3.peerReviewed ?? true,
      // AI-generated fields
      plainLanguageTitle: step0.plainLanguageTitle || null,
      slug: step5.slug || null,
      studyType: step1.studyType || null,
      outcome: step2.outcome || null,
      sampleSize: step2.sampleSize || null,
      duration: step2.duration || null,
      healthConditions: step1.healthConditions || [],
      bodySystems: step1.bodySystems || [],
      lifeStages: step1.lifeStages || [],
      mechanisms: step2.mechanisms || [],
      // Summaries
      summary50Words: step4.summary50 || null,
      summary100Words: step4.summary100 || null,
      summary200Words: step4.summary200 || null,
      objective: step4.objective || null,
      conclusionShort: step4.conclusionShort || null,
      conclusion: step4.conclusionShort || null,
      // SEO
      metaTitle: step5.metaTitle || null,
      metaDescription: step5.metaDescription || null,
      ogTitle: step5.ogTitle || null,
      ogDescription: step5.ogDescription || null,
      semanticKeywords: step5.semanticKeywords || [],
      topicalRelevance: step3.evidenceScore || null,
      // Flags
      enhancedWithAI: true,
      readingLevel: "general",
      createdAt: new Date(),
    })
    .returning({ id: studies.id });

  return inserted.id;
}

/**
 * Process a single queue item through the remaining pipeline steps.
 */
async function processItem(item: PipelineQueueItem): Promise<void> {
  let results = parseStepResults(item.stepResults);
  let currentStep = item.currentStep;

  // Mark as processing
  await db
    .update(pipelineQueue)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(pipelineQueue.id, item.id));

  try {
    const steps = [runStep0, runStep1, runStep2, runStep3, runStep4, runStep5];

    for (let step = currentStep; step < TOTAL_STEPS; step++) {
      results = await steps[step](item, results);
      currentStep = step + 1;

      // Save progress after each step (idempotent checkpoint)
      await db
        .update(pipelineQueue)
        .set({
          currentStep,
          stepResults: JSON.stringify(results),
          updatedAt: new Date(),
        })
        .where(eq(pipelineQueue.id, item.id));
    }

    // All AI analysis steps complete — mark as ready for human review
    // Do NOT auto-create the study. An admin must approve it first.
    await db
      .update(pipelineQueue)
      .set({
        status: "awaiting_approval",
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pipelineQueue.id, item.id));

    logger.info("Pipeline item ready for approval", "StudyAnalysisPipeline", {
      queueId: item.id,
      title: item.title.substring(0, 80),
    });
  } catch (error) {
    const retryCount = item.retryCount + 1;
    const maxRetries = item.maxRetries || 3;

    await db
      .update(pipelineQueue)
      .set({
        status: retryCount >= maxRetries ? "failed" : "pending",
        currentStep,
        stepResults: JSON.stringify(results),
        errorMessage: error instanceof Error ? error.message : String(error),
        retryCount,
        updatedAt: new Date(),
      })
      .where(eq(pipelineQueue.id, item.id));

    logger.error("Pipeline item failed", error, "StudyAnalysisPipeline", {
      queueId: item.id,
      step: currentStep,
      retryCount,
    });
  }
}

/**
 * Approve a pipeline item: create the study from its accumulated AI results.
 * Called by admin when they approve a discovered study.
 * Returns the new study ID.
 */
export async function createStudyFromPipelineItem(pipelineItemId: number): Promise<number> {
  const [item] = await db
    .select()
    .from(pipelineQueue)
    .where(eq(pipelineQueue.id, pipelineItemId))
    .limit(1);

  if (!item) throw new Error(`Pipeline item ${pipelineItemId} not found`);

  const results = parseStepResults(item.stepResults);
  const studyId = await createStudyFromResults(item, results);

  // Mark as completed with the created study ID
  await db
    .update(pipelineQueue)
    .set({
      status: "completed",
      createdStudyId: studyId,
      processedAt: new Date(),
    })
    .where(eq(pipelineQueue.id, pipelineItemId));

  return studyId;
}

/**
 * Process pending items from the pipeline queue.
 * Called by the job scheduler every 15 minutes.
 */
export async function processPipelineQueue(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  // Get pending items (oldest first), limited to MAX_ITEMS_PER_CYCLE
  const pendingItems = await db
    .select()
    .from(pipelineQueue)
    .where(eq(pipelineQueue.status, "pending"))
    .orderBy(pipelineQueue.createdAt)
    .limit(MAX_ITEMS_PER_CYCLE);

  if (pendingItems.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  logger.info(`Processing ${pendingItems.length} pipeline items`, "StudyAnalysisPipeline");

  let succeeded = 0;
  let failed = 0;

  for (const item of pendingItems) {
    try {
      await processItem(item);
      // Re-check status after processing. processItem marks items as
      // "awaiting_approval" after all AI steps finish (admin review is
      // the next gate) — that's a success, not a failure. Only count as
      // failed when the item is back in pending/failed/processing,
      // meaning processItem's catch block ran.
      const updated = await db.query.pipelineQueue.findFirst({
        where: eq(pipelineQueue.id, item.id),
        columns: { status: true },
      });
      const successStatuses = new Set([
        "awaiting_approval",
        "completed",
        "approved",
      ]);
      if (updated?.status && successStatuses.has(updated.status)) succeeded++;
      else failed++;
    } catch (err) {
      // processItem catches its own errors — reaching here means something
      // outside the step loop threw. Log it so we stop losing the signal.
      logger.error("Pipeline item threw unexpectedly", err, "StudyAnalysisPipeline", {
        queueId: item.id,
      });
      failed++;
    }
  }

  logger.info("Pipeline cycle complete", "StudyAnalysisPipeline", {
    processed: pendingItems.length,
    succeeded,
    failed,
  });

  return { processed: pendingItems.length, succeeded, failed };
}

/**
 * Reprocess a specific failed item (reset to pending with retry)
 */
export async function reprocessItem(id: number): Promise<void> {
  await db
    .update(pipelineQueue)
    .set({
      status: "pending",
      errorMessage: null,
      retryCount: 0,
      updatedAt: new Date(),
    })
    .where(eq(pipelineQueue.id, id));
}
