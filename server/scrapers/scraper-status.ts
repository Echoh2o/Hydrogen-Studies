/**
 * Scraper status tracking module
 * 
 * This module helps track the progress of web scrapers and provides status information
 * that can be accessed via API endpoints, allowing the frontend to show progress bars
 * and estimated completion times.
 */

// Status object for each scraper job
interface ScraperStatus {
  id: string;           // Unique identifier for the scraper job
  status: 'pending' | 'running' | 'completed' | 'failed';  // Current status
  startTime: Date;      // When the scraper started
  endTime?: Date;       // When the scraper finished (if completed or failed)
  totalItems: number;   // Total number of items to scrape
  processedItems: number; // Number of items processed so far
  successItems: number;   // Number of items successfully scraped
  failedItems: number;    // Number of items that failed to scrape
  message?: string;       // Status message or error message
  currentStep?: string;   // Current step in the scraping process
  estimatedTimeRemaining?: number; // Estimated time remaining in seconds
}

// In-memory storage for scraper statuses
const scraperStatuses: Record<string, ScraperStatus> = {};

/**
 * Initialize a new scraper status tracking
 * @param id Unique identifier for the scraper job
 * @param totalItems Optional initial count of total items
 */
export function initScraperStatus(id: string, totalItems: number = 0): ScraperStatus {
  const status: ScraperStatus = {
    id,
    status: 'running',
    startTime: new Date(),
    totalItems,
    processedItems: 0,
    successItems: 0,
    failedItems: 0,
    currentStep: 'Initializing scraper'
  };
  
  scraperStatuses[id] = status;
  return status;
}

/**
 * Update the progress of a scraper
 * @param processedItems Number of items processed
 * @param successItems Number of successful items
 * @param failedItems Number of failed items
 * @param totalItems Total number of items (if known)
 * @param currentStep Current step description
 */
export function updateScraperProgress(
  processedItems: number,
  successItems: number,
  failedItems: number,
  totalItems?: number,
  currentStep?: string
): void {
  // Get the most recent scraper status (assume it's the only one running)
  const statusId = Object.keys(scraperStatuses).find(
    id => scraperStatuses[id].status === 'running'
  );
  
  if (!statusId) {
    console.warn('No running scraper found when updating progress');
    return;
  }
  
  const status = scraperStatuses[statusId];
  
  // Update the status object
  status.processedItems = processedItems;
  status.successItems = successItems;
  status.failedItems = failedItems;
  
  if (totalItems !== undefined) {
    status.totalItems = totalItems;
  }
  
  if (currentStep) {
    status.currentStep = currentStep;
  }
  
  // Calculate estimated time remaining
  if (status.totalItems > 0 && processedItems > 0) {
    const elapsedMs = new Date().getTime() - status.startTime.getTime();
    const msPerItem = elapsedMs / processedItems;
    const remainingItems = status.totalItems - processedItems;
    const estimatedRemainingMs = remainingItems * msPerItem;
    
    status.estimatedTimeRemaining = Math.round(estimatedRemainingMs / 1000);
  }
}

/**
 * Mark a scraper as complete
 * @param errorMessage Optional error message if the scraper failed
 */
export function completeScraperStatus(errorMessage?: string): void {
  // Get the most recent scraper status (assume it's the only one running)
  const statusId = Object.keys(scraperStatuses).find(
    id => scraperStatuses[id].status === 'running'
  );
  
  if (!statusId) {
    console.warn('No running scraper found when marking as complete');
    return;
  }
  
  const status = scraperStatuses[statusId];
  
  // Update the status object
  status.endTime = new Date();
  status.status = errorMessage ? 'failed' : 'completed';
  
  if (errorMessage) {
    status.message = errorMessage;
  } else {
    const durationMs = status.endTime.getTime() - status.startTime.getTime();
    const durationSec = Math.round(durationMs / 1000);
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    
    status.message = `Completed in ${minutes}m ${seconds}s - ${status.successItems} successful, ${status.failedItems} failed`;
  }
  
  status.estimatedTimeRemaining = 0;
}

/**
 * Get the status of a specific scraper
 * @param id Scraper job identifier
 */
export function getScraperStatus(id: string): ScraperStatus | null {
  return scraperStatuses[id] || null;
}

/**
 * Get all scraper statuses
 */
export function getAllScraperStatuses(): ScraperStatus[] {
  return Object.values(scraperStatuses);
}

/**
 * Clean up old completed scraper statuses (older than 24 hours)
 */
export function cleanupOldScraperStatuses(): void {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  
  for (const id in scraperStatuses) {
    const status = scraperStatuses[id];
    if (
      (status.status === 'completed' || status.status === 'failed') &&
      status.endTime &&
      status.endTime < oneDayAgo
    ) {
      delete scraperStatuses[id];
    }
  }
}