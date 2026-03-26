/**
 * CLI Script: Enrich studies with consumer-facing summary fields
 *
 * Usage:
 *   npx tsx server/scripts/enrich-study-summaries.ts
 *   npx tsx server/scripts/enrich-study-summaries.ts --batch 50
 */

import { enrichStudySummaries } from "../services/study-summary-enrichment";

function parseBatchSize(): number {
  const args = process.argv.slice(2);
  const batchIdx = args.indexOf("--batch");
  if (batchIdx !== -1 && args[batchIdx + 1]) {
    const size = parseInt(args[batchIdx + 1], 10);
    if (!isNaN(size) && size > 0) {
      return size;
    }
    console.warn(`Invalid batch size "${args[batchIdx + 1]}", using default 20.`);
  }
  return 20;
}

async function main() {
  const batchSize = parseBatchSize();
  console.log(`Starting study summary enrichment (batch size: ${batchSize})...`);
  console.log("---");

  const stats = await enrichStudySummaries(batchSize);

  console.log("---");
  console.log("Study Summary Enrichment Results:");
  console.log(`  Processed: ${stats.totalProcessed}`);
  console.log(`  Enriched:  ${stats.enriched}`);
  console.log(`  Skipped:   ${stats.skipped}`);
  console.log(`  Errors:    ${stats.errors}`);
  console.log(`  Duration:  ${((Date.now() - stats.startTime.getTime()) / 1000).toFixed(1)}s`);

  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
