/**
 * One-shot CLI: pull every Shopify customer and create the matching
 * hydrogenstudies.com account.
 *
 * Run:
 *   npx tsx server/scripts/backfill-shopify-customers.ts
 *
 * Optional flags:
 *   --since=2024-01-01      Only customers updated after this date
 *   --max=500               Cap at N customers (useful for dry runs)
 *
 * Idempotent: existing customers (matched by email) are silently
 * skipped. Safe to re-run after a failed/aborted run — it just
 * re-walks Shopify and the dedup logic short-circuits each one.
 */

import { backfillShopifyCustomers } from "../services/shopify-customer-sync";

function parseArgs(): { since?: Date; max?: number } {
  const args: { since?: Date; max?: number } = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--since=")) {
      const d = new Date(arg.slice("--since=".length));
      if (!isNaN(d.getTime())) args.since = d;
    } else if (arg.startsWith("--max=")) {
      const n = parseInt(arg.slice("--max=".length), 10);
      if (!isNaN(n) && n > 0) args.max = n;
    }
  }
  return args;
}

async function main() {
  const { since, max } = parseArgs();
  const start = Date.now();

  console.log("Shopify customer backfill starting…");
  if (since) console.log(`  filter: updated_at >= ${since.toISOString()}`);
  if (max) console.log(`  cap: ${max} customers`);
  console.log("");

  try {
    const summary = await backfillShopifyCustomers({
      updatedAtMin: since,
      maxCustomers: max,
      progressEvery: 50,
      onProgress: (s) => {
        process.stdout.write(
          `  …processed ${s.processed} (created ${s.created}, existed ${s.existed}, errors ${s.errors})\n`,
        );
      },
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log("");
    console.log("Done.");
    console.log(`  Processed:  ${summary.processed}`);
    console.log(`  Created:    ${summary.created}`);
    console.log(`  Already existed: ${summary.existed}`);
    console.log(`  Skipped:    ${summary.skipped}`);
    console.log(`  Errors:     ${summary.errors}`);
    console.log(`  Elapsed:    ${elapsed}s`);
    if (summary.firstErrors.length > 0) {
      console.log("");
      console.log("First errors:");
      for (const e of summary.firstErrors) console.log(`  - ${e}`);
    }
    process.exit(summary.errors > 0 && summary.created === 0 ? 1 : 0);
  } catch (err) {
    console.error("");
    console.error("Backfill failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
