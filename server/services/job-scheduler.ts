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
      console.log("⚠️ Job Scheduler is already running");
      return;
    }

    console.log("🚀 Starting Job Scheduler...");
    
    // Run immediately on startup
    this.runJobs();

    // Set up periodic check
    this.checkInterval = setInterval(() => {
      this.runJobs();
    }, this.CHECK_INTERVAL_MS);
    
    console.log(`✅ Job Scheduler active (Interval: ${this.CHECK_INTERVAL_MS}ms)`);
  }

  /**
   * Stop the scheduler
   */
  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log("🛑 Job Scheduler stopped");
    }
  }

  /**
   * Execute all scheduled jobs
   */
  private async runJobs(): Promise<void> {
    // Prevent overlapping job executions
    if (this.isJobRunning) {
      console.log("⏳ Previous job cycle still running, skipping this tick");
      return;
    }

    this.isJobRunning = true;

    try {
      // Job 1: Automated Study Discovery
      const discoveryResult = await checkScheduledSearches();
      if (discoveryResult.ran) {
        console.log("🔍 Automated Discovery Job completed:", discoveryResult);
      }
      
      // Job 2: Intelligent Content Enrichment
      const enrichmentStats = await checkAndEnrichStudies();
      if (enrichmentStats.totalProcessed > 0) {
          console.log(`✨ Automated Enrichment: Processed ${enrichmentStats.totalProcessed} studies`);
      }

      // Job 3: Automated Content Generation
      // Pick ONE study that is enriched but has no blog post, and generate one.
      // Limit to 1 per run to save costs/time.
      await this.runContentGenerationJob();
      
    } catch (error) {
      console.error("💥 Critical error in Job Scheduler:", error);
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
        // Use a LEFT JOIN strategy (not natively perfect in Drizzle simple query builder, using separate check)
        
        // 1. Get enriched studies
        const candidates = await db.select().from(studies)
            .where(
                sql`${studies.conclusion} IS NOT NULL`
            )
            .limit(10); // Check recent 10 enriched studies
        
        for (const study of candidates) {
            // Check if blog exists
            const existingBlog = await db.query.blogArticles.findFirst({
                where: eq(blogArticles.studyId, study.id)
            });

            if (!existingBlog) {
                console.log(`🎨 Creating automatic blog post for Study #${study.id}...`);
                
                // 1. Generate Text
                const result = await contentGenerator.generateBlogPost(study.id);
                
                if (result) {
                    // 2. Generate Image
                    await mediaGenerator.generateBlogHeroImage(result.articleId);
                    console.log("✨ Content Generation Cycle Complete for " + result.title);
                }
                
                // Stop after 1 successful generation to prevent spamming/cost
                break;
            }
        }

      } catch (error) {
          console.error("Error in Content Generation Job:", error);
      }
  }
}

// Export a singleton instance for easy usage
export const jobScheduler = JobScheduler.getInstance();
