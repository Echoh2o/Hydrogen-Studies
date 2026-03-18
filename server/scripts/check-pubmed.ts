/**
 * CLI script to run the Research Discovery Engine (including PubMed).
 *
 * Usage:
 *   npx tsx server/scripts/check-pubmed.ts
 *   npx tsx server/scripts/check-pubmed.ts --query "hydrogen therapy cancer"
 */

import { runDiscovery } from "../services/research-discovery-engine";

async function main() {
  const args = process.argv.slice(2);
  let customQuery: string | undefined;

  // Parse --query argument
  const queryIdx = args.indexOf("--query");
  if (queryIdx !== -1 && args[queryIdx + 1]) {
    customQuery = args[queryIdx + 1];
  }

  if (customQuery) {
    console.log(`Running discovery with custom query: "${customQuery}"`);
  } else {
    console.log("Running discovery with rotating query set...");
  }

  console.log("Searching CrossRef, Europe PMC, and PubMed...\n");

  try {
    const result = await runDiscovery(customQuery);

    console.log("\n=== Discovery Run Complete ===");
    console.log(`  Run ID:      ${result.runId}`);
    console.log(`  Found:       ${result.found}`);
    console.log(`  New:         ${result.new}`);
    console.log(`  Duplicates:  ${result.duplicates}`);
    console.log(`  Queued:      ${result.queued}`);
    console.log("==============================\n");

    process.exit(0);
  } catch (error) {
    console.error("Discovery run failed:", error);
    process.exit(1);
  }
}

main();
