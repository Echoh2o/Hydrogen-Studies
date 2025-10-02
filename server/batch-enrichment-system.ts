/**
 * Comprehensive Batch Enrichment System
 * Enriches all studies with authentic research data from PubMed, Europe PMC, and CrossRef APIs
 */

import { db } from "./db";
import { studies } from "@shared/schema";
import { eq, sql, isNull } from "drizzle-orm";
import { enrichStudySimple } from "./simple-pubmed-enrichment";

interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  currentStudy: string;
  estimatedTimeRemaining: string;
  startTime: Date;
}

let currentBatchProgress: BatchProgress | null = null;
let isRunning = false;
let forceStop = false;

export async function startBatchEnrichment(): Promise<void> {
  if (isRunning) {
    throw new Error("Batch enrichment is already running");
  }

  console.log("Starting comprehensive batch enrichment of all studies...");
  isRunning = true;

  try {
    // Get all studies that need enrichment (have DOI but no author affiliations)
    const studiesToEnrichResult = await db.execute(sql`
      SELECT id, title, doi 
      FROM studies 
      WHERE doi IS NOT NULL 
      AND doi != '' 
      AND (author_affiliations IS NULL OR author_affiliations = '')
      ORDER BY id ASC
    `);

    const studiesToEnrich = studiesToEnrichResult.rows || [];
    const total = studiesToEnrich.length;
    console.log(
      `Found ${total} studies to enrich with authentic research data`,
    );

    if (total === 0) {
      console.log("All studies are already enriched with authentic data");
      isRunning = false;
      return;
    }

    currentBatchProgress = {
      total,
      completed: 0,
      failed: 0,
      currentStudy: "",
      estimatedTimeRemaining: "Calculating...",
      startTime: new Date(),
    };

    let completed = 0;
    let failed = 0;

    for (const study of studiesToEnrich) {
      try {
        currentBatchProgress.currentStudy = study.title as string;
        console.log(
          `Enriching study ${completed + 1}/${total}: ${study.title}`,
        );

        const success = await enrichStudySimple(study.id as number);

        if (success) {
          completed++;
          console.log(`✓ Successfully enriched study ${study.id}`);
        } else {
          failed++;
          console.log(`✗ Failed to enrich study ${study.id}`);
        }

        currentBatchProgress.completed = completed;
        currentBatchProgress.failed = failed;

        // Calculate estimated time remaining
        const elapsed = Date.now() - currentBatchProgress.startTime.getTime();
        const avgTimePerStudy = elapsed / (completed + failed);
        const remaining = total - (completed + failed);
        const estimatedMs = remaining * avgTimePerStudy;
        currentBatchProgress.estimatedTimeRemaining =
          formatDuration(estimatedMs);

        // Rate limiting - wait 2 seconds between requests to be respectful to APIs
        if (completed + failed < total) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        failed++;
        currentBatchProgress.failed = failed;
        console.error(`Error enriching study ${study.id}:`, error);
      }
    }

    console.log(`Batch enrichment completed:`);
    console.log(`- Total studies processed: ${total}`);
    console.log(`- Successfully enriched: ${completed}`);
    console.log(`- Failed: ${failed}`);
    console.log(`- Success rate: ${((completed / total) * 100).toFixed(1)}%`);
  } catch (error) {
    console.error("Error in batch enrichment:", error);
    throw error;
  } finally {
    isRunning = false;
    currentBatchProgress = null;
  }
}

export function getBatchProgress(): BatchProgress | null {
  return currentBatchProgress;
}

export function isBatchRunning(): boolean {
  return isRunning;
}

export async function stopBatchEnrichment(): Promise<void> {
  if (!isRunning) {
    throw new Error("No batch enrichment is currently running");
  }

  console.log("Stopping batch enrichment...");
  isRunning = false;
  currentBatchProgress = null;
}

function formatDuration(ms: number): string {
  if (ms < 60000) {
    return `${Math.round(ms / 1000)} seconds`;
  } else if (ms < 3600000) {
    return `${Math.round(ms / 60000)} minutes`;
  } else {
    return `${Math.round(ms / 3600000)} hours`;
  }
}

export async function enrichSpecificStudies(studyIds: number[]): Promise<void> {
  console.log(
    `Starting targeted enrichment for ${studyIds.length} specific studies`,
  );

  let completed = 0;
  let failed = 0;

  for (const studyId of studyIds) {
    try {
      console.log(
        `Enriching study ${completed + 1}/${studyIds.length}: ID ${studyId}`,
      );

      const success = await enrichStudySimple(studyId);

      if (success) {
        completed++;
        console.log(`✓ Successfully enriched study ${studyId}`);
      } else {
        failed++;
        console.log(`✗ Failed to enrich study ${studyId}`);
      }

      // Rate limiting
      if (completed + failed < studyIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      failed++;
      console.error(`Error enriching study ${studyId}:`, error);
    }
  }

  console.log(
    `Targeted enrichment completed: ${completed} successful, ${failed} failed`,
  );
}
