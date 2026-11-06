/**
 * Run the echowater.com evidence metafield sync (TRUST-BADGE-PLAN 2.1).
 *   npx tsx scripts/research/sync-evidence-metafields.ts [--dry-run]
 */
import { syncEvidenceMetafields } from "../../server/services/evidence-metafield-sync";

syncEvidenceMetafields({ dryRun: process.argv.includes("--dry-run") })
  .then((r) => {
    for (const x of r) console.log(`${x.slug.padEnd(24)} ${x.action.padEnd(8)} ${x.detail ?? ""}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
