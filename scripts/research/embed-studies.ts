/**
 * Bulk-embed live studies for MCP meaning-based search (study_embeddings,
 * migration 027) with the in-process bge-small model. Re-embeds only studies
 * whose text changed (content hash); safe to re-run. The web process tops up
 * new studies on its own in small batches — this is for the initial fill and
 * model changes.
 *
 *   railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/research/embed-studies.ts [--dry-run]'
 */
import { syncEmbeddings } from "../../server/services/study-embeddings";

const started = Date.now();
syncEmbeddings({ dryRun: process.argv.includes("--dry-run") })
  .then((r) => {
    console.log(`${process.argv.includes("--dry-run") ? "[dry-run] " : ""}embedded ${r.embedded}, pending ${r.pending} (${Math.round((Date.now() - started) / 1000)}s)`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
