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
  // Separate fast loop for time-sensitive per-cycle jobs (content-generation
  // queue, scheduled blog publishing, stale-job recovery). These previously
  // ran inline in the 15-min loop AFTER the long jobs (blog gen ~30m, scoring/
  // sync ~10m each), so a single slow upstream call could starve them for
  // hours. The fast loop runs them on their own cadence with its own
  // re-entrancy guard, independent of the slow loop.
  private fastCheckInterval: NodeJS.Timeout | null = null;
  private isFastJobRunning: boolean = false;
  private readonly FAST_CHECK_INTERVAL_MS = 5 * 60 * 1000; // Every 5 minutes
  private lastRetractionCheck: Date | null = null;
  private lastLinkBuildCheck: Date | null = null;
  private lastDiscoveryCheck: Date | null = null;
  // Per-cycle jobs — previously had no last-run visibility. Set at the end
  // of each successful invocation so System Health can flag silent failure.
  private lastKeywordDiscoveryCheck: Date | null = null;
  private lastEnrichmentCheck: Date | null = null;
  private lastPipelineProcessingCheck: Date | null = null;
  private lastTldrGenerationCheck: Date | null = null;
  private lastSummaryEnrichmentCheck: Date | null = null;
  private lastCitationBuildCheck: Date | null = null;
  private lastDigestCheck: Date | null = null;
  private lastFreshnessCheck: Date | null = null;
  private readonly LINK_BUILD_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // Weekly
  private readonly DISCOVERY_INTERVAL_MS = 6 * 60 * 60 * 1000; // Every 6 hours
  private readonly CITATION_BUILD_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // Weekly
  private readonly DIGEST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // Weekly
  private readonly FRESHNESS_CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // Weekly
  private readonly BLOG_GENERATION_INTERVAL_MS = 10 * 60 * 1000; // Every 10 minutes — aggressive rebuild
  private lastBlogGenerationCheck: Date | null = null;
  private readonly CONTENT_QUEUE_INTERVAL_MS = 5 * 60 * 1000; // Every 5 minutes
  private lastContentQueueCheck: Date | null = null;
  private readonly JOURNAL_DATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // Daily
  private lastJournalDateCheck: Date | null = null;
  private readonly STUDY_SCORING_INTERVAL_MS = 24 * 60 * 60 * 1000; // Daily
  private lastStudyScoringCheck: Date | null = null;
  // Scheduled-publish runs every cycle (15m). If a blog is set to publish
  // "in 30 minutes," it'll go live within 15m of the target.
  private readonly SCHEDULED_PUBLISH_INTERVAL_MS = 15 * 60 * 1000;
  private lastScheduledPublishCheck: Date | null = null;
  // GSC pulls every 6h — well under the API quota (25k/day), enough to
  // keep "yesterday's data" fresh within a few hours of GSC publishing it.
  private readonly GSC_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
  private lastGscSyncCheck: Date | null = null;
  // GA4 pulls every 6h. Same cadence as GSC — paired so the two
  // datasets advance together when admins look at engagement vs impressions.
  private readonly GA4_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
  private lastGa4SyncCheck: Date | null = null;
  // 404 suggestion backfill drains the unresolved-404 queue every 30 min
  // so admins don't have to click "Auto-Suggest" 167 times to chew through
  // a 16k backlog. Mirror of the image-backfill pattern (commit df085dc).
  private readonly REDIRECT_SUGGESTION_INTERVAL_MS = 30 * 60 * 1000;
  private lastRedirectSuggestionCheck: Date | null = null;
  // Bot-probe cleanup runs once per day. Deletes single-hit referrer-less
  // entries older than 7 days from not_found_log so the table stays
  // useful for actual SEO recovery instead of drowning in scanner noise.
  private readonly NOT_FOUND_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
  private lastNotFoundCleanupCheck: Date | null = null;
  // Shopify customer reconciliation runs once per day. Pulls customers
  // updated in the past 48h from Shopify's Admin API and upserts —
  // catches webhooks that failed or were dropped. 48h window covers
  // ~24h of cron skew + 24h of Shopify retry attempts.
  private readonly SHOPIFY_RECONCILE_INTERVAL_MS = 24 * 60 * 60 * 1000;
  private lastShopifyReconcileCheck: Date | null = null;
  // Image backfill runs every 30 min. Each cycle handles 5 blogs + 5
  // studies — keeps AI cost predictable while still draining a backlog
  // of ~500 missing images in a few days unattended.
  private readonly IMAGE_BACKFILL_INTERVAL_MS = 30 * 60 * 1000;
  private lastImageBackfillCheck: Date | null = null;
  // Stale-job recovery. resetStaleProcessingJobs() runs at boot in app.ts,
  // but if the server doesn't restart for days, items can get stuck in
  // pipeline_queue/content_generation_queue.status='processing' with no path
  // back to 'pending'. Re-run every 5 min as a safety net.
  private readonly STALE_RECOVERY_INTERVAL_MS = 5 * 60 * 1000;
  private lastStaleRecoveryCheck: Date | null = null;

  // Configuration
  private readonly CHECK_INTERVAL_MS = 15 * 60 * 1000; // Check every 15 minutes
  private readonly RETRACTION_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // Check retractions once per day

  private constructor() {}

  /**
   * Wrap an async function with a timeout. Returns null if the job times out or throws.
   */
  /**
   * Run `fn` with a timeout. Resolves to `null` on timeout or throw.
   *
   * `onSuccess` fires ONLY when `fn` genuinely completes before the timeout —
   * use it to record liveness so a job that times out or throws does NOT stamp
   * a "last ran" timestamp it never earned. The `settled` guard ensures a job
   * that completes *after* the timeout already fired cannot retroactively
   * mark itself healthy.
   *
   * NOTE: a timed-out `fn` is not actually cancelled — it keeps running in the
   * background. Jobs that do network I/O should accept an AbortSignal so the
   * orphaned work can stop; see runJobs() comments.
   */
  private async withTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    jobName: string,
    onSuccess?: () => void,
  ): Promise<T | null> {
    return new Promise<T | null>((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        logger.warn(`Job timed out after ${timeoutMs}ms`, "JobScheduler", { job: jobName });
        resolve(null);
      }, timeoutMs);

      fn().then((result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { onSuccess?.(); } catch { /* liveness bookkeeping must never break the job loop */ }
        resolve(result);
      }).catch((error) => {
        if (settled) return;
        settled = true;
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

    // Fast loop for time-sensitive jobs — first run shortly after boot, then
    // every FAST_CHECK_INTERVAL_MS, independent of the slow loop above.
    setTimeout(() => {
      this.runFastJobs().catch(err => {
        logger.error("Initial fast run failed", err, "JobScheduler");
      });
    }, 15000);
    this.fastCheckInterval = setInterval(() => {
      this.runFastJobs().catch(err => {
        logger.error("Periodic fast run failed", err, "JobScheduler");
      });
    }, this.FAST_CHECK_INTERVAL_MS);

    logger.info("Active", "JobScheduler", {
      intervalMs: this.CHECK_INTERVAL_MS,
      fastIntervalMs: this.FAST_CHECK_INTERVAL_MS,
      firstRunIn: "10s",
    });
  }

  /**
   * Stop the scheduler
   */
  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    if (this.fastCheckInterval) {
      clearInterval(this.fastCheckInterval);
      this.fastCheckInterval = null;
    }
    logger.info("Stopped", "JobScheduler");
  }

  /**
   * Report last-run timestamps for each throttled job. Used by the admin
   * monitoring page to show which jobs are running on schedule vs. silently
   * broken. Jobs that run every cycle (e.g. discovery, enrichment) don't
   * carry a timestamp — they're reflected by `running` instead.
   */
  public getStatus(): {
    running: boolean;
    checkIntervalMs: number;
    jobs: Array<{
      name: string;
      lastRun: string | null;
      intervalMs: number;
    }>;
  } {
    const toISO = (d: Date | null) => (d ? d.toISOString() : null);
    return {
      running: this.checkInterval !== null,
      checkIntervalMs: this.CHECK_INTERVAL_MS,
      jobs: [
        { name: "research-discovery", lastRun: toISO(this.lastDiscoveryCheck), intervalMs: this.DISCOVERY_INTERVAL_MS },
        // Per-cycle jobs run on every 15 min tick — intervalMs reflects cadence, not throttle.
        { name: "keyword-discovery", lastRun: toISO(this.lastKeywordDiscoveryCheck), intervalMs: this.CHECK_INTERVAL_MS },
        { name: "enrichment", lastRun: toISO(this.lastEnrichmentCheck), intervalMs: this.CHECK_INTERVAL_MS },
        { name: "pipeline-processing", lastRun: toISO(this.lastPipelineProcessingCheck), intervalMs: this.CHECK_INTERVAL_MS },
        { name: "tldr-generation", lastRun: toISO(this.lastTldrGenerationCheck), intervalMs: this.CHECK_INTERVAL_MS },
        { name: "summary-enrichment", lastRun: toISO(this.lastSummaryEnrichmentCheck), intervalMs: this.CHECK_INTERVAL_MS },
        { name: "retraction-check", lastRun: toISO(this.lastRetractionCheck), intervalMs: this.RETRACTION_CHECK_INTERVAL_MS },
        { name: "link-building", lastRun: toISO(this.lastLinkBuildCheck), intervalMs: this.LINK_BUILD_INTERVAL_MS },
        { name: "citation-build", lastRun: toISO(this.lastCitationBuildCheck), intervalMs: this.CITATION_BUILD_INTERVAL_MS },
        { name: "digest-generation", lastRun: toISO(this.lastDigestCheck), intervalMs: this.DIGEST_INTERVAL_MS },
        { name: "metadata-freshness", lastRun: toISO(this.lastFreshnessCheck), intervalMs: this.FRESHNESS_CHECK_INTERVAL_MS },
        { name: "blog-generation", lastRun: toISO(this.lastBlogGenerationCheck), intervalMs: this.BLOG_GENERATION_INTERVAL_MS },
        { name: "content-queue", lastRun: toISO(this.lastContentQueueCheck), intervalMs: this.CONTENT_QUEUE_INTERVAL_MS },
        { name: "journal-date-backfill", lastRun: toISO(this.lastJournalDateCheck), intervalMs: this.JOURNAL_DATE_INTERVAL_MS },
        { name: "study-scoring", lastRun: toISO(this.lastStudyScoringCheck), intervalMs: this.STUDY_SCORING_INTERVAL_MS },
        { name: "scheduled-publish", lastRun: toISO(this.lastScheduledPublishCheck), intervalMs: this.SCHEDULED_PUBLISH_INTERVAL_MS },
        { name: "gsc-sync", lastRun: toISO(this.lastGscSyncCheck), intervalMs: this.GSC_SYNC_INTERVAL_MS },
        { name: "ga4-sync", lastRun: toISO(this.lastGa4SyncCheck), intervalMs: this.GA4_SYNC_INTERVAL_MS },
        { name: "image-backfill", lastRun: toISO(this.lastImageBackfillCheck), intervalMs: this.IMAGE_BACKFILL_INTERVAL_MS },
        { name: "redirect-suggestion-backfill", lastRun: toISO(this.lastRedirectSuggestionCheck), intervalMs: this.REDIRECT_SUGGESTION_INTERVAL_MS },
        { name: "not-found-cleanup", lastRun: toISO(this.lastNotFoundCleanupCheck), intervalMs: this.NOT_FOUND_CLEANUP_INTERVAL_MS },
        { name: "shopify-customer-reconcile", lastRun: toISO(this.lastShopifyReconcileCheck), intervalMs: this.SHOPIFY_RECONCILE_INTERVAL_MS },
        { name: "stale-job-recovery", lastRun: toISO(this.lastStaleRecoveryCheck), intervalMs: this.STALE_RECOVERY_INTERVAL_MS },
      ],
    };
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
          "discovery",
          () => { this.lastKeywordDiscoveryCheck = new Date(); }
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
        const { reportError } = await import("../utils/error-reporting");
        reportError(error, { tags: { job: "keyword-discovery" } });
      }

      // Job 2: Intelligent Content Enrichment
      try {
        const start = Date.now();
        const enrichmentStats = await this.withTimeout(
          () => checkAndEnrichStudies(),
          5 * 60 * 1000,
          "enrichment",
          () => { this.lastEnrichmentCheck = new Date(); }
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
        const { reportError } = await import("../utils/error-reporting");
        reportError(error, { tags: { job: "enrichment" } });
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
          "pipeline-processing",
          () => { this.lastPipelineProcessingCheck = new Date(); }
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "pipeline-processing" });
        }
      } catch (error) {
        logger.error("Job 6 (pipeline-processing) unexpected error", error, "JobScheduler");
        const { reportError } = await import("../utils/error-reporting");
        reportError(error, { tags: { job: "pipeline-processing" } });
      }

      // Job 7: Batch Blog Auto-Generation (runs after pipeline, up to 5 per cycle)
      // Generates blog articles for pipeline-processed studies that don't have one yet.
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runBatchBlogGenerationJob(),
          30 * 60 * 1000,
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
          "tldr-generation",
          () => { this.lastTldrGenerationCheck = new Date(); }
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "tldr-generation" });
        }
      } catch (error) {
        logger.error("Job 11 (tldr-generation) unexpected error", error, "JobScheduler");
        const { reportError } = await import("../utils/error-reporting");
        reportError(error, { tags: { job: "tldr-generation" } });
      }

      // Job 12: Generate consumer-facing summaries (plain_summary, key_finding, practical_takeaway)
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runSummaryEnrichmentJob(),
          3 * 60 * 1000,
          "summary-enrichment",
          () => { this.lastSummaryEnrichmentCheck = new Date(); }
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "summary-enrichment" });
        }
      } catch (error) {
        logger.error("Job 12 (summary-enrichment) unexpected error", error, "JobScheduler");
        const { reportError } = await import("../utils/error-reporting");
        reportError(error, { tags: { job: "summary-enrichment" } });
      }

      // Job 13 (content-generation queue) moved to the fast loop — see runFastJobs().

      // Job 14: Journal publication-date backfill (runs once per day)
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runJournalDateBackfillJob(),
          10 * 60 * 1000,
          "journal-date-backfill"
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "journal-date-backfill" });
        }
      } catch (error) {
        logger.error("Job 14 (journal-date-backfill) unexpected error", error, "JobScheduler");
      }

      // Job 15: Study quality scoring — rescore unscored, stale-rubric,
      // and recently-modified studies. Keeps scores current without requiring
      // admins to click "batch-score" by hand.
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runStudyScoringJob(),
          10 * 60 * 1000,
          "study-scoring"
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "study-scoring" });
        }
      } catch (error) {
        logger.error("Job 15 (study-scoring) unexpected error", error, "JobScheduler");
      }

      // Job 16 (scheduled blog publishing) moved to the fast loop — see runFastJobs().

      // Job 17: Google Search Console sync. Skips when no credentials
      // are stored (i.e., admin hasn't connected yet). 10-minute timeout
      // accommodates the first-run 90-day backfill.
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runGscSyncJob(),
          10 * 60 * 1000,
          "gsc-sync"
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "gsc-sync" });
        }
      } catch (error) {
        logger.error("Job 17 (gsc-sync) unexpected error", error, "JobScheduler");
      }

      // Job 18: Image backfill — auto-regenerates missing/placeholder
      // images for blogs and studies. Drains the backlog without admin
      // intervention. 5-minute timeout (each image takes ~10-30s).
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runImageBackfillJob(),
          5 * 60 * 1000,
          "image-backfill"
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "image-backfill" });
        }
      } catch (error) {
        logger.error("Job 18 (image-backfill) unexpected error", error, "JobScheduler");
      }

      // Job 20: Redirect-suggestion backfill — drains unresolved-404
      // queue so suggestions appear without admin clicks. 5-minute
      // timeout (per-entry trigram queries are fast).
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runRedirectSuggestionBackfillJob(),
          5 * 60 * 1000,
          "redirect-suggestion-backfill"
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "redirect-suggestion-backfill" });
        }
      } catch (error) {
        logger.error("Job 20 (redirect-suggestion-backfill) unexpected error", error, "JobScheduler");
      }

      // Job 21: not_found_log cleanup — once per day, prune obvious
      // bot-probe detritus so the table stays focused on actionable
      // 404s. 1-minute timeout (single DELETE).
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runNotFoundCleanupJob(),
          60 * 1000,
          "not-found-cleanup"
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "not-found-cleanup" });
        }
      } catch (error) {
        logger.error("Job 21 (not-found-cleanup) unexpected error", error, "JobScheduler");
      }

      // Job 22: Shopify customer reconciliation — pulls last-48h
      // customers from Shopify's Admin API and upserts so webhooks
      // that failed or were dropped don't lose customers. 5-minute
      // timeout (a 48h window is at most ~hundreds of customers
      // even on a busy store).
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runShopifyCustomerReconcileJob(),
          5 * 60 * 1000,
          "shopify-customer-reconcile"
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "shopify-customer-reconcile" });
        }
      } catch (error) {
        logger.error("Job 22 (shopify-customer-reconcile) unexpected error", error, "JobScheduler");
      }

      // Job 23 (stale-job recovery) moved to the fast loop — see runFastJobs().

      // Job 19: GA4 sync. Skips silently when no credentials are stored.
      // 10-minute timeout for the first-run 90-day backfill.
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runGa4SyncJob(),
          10 * 60 * 1000,
          "ga4-sync"
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "ga4-sync" });
        }
      } catch (error) {
        logger.error("Job 19 (ga4-sync) unexpected error", error, "JobScheduler");
      }

    } catch (error) {
      logger.error("Critical error", error, "JobScheduler");
    } finally {
      this.isJobRunning = false;
    }
  }

  /**
   * Fast loop — time-sensitive per-cycle jobs that must not be gated behind the
   * long-running jobs in runJobs(). Runs on FAST_CHECK_INTERVAL_MS with its own
   * re-entrancy guard so a slow tick of the main loop can't delay publishing or
   * content-queue draining.
   */
  private async runFastJobs(): Promise<void> {
    if (this.isFastJobRunning) {
      return;
    }
    this.isFastJobRunning = true;

    try {
      // Job 13: Content Generation Queue
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

      // Job 16: Scheduled blog publishing — promotes drafts whose scheduledFor
      // has passed. Cheap (indexed query); latency = scheduling resolution.
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runScheduledPublishJob(),
          60 * 1000,
          "scheduled-publish"
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "scheduled-publish" });
        }
      } catch (error) {
        logger.error("Job 16 (scheduled-publish) unexpected error", error, "JobScheduler");
      }

      // Job 23: Stale-job recovery — resets pipeline_queue and
      // content_generation_queue rows stuck in 'processing'. Cheap (two indexed
      // UPDATEs); a safety net between restarts on long-lived deploys.
      try {
        const start = Date.now();
        await this.withTimeout(
          () => this.runStaleJobRecovery(),
          60 * 1000,
          "stale-job-recovery"
        );
        const elapsed = Date.now() - start;
        if (elapsed > 1000) {
          logger.info(`Job completed in ${elapsed}ms`, "JobScheduler", { job: "stale-job-recovery" });
        }
      } catch (error) {
        logger.error("Job 23 (stale-job-recovery) unexpected error", error, "JobScheduler");
      }
    } catch (error) {
      logger.error("Critical error (fast loop)", error, "JobScheduler");
    } finally {
      this.isFastJobRunning = false;
    }
  }

  /**
   * Job 23: Stale-job recovery.
   *
   * Resets pipeline_queue / content_generation_queue rows stuck in
   * 'processing'. The same function runs once at boot; the fast loop's
   * scheduled call covers the gap between restarts on long-lived deploys.
   * Cadence is owned by the fast loop (FAST_CHECK_INTERVAL_MS), so no internal
   * throttle is needed here.
   */
  private async runStaleJobRecovery() {
    try {
      const { resetStaleProcessingJobs } = await import("./stale-job-recovery");
      await resetStaleProcessingJobs();
      this.lastStaleRecoveryCheck = new Date();
    } catch (err) {
      logger.error("Stale-job recovery error", err, "JobScheduler");
    }
  }

  /**
   * Job 18: Image backfill.
   *
   * Auto-regenerates AI images for blogs and studies that have NULL
   * imageUrl (or had a placeholder SVG that the boot-time cleanup
   * converted to NULL). Processes a small batch each cycle so the
   * AI cost stays predictable.
   */
  private async runImageBackfillJob() {
    try {
      if (this.lastImageBackfillCheck) {
        const elapsed = Date.now() - this.lastImageBackfillCheck.getTime();
        if (elapsed < this.IMAGE_BACKFILL_INTERVAL_MS) return;
      }
      const { runImageBackfillBatch } = await import("./image-backfill");
      await runImageBackfillBatch();
      this.lastImageBackfillCheck = new Date();
    } catch (err) {
      logger.error("Image backfill job error", err, "JobScheduler");
    }
  }

  /**
   * Job 22: Shopify customer reconciliation.
   *
   * Pulls all Shopify customers updated in the past 48h via the Admin
   * API and upserts each one through the same syncShopifyCustomerToUser
   * path the webhooks use. Idempotent: existing accounts are skipped.
   *
   * Why 48h: Shopify retries failed webhooks for up to 48h before
   * giving up. Pulling that window catches every webhook we MIGHT have
   * missed. Beyond 48h is the manual backfill's job.
   *
   * Skipped entirely when SHOPIFY_ACCESS_TOKEN isn't set — the admin
   * hasn't enabled the integration yet, so there's nothing to do.
   */
  private async runShopifyCustomerReconcileJob() {
    try {
      if (this.lastShopifyReconcileCheck) {
        const elapsed = Date.now() - this.lastShopifyReconcileCheck.getTime();
        if (elapsed < this.SHOPIFY_RECONCILE_INTERVAL_MS) return;
      }

      const { shopifyApiConfigured } = await import("./shopify-client");
      if (!shopifyApiConfigured()) {
        // No Shopify creds — silently skip and don't burn a check window.
        // We'll re-evaluate next tick.
        return;
      }

      const { backfillShopifyCustomers } = await import("./shopify-customer-sync");
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const summary = await backfillShopifyCustomers({ updatedAtMin: since });
      this.lastShopifyReconcileCheck = new Date();

      // Always log the result so we can see in Railway logs that the
      // job ran, even when nothing was reconciled. Useful evidence that
      // webhooks ARE catching everything (in steady state, created==0).
      logger.info("Shopify customer reconcile complete", "JobScheduler", {
        windowHours: 48,
        processed: summary.processed,
        created: summary.created,
        existed: summary.existed,
        errors: summary.errors,
        firstErrors: summary.firstErrors.length > 0 ? summary.firstErrors : undefined,
      });
    } catch (err) {
      logger.error("Shopify customer reconcile error", err, "JobScheduler");
    }
  }

  /**
   * Job 21: not_found_log cleanup.
   *
   * Daily prune of single-hit referrer-less entries older than 7 days
   * — the signature of bot/scanner probes that will never repeat. Real
   * user 404s either get hit more than once or carry a referrer from
   * the page that linked to them.
   */
  private async runNotFoundCleanupJob() {
    try {
      if (this.lastNotFoundCleanupCheck) {
        const elapsed = Date.now() - this.lastNotFoundCleanupCheck.getTime();
        if (elapsed < this.NOT_FOUND_CLEANUP_INTERVAL_MS) return;
      }
      const { cleanupBotProbes } = await import("./redirect-service");
      const result = await cleanupBotProbes();
      this.lastNotFoundCleanupCheck = new Date();
      if (result.deleted > 0) {
        logger.info("not_found_log cleanup complete", "JobScheduler", {
          deleted: result.deleted,
        });
      }
    } catch (err) {
      logger.error("not_found_log cleanup error", err, "JobScheduler");
    }
  }

  /**
   * Job 20: Redirect-suggestion backfill.
   *
   * Processes 100 unresolved 404 entries per cycle (~4,800/day at the
   * 30-min interval). Skips entries that already have a non-null
   * suggestions column, so a 16k cold-start backlog drains in ~3 days
   * and steady-state catches new 404s within a single cycle.
   *
   * Per-entry try/catch lives inside backfillSuggestions itself —
   * here we just need to swallow any whole-batch failure so the cron
   * keeps running.
   */
  private async runRedirectSuggestionBackfillJob() {
    const BATCH_SIZE = 100;
    try {
      if (this.lastRedirectSuggestionCheck) {
        const elapsed = Date.now() - this.lastRedirectSuggestionCheck.getTime();
        if (elapsed < this.REDIRECT_SUGGESTION_INTERVAL_MS) return;
      }
      const { backfillSuggestions } = await import("./redirect-service");
      const result = await backfillSuggestions(BATCH_SIZE);
      this.lastRedirectSuggestionCheck = new Date();
      if (result.processed > 0 || result.errors > 0) {
        logger.info("Redirect suggestion backfill complete", "JobScheduler", {
          processed: result.processed,
          suggested: result.suggested,
          autoPromoted: result.autoPromoted,
          errors: result.errors,
          firstError: result.firstError,
        });
      }
    } catch (err) {
      logger.error("Redirect suggestion backfill error", err, "JobScheduler");
    }
  }

  /**
   * Job 19: Google Analytics 4 sync.
   *
   * Mirrors GSC: pulls per-page engagement metrics + on-site search
   * terms. 90-day backfill on first run, 3-day incremental thereafter.
   * Skipped silently if no credentials are stored.
   */
  private async runGa4SyncJob() {
    try {
      if (this.lastGa4SyncCheck) {
        const elapsed = Date.now() - this.lastGa4SyncCheck.getTime();
        if (elapsed < this.GA4_SYNC_INTERVAL_MS) return;
      }
      const { syncGa4 } = await import("./ga4-service");
      const result = await syncGa4();
      this.lastGa4SyncCheck = new Date();
      if (!result.skipped) {
        logger.info("GA4 sync complete", "JobScheduler", {
          daysPulled: result.daysPulled,
          inserted: result.rowsInserted,
          updated: result.rowsUpdated,
        });
      }
    } catch (err) {
      logger.error("GA4 sync error", err, "JobScheduler");
    }
  }

  /**
   * Job 17: Google Search Console sync.
   *
   * Pulls the past 3 days of search-analytics data (90 days on first
   * run). Skipped silently if no credentials are stored — the admin
   * hasn't connected yet. Uses a manual elapsed check so the cron only
   * runs every 6h regardless of the parent scheduler tick rate.
   */
  private async runGscSyncJob() {
    try {
      if (this.lastGscSyncCheck) {
        const elapsed = Date.now() - this.lastGscSyncCheck.getTime();
        if (elapsed < this.GSC_SYNC_INTERVAL_MS) return;
      }
      const { syncSearchConsole } = await import("./gsc-service");
      const result = await syncSearchConsole();
      this.lastGscSyncCheck = new Date();
      if (!result.skipped) {
        logger.info("GSC sync complete", "JobScheduler", {
          daysPulled: result.daysPulled,
          inserted: result.rowsInserted,
          updated: result.rowsUpdated,
        });
      }
    } catch (err) {
      logger.error("GSC sync error", err, "JobScheduler");
    }
  }

  /**
   * Job 16: Scheduled blog publishing
   *
   * Promotes drafts whose scheduledFor timestamp has passed. Uses an indexed
   * query so the cost is constant in the size of the publish queue, not the
   * total blog count. Throttled to 15min (matches CHECK_INTERVAL_MS).
   */
  private async runScheduledPublishJob() {
    try {
      if (this.lastScheduledPublishCheck) {
        const elapsed = Date.now() - this.lastScheduledPublishCheck.getTime();
        if (elapsed < this.SCHEDULED_PUBLISH_INTERVAL_MS) return;
      }
      const { publishScheduledBlogs } = await import("./blog-lifecycle");
      await publishScheduledBlogs();
      this.lastScheduledPublishCheck = new Date();
    } catch (err) {
      logger.error("Scheduled-publish job error", err, "JobScheduler");
    }
  }

  /**
   * Job 15: Study quality scoring
   *
   * Runs once per day. Finds studies that need rescoring (never scored,
   * stale rubric version, content updated since last score, score older
   * than 180 days, or full text newly available) and batch-scores up to
   * 20 at a time. Tiered AI means borderline studies take ~2x the cost,
   * which is why we cap at 20 — single-digit-dollar daily budget.
   *
   * Drops the old "admin clicks batch-score manually" pattern; the admin
   * UI now shows scores on every study within a day of being added.
   */
  private async runStudyScoringJob() {
    const BATCH_SIZE = 20;

    try {
      if (this.lastStudyScoringCheck) {
        const elapsed = Date.now() - this.lastStudyScoringCheck.getTime();
        if (elapsed < this.STUDY_SCORING_INTERVAL_MS) return;
      }

      const { studyScoringService, ensureScoringColumns } = await import("./study-scoring-service");

      // Make sure the score-related columns exist before we try to write
      // (idempotent — cheap no-op after the first run).
      await ensureScoringColumns();

      const targetIds = await studyScoringService.findStudiesNeedingRescore(BATCH_SIZE);
      if (targetIds.length === 0) {
        this.lastStudyScoringCheck = new Date();
        return;
      }

      logger.info("Starting nightly study scoring", "JobScheduler", {
        candidates: targetIds.length,
      });

      const results = await studyScoringService.batchScoreStudies(targetIds);
      this.lastStudyScoringCheck = new Date();

      logger.info("Study scoring complete", "JobScheduler", {
        processed: targetIds.length,
        scored: results.size,
      });
    } catch (error) {
      logger.error("Study scoring job error", error, "JobScheduler");
    }
  }

  /**
   * Job 14: Journal publication-date backfill
   * Runs once per day. Finds studies that have a DOI but no journalPublishDate
   * and fills it in from CrossRef / Europe PMC / doi.org. Processes up to
   * 100 studies per run. Replaces the deleted JournalDateUpdater admin page —
   * admins no longer need to click a button.
   */
  private async runJournalDateBackfillJob() {
    try {
      if (this.lastJournalDateCheck) {
        const elapsed = Date.now() - this.lastJournalDateCheck.getTime();
        if (elapsed < this.JOURNAL_DATE_INTERVAL_MS) return;
      }

      const { updateJournalPublicationDates } = await import("./journal-date-updater");
      const result = await updateJournalPublicationDates(100);
      this.lastJournalDateCheck = new Date();

      if (result.totalUpdated > 0 || result.failedDois.length > 0) {
        logger.info("Journal date backfill complete", "JobScheduler", {
          updated: result.totalUpdated,
          failed: result.failedDois.length,
        });
      }
    } catch (error) {
      logger.error("Journal date backfill error", error, "JobScheduler");
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
    const MAX_BLOGS_PER_CYCLE = 50; // Aggressive rebuild — baseline content recovery

    try {
      // Throttle: only run every BLOG_GENERATION_INTERVAL_MS (not every scheduler tick)
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
              // Note: `firstAuthor`/`lastAuthor`/`otherAuthors` columns do
              // not exist in the studies table. The single `authors` string
              // is the source of truth.
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
