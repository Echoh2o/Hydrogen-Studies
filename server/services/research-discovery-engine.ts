/**
 * Research Discovery Engine
 *
 * Autonomously discovers new hydrogen research papers from CrossRef and Europe PMC.
 * Deduplicates by DOI (exact) and title similarity (normalized Levenshtein >90%).
 * Queues new discoveries for AI processing via the pipeline_queue table.
 */

import { db } from "../db";
import {
  studies,
  pipelineQueue,
  discoveryRuns,
} from "@shared/schema";
import { eq, sql, or, ilike } from "drizzle-orm";
import { searchCrossRef } from "./crossref-api";
import { searchEuropePMC } from "./europepmc-api";
import { logger } from "../utils/logger";

// Rotating query set — covers the breadth of hydrogen research
const DISCOVERY_QUERIES = [
  "molecular hydrogen therapy",
  "hydrogen-rich water health",
  "H2 antioxidant clinical trial",
  "hydrogen gas inhalation treatment",
  "hydrogen water oxidative stress",
  "molecular hydrogen inflammation",
  "hydrogen therapy neuroprotection",
  "dissolved hydrogen biomedical",
  "hydrogen-rich saline therapeutic",
  "H2 gas medicine",
  "electrolyzed reduced water health",
  "hydrogen water exercise recovery",
  "molecular hydrogen cancer",
  "hydrogen inhalation ischemia reperfusion",
  "hydrogen water gut microbiome",
  "molecular hydrogen diabetes",
  "hydrogen therapy kidney",
  "hydrogen water cognitive function",
  "molecular hydrogen skin",
  "hydrogen therapy cardiovascular",
];

const MAX_QUERIES_PER_RUN = 5;
const RATE_LIMIT_DELAY_MS = 1500;
const MAX_RESULTS_PER_QUERY = 20;

// Track which query index to start from (rotates across runs)
let queryRotationIndex = 0;

/**
 * Normalized Levenshtein similarity (0-1 scale)
 */
function titleSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const s2 = b.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  if (s1 === s2) return 1;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;

  // Quick length-based early rejection
  if (Math.abs(s1.length - s2.length) / maxLen > 0.3) return 0;

  // Compute Levenshtein distance
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = s1[i - 1] === s2[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return 1 - dp[m][n] / maxLen;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface DiscoveryResult {
  doi?: string;
  title: string;
  authors?: string;
  journal?: string;
  publishDate?: string;
  abstract?: string;
  sourceUrl?: string;
  sourcePlatform: string;
}

/**
 * Check if a study already exists in our database or queue
 */
async function isDuplicate(item: DiscoveryResult): Promise<boolean> {
  // 1. Exact DOI match in studies table
  if (item.doi) {
    const existingStudy = await db.query.studies.findFirst({
      where: eq(studies.doi, item.doi),
      columns: { id: true },
    });
    if (existingStudy) return true;

    // Check pipeline queue too
    const existingQueue = await db.query.pipelineQueue.findFirst({
      where: eq(pipelineQueue.doi, item.doi),
      columns: { id: true },
    });
    if (existingQueue) return true;
  }

  // 2. Title similarity check against studies table
  // Get candidates with ILIKE for rough match first (performance optimization)
  const firstWords = item.title.split(/\s+/).slice(0, 4).join(" ");
  const candidates = await db
    .select({ id: studies.id, title: studies.title })
    .from(studies)
    .where(ilike(studies.title, `%${firstWords.replace(/[%_]/g, "")}%`))
    .limit(20);

  for (const candidate of candidates) {
    if (titleSimilarity(item.title, candidate.title) > 0.9) {
      return true;
    }
  }

  // 3. Title similarity check against pipeline queue
  const queueCandidates = await db
    .select({ id: pipelineQueue.id, title: pipelineQueue.title })
    .from(pipelineQueue)
    .where(ilike(pipelineQueue.title, `%${firstWords.replace(/[%_]/g, "")}%`))
    .limit(20);

  for (const candidate of queueCandidates) {
    if (titleSimilarity(item.title, candidate.title) > 0.9) {
      return true;
    }
  }

  return false;
}

/**
 * Search CrossRef and extract relevant results
 */
async function searchCrossRefForHydrogen(query: string): Promise<DiscoveryResult[]> {
  try {
    const data = await searchCrossRef(query, 1, MAX_RESULTS_PER_QUERY);
    const items = data?.message?.items || [];

    return items
      .filter((item: any) => item.title?.[0])
      .map((item: any) => ({
        doi: item.DOI,
        title: item.title[0],
        authors: item.author
          ?.map((a: any) => `${a.given || ""} ${a.family || ""}`.trim())
          .filter(Boolean)
          .join(", ") || undefined,
        journal: item["container-title"]?.[0] || undefined,
        publishDate: item.created?.["date-parts"]?.[0]
          ? item.created["date-parts"][0].join("-")
          : undefined,
        abstract: item.abstract?.replace(/<[^>]+>/g, "") || undefined,
        sourceUrl: item.DOI ? `https://doi.org/${item.DOI}` : item.URL,
        sourcePlatform: "crossref" as const,
      }));
  } catch (error) {
    logger.error(`CrossRef search failed for "${query}"`, error, "DiscoveryEngine");
    return [];
  }
}

/**
 * Search Europe PMC and extract relevant results
 */
async function searchEPMCForHydrogen(query: string): Promise<DiscoveryResult[]> {
  try {
    const data = await searchEuropePMC(query, 1, MAX_RESULTS_PER_QUERY);
    return data.results.map((item: any) => ({
      doi: item.doi || undefined,
      title: item.title,
      authors: item.authors || undefined,
      journal: item.journal || undefined,
      publishDate: item.publicationDate || item.year?.toString() || undefined,
      abstract: item.abstract || undefined,
      sourceUrl: item.url || (item.doi ? `https://doi.org/${item.doi}` : undefined),
      sourcePlatform: "europepmc" as const,
    }));
  } catch (error) {
    logger.error(`Europe PMC search failed for "${query}"`, error, "DiscoveryEngine");
    return [];
  }
}

/**
 * Run an autonomous discovery cycle.
 * Searches both APIs with rotating queries, deduplicates, and queues new studies.
 */
export async function runDiscovery(): Promise<{
  runId: number;
  found: number;
  new: number;
  duplicates: number;
  queued: number;
}> {
  const startTime = Date.now();

  // Create a discovery run record
  const [run] = await db
    .insert(discoveryRuns)
    .values({
      source: "both",
      queries: "[]",
      status: "running",
    })
    .returning();

  const queriesUsed: string[] = [];
  let totalFound = 0;
  let totalNew = 0;
  let totalDuplicates = 0;
  let totalQueued = 0;

  try {
    // Pick next N queries from the rotation
    for (let i = 0; i < MAX_QUERIES_PER_RUN; i++) {
      const queryIdx = (queryRotationIndex + i) % DISCOVERY_QUERIES.length;
      const query = DISCOVERY_QUERIES[queryIdx];
      queriesUsed.push(query);

      // Search both APIs
      const [crossRefResults, epmcResults] = await Promise.all([
        searchCrossRefForHydrogen(query),
        searchEPMCForHydrogen(query),
      ]);

      // Merge results, preferring CrossRef entries (they have DOIs more consistently)
      const allResults = [...crossRefResults, ...epmcResults];
      totalFound += allResults.length;

      // Deduplicate within this batch
      const seenDois = new Set<string>();
      const seenTitles: string[] = [];
      const uniqueResults: DiscoveryResult[] = [];

      for (const result of allResults) {
        // Skip if no title
        if (!result.title || result.title.length < 10) continue;

        // DOI dedup within batch
        if (result.doi && seenDois.has(result.doi)) continue;
        if (result.doi) seenDois.add(result.doi);

        // Title dedup within batch
        const isDupInBatch = seenTitles.some(
          (t) => titleSimilarity(t, result.title) > 0.9
        );
        if (isDupInBatch) continue;
        seenTitles.push(result.title);

        uniqueResults.push(result);
      }

      // Check against database
      for (const result of uniqueResults) {
        const dup = await isDuplicate(result);
        if (dup) {
          totalDuplicates++;
          continue;
        }

        totalNew++;

        // Queue for processing
        await db.insert(pipelineQueue).values({
          doi: result.doi || null,
          title: result.title,
          authors: result.authors || null,
          journal: result.journal || null,
          publishDate: result.publishDate || null,
          abstract: result.abstract || null,
          sourceUrl: result.sourceUrl || null,
          sourcePlatform: result.sourcePlatform,
          status: "pending",
          currentStep: 0,
          stepResults: "{}",
          discoveryRunId: run.id,
        });
        totalQueued++;
      }

      // Rate limiting between queries
      if (i < MAX_QUERIES_PER_RUN - 1) {
        await delay(RATE_LIMIT_DELAY_MS);
      }
    }

    // Advance rotation for next run
    queryRotationIndex = (queryRotationIndex + MAX_QUERIES_PER_RUN) % DISCOVERY_QUERIES.length;

    const durationMs = Date.now() - startTime;

    // Update discovery run record
    await db
      .update(discoveryRuns)
      .set({
        queries: JSON.stringify(queriesUsed),
        foundCount: totalFound,
        newCount: totalNew,
        duplicateCount: totalDuplicates,
        queuedCount: totalQueued,
        durationMs,
        status: "completed",
      })
      .where(eq(discoveryRuns.id, run.id));

    logger.info("Discovery run completed", "DiscoveryEngine", {
      runId: run.id,
      queries: queriesUsed.length,
      found: totalFound,
      new: totalNew,
      duplicates: totalDuplicates,
      queued: totalQueued,
      durationMs,
    });

    return { runId: run.id, found: totalFound, new: totalNew, duplicates: totalDuplicates, queued: totalQueued };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    await db
      .update(discoveryRuns)
      .set({
        queries: JSON.stringify(queriesUsed),
        foundCount: totalFound,
        newCount: totalNew,
        duplicateCount: totalDuplicates,
        queuedCount: totalQueued,
        durationMs,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      .where(eq(discoveryRuns.id, run.id));

    logger.error("Discovery run failed", error, "DiscoveryEngine");
    throw error;
  }
}
