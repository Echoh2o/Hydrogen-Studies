/**
 * Citation Network Builder
 *
 * Fetches real citation data from CrossRef and Europe PMC APIs.
 * Stores citation relationships in the study_citations table.
 * Provides graph data (nodes + edges) for frontend visualization.
 */

import { db } from "../db";
import { studies, studyCitations } from "@shared/schema";
import type { StudyCitation } from "@shared/schema";
import { eq, sql, and, isNotNull, desc } from "drizzle-orm";
import axios from "axios";
import { logger } from "../utils/logger";

const CROSSREF_USER_AGENT =
  "HydrogenStudies.com Research Database/1.0 (https://hydrogenstudies.com; mailto:info@hydrogenstudies.com)";

const BATCH_SIZE = 30;
const RATE_LIMIT_DELAY_MS = 1500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch references (outgoing citations) from CrossRef for a given DOI
 */
async function fetchCrossRefReferences(doi: string): Promise<{
  references: { doi?: string; title?: string }[];
  citedByCount: number;
}> {
  try {
    const response = await axios.get(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      {
        headers: { "User-Agent": CROSSREF_USER_AGENT },
        timeout: 10000,
      },
    );

    const work = response.data?.message;
    if (!work) return { references: [], citedByCount: 0 };

    const references = (work.reference || [])
      .filter((ref: any) => ref.DOI || ref["article-title"])
      .map((ref: any) => ({
        doi: ref.DOI || undefined,
        title: ref["article-title"] || ref["unstructured"] || undefined,
      }));

    return {
      references,
      citedByCount: work["is-referenced-by-count"] || 0,
    };
  } catch (error) {
    // 404 means DOI not found — not an error
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return { references: [], citedByCount: 0 };
    }
    logger.error(`CrossRef citation fetch failed for ${doi}`, error, "CitationBuilder");
    return { references: [], citedByCount: 0 };
  }
}

/**
 * Fetch citing articles from Europe PMC (articles that cite this DOI)
 */
async function fetchEPMCCitations(doi: string): Promise<{ doi?: string; title?: string }[]> {
  try {
    const response = await axios.get(
      "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
      {
        params: {
          query: `CITES:"${doi}"`,
          resultType: "core",
          format: "json",
          pageSize: 50,
        },
        timeout: 10000,
      },
    );

    const results = response.data?.resultList?.result || [];
    return results.map((r: any) => ({
      doi: r.doi || undefined,
      title: r.title || undefined,
    }));
  } catch (error) {
    logger.error(`Europe PMC citation fetch failed for ${doi}`, error, "CitationBuilder");
    return [];
  }
}

/**
 * Find an internal study by DOI
 */
async function findStudyByDoi(doi: string): Promise<number | null> {
  const result = await db.query.studies.findFirst({
    where: eq(studies.doi, doi),
    columns: { id: true },
  });
  return result?.id || null;
}

/**
 * Check if a citation already exists
 */
async function citationExists(
  fromStudyId: number,
  toDoi: string | null,
  toStudyId: number | null,
  direction: string,
): Promise<boolean> {
  const conditions = [
    eq(studyCitations.fromStudyId, fromStudyId),
    eq(studyCitations.direction, direction),
  ];

  if (toStudyId) {
    conditions.push(eq(studyCitations.toStudyId, toStudyId));
  } else if (toDoi) {
    conditions.push(eq(studyCitations.toDoi, toDoi));
  } else {
    return true; // No identifier — skip
  }

  const existing = await db.query.studyCitations.findFirst({
    where: and(...conditions),
    columns: { id: true },
  });

  return !!existing;
}

/**
 * Build citation network for a single study
 */
async function buildCitationsForStudy(studyId: number, doi: string): Promise<{
  outgoing: number;
  incoming: number;
}> {
  let outgoing = 0;
  let incoming = 0;

  // 1. Get outgoing references from CrossRef
  const { references, citedByCount } = await fetchCrossRefReferences(doi);

  // Update citation count on the study
  if (citedByCount > 0) {
    await db
      .update(studies)
      .set({ citationCount: citedByCount })
      .where(eq(studies.id, studyId));
  }

  // Store outgoing citations (this study cites others)
  for (const ref of references.slice(0, 50)) {
    const toDoi = ref.doi || null;
    const toTitle = ref.title || null;
    if (!toDoi && !toTitle) continue;

    // Check if the cited paper is in our database
    const toStudyId = toDoi ? await findStudyByDoi(toDoi) : null;

    if (await citationExists(studyId, toDoi, toStudyId, "cites")) continue;

    await db.insert(studyCitations).values({
      fromStudyId: studyId,
      toStudyId: toStudyId || undefined,
      toDoi,
      toTitle,
      direction: "cites",
      source: "crossref",
    });
    outgoing++;
  }

  await delay(RATE_LIMIT_DELAY_MS);

  // 2. Get incoming citations from Europe PMC (papers that cite this study)
  const citingArticles = await fetchEPMCCitations(doi);

  for (const citing of citingArticles.slice(0, 50)) {
    const citingDoi = citing.doi || null;
    const citingTitle = citing.title || null;
    if (!citingDoi && !citingTitle) continue;

    // Check if the citing paper is in our database
    const citingStudyId = citingDoi ? await findStudyByDoi(citingDoi) : null;

    if (await citationExists(studyId, citingDoi, citingStudyId, "cited_by")) continue;

    await db.insert(studyCitations).values({
      fromStudyId: studyId,
      toStudyId: citingStudyId || undefined,
      toDoi: citingDoi,
      toTitle: citingTitle,
      direction: "cited_by",
      source: "europepmc",
    });
    incoming++;
  }

  return { outgoing, incoming };
}

/**
 * Build citation network for a batch of studies.
 * Called weekly by the job scheduler.
 */
export async function buildCitationNetwork(): Promise<{
  studiesProcessed: number;
  totalOutgoing: number;
  totalIncoming: number;
}> {
  // Get studies with DOIs that haven't been processed recently
  // We check which studies already have citations to avoid re-processing
  const studiesWithDois = await db
    .select({ id: studies.id, doi: studies.doi })
    .from(studies)
    .where(
      and(
        isNotNull(studies.doi),
        sql`${studies.doi} != ''`,
        sql`${studies.id} NOT IN (
          SELECT DISTINCT from_study_id FROM study_citations
        )`,
      ),
    )
    .orderBy(desc(studies.id))
    .limit(BATCH_SIZE);

  if (studiesWithDois.length === 0) {
    logger.info("No new studies to process for citations", "CitationBuilder");
    return { studiesProcessed: 0, totalOutgoing: 0, totalIncoming: 0 };
  }

  logger.info(`Building citations for ${studiesWithDois.length} studies`, "CitationBuilder");

  let totalOutgoing = 0;
  let totalIncoming = 0;

  for (const study of studiesWithDois) {
    if (!study.doi) continue;

    const { outgoing, incoming } = await buildCitationsForStudy(study.id, study.doi);
    totalOutgoing += outgoing;
    totalIncoming += incoming;

    await delay(RATE_LIMIT_DELAY_MS);
  }

  logger.info("Citation network build complete", "CitationBuilder", {
    studiesProcessed: studiesWithDois.length,
    totalOutgoing,
    totalIncoming,
  });

  return {
    studiesProcessed: studiesWithDois.length,
    totalOutgoing,
    totalIncoming,
  };
}

/**
 * Get citation graph data for a single study (for frontend visualization)
 */
export async function getCitationGraph(studyId: number): Promise<{
  nodes: { id: number | string; label: string; isInternal: boolean }[];
  edges: { from: number | string; to: number | string; direction: string }[];
  stats: { outgoing: number; incoming: number; internalLinks: number };
}> {
  // Get the study
  const study = await db.query.studies.findFirst({
    where: eq(studies.id, studyId),
    columns: { id: true, title: true, plainLanguageTitle: true },
  });

  if (!study) {
    return { nodes: [], edges: [], stats: { outgoing: 0, incoming: 0, internalLinks: 0 } };
  }

  // Get all citations involving this study
  const citations = await db
    .select()
    .from(studyCitations)
    .where(eq(studyCitations.fromStudyId, studyId));

  const nodes: { id: number | string; label: string; isInternal: boolean }[] = [
    { id: study.id, label: study.plainLanguageTitle || study.title || "Unknown", isInternal: true },
  ];

  const edges: { from: number | string; to: number | string; direction: string }[] = [];
  const seenNodes = new Set<string>([String(study.id)]);
  let internalLinks = 0;
  let outgoing = 0;
  let incoming = 0;

  for (const citation of citations) {
    const nodeId = citation.toStudyId || citation.toDoi || `ext-${citation.id}`;
    const nodeKey = String(nodeId);

    if (!seenNodes.has(nodeKey)) {
      seenNodes.add(nodeKey);

      if (citation.toStudyId) {
        // Internal study — fetch title
        const linkedStudy = await db.query.studies.findFirst({
          where: eq(studies.id, citation.toStudyId),
          columns: { title: true, plainLanguageTitle: true },
        });
        nodes.push({
          id: nodeId,
          label: linkedStudy?.plainLanguageTitle || linkedStudy?.title || "Unknown",
          isInternal: true,
        });
        internalLinks++;
      } else {
        nodes.push({
          id: nodeId,
          label: citation.toTitle || citation.toDoi || "External Reference",
          isInternal: false,
        });
      }
    }

    if (citation.direction === "cites") {
      edges.push({ from: study.id, to: nodeId, direction: "cites" });
      outgoing++;
    } else {
      edges.push({ from: nodeId, to: study.id, direction: "cited_by" });
      incoming++;
    }
  }

  return {
    nodes,
    edges,
    stats: { outgoing, incoming, internalLinks },
  };
}
