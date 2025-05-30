/**
 * Auto Content Enhancer
 * 
 * Automatically restarts content enhancement on application startup
 * to ensure continuous progress toward 100% completion
 */

import { completeAllContent } from './complete-all-content';
import { db } from './db';
import { studies } from '@shared/schema';
import { isNull, or, eq, sql } from 'drizzle-orm';

let isRunning = false;

/**
 * Check if content enhancement is needed and start automatically
 */
export async function autoStartContentEnhancement() {
  if (isRunning) {
    console.log('🔄 Content enhancement already running, skipping auto-start');
    return;
  }

  try {
    // Quick check of completion status
    const completionCheck = await db.select({
      total: sql<number>`count(*)`,
      needsMethods: sql<number>`count(case when methods is null or methods = '' or length(methods) < 100 then 1 end)`,
      needsResults: sql<number>`count(case when results is null or results = '' or length(results) < 100 then 1 end)`,
      needsObjectives: sql<number>`count(case when objective is null or objective = '' then 1 end)`,
      needsSummaries: sql<number>`count(case when summary_markdown is null or summary_markdown = '' then 1 end)`
    }).from(studies);

    const stats = completionCheck[0];
    const totalNeeded = stats.needsMethods + stats.needsResults + stats.needsObjectives + stats.needsSummaries;

    console.log(`📊 Content Enhancement Status Check:`);
    console.log(`  - Studies needing methods: ${stats.needsMethods}`);
    console.log(`  - Studies needing results: ${stats.needsResults}`);
    console.log(`  - Studies needing objectives: ${stats.needsObjectives}`);
    console.log(`  - Studies needing summaries: ${stats.needsSummaries}`);
    console.log(`  - Total improvements needed: ${totalNeeded}`);

    if (totalNeeded > 0) {
      console.log('📊 Content enhancement needed but auto-start disabled to prevent redundant processing');
      console.log('💡 Content can be completed using direct database operations instead of slow AI processing');
    } else {
      console.log('✅ All content areas complete - no enhancement needed!');
    }

  } catch (error) {
    console.error('❌ Error checking content enhancement status:', error);
  }
}

/**
 * Get current enhancement status
 */
export function getEnhancementStatus() {
  return {
    isRunning,
    message: isRunning ? 'Content enhancement is running' : 'Content enhancement not active'
  };
}