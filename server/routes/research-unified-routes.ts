import { Router, Request, Response } from "express";
import { searchPubMedWithPagination } from "./research-routes";
import { searchEuropePMC } from "../services/europepmc-api-fixed";
import { extractStudyFromEuropePMC } from "../services/europepmc-api";
import {
  searchSemanticScholar,
  extractStudyFromSemanticScholar,
} from "../services/semantic-scholar-api";
import { searchCrossRef, extractStudyFromCrossRef } from "../services/crossref-api";
import { studyService } from "../services/study-service";
import { reviewService } from "../services/review-service";
import { studyScoringService } from "../services/study-scoring-service";
import { detectDuplicate } from "../services/dedup-service";
import { db } from "../db";
import { studyReviewQueue } from "@shared/schema";
import { eq } from "drizzle-orm";
import { enrichStudyFromPubMed } from "../services/pubmed-enricher";
import { logger } from "../utils/logger";
import { requireAdmin } from "../auth";

/**
 * Build study data from PubMed search result (client-sent paper data).
 * enrichStudyFromPubMed enriches an EXISTING study by ID, so we need this
 * helper to create the initial study record from search result data.
 */
function buildStudyFromPubMedData(paperData: any) {
  if (!paperData) return null;
  return {
    title: paperData.title || "Untitled",
    abstract: paperData.abstract || paperData.abstractText || "",
    authors: paperData.authors || paperData.authorString || "Unknown",
    journal: paperData.journal || paperData.journalTitle || "Unknown",
    publishDate: paperData.publishDate || paperData.publicationDate || new Date().toISOString().split("T")[0],
    category: "hydrogen",
    doi: paperData.doi || null,
    url: paperData.url || (paperData.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${paperData.pmid}` : null),
    sourcePlatform: "pubmed",
  };
}

const router = Router();

/**
 * Unified search across multiple research databases
 *
 * This endpoint searches across PubMed, Europe PMC, Semantic Scholar, and CrossRef
 * based on the selected sources and returns consolidated results. It combines results
 * from different sources by matching DOIs and creates a unified listing.
 */
router.get("/api/research/search", async (req: Request, res: Response) => {
  try {
    const {
      query,
      page = "1",
      pageSize = "10",
      sources = "pubmed",
    } = req.query;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query parameter is required" });
    }

    const pageNum = parseInt(page as string) || 1;
    const pageSizeNum = parseInt(pageSize as string) || 10;
    const selectedSources =
      typeof sources === "string" ? sources.split(",") : ["pubmed"];

    logger.info("Unified search request", "ResearchUnifiedRoutes", { query, selectedSources });

    // Step 1: Check if any matching studies are already in our database to avoid duplicates
    // and to flag studies that are already imported
    let existingStudies: any[] = [];
    try {
      logger.info("Getting matching studies from database", "ResearchUnifiedRoutes");
      try {
        existingStudies = await studyService.getStudiesByTitlePartial(query, 50);
      } catch (storageError) {
        logger.warn("Storage method not available, skipping database check", "ResearchUnifiedRoutes", { error: String(storageError) });
        existingStudies = [];
      }
      logger.info("Found potentially matching studies in database", "ResearchUnifiedRoutes", { count: existingStudies.length });

      // Create lookup maps for faster matching
      const existingDOIMap = new Map();
      const existingPMIDMap = new Map();

      existingStudies.forEach((study) => {
        if (study.doi) existingDOIMap.set(study.doi.toLowerCase(), study.id);
        if (study.pmid) existingPMIDMap.set(study.pmid, study.id);
      });
    } catch (error) {
      logger.error("Error checking database for existing studies", error, "ResearchUnifiedRoutes");
    }

    // Step 2: Run searches against each requested source sequentially
    // This is more reliable than parallel searches and respects rate limits
    let allResults: any[] = [];
    let totalResultsCount = 0;
    let errors: string[] = [];

    // Process each source one by one
    for (const source of selectedSources) {
      try {
        logger.info("Processing source", "ResearchUnifiedRoutes", { source });

        switch (source.toLowerCase()) {
          case "pubmed":
            // Search PubMed with an increased limit to account for duplicates later
            logger.info("Searching PubMed", "ResearchUnifiedRoutes");
            const pubmedDataRaw = await searchPubMedWithPagination(
              query,
              pageNum - 1,
              pageSizeNum * 2,
            );
            const pubmedData = Array.isArray(pubmedDataRaw) ? pubmedDataRaw : [];
            const totalPubmedResults =
              pubmedData.length > 0
                ? pubmedData[0]?.totalResults || pubmedData.length
                : 0;

            const formattedPubmedData = pubmedData.map((item: any) => {
              // Check if this study is already in our database
              const isInDatabase = existingStudies.some(
                (study) =>
                  (study.doi &&
                    item.doi &&
                    study.doi.toLowerCase() === item.doi.toLowerCase()) ||
                  (study.pmid && item.pmid && study.pmid === item.pmid),
              );

              // Find the database ID if it exists
              const databaseId = isInDatabase
                ? existingStudies.find(
                    (study) =>
                      (study.doi &&
                        item.doi &&
                        study.doi.toLowerCase() === item.doi.toLowerCase()) ||
                      (study.pmid && item.pmid && study.pmid === item.pmid),
                  )?.id
                : undefined;

              return {
                ...item,
                source: "pubmed",
                inDatabase: isInDatabase,
                databaseId: databaseId,
              };
            });

            logger.info("Found results from PubMed", "ResearchUnifiedRoutes", { count: formattedPubmedData.length });
            allResults = [...allResults, ...formattedPubmedData];
            totalResultsCount += totalPubmedResults;
            break;

          case "europepmc":
            logger.info("Searching EuropePMC", "ResearchUnifiedRoutes");
            const europepmcResults = await searchEuropePMC(
              query,
              pageNum,
              pageSizeNum * 2,
            );
            if (
              europepmcResults &&
              europepmcResults.results &&
              europepmcResults.results.length > 0
            ) {
              logger.info("Found results from EuropePMC", "ResearchUnifiedRoutes", { count: europepmcResults.results.length, total: europepmcResults.total });

              const formattedEPMCData = (europepmcResults.results || []).map(
                (item: any) => {
                  // Check if this study is already in our database
                  const isInDatabase = existingStudies.some(
                    (study) =>
                      (study.doi &&
                        item.doi &&
                        study.doi.toLowerCase() === item.doi.toLowerCase()) ||
                      (study.pmid && item.pmid && study.pmid === item.pmid),
                  );

                  // Find the database ID if it exists
                  const databaseId = isInDatabase
                    ? existingStudies.find(
                        (study) =>
                          (study.doi &&
                            item.doi &&
                            study.doi.toLowerCase() ===
                              item.doi.toLowerCase()) ||
                          (study.pmid && item.pmid && study.pmid === item.pmid),
                      )?.id
                    : undefined;

                  return {
                    ...item,
                    source: "europepmc",
                    inDatabase: isInDatabase,
                    databaseId: databaseId,
                  };
                },
              );

              // Log a sample result for debugging
              if (formattedEPMCData.length > 0) {
                logger.debug("Sample EuropePMC result", "ResearchUnifiedRoutes", { sample: JSON.stringify(formattedEPMCData[0]).substring(0, 200) });
              }

              allResults = [...allResults, ...formattedEPMCData];
              totalResultsCount += europepmcResults.total || 0;
            } else {
              logger.info("No results from EuropePMC or unexpected format", "ResearchUnifiedRoutes");
            }
            break;

          case "semanticscholar":
            logger.info("Searching Semantic Scholar", "ResearchUnifiedRoutes");
            const semanticScholarResults = await searchSemanticScholar(
              query,
              pageNum - 1,
              pageSizeNum * 2,
            );
            if (
              semanticScholarResults &&
              semanticScholarResults.data &&
              semanticScholarResults.data.length > 0
            ) {
              logger.info("Found results from Semantic Scholar", "ResearchUnifiedRoutes", { count: semanticScholarResults.data.length });

              const formattedSSData = (semanticScholarResults.data || []).map(
                (item: any) => {
                  // Check if this study is already in our database
                  const isInDatabase = existingStudies.some(
                    (study) =>
                      study.doi &&
                      item.doi &&
                      study.doi.toLowerCase() === item.doi.toLowerCase(),
                  );

                  // Find the database ID if it exists
                  const databaseId = isInDatabase
                    ? existingStudies.find(
                        (study) =>
                          study.doi &&
                          item.doi &&
                          study.doi.toLowerCase() === item.doi.toLowerCase(),
                      )?.id
                    : undefined;

                  return {
                    ...item,
                    source: "semanticscholar",
                    inDatabase: isInDatabase,
                    databaseId: databaseId,
                  };
                },
              );

              allResults = [...allResults, ...formattedSSData];
              totalResultsCount += semanticScholarResults.total || 0;
            }
            break;

          case "crossref":
            logger.info("Searching CrossRef", "ResearchUnifiedRoutes");
            const crossrefResults = await searchCrossRef(
              query,
              pageNum,
              pageSizeNum * 2,
            );
            if (
              crossrefResults &&
              crossrefResults.items &&
              crossrefResults.items.length > 0
            ) {
              logger.info("Found results from CrossRef", "ResearchUnifiedRoutes", { count: crossrefResults.items.length });

              const formattedCRData = (crossrefResults.items || []).map((item: any) => {
                // Check if this study is already in our database
                const isInDatabase = existingStudies.some(
                  (study) =>
                    study.doi &&
                    item.DOI &&
                    study.doi.toLowerCase() === item.DOI.toLowerCase(),
                );

                // Find the database ID if it exists
                const databaseId = isInDatabase
                  ? existingStudies.find(
                      (study) =>
                        study.doi &&
                        item.DOI &&
                        study.doi.toLowerCase() === item.DOI.toLowerCase(),
                    )?.id
                  : undefined;

                return {
                  ...item,
                  source: "crossref",
                  inDatabase: isInDatabase,
                  databaseId: databaseId,
                };
              });

              allResults = [...allResults, ...formattedCRData];
              totalResultsCount += crossrefResults.totalResults || 0;
            }
            break;

          default:
            logger.warn("Unsupported source", "ResearchUnifiedRoutes", { source });
            errors.push(`Unsupported source: ${source}`);
        }
      } catch (error: unknown) {
        logger.error("Error searching source", error, "ResearchUnifiedRoutes", { source });
        errors.push(`${source}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    logger.info("Total results before deduplication", "ResearchUnifiedRoutes", { count: allResults.length });

    // Step 3: Combine and deduplicate results using DOIs and PMIDs
    // Create DOI and PMID maps to group identical studies
    const doiMap = new Map();
    const pmidMap = new Map();
    const titleMap = new Map(); // Fallback for items without DOI or PMID

    // First pass: collect items by their DOI/PMID
    allResults.forEach((item) => {
      // Handle DOI
      if (item.doi) {
        const doi = item.doi.toLowerCase().trim();
        if (doiMap.has(doi)) {
          doiMap.get(doi).push(item);
        } else {
          doiMap.set(doi, [item]);
        }
      }
      // Handle PMID (as a fallback if no DOI exists)
      else if (item.pmid) {
        const pmid = item.pmid.toString().trim();
        if (pmidMap.has(pmid)) {
          pmidMap.get(pmid).push(item);
        } else {
          pmidMap.set(pmid, [item]);
        }
      }
      // Handle items with neither DOI nor PMID by title
      else if (item.title) {
        const titleKey = item.title.toLowerCase().trim();
        if (titleMap.has(titleKey)) {
          titleMap.get(titleKey).push(item);
        } else {
          titleMap.set(titleKey, [item]);
        }
      }
    });

    // Second pass: process and merge items with the same DOI
    const unifiedResults: any[] = [];

    // Process DOI matches (highest priority)
    doiMap.forEach((items, doi) => {
      if (items.length === 1) {
        // Single item - no merging needed
        unifiedResults.push(items[0]);
      } else {
        // Multiple items with same DOI - merge them
        const mergedItem = items.reduce((merged: any, current: any) => {
          // Start with first item's properties
          const result = { ...merged };

          // Keep track of which sources were merged
          result.mergedSources = result.mergedSources || [];
          if (!result.mergedSources.includes(current.source)) {
            result.mergedSources.push(current.source);
          }

          // Mark as unified since it comes from multiple sources
          result.source = "unified";

          // Take the most complete abstract
          if (
            (!result.abstract || result.abstract.length < 50) &&
            current.abstract &&
            current.abstract.length > 50
          ) {
            result.abstract = current.abstract;
          }

          // Prioritize items already in the database
          if (current.inDatabase) {
            result.inDatabase = true;
            result.databaseId = current.databaseId;
          }

          // Fill in missing fields from current item
          Object.entries(current).forEach(([key, value]) => {
            if (!result[key] && value) {
              result[key] = value;
            }
          });

          return result;
        }, items[0]);

        unifiedResults.push(mergedItem);
      }
    });

    // Process PMID matches (only if not already added via DOI)
    pmidMap.forEach((items, pmid) => {
      // Skip if any item with this PMID has already been included via DOI
      const alreadyAdded = unifiedResults.some((item) => item.pmid === pmid);
      if (!alreadyAdded) {
        if (items.length === 1) {
          unifiedResults.push(items[0]);
        } else {
          // Merge items with same PMID
          const mergedItem = items.reduce((merged: any, current: any) => {
            const result = { ...merged };

            result.mergedSources = result.mergedSources || [];
            if (!result.mergedSources.includes(current.source)) {
              result.mergedSources.push(current.source);
            }

            result.source = "unified";

            if (
              (!result.abstract || result.abstract.length < 50) &&
              current.abstract &&
              current.abstract.length > 50
            ) {
              result.abstract = current.abstract;
            }

            if (current.inDatabase) {
              result.inDatabase = true;
              result.databaseId = current.databaseId;
            }

            Object.entries(current).forEach(([key, value]) => {
              if (!result[key] && value) {
                result[key] = value;
              }
            });

            return result;
          }, items[0]);

          unifiedResults.push(mergedItem);
        }
      }
    });

    // Process title matches as a last resort
    titleMap.forEach((items, title) => {
      // Skip if already added via DOI or PMID
      const alreadyAdded = unifiedResults.some(
        (item) => item.title && item.title.toLowerCase().trim() === title,
      );

      if (!alreadyAdded) {
        if (items.length === 1) {
          unifiedResults.push(items[0]);
        } else {
          // Merge items with the same title
          const mergedItem = items.reduce((merged: any, current: any) => {
            const result = { ...merged };

            result.mergedSources = result.mergedSources || [];
            if (!result.mergedSources.includes(current.source)) {
              result.mergedSources.push(current.source);
            }

            result.source = "unified";

            if (
              (!result.abstract || result.abstract.length < 50) &&
              current.abstract &&
              current.abstract.length > 50
            ) {
              result.abstract = current.abstract;
            }

            if (current.inDatabase) {
              result.inDatabase = true;
              result.databaseId = current.databaseId;
            }

            Object.entries(current).forEach(([key, value]) => {
              if (!result[key] && value) {
                result[key] = value;
              }
            });

            return result;
          }, items[0]);

          unifiedResults.push(mergedItem);
        }
      }
    });

    logger.info("After deduplication and unification", "ResearchUnifiedRoutes", { uniqueResults: unifiedResults.length });

    // Step 4: Sort and paginate the results
    // Sort by year (newest first) if available
    unifiedResults.sort((a, b) => {
      const yearA = a.year ? parseInt(a.year) : 0;
      const yearB = b.year ? parseInt(b.year) : 0;
      return yearB - yearA; // Newest first
    });

    // Get the paginated results
    const paginatedResults = unifiedResults.slice(0, pageSizeNum);

    // Step 5: Count source distribution after deduplication
    const sourceCounts = paginatedResults.reduce(
      (acc: { [key: string]: number }, item: any) => {
        const source = item.source || "unknown";
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      },
      {},
    );

    // Step 6: Set the correct source flag
    // Always use 'unified' as the source when multiple sources were requested
    const responseSource =
      selectedSources.length > 1 ? "unified" : selectedSources[0].toLowerCase();

    // Step 7: Prepare and send the response
    logger.info("Responding with search results", "ResearchUnifiedRoutes", { responseSource, articleCount: paginatedResults.length });

    const responseObj = {
      success: true,
      source: responseSource,
      query: query,
      total: unifiedResults.length,
      startIndex: (pageNum - 1) * pageSizeNum,
      nextIndex: Math.min(pageNum * pageSizeNum, unifiedResults.length),
      articles: paginatedResults,
      sourceCounts: sourceCounts,
      errors: errors.length > 0 ? errors : undefined,
    };

    res.json(responseObj);
  } catch (error: unknown) {
    logger.error("Error in unified research search", error, "ResearchUnifiedRoutes");
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : "Failed to search research databases" });
  }
});

/**
 * Add a paper to the review queue from any of the supported research databases
 * This implements the first tier of the two-tier review system
 */
router.post(
  "/api/research/review-queue",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { source, userId, ...paperData } = req.body;

      if (!source) {
        return res.status(400).json({ error: "Source is required" });
      }

      // Create an external ID based on source and paper ID
      let externalId = "";
      let doi = "";

      // Extract ID and DOI based on source
      if (source === "pubmed" && paperData.pmid) {
        externalId = `pubmed:${paperData.pmid}`;
        doi = paperData.doi || "";
      } else if (source === "europepmc" && paperData.id) {
        externalId = `europepmc:${paperData.id}`;
        doi = paperData.doi || "";
      } else if (source === "semanticscholar" && paperData.paperId) {
        externalId = `semanticscholar:${paperData.paperId}`;
        doi = paperData.doi || "";
      } else if (source === "crossref" && paperData.DOI) {
        externalId = `crossref:${paperData.DOI}`;
        doi = paperData.DOI || "";
      } else {
        return res
          .status(400)
          .json({ error: "Missing required identifier for this source" });
      }

      // Check for duplicate DOI in existing studies
      if (doi) {
        const duplicateCheck = await studyService.checkStudyExists(doi);
        if (duplicateCheck.exists) {
          return res.status(409).json({
            success: false,
            isDuplicate: true,
            message: "This study already exists in the database",
            studyId: duplicateCheck.studyId,
          });
        }
      }

      // Extract study data based on source
      let studyData;
      switch (source.toLowerCase()) {
        case "pubmed":
          studyData = buildStudyFromPubMedData(paperData);
          break;
        case "europepmc":
          studyData = extractStudyFromEuropePMC(paperData);
          break;
        case "semanticscholar":
          studyData = extractStudyFromSemanticScholar(paperData);
          break;
        case "crossref":
          studyData = extractStudyFromCrossRef(paperData);
          break;
        default:
          return res.status(400).json({ error: "Unsupported source" });
      }

      if (!studyData) {
        return res
          .status(404)
          .json({ error: "Failed to extract study data from paper" });
      }

      // Create review queue item
      const reviewItem = {
        externalId,
        doi,
        title: studyData.title,
        abstract: studyData.abstract,
        authors: studyData.authors,
        journal: studyData.journal,
        publishDate: studyData.publishDate,
        journalPublishDate: studyData.journalPublishDate || null,
        category: studyData.category,
        sourceUrl: studyData.sourceUrl || "",
        sourcePlatform: source.toLowerCase(),
        status: "pending",
        savedByUserId: userId || null,
        // Store additional data as JSON in reviewNotes for later use when approving
        reviewNotes: JSON.stringify({
          originalData: paperData,
          extractedStudy: studyData,
        }),
      };

      // Save to review queue
      const savedReviewItem = await reviewService.addToQueue(reviewItem);

      // Dedup check *before* scoring — matched duplicates skip the AI
      // entirely (saves cost) and get surfaced in the UI with a prominent
      // "Duplicate of" badge so the curator can reject in one click.
      const dupeResult = await detectDuplicate({
        doi: savedReviewItem.doi,
        title: savedReviewItem.title,
        excludeQueueId: savedReviewItem.id,
      }).catch((err) => {
        logger.error("Dedup check failed", err, "ResearchUnifiedRoutes");
        return { isDuplicate: false as const };
      });

      if (dupeResult.isDuplicate) {
        // Persist the match metadata inside reviewNotes (the column already
        // holds JSON; appending a `duplicateMatch` key keeps schema static).
        const existingNotes = (() => {
          try { return JSON.parse(savedReviewItem.reviewNotes || "{}"); }
          catch { return {}; }
        })();
        const updatedNotes = {
          ...existingNotes,
          duplicateMatch: {
            matchType: dupeResult.matchType,
            similarity: dupeResult.similarity,
            existingTitle: dupeResult.existingTitle,
            duplicateOfStudyId: dupeResult.duplicateOfStudyId ?? null,
            duplicateOfQueueId: dupeResult.duplicateOfQueueId ?? null,
          },
        };
        await db
          .update(studyReviewQueue)
          .set({
            isDuplicate: true,
            duplicateOfStudyId: dupeResult.duplicateOfStudyId ?? null,
            reviewNotes: JSON.stringify(updatedNotes),
          })
          .where(eq(studyReviewQueue.id, savedReviewItem.id));

        logger.info(
          "Queue item flagged as duplicate; skipping scoring",
          "ResearchUnifiedRoutes",
          {
            queueItemId: savedReviewItem.id,
            matchType: dupeResult.matchType,
            similarity: dupeResult.similarity,
          },
        );

        return res.json({
          success: true,
          message: "Added to queue — detected as duplicate (scoring skipped)",
          reviewItem: {
            ...savedReviewItem,
            isDuplicate: true,
            duplicateOfStudyId: dupeResult.duplicateOfStudyId ?? null,
            reviewNotes: JSON.stringify(updatedNotes),
          },
          duplicate: dupeResult,
        });
      }

      // Not a duplicate — proceed to score. Wrapped with a 15s cap so a
      // slow AI provider doesn't block the API response; nightly cron
      // backfills any items whose scoring timed out.
      let scoredItem = savedReviewItem;
      try {
        const scorePromise = studyScoringService.scoreQueueItem(savedReviewItem.id);
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000));
        const result = await Promise.race([scorePromise, timeout]);
        if (result) {
          scoredItem = { ...savedReviewItem, ...result, scoredAt: new Date() };
        } else {
          logger.warn(
            "Queue item scoring timed out; cron will backfill",
            "ResearchUnifiedRoutes",
            { queueItemId: savedReviewItem.id },
          );
        }
      } catch (err) {
        logger.error("Failed to score queue item on insert", err, "ResearchUnifiedRoutes");
      }

      res.json({
        success: true,
        message: "Study added to review queue successfully",
        reviewItem: scoredItem,
      });
    } catch (error: unknown) {
      logger.error("Error adding paper to review queue", error, "ResearchUnifiedRoutes");
      res
        .status(500)
        .json({
          error: error instanceof Error ? error.message : "Failed to add paper to review queue",
        });
    }
  },
);

/**
 * Get items from the study review queue
 */
router.get(
  "/api/research/review-queue",
  async (req: Request, res: Response) => {
    try {
      const { status, userId } = req.query;

      const filters: { status?: string; userId?: string } = {};
      if (status && typeof status === "string") {
        filters.status = status;
      }
      if (userId && typeof userId === "string") {
        filters.userId = userId;
      }

      const reviewItems = await reviewService.getQueue(filters);

      res.json({
        success: true,
        data: reviewItems,
      });
    } catch (error: unknown) {
      logger.error("Error fetching review queue", error, "ResearchUnifiedRoutes");
      res
        .status(500)
        .json({ error: error instanceof Error ? error.message : "Failed to fetch review queue" });
    }
  },
);

/**
 * Update the status of a study in the review queue (approve or reject)
 * This implements the second tier of the two-tier review system
 */
router.put(
  "/api/research/review-queue/:id",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, userId, notes } = req.body;

      if (!id || !status || !userId) {
        return res
          .status(400)
          .json({ error: "ID, status, and userId are required" });
      }

      if (status !== "approved" && status !== "rejected") {
        return res
          .status(400)
          .json({ error: 'Status must be either "approved" or "rejected"' });
      }

      // Get the review item
      const reviewItem = await reviewService.getQueueItemById(parseInt(id));
      if (!reviewItem) {
        return res.status(404).json({ error: "Review item not found" });
      }

      // Update the review status
      const updatedItem = await reviewService.updateStatus(
        parseInt(id),
        status,
        userId,
        notes,
      );

      // If approved, create the actual study
      if (status === "approved") {
        try {
          // Parse the stored study data from reviewNotes
          const storedData = JSON.parse(reviewItem.reviewNotes || "{}");
          const studyData = storedData.extractedStudy;

          if (!studyData) {
            return res
              .status(400)
              .json({ error: "No valid study data found in review item" });
          }

          // Save the study to the database
          const savedStudy = await studyService.createStudy(studyData);

          // Immediately score the promoted study. The published-study scorer
          // now has access to fields the queue item couldn't score (methods,
          // results, sample size if enriched), so the post-publish score is
          // typically more accurate than the pre-publish one. Non-blocking:
          // scoring failure here shouldn't fail the approval.
          if (savedStudy?.id) {
            studyScoringService.scoreStudy(savedStudy.id).catch((err) => {
              logger.error(
                "Failed to score approved study",
                err,
                "ResearchUnifiedRoutes",
              );
            });
          }

          res.json({
            success: true,
            message: "Study approved and imported successfully",
            reviewItem: updatedItem,
            study: savedStudy,
          });
        } catch (importError: unknown) {
          logger.error("Error importing approved study", importError, "ResearchUnifiedRoutes");
          res.status(500).json({
            error: importError instanceof Error ? importError.message : "Failed to import approved study",
            reviewItem: updatedItem, // Still return the updated review item
          });
        }
      } else {
        // If rejected, just return the updated review item
        res.json({
          success: true,
          message: "Study rejected successfully",
          reviewItem: updatedItem,
        });
      }
    } catch (error: unknown) {
      logger.error("Error updating review queue item", error, "ResearchUnifiedRoutes");
      res
        .status(500)
        .json({ error: error instanceof Error ? error.message : "Failed to update review queue item" });
    }
  },
);

/**
 * Delete an item from the review queue
 */
router.delete(
  "/api/research/review-queue/:id",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ error: "ID is required" });
      }

      await reviewService.deleteFromQueue(parseInt(id));

      res.json({
        success: true,
        message: "Study removed from review queue",
      });
    } catch (error: unknown) {
      logger.error("Error deleting review queue item", error, "ResearchUnifiedRoutes");
      res
        .status(500)
        .json({ error: error instanceof Error ? error.message : "Failed to delete review queue item" });
    }
  },
);

/**
 * Import a paper directly from any of the supported research databases (legacy method)
 */
router.post("/api/research/import", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { source, ...paperData } = req.body;

    if (!source) {
      return res.status(400).json({ error: "Source is required" });
    }

    // Check if study already exists
    let identifier = "";
    if (paperData.pmid) identifier = paperData.pmid;
    else if (paperData.doi) identifier = paperData.doi;
    else if (paperData.paperId) identifier = paperData.paperId;

    if (identifier) {
      const existingStudy = await studyService.getStudyByIdentifier(identifier);
      if (existingStudy) {
        return res.status(409).json({
          message: "This study already exists in the database",
          study: existingStudy,
        });
      }
    }

    // Extract study based on source
    let study;
    switch (source.toLowerCase()) {
      case "pubmed":
        study = buildStudyFromPubMedData(paperData);
        break;
      case "europepmc":
        study = extractStudyFromEuropePMC(paperData);
        break;
      case "semanticscholar":
        study = extractStudyFromSemanticScholar(paperData);
        break;
      case "crossref":
        study = extractStudyFromCrossRef(paperData);
        break;
      default:
        return res.status(400).json({ error: "Unsupported source" });
    }

    if (!study) {
      return res
        .status(404)
        .json({ error: "Failed to extract study data from paper" });
    }

    // Save study to database
    const savedStudy = await studyService.createStudy(study);

    // Trigger full lifecycle pipeline in background (non-blocking)
    // This chains: DOI enhancement → content enrichment → SEO → TLDR → image → blog → links
    if (savedStudy?.id) {
      import("../services/study-lifecycle").then(({ runStudyLifecyclePipeline }) => {
        runStudyLifecyclePipeline(savedStudy.id).catch(err =>
          logger.error("Study lifecycle pipeline failed", err, "ResearchUnifiedRoutes")
        );
      }).catch(err => logger.error("Failed to load lifecycle module", err, "ResearchUnifiedRoutes"));
    }

    res.json({
      success: true,
      message: "Study imported successfully",
      study: savedStudy,
    });
  } catch (error: unknown) {
    logger.error("Error importing paper", error, "ResearchUnifiedRoutes");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to import paper" });
  }
});

/**
 * Source-specific import endpoints
 * These wrap the generic /api/research/import with the correct source parameter
 */
router.post("/api/research/pubmed/import", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { pmid, title, abstract, authors, journal, publishDate, doi, url } = req.body;
    if (!pmid && !title) return res.status(400).json({ error: "pmid or title is required" });

    const identifier = doi || pmid || "";
    if (identifier) {
      const existing = await studyService.getStudyByIdentifier(identifier);
      if (existing) return res.status(409).json({ message: "Study already exists", study: existing });
    }

    // Build study from client-provided search result data
    const studyData = {
      title: title || "Untitled",
      abstract: abstract || "",
      authors: authors || "Unknown",
      journal: journal || "Unknown",
      publishDate: publishDate || new Date().toISOString().split("T")[0],
      category: "hydrogen",
      doi: doi || null,
      url: url || (pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}` : null),
      sourcePlatform: "pubmed",
    };

    const saved = await studyService.createStudy(studyData);

    // Trigger full lifecycle pipeline in background
    if (saved?.id) {
      import("../services/study-lifecycle").then(({ runStudyLifecyclePipeline }) => {
        runStudyLifecyclePipeline(saved.id).catch(err =>
          logger.error("Study lifecycle pipeline failed", err, "ResearchUnifiedRoutes")
        );
      }).catch(err => logger.error("Failed to load lifecycle module", err, "ResearchUnifiedRoutes"));
    }

    res.json({ success: true, message: "Study imported from PubMed", study: saved });
  } catch (error: unknown) {
    logger.error("PubMed import error", error, "ResearchUnifiedRoutes");
    res.status(500).json({ error: error instanceof Error ? error.message : "PubMed import failed" });
  }
});

router.post("/api/semantic-scholar/import", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { paperId, ...rest } = req.body;
    if (!paperId) return res.status(400).json({ error: "paperId is required" });

    const existing = await studyService.getStudyByIdentifier(paperId);
    if (existing) return res.status(409).json({ message: "Study already exists", study: existing });

    const study = extractStudyFromSemanticScholar({ paperId, ...rest });
    if (!study) return res.status(404).json({ error: "Failed to extract study from Semantic Scholar" });

    const saved = await studyService.createStudy(study);

    if (saved?.id) {
      import("../services/study-lifecycle").then(({ runStudyLifecyclePipeline }) => {
        runStudyLifecyclePipeline(saved.id).catch(err =>
          logger.error("Study lifecycle pipeline failed", err, "ResearchUnifiedRoutes")
        );
      }).catch(err => logger.error("Failed to load lifecycle module", err, "ResearchUnifiedRoutes"));
    }

    res.json({ success: true, message: "Study imported from Semantic Scholar", study: saved });
  } catch (error: unknown) {
    logger.error("Semantic Scholar import error", error, "ResearchUnifiedRoutes");
    res.status(500).json({ error: error instanceof Error ? error.message : "Semantic Scholar import failed" });
  }
});

router.post("/api/crossref/import", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { doi, ...rest } = req.body;
    if (!doi) return res.status(400).json({ error: "doi is required" });

    const existing = await studyService.getStudyByIdentifier(doi);
    if (existing) return res.status(409).json({ message: "Study already exists", study: existing });

    const study = extractStudyFromCrossRef({ doi, ...rest });
    if (!study) return res.status(404).json({ error: "Failed to extract study from CrossRef" });

    const saved = await studyService.createStudy(study);

    if (saved?.id) {
      import("../services/study-lifecycle").then(({ runStudyLifecyclePipeline }) => {
        runStudyLifecyclePipeline(saved.id).catch(err =>
          logger.error("Study lifecycle pipeline failed", err, "ResearchUnifiedRoutes")
        );
      }).catch(err => logger.error("Failed to load lifecycle module", err, "ResearchUnifiedRoutes"));
    }

    res.json({ success: true, message: "Study imported from CrossRef", study: saved });
  } catch (error: unknown) {
    logger.error("CrossRef import error", error, "ResearchUnifiedRoutes");
    res.status(500).json({ error: error instanceof Error ? error.message : "CrossRef import failed" });
  }
});

router.get("/api/europepmc/article/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const source = (req.query.source as string) || "MED";

    // Fetch full article details from Europe PMC
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:${encodeURIComponent(id)}%20AND%20SRC:${source}&format=json&resultType=core`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.resultList?.result?.[0]) {
      return res.status(404).json({ error: "Article not found" });
    }

    res.json(data.resultList.result[0]);
  } catch (error: unknown) {
    logger.error("Europe PMC article fetch error", error, "ResearchUnifiedRoutes");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch article" });
  }
});

router.post("/api/europepmc/save", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id, source, ...rest } = req.body;
    if (!id) return res.status(400).json({ error: "id is required" });

    // First fetch the article details
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:${encodeURIComponent(id)}%20AND%20SRC:${source || "MED"}&format=json&resultType=core`;
    const response = await fetch(url);
    const data = await response.json();

    const article = data.resultList?.result?.[0];
    if (!article) return res.status(404).json({ error: "Article not found in Europe PMC" });

    // Check for duplicate
    const identifier = article.doi || article.pmid || id;
    const existing = await studyService.getStudyByIdentifier(identifier);
    if (existing) return res.status(409).json({ message: "Study already exists", study: existing });

    const study = extractStudyFromEuropePMC(article);
    if (!study) return res.status(404).json({ error: "Failed to extract study" });

    const saved = await studyService.createStudy(study);
    res.json({ success: true, message: "Study imported from Europe PMC", study: saved });
  } catch (error: unknown) {
    logger.error("Europe PMC save error", error, "ResearchUnifiedRoutes");
    res.status(500).json({ error: error instanceof Error ? error.message : "Europe PMC save failed" });
  }
});

/**
 * PubMed specific search endpoint
 */
router.get(
  "/api/research/pubmed/search",
  async (req: Request, res: Response) => {
    try {
      const { query, page = "1", pageSize = "10" } = req.query;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Query parameter is required" });
      }

      const pageNum = parseInt(page as string) || 1;
      const pageSizeNum = parseInt(pageSize as string) || 10;

      logger.info("PubMed search", "ResearchUnifiedRoutes", { query, page: pageNum, pageSize: pageSizeNum });

      const results = await searchPubMedWithPagination(
        query,
        (pageNum - 1) * pageSizeNum,
        pageSizeNum,
      );

      res.json({
        success: true,
        source: "pubmed",
        data: results,
        total: results.length,
        page: pageNum,
        pageSize: pageSizeNum,
      });
    } catch (error: unknown) {
      logger.error("Error in PubMed search", error, "ResearchUnifiedRoutes");
      res
        .status(500)
        .json({ error: error instanceof Error ? error.message : "Failed to search PubMed" });
    }
  },
);

/**
 * Europe PMC specific search endpoint
 */
router.get(
  "/api/research/europe-pmc/search",
  async (req: Request, res: Response) => {
    try {
      const { query, page = "1", pageSize = "10" } = req.query;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Query parameter is required" });
      }

      const pageNum = parseInt(page as string) || 1;
      const pageSizeNum = parseInt(pageSize as string) || 10;

      logger.info("Europe PMC search", "ResearchUnifiedRoutes", { query, page: pageNum, pageSize: pageSizeNum });

      const results = await searchEuropePMC(query, pageNum, pageSizeNum);

      res.json({
        success: true,
        source: "europe-pmc",
        data: results.results,
        total: results.total,
        page: pageNum,
        pageSize: pageSizeNum,
      });
    } catch (error: unknown) {
      logger.error("Error in Europe PMC search", error, "ResearchUnifiedRoutes");
      res
        .status(500)
        .json({ error: error instanceof Error ? error.message : "Failed to search Europe PMC" });
    }
  },
);

/**
 * CrossRef specific search endpoint
 */
router.get(
  "/api/research/crossref/search",
  async (req: Request, res: Response) => {
    try {
      const { query, page = "1", pageSize = "10" } = req.query;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Query parameter is required" });
      }

      const pageNum = parseInt(page as string) || 1;
      const pageSizeNum = parseInt(pageSize as string) || 10;

      logger.info("CrossRef search", "ResearchUnifiedRoutes", { query, page: pageNum, pageSize: pageSizeNum });

      const results = await searchCrossRef(query, pageNum, pageSizeNum);

      res.json({
        success: true,
        source: "crossref",
        data: results.items || [],
        total: results.total_results || 0,
        page: pageNum,
        pageSize: pageSizeNum,
      });
    } catch (error: unknown) {
      logger.error("Error in CrossRef search", error, "ResearchUnifiedRoutes");
      res
        .status(500)
        .json({ error: error instanceof Error ? error.message : "Failed to search CrossRef" });
    }
  },
);

/**
 * Semantic Scholar specific search endpoint
 */
router.get(
  "/api/research/semantic-scholar/search",
  async (req: Request, res: Response) => {
    try {
      const { query, page = "1", pageSize = "10" } = req.query;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Query parameter is required" });
      }

      const pageNum = parseInt(page as string) || 1;
      const pageSizeNum = parseInt(pageSize as string) || 10;

      logger.info("Semantic Scholar search", "ResearchUnifiedRoutes", { query, page: pageNum, pageSize: pageSizeNum });

      const results = await searchSemanticScholar(
        query,
        pageNum - 1,
        pageSizeNum,
      );

      res.json({
        success: true,
        source: "semantic-scholar",
        data: results.data || [],
        total: results.total || 0,
        page: pageNum,
        pageSize: pageSizeNum,
      });
    } catch (error: unknown) {
      logger.error("Error in Semantic Scholar search", error, "ResearchUnifiedRoutes");
      res
        .status(500)
        .json({ error: error instanceof Error ? error.message : "Failed to search Semantic Scholar" });
    }
  },
);

/**
 * Schedule a recurring search
 */
router.post("/api/research/schedule", requireAdmin, async (req: Request, res: Response) => {
  try {
    // This would be implemented in a future version
    res
      .status(501)
      .json({ message: "Scheduled searches are not yet implemented" });
  } catch (error: unknown) {
    logger.error("Error scheduling search", error, "ResearchUnifiedRoutes");
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : "Failed to schedule search" });
  }
});

/**
 * Approve or reject a study from the review queue
 * When approved, automatically generates comprehensive content
 */
router.put(
  "/api/research/review-queue/:id",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, userId, notes } = req.body;

      if (!id || !status || !userId) {
        return res.status(400).json({
          error: "Missing required fields: id, status, and userId are required",
        });
      }

      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({
          error: 'Invalid status. Must be either "approved" or "rejected"',
        });
      }

      // Get the review queue item
      const reviewItem = await reviewService.getQueueItemById(parseInt(id));

      if (!reviewItem) {
        return res.status(404).json({ error: "Review queue item not found" });
      }

      // Update the review status
      const updatedItem = await reviewService.updateStatus(
        parseInt(id),
        status,
        userId,
        notes,
      );

      // If approved, create the study and generate all content
      if (status === "approved") {
        try {
          logger.info("Processing approved study", "ResearchUnifiedRoutes", { title: reviewItem.title });

          // 1. Create the study in the main database
          const study = {
            title: reviewItem.title,
            abstract: reviewItem.abstract,
            authors: reviewItem.authors,
            journal: reviewItem.journal,
            publishDate: reviewItem.publishDate || new Date().toISOString(),
            journalPublishDate: reviewItem.journalPublishDate,
            category: reviewItem.category,
            doi: reviewItem.doi,
            url: reviewItem.sourceUrl,
            sourcePlatform: reviewItem.sourcePlatform,
            peerReviewed: true,
          };

          const createdStudy = await studyService.createStudy(study);
          logger.info("Study created", "ResearchUnifiedRoutes", { studyId: createdStudy.id });

          // Import enrichment modules dynamically to avoid circular dependencies
          const [
            { enrichStudyContent },
            { generateBlogArticlesForStudy },
            { generateScientificArticlesForStudy },
            { generateStudyImage },
            { autoTagStudy },
          ] = await Promise.all([
            import("../services/content-enrichment").then(m => ({ enrichStudyContent: m.enhanceStudyContent })),
            import("../services/blog-generator-enhanced"),
            import("../services/scientific-article-generator"),
            import("../services/image-generator").then(m => ({ generateStudyImage: m.generateImageForStudy })),
            import("../automated-tagging-system").then(m => ({ autoTagStudy: m.tagSingleStudy })),
          ]);

          // 2. Enrich the study content (6th grade reading level)
          logger.info("Starting content enrichment", "ResearchUnifiedRoutes");
          const enrichmentResult = await enrichStudyContent(createdStudy.id);

          if (enrichmentResult.success) {
            logger.info("Content enrichment completed successfully", "ResearchUnifiedRoutes");
          } else {
            logger.warn("Content enrichment had issues", "ResearchUnifiedRoutes", { message: enrichmentResult.message });
          }

          // 3. Generate 7-10 blog posts (parallel generation for efficiency)
          logger.info("Generating blog articles", "ResearchUnifiedRoutes");
          const blogGenerationPromise = generateBlogArticlesForStudy(
            createdStudy,
            {
              count: 10, // Generate up to 10 blog posts
              fallbackToBasic: true,
            },
          );

          // 4. Generate 2 scientific articles
          logger.info("Generating scientific articles", "ResearchUnifiedRoutes");
          const scientificGenerationPromise =
            generateScientificArticlesForStudy(
              createdStudy,
              {
                fallbackToBasic: true,
              },
            );

          // 5. Generate study image using Grok (xAI) or DALL-E fallback
          logger.info("Generating study image", "ResearchUnifiedRoutes");
          const imageGenerationPromise = generateStudyImage(createdStudy.id);

          // 6. Auto-tag and categorize for SEO
          logger.info("Auto-tagging study", "ResearchUnifiedRoutes");
          const taggingPromise = autoTagStudy(createdStudy.id);

          // Execute all content generation in parallel
          const [blogResult, scientificResult, imageResult, tagResult] =
            await Promise.all([
              blogGenerationPromise.catch((error) => {
                logger.error("Blog generation failed", error, "ResearchUnifiedRoutes");
                return {
                  articles: [],
                  errors: [{ type: "blog", error: error.message }],
                };
              }),
              scientificGenerationPromise.catch((error) => {
                logger.error("Scientific article generation failed", error, "ResearchUnifiedRoutes");
                return {
                  articles: [],
                  errors: [{ type: "scientific", error: error.message }],
                };
              }),
              imageGenerationPromise.catch((error) => {
                logger.error("Image generation failed", error, "ResearchUnifiedRoutes");
                return { success: false, error: error.message };
              }),
              taggingPromise.catch((error) => {
                logger.error("Auto-tagging failed", error, "ResearchUnifiedRoutes");
                return { success: false, error: error.message };
              }),
            ]);

          // Compile generation results
          const generationSummary = {
            studyId: createdStudy.id,
            blogPosts: {
              generated: blogResult.articles?.length || 0,
              errors: blogResult.errors?.length || 0,
            },
            scientificArticles: {
              generated: scientificResult.articles?.length || 0,
              errors: scientificResult.errors?.length || 0,
            },
            image: (imageResult as Record<string, unknown>).success ? "Generated" : "Failed",
            tags: (tagResult as Record<string, unknown>).success !== false ? "Applied" : "Failed",
          };

          logger.info("Content generation summary", "ResearchUnifiedRoutes", generationSummary);

          res.json({
            success: true,
            message: `Study approved and published with comprehensive content`,
            reviewItem: updatedItem,
            study: createdStudy,
            contentGeneration: generationSummary,
          });
        } catch (error: unknown) {
          logger.error("Error processing approved study", error, "ResearchUnifiedRoutes");

          // Still mark as approved but note the error
          res.json({
            success: true,
            message: "Study approved but content generation had issues",
            reviewItem: updatedItem,
            error: error instanceof Error ? error.message : "Content generation partially failed",
          });
        }
      } else {
        // Study was rejected
        res.json({
          success: true,
          message: "Study rejected successfully",
          reviewItem: updatedItem,
        });
      }
    } catch (error: unknown) {
      logger.error("Error updating review status", error, "ResearchUnifiedRoutes");
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to update review status",
      });
    }
  },
);

export default router;
