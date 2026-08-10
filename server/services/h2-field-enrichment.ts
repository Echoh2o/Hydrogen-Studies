/**
 * H2-Specific Field Enrichment Service
 *
 * Uses Claude AI to extract hydrogen-specific metadata from study abstracts.
 * Populates fields: h2_delivery_method, h2_concentration, dosage_protocol,
 * methodology_summary, limitations, is_human_trial.
 */

import { db } from "../db";
import { studies } from "@shared/schema";
import { sql, eq } from "drizzle-orm";
import { ai } from "./ai-provider";

export interface H2EnrichmentStats {
  totalProcessed: number;
  enriched: number;
  errors: number;
  startTime: Date;
  isRunning: boolean;
}

let h2Stats: H2EnrichmentStats = {
  totalProcessed: 0,
  enriched: 0,
  errors: 0,
  startTime: new Date(),
  isRunning: false,
};

interface H2ExtractionResult {
  h2_delivery_method:
    | "drinking"
    | "inhalation"
    | "bathing"
    | "injection"
    | "topical"
    | "saline"
    | "mixed"
    | null;
  h2_concentration: string | null;
  dosage_protocol: string | null;
  methodology_summary: string | null;
  limitations: string | null;
  is_human_trial: boolean;
}

const SYSTEM_PROMPT = `You are a scientific research analyst specializing in molecular hydrogen (H2) studies.
Extract the following fields from the study. Be precise and factual — only include information explicitly stated or clearly implied in the text.

Return JSON with these fields:
{
  "h2_delivery_method": "drinking" | "inhalation" | "bathing" | "injection" | "topical" | "saline" | "mixed" | null,
  "h2_concentration": string or null (e.g., "1.6 ppm", "0.8 mM", "4% H2 gas", "1.2-1.6 mg/L"),
  "dosage_protocol": string or null (e.g., "500ml H2-rich water daily for 8 weeks"),
  "methodology_summary": string or null (1-2 sentence summary of methods used),
  "limitations": string or null (key limitations mentioned or inferable),
  "is_human_trial": boolean (true if participants are humans, false for animal/in-vitro/review)
}`;

/**
 * Get current H2 enrichment stats
 */
export function getH2EnrichmentStats(): H2EnrichmentStats {
  return { ...h2Stats };
}

/**
 * Main enrichment function: finds studies missing H2-specific fields
 * and uses Claude to extract structured metadata from their abstracts.
 */
export async function enrichH2Fields(
  batchSize: number = 20,
): Promise<H2EnrichmentStats> {
  if (h2Stats.isRunning) {
    console.log("H2 enrichment is already running, skipping this cycle.");
    return h2Stats;
  }

  h2Stats = {
    totalProcessed: 0,
    enriched: 0,
    errors: 0,
    startTime: new Date(),
    isRunning: true,
  };

  try {
    // Find studies missing H2-specific fields
    const candidates = await db
      .select({
        id: studies.id,
        title: studies.title,
        abstract: studies.abstract,
        studyType: studies.studyType,
        methods: studies.methods,
        methodsShort: studies.methodsShort,
      })
      .from(studies)
      .where(
        sql`${studies.h2DeliveryMethod} IS NULL AND ${studies.h2ExtractionAttemptedAt} IS NULL AND ${studies.abstract} IS NOT NULL AND ${studies.abstract} != ''`,
      )
      .limit(batchSize);

    if (candidates.length === 0) {
      console.log("H2 enrichment: no studies need enrichment.");
      h2Stats.isRunning = false;
      return h2Stats;
    }

    console.log(
      `H2 enrichment: found ${candidates.length} studies to process.`,
    );

    for (const study of candidates) {
      try {
        await enrichSingleStudy(study);
        h2Stats.totalProcessed++;
        h2Stats.enriched++;
        console.log(
          `H2 enriched study ${study.id}: ${study.title ? study.title.substring(0, 60) : "Untitled"}...`,
        );
      } catch (error) {
        h2Stats.totalProcessed++;
        h2Stats.errors++;
        console.error(`H2 enrichment error for study ${study.id}:`, error);
      }

      // Rate limit: 2-second delay between studies
      if (candidates.indexOf(study) < candidates.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.log(
      `H2 enrichment complete: ${h2Stats.enriched} enriched, ${h2Stats.errors} errors out of ${h2Stats.totalProcessed} processed.`,
    );
  } catch (error) {
    console.error("H2 enrichment process failed:", error);
  } finally {
    h2Stats.isRunning = false;
  }

  return h2Stats;
}

/**
 * Enrich a single study with H2-specific fields using AI extraction
 */
async function enrichSingleStudy(study: {
  id: number;
  title: string | null;
  abstract: string | null;
  studyType: string | null;
  methods: string | null;
  methodsShort: string | null;
}): Promise<void> {
  const userPrompt = `Title: ${study.title || "Not available"}
Abstract: ${study.abstract || "Not available"}
Study Type: ${study.studyType || "Not available"}
Methods: ${study.methods || study.methodsShort || "Not available"}`;

  const result = await ai.generateJSON<H2ExtractionResult>(
    SYSTEM_PROMPT,
    userPrompt,
    { maxTokens: 1000, temperature: 0.3, model: "claude-haiku-4-5" },
  );

  // Build update object with only non-null fields
  const updates: Record<string, any> = {};

  if (result.h2_delivery_method !== undefined) {
    updates.h2DeliveryMethod = result.h2_delivery_method;
  }
  if (result.h2_concentration !== undefined) {
    updates.h2Concentration = result.h2_concentration;
  }
  if (result.dosage_protocol !== undefined) {
    updates.dosageProtocol = result.dosage_protocol;
  }
  if (result.methodology_summary !== undefined) {
    updates.methodologySummary = result.methodology_summary;
  }
  if (result.limitations !== undefined) {
    updates.limitations = result.limitations;
  }
  if (result.is_human_trial !== undefined) {
    updates.isHumanTrial = result.is_human_trial;
  }

  // Stamp the attempt time on every extraction (even when the result is null),
  // so permanently-null rows are excluded from future candidate queries and not reprocessed.
  updates.h2ExtractionAttemptedAt = new Date();

  await db.update(studies).set(updates).where(eq(studies.id, study.id));
}
