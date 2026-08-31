/**
 * Content Generation Worker
 *
 * Single source of truth for the post-import content waterfall.
 * Every study — whether created via API, spreadsheet import, or pipeline —
 * goes through the same enrichment steps in order:
 *
 *   1. SEO enrichment (slug, plain language title, meta fields, schema.org)
 *   2. Summaries (TLDR, plain summary, key finding, practical takeaway)
 *   3. Tag generation (consumer-friendly search tags via Haiku)
 *   4. Blog article generation (3 articles: science_explainer, practical_guide, faq)
 *   5. Study image generation (Grok/xAI)
 *   6. Internal link building
 *
 * Steps are idempotent and resumable. On failure, the queue item retries
 * up to 3 times, skipping already-completed steps.
 */

import { db } from "../db";
import { contentGenerationQueue, studies } from "@shared/schema";
import { eq, and, sql, asc, desc, inArray } from "drizzle-orm";
import { logger } from "../utils/logger";

const WATERFALL_STEPS = ["seo", "summaries", "tags", "blogs", "image", "links"] as const;
type WaterfallStep = typeof WATERFALL_STEPS[number];

const MAX_RETRIES = 3;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Sentinel written to keyFinding when the AI returns nothing useful. Mirrors
// study-summary-enrichment.ts's PROCESSED_SENTINEL: non-NULL (so the batch
// candidate query's `keyFinding IS NULL` skips it) but falsy in JS templates.
const SUMMARY_PROCESSED_SENTINEL = "__no_content__";

// Copy of study-summary-enrichment.ts's SYSTEM_PROMPT. The batch
// enrichStudySummaries() selects an unbounded `LIMIT 1` candidate with no id
// filter, so it enriches an arbitrary row — not the study being processed. The
// worker enriches THIS study by id instead (WHERE id = studyId).
const SUMMARY_SYSTEM_PROMPT = `You are a science writer who translates academic hydrogen research into clear, accurate language for health-conscious consumers.

Given a study's title, abstract, and any available metadata, generate three pieces of content:

1. **plain_summary** (2-4 sentences): A plain-language explanation of what the study investigated and what it found. Write at a 10th-grade reading level. Avoid jargon — if you must use a technical term, define it in parentheses. Do NOT editorialize or make health claims beyond what the study supports.

2. **key_finding** (1-2 sentences): The single most important result of this study, stated clearly and factually. This will appear as a highlighted callout. Start with the finding, not "This study found that...".

3. **practical_takeaway** (1-3 sentences): What this study might mean for someone interested in hydrogen water. Be honest about limitations — if the study is animal-only or very small, say so. Never make definitive health claims. Use phrases like "suggests that", "may support", "early evidence indicates".

Return JSON with these exact fields:
{
  "plain_summary": string or null,
  "key_finding": string or null,
  "practical_takeaway": string or null
}

If the abstract is too vague or incomplete to generate a reliable summary, return null for that field. Accuracy matters more than completeness.`;

/**
 * Enrich a SINGLE study's summary fields by id (plainSummary, keyFinding,
 * practicalTakeaway). Unlike the batch enrichStudySummaries(), this targets the
 * exact study being processed so the waterfall never marks 'summaries' complete
 * for a study that was never actually enriched.
 */
async function enrichSummaryForStudyId(studyId: number): Promise<void> {
  const [study] = await db
    .select({
      id: studies.id,
      title: studies.title,
      abstract: studies.abstract,
      studyType: studies.studyType,
      resultsShort: studies.resultsShort,
      conclusionShort: studies.conclusionShort,
      conclusion: studies.conclusion,
      results: studies.results,
      sampleSize: studies.sampleSize,
      duration: studies.duration,
      isHumanTrial: studies.isHumanTrial,
      h2DeliveryMethod: studies.h2DeliveryMethod,
      keyFinding: studies.keyFinding,
    })
    .from(studies)
    .where(eq(studies.id, studyId))
    .limit(1);

  // Nothing to enrich without an abstract; and keyFinding non-NULL means this
  // study was already processed (real content or sentinel) — don't re-spend AI.
  if (!study || !study.abstract || study.keyFinding) return;

  const { ai, MODELS } = await import("./ai-provider");

  const userPrompt = `Title: ${study.title || "Not available"}
Abstract: ${study.abstract || "Not available"}
Study Type: ${study.studyType || "Not available"}
Results: ${study.resultsShort || study.results || "Not available"}
Conclusion: ${study.conclusionShort || study.conclusion || "Not available"}
Sample Size: ${study.sampleSize ?? "Not reported"}
Duration: ${study.duration ? `${study.duration} days` : "Not reported"}
Human Trial: ${study.isHumanTrial ? "Yes" : "No/Unknown"}
H2 Delivery: ${study.h2DeliveryMethod || "Not specified"}`;

  const raw = await ai.generateJSON<{
    plain_summary?: unknown;
    key_finding?: unknown;
    practical_takeaway?: unknown;
  }>(SUMMARY_SYSTEM_PROMPT, userPrompt, {
    // Sonnet + effort:low, not Haiku — these are user-facing study-page fields;
    // see study-summary-enrichment.ts (same rationale, kept in sync).
    model: MODELS.SONNET,
    maxTokens: 1500,
    temperature: 0.4,
    effort: "low",
    caller: "ContentWorker.summaries",
  });

  const updates: Record<string, string> = {};
  if (raw && typeof raw.plain_summary === "string" && raw.plain_summary.trim()) {
    updates.plainSummary = raw.plain_summary.trim();
  }
  if (raw && typeof raw.key_finding === "string" && raw.key_finding.trim()) {
    updates.keyFinding = raw.key_finding.trim();
  }
  if (raw && typeof raw.practical_takeaway === "string" && raw.practical_takeaway.trim()) {
    updates.practicalTakeaway = raw.practical_takeaway.trim();
  }

  // Always mark processed: write the sentinel when AI produced no keyFinding so
  // the row won't be re-selected on a later batch run.
  if (!updates.keyFinding) {
    updates.keyFinding = SUMMARY_PROCESSED_SENTINEL;
  }

  await db.update(studies).set(updates).where(eq(studies.id, studyId));
}

/**
 * Enqueue a single study for content generation. Idempotent — skips if already queued.
 */
export async function enqueueStudy(studyId: number, priority: number = 0): Promise<void> {
  try {
    // Check if already queued (pending or processing)
    const [existing] = await db
      .select({ id: contentGenerationQueue.id })
      .from(contentGenerationQueue)
      .where(
        and(
          eq(contentGenerationQueue.studyId, studyId),
          inArray(contentGenerationQueue.status, ["pending", "processing"]),
        ),
      )
      .limit(1);

    if (existing) {
      logger.info(`Study ${studyId} already in content queue, skipping`, "ContentWorker");
      return;
    }

    // onConflictDoNothing backs the pre-check with the partial unique index
    // (uq_cgq_active_study): a concurrent enqueue racing past the SELECT
    // resolves to a silent no-op instead of a unique-violation error.
    const inserted = await db
      .insert(contentGenerationQueue)
      .values({ studyId, priority, status: "pending" })
      .onConflictDoNothing()
      .returning({ id: contentGenerationQueue.id });

    if (inserted.length > 0) {
      logger.info(`Enqueued study ${studyId} for content generation`, "ContentWorker");
    } else {
      // A concurrent enqueue won the race after our SELECT; nothing was inserted.
      logger.info(`Study ${studyId} already queued by a concurrent enqueue, skipping`, "ContentWorker");
    }
  } catch (error) {
    logger.error(`Failed to enqueue study ${studyId}`, error, "ContentWorker");
  }
}

/**
 * Bulk enqueue studies. Returns count of newly enqueued items.
 */
export async function enqueueStudies(studyIds: number[], priority: number = 0): Promise<number> {
  let enqueued = 0;
  for (const studyId of studyIds) {
    try {
      const [existing] = await db
        .select({ id: contentGenerationQueue.id })
        .from(contentGenerationQueue)
        .where(
          and(
            eq(contentGenerationQueue.studyId, studyId),
            inArray(contentGenerationQueue.status, ["pending", "processing"]),
          ),
        )
        .limit(1);

      if (!existing) {
        const inserted = await db
          .insert(contentGenerationQueue)
          .values({ studyId, priority, status: "pending" })
          .onConflictDoNothing()
          .returning({ id: contentGenerationQueue.id });
        if (inserted.length > 0) enqueued++;
      }
    } catch (error) {
      logger.error(`Failed to enqueue study ${studyId}`, error, "ContentWorker");
    }
  }

  if (enqueued > 0) {
    logger.info(`Bulk enqueued ${enqueued} studies for content generation`, "ContentWorker");
  }
  return enqueued;
}

/**
 * Get queue status counts for admin dashboard visibility.
 */
export async function getQueueStatus(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  const rows = await db
    .select({
      status: contentGenerationQueue.status,
      count: sql<number>`count(*)::int`,
    })
    .from(contentGenerationQueue)
    .groupBy(contentGenerationQueue.status);

  const counts = { pending: 0, processing: 0, completed: 0, failed: 0 };
  for (const row of rows) {
    if (row.status in counts) {
      counts[row.status as keyof typeof counts] = row.count;
    }
  }
  return counts;
}

/**
 * Atomically claim a queue item: flip pending→processing only if it is
 * STILL pending. Returns the updated row ([] = someone else claimed it
 * first — "lost the race"). This single conditional UPDATE ... RETURNING
 * is the entire claim protocol; there is deliberately no surrounding
 * transaction. Exported so race-safety tests exercise the real statement
 * (content-queue-claim.pglite.test.ts); processContentQueue uses this
 * exact path.
 */
export async function claimQueueItem(queueItemId: number): Promise<{ id: number }[]> {
  return db
    .update(contentGenerationQueue)
    .set({ status: "processing", startedAt: new Date() })
    .where(
      and(
        eq(contentGenerationQueue.id, queueItemId),
        eq(contentGenerationQueue.status, "pending"),
      ),
    )
    .returning({ id: contentGenerationQueue.id });
}

/**
 * Process pending items from the content generation queue.
 * Picks up the oldest items with highest priority first.
 */
export async function processContentQueue(
  maxItems: number = 3,
  signal?: AbortSignal,
): Promise<{
  processed: number;
  failed: number;
}> {
  let processed = 0;
  let failed = 0;

  // Pick up pending items (higher priority first, then oldest first)
  const items = await db
    .select()
    .from(contentGenerationQueue)
    .where(eq(contentGenerationQueue.status, "pending"))
    .orderBy(desc(contentGenerationQueue.priority), asc(contentGenerationQueue.createdAt))
    .limit(maxItems);

  if (items.length === 0) {
    return { processed: 0, failed: 0 };
  }

  logger.info(`Processing ${items.length} items from content queue`, "ContentWorker");

  let retrying = 0;
  for (let i = 0; i < items.length; i++) {
    // Stop claiming new items once the scheduler's timeout has fired. Without
    // this, a slow drain keeps running as an orphan after withTimeout() gave
    // up — claiming items and writing 'completed' while the NEXT fast tick
    // starts a second concurrent drain (double AI spend, rate-limit pressure).
    if (signal?.aborted) {
      logger.warn(
        `Content queue drain aborted (timeout): ${processed} processed, ${items.length - i} items left for next cycle`,
        "ContentWorker",
      );
      break;
    }
    const item = items[i];

    // Atomically claim the item: flip pending→processing only if it's STILL
    // pending. The earlier SELECT + this UPDATE are not a transaction, so a
    // concurrent worker (or another Railway instance, or the boot-time run
    // overlapping the first scheduler tick) may have grabbed it in between.
    // If the conditional update touches 0 rows we lost the race — skip it
    // rather than double-spend AI budget generating duplicate content.
    const claimed = await claimQueueItem(item.id);
    if (claimed.length === 0) {
      continue;
    }

    try {
      await runWaterfall(item.id, item.studyId, (item.completedSteps as string[]) || [], signal);
      // runWaterfall handles step failures by storing retry state in the DB
      // and returning cleanly. Re-read status to categorize correctly.
      const [after] = await db
        .select({ status: contentGenerationQueue.status })
        .from(contentGenerationQueue)
        .where(eq(contentGenerationQueue.id, item.id))
        .limit(1);
      if (after?.status === "completed") processed++;
      else if (after?.status === "failed") failed++;
      else retrying++;
    } catch (error) {
      failed++;
      logger.error(`Content generation threw unexpectedly for study ${item.studyId}`, error, "ContentWorker");
    }

    // Delay between studies to avoid API rate limits
    if (i < items.length - 1) {
      await delay(5000);
    }
  }

  logger.info(
    `Content queue processing complete: ${processed} succeeded, ${retrying} pending retry, ${failed} failed`,
    "ContentWorker",
  );
  return { processed, failed };
}

/**
 * Run the content waterfall for a single queue item.
 * Skips already-completed steps for resume capability.
 */
async function runWaterfall(
  queueId: number,
  studyId: number,
  alreadyCompleted: string[],
  signal?: AbortSignal,
): Promise<void> {
  const completedSet = new Set(alreadyCompleted);

  for (const step of WATERFALL_STEPS) {
    if (completedSet.has(step)) {
      logger.info(`Skipping already-completed step "${step}" for study ${studyId}`, "ContentWorker");
      continue;
    }

    // Cooperative cancellation: the scheduler's timeout fired mid-drain. Release
    // the claim back to 'pending' (preserving finished steps) so the next cycle
    // resumes immediately, instead of leaving the row 'processing' until the
    // 90-min stale-recovery sweep. Checked before starting an unfinished step,
    // so a fully-completed waterfall still falls through to mark 'completed'.
    if (signal?.aborted) {
      await db
        .update(contentGenerationQueue)
        .set({ status: "pending", currentStep: null, completedSteps: Array.from(completedSet) })
        .where(eq(contentGenerationQueue.id, queueId));
      logger.warn(
        `Waterfall aborted (timeout) for study ${studyId} before step "${step}"; reset to pending`,
        "ContentWorker",
      );
      return;
    }

    // Update current step
    await db
      .update(contentGenerationQueue)
      .set({ currentStep: step })
      .where(eq(contentGenerationQueue.id, queueId));

    try {
      await executeStep(step, studyId);

      // Append to completedSteps
      completedSet.add(step);
      await db
        .update(contentGenerationQueue)
        .set({
          completedSteps: Array.from(completedSet),
        })
        .where(eq(contentGenerationQueue.id, queueId));

      logger.info(`Step "${step}" completed for study ${studyId}`, "ContentWorker");
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Step "${step}" failed for study ${studyId}: ${errorMsg}`, error, "ContentWorker");

      // Fetch current retry count
      const [current] = await db
        .select({ retryCount: contentGenerationQueue.retryCount })
        .from(contentGenerationQueue)
        .where(eq(contentGenerationQueue.id, queueId))
        .limit(1);

      const newRetryCount = (current?.retryCount || 0) + 1;

      if (newRetryCount >= MAX_RETRIES) {
        // Mark as permanently failed
        await db
          .update(contentGenerationQueue)
          .set({
            status: "failed",
            errorMessage: `Step "${step}": ${errorMsg}`,
            retryCount: newRetryCount,
            completedSteps: Array.from(completedSet),
          })
          .where(eq(contentGenerationQueue.id, queueId));
      } else {
        // Set back to pending for retry, preserving completed steps
        await db
          .update(contentGenerationQueue)
          .set({
            status: "pending",
            errorMessage: `Step "${step}": ${errorMsg}`,
            retryCount: newRetryCount,
            completedSteps: Array.from(completedSet),
          })
          .where(eq(contentGenerationQueue.id, queueId));
      }

      return; // Stop waterfall on failure
    }

    // Delay between steps to avoid API rate limits
    await delay(2000);
  }

  // All steps completed successfully
  await db
    .update(contentGenerationQueue)
    .set({
      status: "completed",
      completedAt: new Date(),
      currentStep: null,
    })
    .where(eq(contentGenerationQueue.id, queueId));

  logger.info(`Content generation complete for study ${studyId}`, "ContentWorker");
}

/**
 * Execute a single waterfall step.
 */
async function executeStep(step: WaterfallStep, studyId: number): Promise<void> {
  switch (step) {
    case "seo": {
      const { enrichAndSaveStudy } = await import("./study-seo-enrichment");
      await enrichAndSaveStudy(studyId);
      break;
    }

    case "summaries": {
      // Generate TLDR, plain summary, key finding, and practical takeaway
      // These must run BEFORE blogs/images so those steps can use plain language
      const [studyForSummary] = await db
        .select({
          id: studies.id,
          tldr: studies.tldr,
          plainSummary: studies.plainSummary,
          keyFinding: studies.keyFinding,
        })
        .from(studies)
        .where(eq(studies.id, studyId))
        .limit(1);

      if (!studyForSummary) break;

      // Skip if already has all summary fields
      if (studyForSummary.tldr && studyForSummary.plainSummary && studyForSummary.keyFinding) break;

      try {
        // Enrich THIS study by id. The batch enrichStudySummaries() selects an
        // unbounded `LIMIT 1` candidate with no id filter, so it enriches an
        // arbitrary row — leaving the target study unenriched while the worker
        // marks its 'summaries' step complete.
        await enrichSummaryForStudyId(studyId);

        // Also generate TLDR if missing (summary enrichment doesn't cover TLDR)
        if (!studyForSummary.tldr) {
          const [fullStudy] = await db
            .select({ title: studies.title, abstract: studies.abstract, conclusion: studies.conclusion })
            .from(studies)
            .where(eq(studies.id, studyId))
            .limit(1);

          if (fullStudy?.abstract) {
            const { generateStudyTldr } = await import("./tldr-generator");

            // This copy of the TLDR prompt never included the persona prefix.
            const tldr = await generateStudyTldr(fullStudy, {
              includePersona: false,
              caller: "ContentWorker.tldr",
            });
            if (tldr) {
              await db.update(studies).set({ tldr }).where(eq(studies.id, studyId));
            }
          }
        }
      } catch (summaryError: any) {
        // Non-fatal for individual field failures, but log it
        logger.warn(`Summary generation issue for study ${studyId}: ${summaryError.message}`, "ContentWorker");
      }
      break;
    }

    case "tags": {
      // Generate consumer-friendly tags using Haiku
      const [study] = await db
        .select({
          id: studies.id,
          title: studies.title,
          abstract: studies.abstract,
          category: studies.category,
          tags: studies.tags,
        })
        .from(studies)
        .where(eq(studies.id, studyId))
        .limit(1);

      if (!study || !study.abstract) break;

      // Skip if already has tags
      if (study.tags && study.tags.length > 0) break;

      try {
        const { ai, MODELS } = await import("./ai-provider");

        // Use generateJSON (not generateText): Haiku frequently wraps arrays in
        // ```json fences, which made the previous JSON.parse(text) throw, get
        // swallowed as "nice-to-have", and leave the study permanently untagged
        // while the step was marked complete. generateJSON strips fences.
        const tags = await ai.generateJSON<string[]>(
          "",
          `Generate 5-8 consumer-friendly tags for this hydrogen study. Tags should be simple, lowercase phrases that a health-conscious consumer would search for. Focus on conditions, benefits, and delivery methods.

Title: ${study.title}
Abstract: ${study.abstract}
Category: ${study.category || "General"}

Return ONLY a JSON array of strings, nothing else. Example: ["gut health", "inflammation", "hydrogen water", "antioxidant"]`,
          { model: MODELS.HAIKU, maxTokens: 300, temperature: null, caller: "ContentWorker.tags" },
        );
        if (Array.isArray(tags) && tags.length > 0) {
          await db.update(studies).set({ tags }).where(eq(studies.id, studyId));
        }
      } catch (tagError: any) {
        // Non-fatal: tags are nice-to-have
        logger.warn(`Tag generation failed for study ${studyId}: ${tagError.message}`, "ContentWorker");
      }
      break;
    }

    case "blogs": {
      const { generateBlogArticlesForStudy } = await import("./blog-generator-enhanced");
      const { studyService } = await import("./study-service");

      const study = await studyService.getStudyById(studyId);
      if (!study) {
        logger.warn(`Study ${studyId} not found for blog generation`, "ContentWorker");
        break;
      }

      // generateBlogArticlesForStudy already inserts into DB and generates images per blog
      const result = await generateBlogArticlesForStudy(study, { count: 3, fallbackToBasic: true });

      if (result.errors.length > 0) {
        logger.warn(`Blog generation had ${result.errors.length} errors for study ${studyId}`, "ContentWorker", {
          errors: result.errors,
        });
      }

      if (result.articles.length > 0) {
        logger.info(`Generated ${result.articles.length} blog articles for study ${studyId}`, "ContentWorker");
      }
      break;
    }

    case "image": {
      const { generateImageForStudy } = await import("./image-generator");
      const result = await generateImageForStudy(studyId);
      if (!result.success) {
        // Surface the failure so the waterfall's retry logic kicks in
        // (previously this return value was ignored — every failed image
        // generation was silently marked as a completed step, which is
        // why studies ended up with zero images despite "complete" status).
        throw new Error(result.message || "Image generation failed");
      }
      break;
    }

    case "links": {
      const { generateStudyLinks, saveLinks } = await import("./internal-linking-engine");
      const links = await generateStudyLinks(studyId);
      await saveLinks(links);
      break;
    }
  }
}
