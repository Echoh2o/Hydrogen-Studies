import { checkScheduledSearches } from "./keyword-monitor-service";
import { checkAndEnrichStudies } from "./targeted-enrichment";
import { contentGenerator } from "./content-generator";
import { mediaGenerator } from "./media-generator";
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

  // Configuration
  private readonly CHECK_INTERVAL_MS = 60 * 1000; // Check every 1 minute

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
}

// Export a singleton instance for easy usage
export const jobScheduler = JobScheduler.getInstance();
