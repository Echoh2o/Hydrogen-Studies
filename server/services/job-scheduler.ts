import { checkScheduledSearches } from "./keyword-monitor-service";
import { checkAndEnrichStudies } from "./targeted-enrichment";
import { batchRetractionCheck } from "./retraction-monitor";
import { buildAllStudyLinks, buildAllBlogLinks } from "./internal-linking-engine";
import { generateBlogArticlesForStudy } from "./blog-generator-enhanced";
import { getCrossRefArticleByDOI } from "./crossref-api";
import { db } from "../db";
import { studies, blogArticles } from "@shared/schema";
import { eq, sql, asc, isNotNull } from "drizzle-orm";
import { logger } from "../utils/logger";

/**
 * Job Scheduler Service
 * Manages background tasks and cron-like jobs for the application.
 * Designed to be robust, self-recovering, and memory-efficient.
 */
export class JobScheduler {
  private static instance: JobScheduler;
  private checkInterval: NodeJS.Timeout | null = null;
  private isJobRunning: boolean = false;
  private lastRetractionCheck: Date | null = null;
  private lastLinkBuildCheck: Date | null = null;
  private lastDiscoveryCheck: Date | null = null;
  private lastCitationBuildCheck: Date | null = null;
  private lastDigestCheck: Date | null = null;
  private lastFreshnessCheck: Date | null = null;
  private readonly LINK_BUILD_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // Weekly
  private readonly DISCOVERY_INTERVAL_MS = 6 * 60 * 60 * 1000; // Every 6 hours
  private readonly CITATION_BUILD_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // Weekly
  private readonly DIGEST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // Weekly
  private readonly FRESHNESS_CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // Weekly
  private readonly BLOG_GENERATION_INTERVAL_MS = 30 * 60 * 1000; // Every 30 minutes
  private lastBlogGenerationCheck: Date | null = null;
  private readonly CONTENT_QUEUE_INTERVAL_MS = 5 * 60 * 1000; // Every 5 minutes
  private lastContentQueueCheck: Date | null = null;

  // Configuration
  private readonly CHECK_INTERVAL_MS = 15 * 60 * 1000; // Check every 15 minutes
  private readonly RETRACTION_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // Check retractions once per day

  private constructor() {}

  /**
   * Wrap an async function with a timeout. Returns null if the job times out or throws.
   */
  private async withTimeout<T>(fn: () => Promise<T>, timeoutMs: number, jobName: string): Promise<T | null> {
    return new Promise<T | null>((resolve) => {
      const timer = setTimeout(() => {
        logger.warn(`Job timed out after ${timeoutMs}ms`, "JobScheduler", { job: jobName });
        resolve(null);
      }, timeoutMs);

      fn().then((result) => {
        clearTimeout(timer);
        resolve(result);
      }).catch((error) => {
        clearTimeout(timer);
        logger.error(`Job failed: ${jobName}`, error, "JobScheduler");
        resolve(null);
      });
    });
  }

  public static getInstance(): JobScheduler {
    if (!JobScheduler.instance) {
      JobScheduler.instance = new JobScheduler();
    }
    return JobScheduler.instance;
  }

  /**
   * Start the scheduler
   */
  public start(): void {
    if (this.checkInterval) {
      logger.info("Already running", "JobScheduler");
      return;
    }

    logger.info("Starting...", "JobScheduler");

    // Delay first run by 10s to let the app fully initialize (DB, routes, etc.)
    setTimeout(() => {
      this.runJobs().catch(err => {
        logger.error("Initial run failed", err, "JobScheduler");
      });
    }, 10000);

    // Set up periodic check with error boundary
    this.checkInterval = setInterval(() => {
      this.runJobs().catch(err => {
        logger.error("Periodic run failed", err, "JobScheduler");
      });
    }, this.CHECK_INTERVAL_MS);

    logger.info("Active", "JobScheduler", { intervalMs: this.CHECK_INTERVAL_MS, firstRunIn: "10s" });
  }

  /**
   * Stop the scheduler
   */
  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info("Stopped", "JobScheduler");
    }
  }

  /**
   * Execute all scheduled jobs
   */
  private async runJobs(): Promise<void> {
    // Prevent overlapping job executions
    if (this.isJobRunning) {
      return;
    }

    this.isJobRunning = true;

    try {
      // Job 1: Automated Study Discovery
      try {
        const start = Date.now();
        const discoveryResult = await this.withTimeout(
          () => checkScheduledSearches(),
          5 * 60 * 1000,
          "discovery"
        );
        const elapsed = Date.now() - start;
        if (discoveryResult?.ran) {
          logger.info("Discovery job completed", "JobScheduler", { result: discoveryResult });
        }
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "discovery" });
        }
      } catch (error) {
        logger.error("Job 1 (discovery) unexpected error", error, "JobScheduler");
      }

      // Job 2: Intelligent Content Enrichment
      try {
        const start = Date.now();
        const enrichmentStats = await this.withTimeout(
          () => checkAndEnrichStudies(),
          5 * 60 * 1000,
          "enrichment"
        );
        const elapsed = Date.now() - start;
        if (enrichmentStats && enrichmentStats.totalProcessed > 0) {
          logger.info("Enrichment completed", "JobScheduler", { totalProcessed: enrichmentStats.totalProcessed });
        }
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "enrichment" });
        }
      } catch (error) {
        logger.error("Job 2 (enrichment) unexpected error", error, "JobScheduler");
      }

      // Job 3: Retraction & Correction Monitoring (runs once per day)
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runRetractionCheckJob(),
          5 * 60 * 1000,
          "retraction-check"
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "retraction-check" });
        }
      } catch (error) {
        logger.error("Job 3 (retraction-check) unexpected error", error, "JobScheduler");
      }

      // Job 4: Internal Link Building (runs once per week)
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runLinkBuildingJob(),
          5 * 60 * 1000,
          "link-building"
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "link-building" });
        }
      } catch (error) {
        logger.error("Job 4 (link-building) unexpected error", error, "JobScheduler");
      }

      // Job 5: Research Discovery (runs every 6 hours)
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runResearchDiscoveryJob(),
          5 * 60 * 1000,
          "research-discovery"
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "research-discovery" });
        }
      } catch (error) {
        logger.error("Job 5 (research-discovery) unexpected error", error, "JobScheduler");
      }

      // Job 6: Pipeline Processing (runs every 15 min cycle)
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runPipelineProcessingJob(),
          3 * 60 * 1000,
          "pipeline-processing"
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "pipeline-processing" });
        }
      } catch (error) {
        logger.error("Job 6 (pipeline-processing) unexpected error", error, "JobScheduler");
      }

      // Job 7: Batch Blog Auto-Generation (runs after pipeline, up to 5 per cycle)
      // Generates blog articles for pipeline-processed studies that don't have one yet.
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runBatchBlogGenerationJob(),
          10 * 60 * 1000,
          "batch-blog-generation"
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "batch-blog-generation" });
        }
      } catch (error) {
        logger.error("Job 7 (batch-blog-generation) unexpected error", error, "JobScheduler");
      }

      // Job 8: Citation Network Building (runs once per week)
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runCitationBuildJob(),
          3 * 60 * 1000,
          "citation-build"
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "citation-build" });
        }
      } catch (error) {
        logger.error("Job 8 (citation-build) unexpected error", error, "JobScheduler");
      }

      // Job 9: Weekly Digest Generation (runs once per week)
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runDigestGenerationJob(),
          3 * 60 * 1000,
          "digest-generation"
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "digest-generation" });
        }
      } catch (error) {
        logger.error("Job 9 (digest-generation) unexpected error", error, "JobScheduler");
      }

      // Job 10: Study Metadata Freshness Check (runs once per week on Sundays)
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runMetadataFreshnessJob(),
          3 * 60 * 1000,
          "metadata-freshness"
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "metadata-freshness" });
        }
      } catch (error) {
        logger.error("Job 10 (metadata-freshness) unexpected error", error, "JobScheduler");
      }

      // Job 11: Auto-generate TLDRs for studies missing them
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runTldrGenerationJob(),
          3 * 60 * 1000,
          "tldr-generation"
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "tldr-generation" });
        }
      } catch (error) {
        logger.error("Job 11 (tldr-generation) unexpected error", error, "JobScheduler");
      }

      // Job 12: Generate consumer-facing summaries (plain_summary, key_finding, practical_takeaway)
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runSummaryEnrichmentJob(),
          3 * 60 * 1000,
          "summary-enrichment"
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "summary-enrichment" });
        }
      } catch (error) {
        logger.error("Job 12 (summary-enrichment) unexpected error", error, "JobScheduler");
      }

      // Job 13: Content Generation Queue (runs every 5 minutes)
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runContentQueueJob(),
          10 * 60 * 1000,
          "content-queue"
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "content-queue" });
        }
      } catch (error) {
        logger.error("Job 13 (content-queue) unexpected error", error, "JobScheduler");
      }

    } catch (error) {
      logger.error("Critical error", error, "JobScheduler");
    } finally {
      this.isJobRunning = false;
    }
  }

  /**
   * Job 7: Batch Blog Auto-Generation
   * Generates blog articles for pipeline-processed studies that don't have one yet.
   * Runs every 15-minute cycle after pipeline processing. Max 5 studies per cycle
   * to stay within AI API rate limits. Uses the enhanced blog generator which
   * produces multiple article types with images and internal links.
   */
  private async runBatchBlogGenerationJob() {
    const MAX_BLOGS_PER_CYCLE = 20; // Increased for faster content generation

    try {
      // Only run every 6 hours (not every 15-minute cycle)
      if (this.lastBlogGenerationCheck) {
        const elapsed = Date.now() - this.lastBlogGenerationCheck.getTime();
        if (elapsed < this.BLOG_GENERATION_INTERVAL_MS) {
          return;
        }
      }
      this.lastBlogGenerationCheck = new Date();
      // Find studies that have been enriched (have plain_language_title and category)
      // but don't have any blog article yet. Use a LEFT JOIN to check for missing blogs.
      const candidateStudies = await db
        .select({
          id: studies.id,
          title: studies.title,
          abstract: studies.abstract,
          authors: studies.authors,
          journal: studies.journal,
          publishDate: studies.publishDate,
          category: studies.category,
          plainLanguageTitle: studies.plainLanguageTitle,
        })
        .from(studies)
        .leftJoin(blogArticles, eq(studies.id, blogArticles.studyId))
        .where(
          sql`${studies.plainLanguageTitle} IS NOT NULL AND ${studies.category} IS NOT NULL AND ${blogArticles.id} IS NULL`
        )
        .limit(MAX_BLOGS_PER_CYCLE);

      if (candidateStudies.length === 0) {
        return; // Nothing to generate
      }

      logger.info("Starting batch blog generation", "JobScheduler", {
        candidates: candidateStudies.length,
      });

      let generated = 0;
      let failed = 0;

      for (const candidate of candidateStudies) {
        try {
          // Fetch the full study record for the blog generator
          const fullStudy = await db.query.studies.findFirst({
            where: eq(studies.id, candidate.id),
          });

          if (!fullStudy) {
            logger.warn("Study not found during blog generation", "JobScheduler", { studyId: candidate.id });
            failed++;
            continue;
          }

          logger.info("Generating blog for study", "JobScheduler", {
            studyId: fullStudy.id,
            title: fullStudy.plainLanguageTitle || fullStudy.title,
          });

          const result = await generateBlogArticlesForStudy(fullStudy, {
            count: 1, // Generate 1 article type per study to spread across cycles
            fallbackToBasic: true,
          });

          if (result.articles.length > 0) {
            generated++;
            logger.info("Blog generated for study", "JobScheduler", {
              studyId: fullStudy.id,
              articlesCreated: result.articles.length,
              errors: result.errors.length,
              warnings: result.warnings.length,
            });
          }

          if (result.errors.length > 0) {
            logger.warn("Blog generation had errors", "JobScheduler", {
              studyId: fullStudy.id,
              errors: result.errors,
            });
          }
        } catch (studyError) {
          // Non-blocking: individual failures don't stop the batch
          failed++;
          logger.error("Blog generation failed for study", studyError, "JobScheduler", {
            studyId: candidate.id,
          });
        }
      }

      if (generated > 0 || failed > 0) {
        logger.info("Batch blog generation complete", "JobScheduler", {
          generated,
          failed,
          total: candidateStudies.length,
        });
      }
    } catch (error) {
      logger.error("Batch blog generation error", error, "JobScheduler");
    }
  }

  /**
   * Job 3: Check for retracted/corrected studies
   * Runs once per day — checks a batch of studies against CrossRef and PubMed
   * for retraction notices, corrections, and expressions of concern.
   */
  private async runRetractionCheckJob() {
    try {
      // Only run once per day
      if (this.lastRetractionCheck) {
        const elapsed = Date.now() - this.lastRetractionCheck.getTime();
        if (elapsed < this.RETRACTION_CHECK_INTERVAL_MS) {
          return; // Not time yet
        }
      }

      logger.info("Running daily retraction check", "JobScheduler");

      const result = await batchRetractionCheck({
        batchSize: 50, // Check 50 studies per day (rotates through all over time)
        delayMs: 1000, // 1 second between API calls to avoid rate limits
        onProgress: (checked, total) => {
          if (checked % 10 === 0) {
            logger.info("Retraction check progress", "JobScheduler", { checked, total });
          }
        },
      });

      this.lastRetractionCheck = new Date();

      if (result.retracted > 0 || result.corrected > 0 || result.expressionOfConcern > 0) {
        logger.warn("Retraction check complete — issues found", "JobScheduler", {
          retracted: result.retracted,
          corrected: result.corrected,
          expressionOfConcern: result.expressionOfConcern,
          checked: result.checked,
        });
      } else {
        logger.info("Retraction check complete, no issues found", "JobScheduler", { checked: result.checked });
      }
    } catch (error) {
      logger.error("Retraction check error", error, "JobScheduler");
    }
  }
  /**
   * Job 5: Rebuild internal links between studies and blogs
   * Runs once per week to keep cross-references fresh.
   */
  private async runLinkBuildingJob() {
    try {
      if (this.lastLinkBuildCheck) {
        const elapsed = Date.now() - this.lastLinkBuildCheck.getTime();
        if (elapsed < this.LINK_BUILD_INTERVAL_MS) return;
      }

      logger.info("Running weekly link building", "JobScheduler");
      await buildAllStudyLinks({ batchSize: 200 });
      await buildAllBlogLinks({ batchSize: 200 });
      this.lastLinkBuildCheck = new Date();
      logger.info("Link building complete", "JobScheduler");
    } catch (error) {
      logger.error("Link building error", error, "JobScheduler");
    }
  }

  /**
   * Job 6: Autonomous Research Discovery
   * Runs every 6 hours — searches CrossRef + Europe PMC for new hydrogen studies.
   */
  private async runResearchDiscoveryJob() {
    try {
      if (this.lastDiscoveryCheck) {
        const elapsed = Date.now() - this.lastDiscoveryCheck.getTime();
        if (elapsed < this.DISCOVERY_INTERVAL_MS) return;
      }

      logger.info("Running research discovery", "JobScheduler");
      const { runDiscovery } = await import("./research-discovery-engine");
      const result = await runDiscovery();
      this.lastDiscoveryCheck = new Date();
      logger.info("Research discovery complete", "JobScheduler", {
        found: result.found,
        new: result.new,
        queued: result.queued,
      });
    } catch (error) {
      logger.error("Research discovery error", error, "JobScheduler");
    }
  }

  /**
   * Job 7: Pipeline Processing
   * Runs every 15-minute cycle — processes pending items through the AI pipeline.
   */
  private async runPipelineProcessingJob() {
    try {
      const { processPipelineQueue } = await import("./study-analysis-pipeline");
      const result = await processPipelineQueue();
      if (result.processed > 0) {
        logger.info("Pipeline processing complete", "JobScheduler", result);
      }
    } catch (error) {
      logger.error("Pipeline processing error", error, "JobScheduler");
    }
  }

  /**
   * Job 8: Citation Network Building
   * Runs once per week — fetches citation data from CrossRef and Europe PMC.
   */
  private async runCitationBuildJob() {
    try {
      if (this.lastCitationBuildCheck) {
        const elapsed = Date.now() - this.lastCitationBuildCheck.getTime();
        if (elapsed < this.CITATION_BUILD_INTERVAL_MS) return;
      }

      logger.info("Running citation network build", "JobScheduler");
      const { buildCitationNetwork } = await import("./citation-network-builder");
      const result = await buildCitationNetwork();
      this.lastCitationBuildCheck = new Date();
      logger.info("Citation build complete", "JobScheduler", result);
    } catch (error) {
      logger.error("Citation build error", error, "JobScheduler");
    }
  }

  /**
   * Job 9: Weekly Digest Generation
   * Runs once per week — generates an AI-powered weekly research digest.
   */
  private async runDigestGenerationJob() {
    try {
      if (this.lastDigestCheck) {
        const elapsed = Date.now() - this.lastDigestCheck.getTime();
        if (elapsed < this.DIGEST_INTERVAL_MS) return;
      }

      // Only generate on Mondays (or first run)
      const today = new Date().getDay();
      if (this.lastDigestCheck && today !== 1) return; // 1 = Monday

      logger.info("Running weekly digest generation", "JobScheduler");
      const { generateWeeklyDigest } = await import("./research-digest-generator");
      await generateWeeklyDigest();
      this.lastDigestCheck = new Date();
      logger.info("Digest generation complete", "JobScheduler");
    } catch (error) {
      logger.error("Digest generation error", error, "JobScheduler");
    }
  }

  /**
   * Job 11: Auto-generate TLDRs for studies missing them
   * Generates 10 TLDRs per cycle using Claude AI.
   */
  private async runTldrGenerationJob() {
    const MAX_TLDRS_PER_CYCLE = 3; // Reduced from 10 to control API costs

    try {
      const { isNull } = await import("drizzle-orm");

      const studiesWithoutTldr = await db
        .select({ id: studies.id, title: studies.title, abstract: studies.abstract, conclusion: studies.conclusion })
        .from(studies)
        .where(isNull(studies.tldr))
        .limit(MAX_TLDRS_PER_CYCLE);

      if (studiesWithoutTldr.length === 0) return;

      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const anthropic = new Anthropic();
      const { eq } = await import("drizzle-orm");

      let generated = 0;

      for (const study of studiesWithoutTldr) {
        try {
          if (!study.abstract) continue;

          const prompt = `You are a science communicator. Write a TL;DR summary of this study in 1-2 simple sentences. Use plain language a 6th grader could understand. Focus on the key finding and why it matters. No jargon. Be conversational.\n\nStudy title: ${study.title}\nAbstract: ${study.abstract}\n${study.conclusion ? `Conclusion: ${study.conclusion}` : ""}\n\nWrite ONLY the TL;DR text, nothing else.`;

          const message = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001", // Haiku is 90% cheaper — TLDRs are simple summaries
            max_tokens: 200,
            messages: [{ role: "user", content: prompt }],
          });

          const tldr = (message.content[0] as any).text?.trim();
          if (tldr) {
            await db.update(studies).set({ tldr }).where(eq(studies.id, study.id));
            generated++;
          }
        } catch (err: any) {
          logger.warn(`TLDR generation failed for study ${study.id}: ${err.message}`, "JobScheduler");
        }
      }

      if (generated > 0) {
        logger.info(`Auto-generated ${generated} TLDRs (${studiesWithoutTldr.length - generated} remaining)`, "JobScheduler");
      }
    } catch (error) {
      logger.error("TLDR generation job error", error, "JobScheduler");
    }
  }

  /**
   * Job 10: Study Metadata Freshness Check
   * Runs once per week on Sundays — re-fetches metadata for the oldest-checked studies
   * from CrossRef to detect updates (corrected abstracts, new authors, updated titles, etc.).
   * Processes 100 studies per run, ordered by lastModified ASC (NULLs first).
   */
  private async runMetadataFreshnessJob() {
    try {
      if (this.lastFreshnessCheck) {
        const elapsed = Date.now() - this.lastFreshnessCheck.getTime();
        if (elapsed < this.FRESHNESS_CHECK_INTERVAL_MS) return;
      }

      // Only run on Sundays (or first run)
      const today = new Date().getDay();
      if (this.lastFreshnessCheck && today !== 0) return; // 0 = Sunday

      logger.info("Running study metadata freshness check", "JobScheduler");

      // Query 100 studies with DOIs, ordered by lastModified ASC (NULLs first = never checked)
      const staleStudies = await db
        .select({
          id: studies.id,
          title: studies.title,
          abstract: studies.abstract,
          authors: studies.authors,
          journal: studies.journal,
          publishDate: studies.publishDate,
          doi: studies.doi,
        })
        .from(studies)
        .where(isNotNull(studies.doi))
        .orderBy(asc(studies.lastModified))
        .limit(100);

      if (staleStudies.length === 0) {
        logger.info("No studies with DOIs to check for freshness", "JobScheduler");
        this.lastFreshnessCheck = new Date();
        return;
      }

      let checked = 0;
      let updated = 0;
      let failed = 0;
      const changedStudies: Array<{ id: number; fields: string[] }> = [];

      for (const study of staleStudies) {
        try {
          const doi = study.doi?.trim();
          if (!doi) continue;

          // Rate limit: 1 second between API calls
          if (checked > 0) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          const crossrefResponse = await getCrossRefArticleByDOI(doi);
          checked++;

          if (!crossrefResponse?.message) {
            // Touch lastModified so this study rotates to the back of the queue
            await db.update(studies).set({ lastModified: new Date() }).where(eq(studies.id, study.id));
            continue;
          }

          const crossrefData = crossrefResponse.message;
          const changes: Record<string, any> = {};
          const changedFields: string[] = [];

          // Compare title
          if (
            crossrefData.title &&
            Array.isArray(crossrefData.title) &&
            crossrefData.title.length > 0
          ) {
            const fetchedTitle = crossrefData.title[0]?.trim();
            if (
              fetchedTitle &&
              fetchedTitle.length > 10 &&
              study.title &&
              this.normalizeForComparison(fetchedTitle) !== this.normalizeForComparison(study.title)
            ) {
              changes.title = fetchedTitle;
              changedFields.push("title");
            }
          }

          // Compare abstract
          if (crossrefData.abstract && crossrefData.abstract.trim() !== "") {
            const fetchedAbstract = crossrefData.abstract.replace(/<\/?[^>]+(>|$)/g, "").trim();
            if (
              fetchedAbstract.length > 20 &&
              study.abstract &&
              this.normalizeForComparison(fetchedAbstract) !== this.normalizeForComparison(study.abstract)
            ) {
              // Only count as changed if substantially different (not just whitespace/punctuation)
              const similarity = this.textSimilarity(fetchedAbstract, study.abstract);
              if (similarity < 0.95) {
                changes.abstract = fetchedAbstract;
                changedFields.push("abstract");
              }
            }
          }

          // Compare authors
          if (
            crossrefData.author &&
            Array.isArray(crossrefData.author) &&
            crossrefData.author.length > 0
          ) {
            const fetchedAuthors = crossrefData.author
              .map((a: any) => `${a.given || ""} ${a.family || ""}`.trim())
              .join(", ");
            if (
              fetchedAuthors &&
              study.authors &&
              this.normalizeForComparison(fetchedAuthors) !== this.normalizeForComparison(study.authors)
            ) {
              changes.authors = fetchedAuthors;
              changedFields.push("authors");

              // Update structured author fields too
              if (crossrefData.author.length > 0) {
                changes.firstAuthor = `${crossrefData.author[0].given || ""} ${crossrefData.author[0].family || ""}`.trim();
                if (crossrefData.author.length > 1) {
                  changes.lastAuthor = `${crossrefData.author[crossrefData.author.length - 1].given || ""} ${crossrefData.author[crossrefData.author.length - 1].family || ""}`.trim();
                  if (crossrefData.author.length > 2) {
                    changes.otherAuthors = crossrefData.author
                      .slice(1, -1)
                      .map((a: any) => `${a.given || ""} ${a.family || ""}`.trim())
                      .join(", ");
                  }
                }
              }
            }
          }

          // Compare journal
          if (
            crossrefData["container-title"] &&
            Array.isArray(crossrefData["container-title"]) &&
            crossrefData["container-title"].length > 0
          ) {
            const fetchedJournal = crossrefData["container-title"][0]?.trim();
            if (
              fetchedJournal &&
              study.journal &&
              this.normalizeForComparison(fetchedJournal) !== this.normalizeForComparison(study.journal)
            ) {
              changes.journal = fetchedJournal;
              changedFields.push("journal");
            }
          }

          // Compare publication date
          if (crossrefData.published?.["date-parts"]?.[0]) {
            const dateParts = crossrefData.published["date-parts"][0];
            if (dateParts && dateParts.length >= 1) {
              const year = dateParts[0];
              const month = dateParts.length >= 2 ? String(dateParts[1]).padStart(2, "0") : "01";
              const day = dateParts.length >= 3 ? String(dateParts[2]).padStart(2, "0") : "01";
              const fetchedDate = `${year}-${month}-${day}`;
              if (study.publishDate && fetchedDate !== study.publishDate) {
                changes.publishDate = fetchedDate;
                changedFields.push("publishDate");
              }
            }
          }

          // Always touch lastModified to rotate this study to the back of the queue
          changes.lastModified = new Date();

          // Apply updates
          if (changedFields.length > 0) {
            await db.update(studies).set(changes).where(eq(studies.id, study.id));
            updated++;
            changedStudies.push({ id: study.id, fields: changedFields });
            logger.info("Study metadata updated", "JobScheduler:Freshness", {
              studyId: study.id,
              changedFields,
            });
          } else {
            // Just update lastModified timestamp to rotate queue
            await db.update(studies).set({ lastModified: new Date() }).where(eq(studies.id, study.id));
          }
        } catch (studyError) {
          failed++;
          logger.warn("Freshness check failed for study", "JobScheduler:Freshness", {
            studyId: study.id,
            error: studyError instanceof Error ? studyError.message : String(studyError),
          });
          // Non-blocking: continue to next study
        }
      }

      this.lastFreshnessCheck = new Date();

      logger.info("Study metadata freshness check complete", "JobScheduler", {
        checked,
        updated,
        failed,
        changedStudies: changedStudies.length > 0 ? changedStudies : undefined,
      });
    } catch (error) {
      logger.error("Metadata freshness check error", error, "JobScheduler");
    }
  }

  /**
   * Job 13: Content Generation Queue
   * Processes pending items from the unified content generation queue.
   * Runs every 5 minutes, processes 2 studies per cycle to respect API rate limits.
   */
  private async runContentQueueJob() {
    try {
      if (this.lastContentQueueCheck) {
        const elapsed = Date.now() - this.lastContentQueueCheck.getTime();
        if (elapsed < this.CONTENT_QUEUE_INTERVAL_MS) return;
      }

      const { processContentQueue } = await import("./content-generation-worker");
      const result = await processContentQueue(10);
      this.lastContentQueueCheck = new Date();

      if (result.processed > 0 || result.failed > 0) {
        logger.info("Content queue processed", "JobScheduler", {
          processed: result.processed,
          failed: result.failed,
        });
      }
    } catch (error) {
      logger.error("Content queue job error", error, "JobScheduler");
    }
  }

  /**
   * Normalize text for comparison: lowercase, collapse whitespace, strip punctuation.
   */
  private normalizeForComparison(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[^\w\s]/g, "")
      .trim();
  }

  /**
   * Simple text similarity ratio (0 to 1) based on matching prefix and suffix characters.
   * Used to avoid flagging trivial formatting differences as real changes.
   */
  private textSimilarity(a: string, b: string): number {
    const normA = this.normalizeForComparison(a);
    const normB = this.normalizeForComparison(b);
    if (normA === normB) return 1;
    const longer = normA.length > normB.length ? normA : normB;
    const shorter = normA.length > normB.length ? normB : normA;
    if (longer.length === 0) return 1;
    const maxLen = longer.length;
    let prefixMatches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (shorter[i] === longer[i]) prefixMatches++;
      else break;
    }
    let suffixMatches = 0;
    for (let i = 0; i < shorter.length - prefixMatches; i++) {
      if (shorter[shorter.length - 1 - i] === longer[longer.length - 1 - i]) suffixMatches++;
      else break;
    }
    return (prefixMatches + suffixMatches) / maxLen;
  }

  /**
   * Job 12: Consumer-Facing Summary Enrichment
   * Generates plain_summary, key_finding, and practical_takeaway for studies.
   * Processes 5 studies per cycle using Claude Haiku.
   */
  private async runSummaryEnrichmentJob() {
    try {
      const { enrichStudySummaries } = await import("./study-summary-enrichment");
      const result = await enrichStudySummaries(5);
      if (result.totalProcessed > 0) {
        logger.info("Summary enrichment complete", "JobScheduler", {
          enriched: result.enriched,
          skipped: result.skipped,
          errors: result.errors,
        });
      }
    } catch (error) {
      logger.error("Summary enrichment job error", error, "JobScheduler");
    }
  }
}

// Export a singleton instance for easy usage
export const jobScheduler = JobScheduler.getInstance();
