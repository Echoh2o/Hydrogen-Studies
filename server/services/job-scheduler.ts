import { checkScheduledSearches } from "./keyword-monitor-service";
import { checkAndEnrichStudies } from "./targeted-enrichment";
import { contentGenerator } from "./content-generator";
import { mediaGenerator } from "./media-generator";
import { batchRetractionCheck } from "./retraction-monitor";
import { db } from "../db";
import { studies, blogArticles } from "@shared/schema";
import { eq, sql, isNull } from "drizzle-orm";

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

  // Configuration
  private readonly CHECK_INTERVAL_MS = 60 * 1000; // Check every 1 minute
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
      console.log("[JobScheduler] Already running");
      return;
    }

    console.log("[JobScheduler] Starting...");

    // Run immediately on startup
    this.runJobs();

    // Set up periodic check
    this.checkInterval = setInterval(() => {
      this.runJobs();
    }, this.CHECK_INTERVAL_MS);

    console.log(`[JobScheduler] Active (interval: ${this.CHECK_INTERVAL_MS}ms)`);
  }

  /**
   * Stop the scheduler
   */
  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log("[JobScheduler] Stopped");
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
        console.log("[JobScheduler] Discovery job completed:", discoveryResult);
      }

      // Job 2: Intelligent Content Enrichment
      const enrichmentStats = await checkAndEnrichStudies();
      if (enrichmentStats.totalProcessed > 0) {
        console.log(`[JobScheduler] Enrichment: processed ${enrichmentStats.totalProcessed} studies`);
      }

      // Job 3: Automated Content Generation
      // Pick ONE study that is enriched but has no blog post, and generate one.
      await this.runContentGenerationJob();

      // Job 4: Retraction & Correction Monitoring (runs once per day)
      await this.runRetractionCheckJob();

    } catch (error) {
      console.error("[JobScheduler] Critical error:", error);
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
          console.log(`[JobScheduler] Creating blog post for Study #${study.id}...`);

          const result = await contentGenerator.generateBlogPost(study.id);

          if (result) {
            await mediaGenerator.generateBlogHeroImage(result.articleId);
            console.log(`[JobScheduler] Content generation complete: ${result.title}`);
          }

          // Stop after 1 successful generation to prevent spamming/cost
          break;
        }
      }
    } catch (error) {
      console.error("[JobScheduler] Content generation error:", error);
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

      console.log("[JobScheduler] Running daily retraction check...");

      const result = await batchRetractionCheck({
        batchSize: 50, // Check 50 studies per day (rotates through all over time)
        delayMs: 1000, // 1 second between API calls to avoid rate limits
        onProgress: (checked, total) => {
          if (checked % 10 === 0) {
            console.log(`[JobScheduler] Retraction check: ${checked}/${total}`);
          }
        },
      });

      this.lastRetractionCheck = new Date();

      if (result.retracted > 0 || result.corrected > 0 || result.expressionOfConcern > 0) {
        console.warn(
          `[JobScheduler] Retraction check complete: ` +
          `${result.retracted} retracted, ${result.corrected} corrected, ` +
          `${result.expressionOfConcern} expression of concern ` +
          `(checked ${result.checked} studies)`
        );
      } else {
        console.log(`[JobScheduler] Retraction check: ${result.checked} studies checked, no issues found`);
      }
    } catch (error) {
      console.error("[JobScheduler] Retraction check error:", error);
    }
  }
}

// Export a singleton instance for easy usage
export const jobScheduler = JobScheduler.getInstance();
