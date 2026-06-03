/**
 * Study Summary Enrichment Service
 *
 * Uses Claude AI to generate consumer-facing content from study abstracts.
 * Populates fields: plain_summary, key_finding, practical_takeaway.
 *
 * Follows the same pattern as h2-field-enrichment.ts, with fixes for:
 * - Permanently failing studies (marked via sentinel so they aren't retried)
 * - AI response validation (checks field names exist before using)
 * - Structured logging via logger utility
 */

import { db } from "../db";
import { studies } from "@shared/schema";
import { sql, eq } from "drizzle-orm";
import { ai } from "./ai-provider";
import { logger } from "../utils/logger";

const TAG = "SummaryEnrichment";

export interface SummaryEnrichmentStats {
  totalProcessed: number;
  enriched: number;
  skipped: number;
  errors: number;
  startTime: Date;
  isRunning: boolean;
}

let stats: SummaryEnrichmentStats = {
  totalProcessed: 0,
  enriched: 0,
  skipped: 0,
  errors: 0,
  startTime: new Date(),
  isRunning: false,
};

interface SummaryExtractionResult {
  plain_summary: string | null;
  key_finding: string | null;
  practical_takeaway: string | null;
}

// Sentinel value written to key_finding when a study is processed but AI
// returned nothing useful. Must be distinguishable from real content and
// must cause the IS NULL check in the candidate query to skip this row.
const PROCESSED_SENTINEL = "__no_content__";

const SYSTEM_PROMPT = `You are a science writer who translates academic hydrogen research into clear, accurate language for health-conscious consumers.

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

export function getSummaryEnrichmentStats(): SummaryEnrichmentStats {
  return { ...stats };
}

/**
 * Main enrichment function: finds studies missing summary fields
 * and uses Claude to generate consumer-facing content.
 */
export async function enrichStudySummaries(
  batchSize: number = 20,
): Promise<SummaryEnrichmentStats> {
  if (stats.isRunning) {
    logger.info("Already running, skipping this cycle", TAG);
    return stats;
  }

  stats = {
    totalProcessed: 0,
    enriched: 0,
    skipped: 0,
    errors: 0,
    startTime: new Date(),
    isRunning: true,
  };

  try {
    // Find studies that have an abstract but haven't been processed yet.
    // key_finding IS NULL means never touched; the sentinel value means
    // "processed but AI returned nothing" and will NOT match IS NULL.
    const candidates = await db
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
      })
      .from(studies)
      .where(
        sql`${studies.keyFinding} IS NULL
            AND ${studies.abstract} IS NOT NULL
            AND ${studies.abstract} != ''`,
      )
      .limit(batchSize);

    if (candidates.length === 0) {
      logger.info("No studies need enrichment", TAG);
      stats.isRunning = false;
      return stats;
    }

    logger.info("Starting batch", TAG, { candidates: candidates.length });

    for (let i = 0; i < candidates.length; i++) {
      const study = candidates[i];
      try {
        const enriched = await enrichSingleStudy(study);
        stats.totalProcessed++;
        if (enriched) {
          stats.enriched++;
          logger.info("Enriched study", TAG, {
            studyId: study.id,
            title: study.title?.substring(0, 60),
          });
        } else {
          stats.skipped++;
          logger.info("Skipped study (AI returned no content)", TAG, {
            studyId: study.id,
          });
        }
      } catch (error) {
        stats.totalProcessed++;
        stats.errors++;
        logger.error("Failed to enrich study", error, TAG, {
          studyId: study.id,
          title: study.title?.substring(0, 60),
        });

        // CRITICAL: Mark the study as processed even on error so it isn't
        // retried forever (e.g., if this study always triggers invalid JSON).
        try {
          await db
            .update(studies)
            .set({ keyFinding: PROCESSED_SENTINEL })
            .where(eq(studies.id, study.id));
        } catch (dbError) {
          logger.error("Failed to mark study as processed after error", dbError, TAG, {
            studyId: study.id,
          });
        }
      }

      // Rate limit: 2-second delay between studies
      if (i < candidates.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    logger.info("Batch complete", TAG, {
      enriched: stats.enriched,
      skipped: stats.skipped,
      errors: stats.errors,
      total: stats.totalProcessed,
    });
  } catch (error) {
    logger.error("Process failed", error, TAG);
  } finally {
    stats.isRunning = false;
  }

  return stats;
}

/**
 * Validate that the AI response has the expected shape.
 * Returns a normalized result with nulls for missing/invalid fields.
 */
function validateResponse(raw: any): SummaryExtractionResult {
  if (!raw || typeof raw !== "object") {
    return { plain_summary: null, key_finding: null, practical_takeaway: null };
  }
  return {
    plain_summary:
      typeof raw.plain_summary === "string" && raw.plain_summary.trim()
        ? raw.plain_summary.trim()
        : null,
    key_finding:
      typeof raw.key_finding === "string" && raw.key_finding.trim()
        ? raw.key_finding.trim()
        : null,
    practical_takeaway:
      typeof raw.practical_takeaway === "string" && raw.practical_takeaway.trim()
        ? raw.practical_takeaway.trim()
        : null,
  };
}

/**
 * Enrich a single study with consumer-facing summary fields.
 * Throws on AI failure — caller is responsible for marking as processed on error.
 */
async function enrichSingleStudy(study: {
  id: number;
  title: string | null;
  abstract: string | null;
  studyType: string | null;
  resultsShort: string | null;
  conclusionShort: string | null;
  conclusion: string | null;
  results: string | null;
  sampleSize: number | null;
  duration: number | null;
  isHumanTrial: boolean | null;
  h2DeliveryMethod: string | null;
}): Promise<boolean> {
  const userPrompt = `Title: ${study.title || "Not available"}
Abstract: ${study.abstract || "Not available"}
Study Type: ${study.studyType || "Not available"}
Results: ${study.resultsShort || study.results || "Not available"}
Conclusion: ${study.conclusionShort || study.conclusion || "Not available"}
Sample Size: ${study.sampleSize ?? "Not reported"}
Duration: ${study.duration ? `${study.duration} days` : "Not reported"}
Human Trial: ${study.isHumanTrial ? "Yes" : "No/Unknown"}
H2 Delivery: ${study.h2DeliveryMethod || "Not specified"}`;

  const rawResult = await ai.generateJSON<SummaryExtractionResult>(
    SYSTEM_PROMPT,
    userPrompt,
    { maxTokens: 1500, temperature: 0.4, model: "claude-haiku-4-5" },
  );

  const result = validateResponse(rawResult);

  const updates: Record<string, any> = {};
  let hasContent = false;

  if (result.plain_summary) {
    updates.plainSummary = result.plain_summary;
    hasContent = true;
  }
  if (result.key_finding) {
    updates.keyFinding = result.key_finding;
    hasContent = true;
  }
  if (result.practical_takeaway) {
    updates.practicalTakeaway = result.practical_takeaway;
    hasContent = true;
  }

  // Always mark as processed so this study is not re-queried.
  // If AI returned real content for key_finding, it's already set above.
  // Otherwise write a sentinel that is non-NULL (skips the IS NULL query)
  // but falsy in JS templates (won't render as display text).
  if (!updates.keyFinding) {
    updates.keyFinding = PROCESSED_SENTINEL;
  }

  await db.update(studies).set(updates).where(eq(studies.id, study.id));
  return hasContent;
}
