/**
 * Scraper status tracker
 * 
 * This module tracks the status of scraper operations to provide feedback to users
 */

export interface ScraperProgress {
  total: number;         // Total number of items to process
  processed: number;     // Number of items processed so far
  successful: number;    // Number of successfully processed items
  failed: number;        // Number of failed items
  startTime: Date;       // When the scraper started
  lastUpdateTime: Date;  // Last time the status was updated
  isRunning: boolean;    // Whether the scraper is currently running
  estimatedTimeRemaining: number; // Estimated seconds remaining
  error?: string;        // Error message if something went wrong
  source: string;        // Source being scraped (e.g., "hydrogen-studies", "pubmed")
}

// Global status object for the scraper
const scraperStatus: ScraperProgress = {
  total: 0,
  processed: 0,
  successful: 0,
  failed: 0,
  startTime: new Date(),
  lastUpdateTime: new Date(),
  isRunning: false,
  estimatedTimeRemaining: 0,
  source: ''
};

/**
 * Initialize a new scraper run
 */
export function initScraperStatus(source: string, totalItems: number = 0): void {
  scraperStatus.total = totalItems;
  scraperStatus.processed = 0;
  scraperStatus.successful = 0;
  scraperStatus.failed = 0;
  scraperStatus.startTime = new Date();
  scraperStatus.lastUpdateTime = new Date();
  scraperStatus.isRunning = true;
  scraperStatus.estimatedTimeRemaining = 0;
  scraperStatus.error = undefined;
  scraperStatus.source = source;
}

/**
 * Update the scraper progress
 */
export function updateScraperProgress(
  processed: number, 
  successful: number,
  failed: number,
  total?: number
): void {
  if (total !== undefined) {
    scraperStatus.total = total;
  }
  
  scraperStatus.processed = processed;
  scraperStatus.successful = successful;
  scraperStatus.failed = failed;
  const now = new Date();
  scraperStatus.lastUpdateTime = now;
  
  // Calculate estimated time remaining
  if (processed > 0 && scraperStatus.total > 0) {
    const elapsedMs = now.getTime() - scraperStatus.startTime.getTime();
    const msPerItem = elapsedMs / processed;
    const remainingItems = scraperStatus.total - processed;
    const estimatedRemainingMs = msPerItem * remainingItems;
    scraperStatus.estimatedTimeRemaining = Math.round(estimatedRemainingMs / 1000);
  }
}

/**
 * Mark the scraper as completed
 */
export function completeScraperStatus(error?: string): void {
  scraperStatus.isRunning = false;
  scraperStatus.estimatedTimeRemaining = 0;
  scraperStatus.lastUpdateTime = new Date();
  if (error) {
    scraperStatus.error = error;
  }
}

/**
 * Get the current scraper status
 */
export function getScraperStatus(): ScraperProgress {
  return { ...scraperStatus };
}

/**
 * Get a formatted description of the scraper's progress
 */
export function getScraperProgressDescription(): string {
  if (!scraperStatus.isRunning && scraperStatus.processed === 0) {
    return 'No scraper has been run yet.';
  }
  
  if (scraperStatus.error) {
    return `Scraper encountered an error: ${scraperStatus.error}`;
  }
  
  const percentComplete = scraperStatus.total > 0 
    ? Math.round((scraperStatus.processed / scraperStatus.total) * 100) 
    : 0;
  
  let timeRemaining = '';
  if (scraperStatus.isRunning && scraperStatus.estimatedTimeRemaining > 0) {
    if (scraperStatus.estimatedTimeRemaining > 60) {
      const minutes = Math.floor(scraperStatus.estimatedTimeRemaining / 60);
      const seconds = scraperStatus.estimatedTimeRemaining % 60;
      timeRemaining = ` (estimated ${minutes}m ${seconds}s remaining)`;
    } else {
      timeRemaining = ` (estimated ${scraperStatus.estimatedTimeRemaining}s remaining)`;
    }
  }
  
  if (scraperStatus.isRunning) {
    return `Scraping ${scraperStatus.source}: ${scraperStatus.processed} of ${scraperStatus.total} processed (${percentComplete}% complete)${timeRemaining}. ${scraperStatus.successful} studies imported successfully.`;
  } else {
    return `Completed scraping ${scraperStatus.source}: ${scraperStatus.successful} studies imported successfully out of ${scraperStatus.total} discovered.`;
  }
}