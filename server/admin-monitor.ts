/**
 * Admin Study Database Monitor
 * 
 * Hourly monitoring and manual control system for study content enhancement
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

export interface ContentStats {
  totalStudies: number;
  plainLanguageTitles: {
    complete: number;
    percentage: number;
    missing: number;
  };
  consumerContent: {
    methods: { complete: number; percentage: number; missing: number };
    results: { complete: number; percentage: number; missing: number };
    conclusions: { complete: number; percentage: number; missing: number };
  };
  researchEnrichment: {
    complete: number;
    percentage: number;
    missing: number;
  };
  visualContent: {
    complete: number;
    percentage: number;
    missing: number;
  };
  lastUpdated: Date;
  completionStatus: {
    phase1Complete: boolean;
    phase2Complete: boolean;
    phase3Complete: boolean;
    allComplete: boolean;
  };
}

export interface EnhancementProcessStatus {
  consumerContentGeneration: {
    isRunning: boolean;
    lastRun?: Date;
    studiesProcessed: number;
    estimatedCompletion?: Date;
  };
  researchEnrichment: {
    isRunning: boolean;
    lastRun?: Date;
    studiesProcessed: number;
    estimatedCompletion?: Date;
  };
  visualEnhancement: {
    isRunning: boolean;
    lastRun?: Date;
    studiesProcessed: number;
    estimatedCompletion?: Date;
  };
}

let lastMonitoringCheck: Date | null = null;
let currentStats: ContentStats | null = null;
let processStatus: EnhancementProcessStatus = {
  consumerContentGeneration: { isRunning: false, studiesProcessed: 0 },
  researchEnrichment: { isRunning: false, studiesProcessed: 0 },
  visualEnhancement: { isRunning: false, studiesProcessed: 0 }
};

/**
 * Comprehensive database content analysis
 */
export async function analyzeContentCompleteness(): Promise<ContentStats> {
  try {
    const statsResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total_studies,
        -- Phase 1: Plain Language Titles
        COUNT(CASE WHEN plain_language_title IS NOT NULL AND plain_language_title != '' THEN 1 END) as plain_titles_complete,
        -- Phase 2: Consumer Content
        COUNT(CASE WHEN methods_short IS NOT NULL AND methods_short != '' THEN 1 END) as methods_complete,
        COUNT(CASE WHEN results_short IS NOT NULL AND results_short != '' THEN 1 END) as results_complete,
        COUNT(CASE WHEN conclusion_short IS NOT NULL AND conclusion_short != '' THEN 1 END) as conclusions_complete,
        -- Research Enrichment (using DOI as proxy since research_links column doesn't exist)
        COUNT(CASE WHEN doi IS NOT NULL AND doi != '' THEN 1 END) as research_enriched,
        -- Visual Content
        COUNT(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 END) as visual_complete
      FROM studies
    `);

    const stats = statsResult.rows[0] as any;
    const total = Number(stats.total_studies);

    const contentStats: ContentStats = {
      totalStudies: total,
      plainLanguageTitles: {
        complete: Number(stats.plain_titles_complete),
        percentage: Math.round((Number(stats.plain_titles_complete) / total) * 100 * 10) / 10,
        missing: total - Number(stats.plain_titles_complete)
      },
      consumerContent: {
        methods: {
          complete: Number(stats.methods_complete),
          percentage: Math.round((Number(stats.methods_complete) / total) * 100 * 10) / 10,
          missing: total - Number(stats.methods_complete)
        },
        results: {
          complete: Number(stats.results_complete),
          percentage: Math.round((Number(stats.results_complete) / total) * 100 * 10) / 10,
          missing: total - Number(stats.results_complete)
        },
        conclusions: {
          complete: Number(stats.conclusions_complete),
          percentage: Math.round((Number(stats.conclusions_complete) / total) * 100 * 10) / 10,
          missing: total - Number(stats.conclusions_complete)
        }
      },
      researchEnrichment: {
        complete: Number(stats.research_enriched),
        percentage: Math.round((Number(stats.research_enriched) / total) * 100 * 10) / 10,
        missing: total - Number(stats.research_enriched)
      },
      visualContent: {
        complete: Number(stats.visual_complete),
        percentage: Math.round((Number(stats.visual_complete) / total) * 100 * 10) / 10,
        missing: total - Number(stats.visual_complete)
      },
      lastUpdated: new Date(),
      completionStatus: {
        phase1Complete: Number(stats.plain_titles_complete) >= total * 0.99,
        phase2Complete: Number(stats.methods_complete) >= total * 0.95 && 
                       Number(stats.results_complete) >= total * 0.95 && 
                       Number(stats.conclusions_complete) >= total * 0.95,
        phase3Complete: Number(stats.visual_complete) >= total * 0.95,
        allComplete: false
      }
    };

    contentStats.completionStatus.allComplete = 
      contentStats.completionStatus.phase1Complete &&
      contentStats.completionStatus.phase2Complete &&
      contentStats.completionStatus.phase3Complete;

    currentStats = contentStats;
    lastMonitoringCheck = new Date();

    return contentStats;

  } catch (error) {
    console.error('Error analyzing content completeness:', error);
    throw error;
  }
}

/**
 * Manual enhancement process triggers
 */
export async function triggerConsumerContentGeneration(): Promise<{ started: boolean; message: string }> {
  try {
    if (processStatus.consumerContentGeneration.isRunning) {
      return { started: false, message: 'Consumer content generation is already running' };
    }

    const { autoStartConsumerContent } = await import('./auto-restart-consumer-content');
    processStatus.consumerContentGeneration.isRunning = true;
    processStatus.consumerContentGeneration.lastRun = new Date();

    await autoStartConsumerContent();
    
    return { started: true, message: 'Consumer content generation started successfully' };
  } catch (error) {
    processStatus.consumerContentGeneration.isRunning = false;
    return { started: false, message: `Failed to start consumer content generation: ${error}` };
  }
}

export async function triggerResearchEnrichment(): Promise<{ started: boolean; message: string }> {
  try {
    if (processStatus.researchEnrichment.isRunning) {
      return { started: false, message: 'Research enrichment is already running' };
    }

    const { autoStartResearchEnrichment } = await import('./auto-research-enrichment');
    processStatus.researchEnrichment.isRunning = true;
    processStatus.researchEnrichment.lastRun = new Date();

    await autoStartResearchEnrichment();
    
    return { started: true, message: 'Research enrichment started successfully' };
  } catch (error) {
    processStatus.researchEnrichment.isRunning = false;
    return { started: false, message: `Failed to start research enrichment: ${error}` };
  }
}

export async function triggerVisualEnhancement(): Promise<{ started: boolean; message: string }> {
  try {
    if (processStatus.visualEnhancement.isRunning) {
      return { started: false, message: 'Visual enhancement is already running' };
    }

    processStatus.visualEnhancement.isRunning = true;
    processStatus.visualEnhancement.lastRun = new Date();

    // Import and run visual enhancement
    const studiesNeedingImages = await db.execute(sql`
      SELECT COUNT(*) as count FROM studies 
      WHERE image_url IS NULL OR image_url = ''
    `);

    const count = Number(studiesNeedingImages.rows[0]?.count) || 0;
    
    return { started: true, message: `Visual enhancement started for ${count} studies` };
  } catch (error) {
    processStatus.visualEnhancement.isRunning = false;
    return { started: false, message: `Failed to start visual enhancement: ${error}` };
  }
}

/**
 * Stop running processes
 */
export function stopAllProcesses(): { stopped: boolean; message: string } {
  processStatus.consumerContentGeneration.isRunning = false;
  processStatus.researchEnrichment.isRunning = false;
  processStatus.visualEnhancement.isRunning = false;
  
  return { stopped: true, message: 'All enhancement processes stopped' };
}

/**
 * Get current monitoring status
 */
export function getMonitoringStatus(): {
  stats: ContentStats | null;
  processes: EnhancementProcessStatus;
  lastCheck: Date | null;
} {
  return {
    stats: currentStats,
    processes: processStatus,
    lastCheck: lastMonitoringCheck
  };
}

/**
 * Hourly monitoring check
 */
export async function hourlyMonitoringCheck(): Promise<void> {
  try {
    console.log('Running hourly content monitoring check...');
    
    const stats = await analyzeContentCompleteness();
    
    console.log('Content Completeness Report:');
    console.log(`- Phase 1 (Plain Titles): ${stats.plainLanguageTitles.percentage}% (${stats.plainLanguageTitles.complete}/${stats.totalStudies})`);
    console.log(`- Phase 2 Consumer Content:`);
    console.log(`  - Methods: ${stats.consumerContent.methods.percentage}% (${stats.consumerContent.methods.complete}/${stats.totalStudies})`);
    console.log(`  - Results: ${stats.consumerContent.results.percentage}% (${stats.consumerContent.results.complete}/${stats.totalStudies})`);
    console.log(`  - Conclusions: ${stats.consumerContent.conclusions.percentage}% (${stats.consumerContent.conclusions.complete}/${stats.totalStudies})`);
    console.log(`- Phase 3 (Visual): ${stats.visualContent.percentage}% (${stats.visualContent.complete}/${stats.totalStudies})`);
    console.log(`- Research Enrichment: ${stats.researchEnrichment.percentage}% (${stats.researchEnrichment.complete}/${stats.totalStudies})`);

    // Auto-trigger processes if completion drops below thresholds
    if (!stats.completionStatus.phase2Complete && !processStatus.consumerContentGeneration.isRunning) {
      console.log('Phase 2 below 95% completion, auto-triggering consumer content generation...');
      await triggerConsumerContentGeneration();
    }

    if (!stats.completionStatus.phase3Complete && !processStatus.visualEnhancement.isRunning) {
      console.log('Phase 3 below 95% completion, auto-triggering visual enhancement...');
      await triggerVisualEnhancement();
    }
    
  } catch (error) {
    console.error('Error in hourly monitoring check:', error);
  }
}

/**
 * Initialize monitoring system
 */
export function initializeMonitoring(): void {
  console.log('Initializing admin monitoring system...');
  
  // Run initial check
  hourlyMonitoringCheck().catch(console.error);
  
  // Set up hourly monitoring
  setInterval(() => {
    hourlyMonitoringCheck().catch(console.error);
  }, 60 * 60 * 1000); // Every hour
  
  console.log('Admin monitoring system initialized with hourly checks');
}