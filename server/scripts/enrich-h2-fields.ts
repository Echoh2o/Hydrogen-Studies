/**
 * CLI Script: Enrich H2-specific fields for studies
 *
 * Usage:
 *   npx tsx server/scripts/enrich-h2-fields.ts
 *   npx tsx server/scripts/enrich-h2-fields.ts --batch 50
 */

import { enrichH2Fields } from "../services/h2-field-enrichment";

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
  console.log(`Starting H2 field enrichment (batch size: ${batchSize})...`);
  console.log("---");

  const stats = await enrichH2Fields(batchSize);

  console.log("---");
  console.log("H2 Field Enrichment Results:");
  console.log(`  Processed: ${stats.totalProcessed}`);
  console.log(`  Enriched:  ${stats.enriched}`);
  console.log(`  Errors:    ${stats.errors}`);
  console.log(`  Duration:  ${((Date.now() - stats.startTime.getTime()) / 1000).toFixed(1)}s`);

  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
