/**
 * Study Lifecycle Pipeline
 *
 * Automatically triggers the full enrichment chain when a new study is added.
 * Each step runs sequentially with error isolation — individual step failures
 * don't block subsequent steps.
 *
 * Pipeline order:
 * 1. DOI Enhancement (fetch metadata from CrossRef/Semantic Scholar)
 * 2. Content Enrichment (keywords, health conditions, body systems, conclusion)
 * 3. Pipeline Processing (plain language title, categorization, quality score, summaries, SEO metadata)
 * 4. TLDR Generation
 * 5. Image Generation
 * 6. Blog Article Generation
 * 7. Internal Link Building
 */

import { db } from "../db";
import { studies, blogArticles } from "../../shared/schema";
import { eq, isNull } from "drizzle-orm";
import { logger } from "../utils/logger";

interface PipelineResult {
  studyId: number;
  steps: Record<string, { success: boolean; message?: string }>;
  duration: number;
}

/**
 * Run the full enrichment pipeline for a newly imported study.
 * This is fire-and-forget — call it without awaiting.
 */
export async function runStudyLifecyclePipeline(studyId: number): Promise<PipelineResult> {
  const startTime = Date.now();
  const steps: Record<string, { success: boolean; message?: string }> = {};

  logger.info(`Starting lifecycle pipeline for study ${studyId}`, "StudyLifecycle");

  // Small initial delay to let the import transaction commit
  await delay(2000);

  // Step 1: DOI Enhancement — fetch missing metadata from CrossRef/Semantic Scholar
  try {
    const { enhanceStudyWithDoi } = await import("./doi-enhancer");
    const [study] = await db.select({ doi: studies.doi }).from(studies).where(eq(studies.id, studyId)).limit(1);
    if (study?.doi) {
      const result = await enhanceStudyWithDoi(studyId);
      steps.doiEnhancement = { success: true, message: `Enhanced ${result.enhancedFields?.length || 0} fields` };
    } else {
      steps.doiEnhancement = { success: true, message: "No DOI, skipped" };
    }
  } catch (err: any) {
    steps.doiEnhancement = { success: false, message: err.message };
    logger.warn(`DOI enhancement failed for study ${studyId}: ${err.message}`, "StudyLifecycle");
  }

  await delay(1000);

  // Step 2: Content Enrichment — keywords, health conditions, body systems, conclusion
  try {
    const { checkAndEnrichStudies } = await import("./targeted-enrichment");
    const result = await checkAndEnrichStudies();
    steps.contentEnrichment = { success: true, message: `Processed ${result.totalProcessed} studies` };
  } catch (err: any) {
    steps.contentEnrichment = { success: false, message: err.message };
    logger.warn(`Content enrichment failed for study ${studyId}: ${err.message}`, "StudyLifecycle");
  }

  await delay(1000);

  // Step 3: SEO Enrichment — slug, plain language title
  try {
    const { enrichAndSaveStudy } = await import("./study-seo-enrichment");
    await enrichAndSaveStudy(studyId);
    steps.seoEnrichment = { success: true };
  } catch (err: any) {
    steps.seoEnrichment = { success: false, message: err.message };
    logger.warn(`SEO enrichment failed for study ${studyId}: ${err.message}`, "StudyLifecycle");
  }

  await delay(1000);

  // Step 4: TLDR Generation
  try {
    const [study] = await db
      .select({ id: studies.id, title: studies.title, abstract: studies.abstract, conclusion: studies.conclusion, tldr: studies.tldr })
      .from(studies)
      .where(eq(studies.id, studyId))
      .limit(1);

    if (study && !study.tldr && study.abstract) {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const anthropic = new Anthropic();

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `You are a science communicator. Write a TL;DR summary of this study in 1-2 simple sentences. Use plain language a 6th grader could understand. Focus on the key finding and why it matters. No jargon. Be conversational.\n\nStudy title: ${study.title}\nAbstract: ${study.abstract}\n${study.conclusion ? `Conclusion: ${study.conclusion}` : ""}\n\nWrite ONLY the TL;DR text, nothing else.`
        }],
      });

      const tldr = (message.content[0] as any).text?.trim();
      if (tldr) {
        await db.update(studies).set({ tldr }).where(eq(studies.id, studyId));
        steps.tldrGeneration = { success: true };
      } else {
        steps.tldrGeneration = { success: false, message: "Empty response" };
      }
    } else {
      steps.tldrGeneration = { success: true, message: study?.tldr ? "Already has TLDR" : "No abstract" };
    }
  } catch (err: any) {
    steps.tldrGeneration = { success: false, message: err.message };
    logger.warn(`TLDR generation failed for study ${studyId}: ${err.message}`, "StudyLifecycle");
  }

  await delay(2000);

  // Step 5: Image Generation
  try {
    const [study] = await db
      .select({ imageUrl: studies.imageUrl })
      .from(studies)
      .where(eq(studies.id, studyId))
      .limit(1);

    if (!study?.imageUrl) {
      const { generateImageForStudy } = await import("./image-generator");
      await generateImageForStudy(studyId);
      steps.imageGeneration = { success: true };
    } else {
      steps.imageGeneration = { success: true, message: "Already has image" };
    }
  } catch (err: any) {
    steps.imageGeneration = { success: false, message: err.message };
    logger.warn(`Image generation failed for study ${studyId}: ${err.message}`, "StudyLifecycle");
  }

  await delay(2000);

  // Step 6: Blog Article Generation
  try {
    const existingBlog = await db
      .select({ id: blogArticles.id })
      .from(blogArticles)
      .where(eq(blogArticles.studyId, studyId))
      .limit(1);

    if (existingBlog.length === 0) {
      const [study] = await db.select().from(studies).where(eq(studies.id, studyId)).limit(1);
      if (study) {
        const { generateBlogArticlesForStudy } = await import("./blog-generator-enhanced");
        // generateBlogArticlesForStudy already inserts articles into the DB — do NOT re-insert
        const result = await generateBlogArticlesForStudy(study, { count: 1, fallbackToBasic: true });
        if (result.articles.length > 0) {
          steps.blogGeneration = { success: true, message: `Generated ${result.articles.length} article(s)` };
        } else {
          steps.blogGeneration = { success: false, message: result.errors?.[0]?.error || "No articles generated" };
        }
      }
    } else {
      steps.blogGeneration = { success: true, message: "Already has blog" };
    }
  } catch (err: any) {
    steps.blogGeneration = { success: false, message: err.message };
    logger.warn(`Blog generation failed for study ${studyId}: ${err.message}`, "StudyLifecycle");
  }

  await delay(1000);

  // Step 7: Internal Link Building
  try {
    const { generateStudyLinks } = await import("./internal-linking-engine");
    await generateStudyLinks(studyId);
    steps.linkBuilding = { success: true };
  } catch (err: any) {
    steps.linkBuilding = { success: false, message: err.message };
    logger.warn(`Link building failed for study ${studyId}: ${err.message}`, "StudyLifecycle");
  }

  const duration = Date.now() - startTime;
  const successCount = Object.values(steps).filter(s => s.success).length;
  const totalSteps = Object.keys(steps).length;

  logger.info(`Lifecycle pipeline complete for study ${studyId}: ${successCount}/${totalSteps} steps succeeded in ${Math.round(duration / 1000)}s`, "StudyLifecycle");

  return { studyId, steps, duration };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
