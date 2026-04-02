/**
 * Bulk Content Regeneration Script
 *
 * Run after a database reset to regenerate all content from studies.
 * Executes in phases with progress tracking and error recovery.
 *
 * Usage: railway run npx tsx server/scripts/regenerate-content.ts [--phase N] [--start-id N] [--dry-run]
 *
 * Phases:
 *   1. SEO enrichment (meta titles, descriptions, schema.org, health conditions, keywords)
 *   2. Blog generation (3 articles per study: science_explainer, practical_guide, faq)
 *   3. Internal link building (study-to-study and blog-to-blog cross-links)
 *   4. Keyword strategy seeding (generate monitoring keywords from study topics)
 *
 * Cost estimate: ~$60-90 for 1,700 studies (Sonnet pricing)
 */

import { db } from "../db";
import { studies } from "@shared/schema";
import { desc, gt, count, isNull } from "drizzle-orm";

// Parse CLI args
const args = process.argv.slice(2);
const startPhase = parseInt(args.find(a => a.startsWith("--phase="))?.split("=")[1] || "1");
const startId = parseInt(args.find(a => a.startsWith("--start-id="))?.split("=")[1] || "0");
const dryRun = args.includes("--dry-run");
const blogOnly = args.includes("--blogs-only");
const seoOnly = args.includes("--seo-only");
const linksOnly = args.includes("--links-only");
const imagesOnly = args.includes("--images-only");

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// PHASE 1: SEO Enrichment
// ============================================================
async function phase1_seoEnrichment() {
  log("═══ PHASE 1: SEO Enrichment ═══");

  const { batchEnrichStudies } = await import("../services/study-seo-enrichment");

  let totalSuccess = 0;
  let totalFailed = 0;
  let batch = 1;

  // Run in batches until no more candidates
  while (true) {
    log(`  Batch ${batch}...`);

    const result = await batchEnrichStudies({
      batchSize: 5,
      delayMs: 1500,
      onProgress: (done, total, studyId) => {
        if (done % 5 === 0 || done === total) {
          log(`    Progress: ${done}/${total} (study #${studyId})`);
        }
      },
    });

    totalSuccess += result.success;
    totalFailed += result.failed;

    log(`  Batch ${batch} done: ${result.success} enriched, ${result.failed} failed, ${result.total} total`);

    // Stop when no more studies to enrich
    if (result.total === 0) break;

    batch++;
    await sleep(2000); // Pause between batches
  }

  log(`✓ Phase 1 complete: ${totalSuccess} studies enriched, ${totalFailed} failed`);
  return { enriched: totalSuccess, errors: totalFailed };
}

// ============================================================
// PHASE 2: Blog Generation
// ============================================================
async function phase2_blogGeneration() {
  log("═══ PHASE 2: Blog Generation (3 articles per study) ═══");

  const { generateBlogArticlesForStudy } = await import("../services/blog-generator-enhanced");
  const { studyService } = await import("../services/study-service");

  // Get total study count
  const countResult = await db.select({ value: count() }).from(studies);
  const totalStudies = countResult[0]?.value || 0;
  log(`  Total studies: ${totalStudies}`);

  let totalGenerated = 0;
  let totalErrors = 0;
  let totalSkipped = 0;
  let page = 1;
  const pageSize = 20;

  while (true) {
    const batch = await studyService.getStudies({
      page,
      pageSize,
      sortBy: "id",
      sortOrder: "asc",
    });

    if (batch.data.length === 0) break;

    for (const study of batch.data) {
      // Skip if we have a start-id and haven't reached it yet
      if (startId > 0 && study.id < startId) continue;

      try {
        log(`  [${totalGenerated + totalSkipped + totalErrors + 1}/${totalStudies}] Study #${study.id}: ${study.title?.substring(0, 60)}...`);

        if (dryRun) {
          log(`    [DRY RUN] Would generate 3 blogs`);
          totalSkipped++;
          continue;
        }

        const result = await generateBlogArticlesForStudy(study, {
          count: 3,
          fallbackToBasic: true,
        });

        totalGenerated += result.articles.length;
        totalErrors += result.errors.length;

        if (result.errors.length > 0) {
          log(`    ⚠ ${result.articles.length} generated, ${result.errors.length} errors: ${result.errors.map(e => e.type).join(", ")}`);
        }

        // Rate limit: wait between studies to avoid API throttling
        await sleep(3000);

      } catch (err: any) {
        totalErrors++;
        log(`    ✗ Failed: ${err.message?.substring(0, 80)}`);
        // Continue to next study — don't let one failure stop the batch
        await sleep(2000);
      }
    }

    page++;
    log(`  Page ${page - 1} complete. Generated: ${totalGenerated}, Errors: ${totalErrors}`);
  }

  log(`✓ Phase 2 complete: ${totalGenerated} blogs generated, ${totalErrors} errors, ${totalSkipped} skipped`);
  return { generated: totalGenerated, errors: totalErrors };
}

// ============================================================
// PHASE 3: Internal Link Building
// ============================================================
async function phase3_linkBuilding() {
  log("═══ PHASE 3: Internal Link Building ═══");

  const { buildAllStudyLinks, buildAllBlogLinks } = await import("../services/internal-linking-engine");

  log("  Building study-to-study links...");
  const studyLinks = await buildAllStudyLinks({
    batchSize: 100,
    onProgress: (done, total) => {
      if (done % 100 === 0 || done === total) {
        log(`    Study links: ${done}/${total}`);
      }
    },
  });
  log(`  Study links: ${studyLinks.processed} studies processed, ${studyLinks.linksCreated} links created`);

  log("  Building blog-to-blog links...");
  const blogLinks = await buildAllBlogLinks({
    batchSize: 100,
    onProgress: (done, total) => {
      if (done % 100 === 0 || done === total) {
        log(`    Blog links: ${done}/${total}`);
      }
    },
  });
  log(`  Blog links: ${blogLinks.processed} blogs processed, ${blogLinks.linksCreated} links created`);

  log(`✓ Phase 3 complete: ${studyLinks.linksCreated + blogLinks.linksCreated} total links created`);
  return { studyLinks: studyLinks.linksCreated, blogLinks: blogLinks.linksCreated };
}

// ============================================================
// PHASE 4: Keyword Strategy
// ============================================================
async function phase4_keywordStrategy() {
  log("═══ PHASE 4: Keyword Strategy Seeding ═══");

  try {
    // Generate topic clusters from existing study categories
    const { generateTopicClusters } = await import("../services/seo-content-factory");
    const clusters = await generateTopicClusters();
    log(`  Generated ${clusters.length} topic clusters from study categories`);

    for (const cluster of clusters.slice(0, 5)) {
      log(`    - ${cluster.pillarTitle}: ${cluster.clusterKeywords?.length || 0} keywords`);
    }
  } catch (err: any) {
    log(`  ⚠ Keyword strategy seeding failed: ${err.message?.substring(0, 80)}`);
  }

  log(`✓ Phase 4 complete`);
}

// ============================================================
// PHASE 5: Study Image Generation
// ============================================================
async function phase5_studyImages() {
  log("═══ PHASE 5: Study Image Generation (Grok/xAI) ═══");

  const { batchGenerateImagesForStudies, findStudiesNeedingImages } = await import("../services/image-generator");

  // Find how many need images
  const needImages = await findStudiesNeedingImages(9999);
  log(`  Studies needing images: ${needImages.length}`);

  if (needImages.length === 0) {
    log(`✓ Phase 5 complete: all studies have images`);
    return { generated: 0, failed: 0 };
  }

  let totalSuccess = 0;
  let totalFailed = 0;

  // Process in batches of 10 to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < needImages.length; i += batchSize) {
    const batch = needImages.slice(i, i + batchSize);
    log(`  Batch ${Math.floor(i / batchSize) + 1}: studies ${batch[0]}-${batch[batch.length - 1]}`);

    if (dryRun) {
      log(`    [DRY RUN] Would generate ${batch.length} images`);
      continue;
    }

    const result = await batchGenerateImagesForStudies(batch);
    totalSuccess += result.success;
    totalFailed += result.failed;

    log(`    Generated: ${result.success}, Failed: ${result.failed}`);
    await sleep(3000); // Rate limit between batches
  }

  log(`✓ Phase 5 complete: ${totalSuccess} images generated, ${totalFailed} failed`);
  return { generated: totalSuccess, failed: totalFailed };
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  log("╔══════════════════════════════════════════════════╗");
  log("║     BULK CONTENT REGENERATION                    ║");
  log("╚══════════════════════════════════════════════════╝");

  if (dryRun) log("⚠ DRY RUN MODE — no content will be generated");
  if (startId > 0) log(`  Starting from study ID: ${startId}`);
  if (blogOnly) log("  Mode: blogs only");
  if (seoOnly) log("  Mode: SEO enrichment only");
  if (linksOnly) log("  Mode: link building only");
  if (imagesOnly) log("  Mode: study images only");

  const results: Record<string, any> = {};
  const runAll = !blogOnly && !seoOnly && !linksOnly && !imagesOnly;

  try {
    // Phase 1: SEO Enrichment
    if ((runAll || seoOnly) && startPhase <= 1) {
      results.phase1 = await phase1_seoEnrichment();
    }

    // Phase 2: Blog Generation (includes blog images via Grok)
    if ((runAll || blogOnly) && startPhase <= 2) {
      results.phase2 = await phase2_blogGeneration();
    }

    // Phase 3: Link Building
    if ((runAll || linksOnly) && startPhase <= 3) {
      results.phase3 = await phase3_linkBuilding();
    }

    // Phase 4: Keyword Strategy
    if (runAll && startPhase <= 4) {
      results.phase4 = await phase4_keywordStrategy();
    }

    // Phase 5: Study Images
    if ((runAll || imagesOnly) && startPhase <= 5) {
      results.phase5 = await phase5_studyImages();
    }

  } catch (err: any) {
    log(`✗ FATAL ERROR: ${err.message}`);
    console.error(err);
  }

  log("");
  log("═══ FINAL SUMMARY ═══");
  log(JSON.stringify(results, null, 2));
  log("Done.");

  process.exit(0);
}

main();
