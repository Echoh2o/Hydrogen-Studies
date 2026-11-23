/**
 * Scheduled TL;DR backfill (job-scheduler Job 11), extracted so the skip rules
 * are unit-testable.
 *
 * Skip rules (audit 2026-11-22):
 *  - only studies with a REAL abstract (realAbstractSql / hasRealAbstract):
 *    a title-only study gets no TL;DR — that is how refusals and invented
 *    findings reached 105 study pages;
 *  - only tldr IS NULL: a field holding the `__no_content__` sentinel is
 *    intentionally empty and is never refilled;
 *  - a model refusal (isModelRefusal, or stop_reason: refusal) is never
 *    stored: the study is marked processed with the sentinel and not retried.
 *
 * Not gated on GENERATION_ENABLED: this is study enrichment, not article
 * generation.
 */
import { db } from "../db";
import { studies } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { isModelRefusal, isPlaceholder } from "@shared/seo-markup";
import { generateStudyTldr } from "./tldr-generator";
import { hasRealAbstract, realAbstractSql } from "../utils/real-abstract";
import { logger } from "../utils/logger";

export const NO_CONTENT_SENTINEL = "__no_content__";

export async function runTldrBackfill(limit: number): Promise<{ generated: number; refused: number; skipped: number }> {
  const rows = await db
    .select({ id: studies.id, title: studies.title, abstract: studies.abstract, conclusion: studies.conclusion })
    .from(studies)
    .where(sql`${studies.tldr} IS NULL AND ${studies.isExcluded} = false AND ${realAbstractSql()}`)
    .limit(limit);

  let generated = 0;
  let refused = 0;
  let skipped = 0;
  const markProcessed = (id: number) =>
    db.update(studies).set({ tldr: NO_CONTENT_SENTINEL }).where(eq(studies.id, id));

  for (const study of rows) {
    if (!hasRealAbstract(study.abstract)) {
      skipped++;
      continue;
    }
    try {
      const tldr = await generateStudyTldr(study, { caller: "JobScheduler.tldr" });
      if (tldr && (isModelRefusal(tldr) || isPlaceholder(tldr))) {
        refused++;
        await markProcessed(study.id);
      } else if (tldr) {
        await db.update(studies).set({ tldr }).where(eq(studies.id, study.id));
        generated++;
      }
    } catch (err: any) {
      if (String(err?.message ?? "").includes("stop_reason: refusal")) {
        refused++;
        await markProcessed(study.id).catch(() => {});
      } else {
        logger.warn(`TLDR generation failed for study ${study.id}: ${err?.message}`, "JobScheduler");
      }
    }
  }
  return { generated, refused, skipped };
}
