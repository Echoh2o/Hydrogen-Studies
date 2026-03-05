import { checkScheduledSearches } from "./keyword-monitor-service";
import { checkAndEnrichStudies } from "./targeted-enrichment";
import { contentGenerator } from "./content-generator";
import { mediaGenerator } from "./media-generator";
import { batchRetractionCheck } from "./retraction-monitor";
import { buildAllStudyLinks, buildAllBlogLinks } from "./internal-linking-engine";
import { db } from "../db";
import { studies, blogArticles } from "@shared/schema";
import { eq, sql, isNull } from "drizzle-orm";
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
  private readonly LINK_BUILD_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // Weekly

  // Configuration
  private readonly CHECK_INTERVAL_MS = 15 * 60 * 1000; // Check every 15 minutes
  private readonly RETRACTION_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // Check retractions once per day

  private constructor() {}

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
      const discoveryResult = await checkScheduledSearches();
      if (discoveryResult.ran) {
        logger.info("Discovery job completed", "JobScheduler", { result: discoveryResult });
      }

      // Job 2: Intelligent Content Enrichment
      const enrichmentStats = await checkAndEnrichStudies();
      if (enrichmentStats.totalProcessed > 0) {
        logger.info("Enrichment completed", "JobScheduler", { totalProcessed: enrichmentStats.totalProcessed });
      }

      // Job 3: Automated Content Generation
      // Pick ONE study that is enriched but has no blog post, and generate one.
      await this.runContentGenerationJob();

      // Job 4: Retraction & Correction Monitoring (runs once per day)
      await this.runRetractionCheckJob();

      // Job 5: Internal Link Building (runs once per week)
      await this.runLinkBuildingJob();

    } catch (error) {
      logger.error("Critical error", error, "JobScheduler");
    } finally {
      this.isJobRunning = false;
    }
  }

  /**
   * Job 3: Generate Content for Studies
   */
  private async runContentGenerationJob() {
    try {
      // Find a candidate study: Enriched (has conclusion) AND not yet covered in a blog
      const candidates = await db.select().from(studies)
        .where(sql`${studies.conclusion} IS NOT NULL`)
        .limit(10);

      for (const study of candidates) {
        // Check if blog exists
        const existingBlog = await db.query.blogArticles.findFirst({
          where: eq(blogArticles.studyId, study.id)
        });

        if (!existingBlog) {
          logger.info("Creating blog post for study", "JobScheduler", { studyId: study.id });

          const result = await contentGenerator.generateBlogPost(study.id);

          if (result) {
            await mediaGenerator.generateBlogHeroImage(result.articleId);
            logger.info("Content generation complete", "JobScheduler", { title: result.title });
          }

          // Stop after 1 successful generation to prevent spamming/cost
          break;
        }
      }
    } catch (error) {
      logger.error("Content generation error", error, "JobScheduler");
    }
  }
  /**
   * Job 4: Check for retracted/corrected studies
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
}

// Export a singleton instance for easy usage
export const jobScheduler = JobScheduler.getInstance();
