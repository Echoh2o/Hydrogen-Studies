/**
 * Bulk Content Regeneration Script
 *
 * Run after a database reset to regenerate all content from studies.
 * Executes in phases with progress tracking and error recovery.
 *
 * Usage: railway run npx tsx server/scripts/regenerate-content.ts [--phase N] [--start-id N] [--dry-run]
 *
 * Phases:
 *   1.  SEO enrichment (meta titles, descriptions, schema.org, health conditions, keywords)
 *   1b. Tag generation (consumer-friendly search tags via Haiku — cheap + fast)
 *   2.  Blog generation (3 articles per study: science_explainer, practical_guide, fq)
 *   3.  Internal link building (study-to-study and blog-to-blog cross-links)
 *   4.  Keyword strategy seeding (generate monitoring keywords from study topics)
 *   5.  Study image generation (Grok/xAI hero images)
 *
 * Cost estimate: ~$60-90 for 1,700 studies (Sonnet pricing)
 */

import { db } from "../db";
import { studies } from "@shared/schema";
import { desc, gt, count, isNull, sql } from "drizzle-orm";
import { ai } from "../services/ai-provider";

// Parse CLI args
const args = process.argv.slice(2);
const startPhase = parseInt(args.find(a => a.startsWith("--phase="))?.split("=")[1] || "1");
const startId = parseInt(args.find(a => a.startsWith("--start-id="))?.split("=")[1] || "0");
const dryRun = args.includes("--dry-run");
const blogOnly = args.includes("--blogs-only");
const seoOnly = args.includes("--seo-only");
const linksOnly = args.includes("--links-only");
const imagesOnly = args.includes("--images-only");
const tagsOnly = args.includes("--tags-only");
const fast = args.includes("--fast"); // Minimal delays for bulk initial push

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

  const { batchEnrichStudies, getEnrichmentCandidateCount } = await import("../services/study-seo-enrichment");

  if (dryRun) {
    const pending = await getEnrichmentCandidateCount().catch(() => -1);
    log(`  [dry run] ${pending < 0 ? "unknown number of" : pending} studies would be SEO-enriched — skipping`);
    log("✓ Phase 1 complete (dry run)");
    return { enriched: 0, errors: 0 };
  }

  let totalSuccess = 0;
  let totalFailed = 0;
  let batch = 1;

  // Cap iterations so a persistently-failing batch can't loop forever burning
  // AI spend. Candidates are re-selected while their fields stay NULL, and a
  // failed enrichment writes nothing, so without this guard a batch that only
  // ever fails never terminates.
  const MAX_BATCHES = 500;

  while (batch <= MAX_BATCHES) {
    log(`  Batch ${batch}...`);

    const result = await batchEnrichStudies({
      batchSize: fast ? 20 : 5,
      delayMs: fast ? 300 : 1500,
      onProgress: (done, total, studyId) => {
        if (done % 5 === 0 || done === total) {
          log(`    Progress: ${done}/${total} (study #${studyId})`);
        }
      },
    });

    totalSuccess += result.success;
    totalFailed += result.failed;

    log(`  Batch ${batch} done: ${result.success} enriched, ${result.failed} failed, ${result.total} total`);

    // Stop when no more candidates, OR when a batch made zero progress (only
    // permanently-failing studies remain) — otherwise we'd re-fetch the same
    // failing rows every iteration.
    if (result.total === 0) break;
    if (result.success === 0) {
      log(`  Stopping: ${result.failed} studies could not be enriched (no progress this batch)`);
      break;
    }

    batch++;
    await sleep(fast ? 500 : 2000); // Pause between batches
  }

  if (batch > MAX_BATCHES) {
    log(`  Stopping: reached MAX_BATCHES (${MAX_BATCHES}) guard`);
  }

  log(`✓ Phase 1 complete: ${totalSuccess} studies enriched, ${totalFailed} failed`);
  return { enriched: totalSuccess, errors: totalFailed };
}

// ============================================================
// ============================================================
// PHASE 1b: Tag Generation (consumer-friendly tags for search + images)
// ============================================================
async function phase1b_tagGeneration() {
  log("═══ PHASE 1b: AI Tag Generation ═══");

  const { studyService } = await import("../services/study-service");

  // Count studies missing tags
  const countResult = await db.select({ value: count() }).from(studies);
  const totalStudies = countResult[0]?.value || 0;

  const missingTags = await db.execute(
    sql`SELECT COUNT(*) as c FROM studies WHERE tags IS NULL OR array_length(tags, 1) IS NULL OR array_length(tags, 1) = 0`
  );
  const needsTags = parseInt((missingTags.rows[0] as any)?.c || "0");
  log(`  ${needsTags}/${totalStudies} studies need tags`);

  if (needsTags === 0 || dryRun) {
    log(`✓ Phase 1b complete${dryRun ? " (dry run)" : ""}`);
    return { tagged: 0 };
  }

  let tagged = 0;
  let page = 1;
  const pageSize = 10;

  while (true) {
    // Get studies without tags
    const batch = await db.execute(
      sql`SELECT id, title, category, tldr, plain_summary, abstract, h2_delivery_method, keywords
          FROM studies
          WHERE tags IS NULL OR array_length(tags, 1) IS NULL OR array_length(tags, 1) = 0
          ORDER BY id
          LIMIT ${pageSize}`
    );

    if (batch.rows.length === 0) break;

    // Generate tags for each study using AI
    for (const row of batch.rows as any[]) {
      try {
        const context = row.tldr || row.plain_summary || row.abstract || row.title;
        const category = row.category || "";
        const delivery = row.h2_delivery_method || "";
        const existingKeywords = (row.keywords || []).join(", ");

        const tagPrompt = `Generate 5-8 consumer-friendly search tags for this hydrogen research study.

Study: ${context.substring(0, 300)}
Category: ${category}
Delivery method: ${delivery}
Existing keywords: ${existingKeywords}

Rules:
- Tags should be plain English phrases that health-conscious consumers would search for
- Include the body system or condition (e.g., "gut health", "brain fog", "joint pain relief")
- Include the benefit (e.g., "anti-aging", "muscle recovery", "better sleep")
- Include the delivery method if relevant (e.g., "hydrogen water", "hydrogen inhalation")
- NO scientific jargon — think "what would someone Google?"
- Return ONLY a JSON array of strings, nothing else

Example: ["gut health","hydrogen water benefits","inflammation relief","digestive wellness","antioxidant"]`;

        const result = await ai.generateText(
          "You generate consumer-friendly search tags for health research. Return only a JSON array of strings.",
          tagPrompt,
          { maxTokens: 150, temperature: 0.3, model: "claude-haiku-4-5" },
        );

        if (result) {
          // Parse the JSON array from the response
          const cleaned = result.trim().replace(/```json\n?/g, "").replace(/```/g, "").trim();
          const parsedTags = JSON.parse(cleaned) as string[];
          if (Array.isArray(parsedTags) && parsedTags.length > 0) {
            await db.execute(
              sql`UPDATE studies SET tags = ${parsedTags} WHERE id = ${row.id}`
            );
            tagged++;
            if (tagged % 20 === 0) log(`    Tagged ${tagged} studies...`);
          }
        }

        await sleep(fast ? 100 : 500); // Light rate limiting — Haiku is fast + cheap
      } catch (err: any) {
        log(`    ⚠ Failed to tag study #${row.id}: ${err.message?.substring(0, 60)}`);
      }
    }
  }

  log(`✓ Phase 1b complete: ${tagged} studies tagged`);
  return { tagged };
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
  const pageSize = fast ? 50 : 20;

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
        await sleep(fast ? 500 : 3000);

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

  if (dryRun) {
    log("  [dry run] would rebuild study-to-study and blog-to-blog internal links — skipping");
    log("✓ Phase 3 complete (dry run)");
    return { studyLinks: 0, blogLinks: 0 };
  }

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

  if (dryRun) {
    log("  [dry run] would generate topic clusters from study categories — skipping");
    log("✓ Phase 4 complete (dry run)");
    return { clusters: 0 };
  }

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
  const batchSize = fast ? 25 : 10;
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
  if (fast) log("⚡ FAST MODE — minimal delays for bulk initial push");
  if (startId > 0) log(`  Starting from study ID: ${startId}`);
  if (blogOnly) log("  Mode: blogs only");
  if (seoOnly) log("  Mode: SEO enrichment only");
  if (linksOnly) log("  Mode: link building only");
  if (imagesOnly) log("  Mode: study images only");
  if (tagsOnly) log("  Mode: tag generation only");

  const results: Record<string, any> = {};
  const runAll = !blogOnly && !seoOnly && !linksOnly && !imagesOnly && !tagsOnly;
  let failed = false;

  try {
    // Phase 1: SEO Enrichment
    if ((runAll || seoOnly) && startPhase <= 1) {
      results.phase1 = await phase1_seoEnrichment();
    }

    // Phase 1b: Tag Generation (before blogs so tags are available as context)
    if (runAll || tagsOnly || seoOnly) {
      results.phase1b = await phase1b_tagGeneration();
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
    failed = true;
  }

  log("");
  log("═══ FINAL SUMMARY ═══");
  log(JSON.stringify(results, null, 2));
  log(failed ? "Done with errors." : "Done.");

  // Exit non-zero on failure so `railway run`/CI and any wrapping automation
  // don't treat a half-completed run (DB disconnect, missing API key mid-run)
  // as success.
  process.exit(failed ? 1 : 0);
}

main();
