/**
 * Zod schemas for the JSON-shaped fields on multi_format_content.
 *
 * These run at WRITE time (in multi-format-generator.ts) so corrupt
 * data never reaches the DB in the first place. Phase 1 already added
 * a safe-parse on the READ side (server/utils/sanitize.ts: safeJsonParse)
 * so an existing corrupt row doesn't crash exports — together, the two
 * close both ends of the pipeline.
 *
 * Lives in shared/ so the schemas are also importable from client code
 * if a future admin UI wants to validate manually-edited content.
 */
import { z } from "zod";

/** One Q&A pair in a podcast script. */
export const PodcastQAItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});
export const PodcastQASchema = z.array(PodcastQAItemSchema);
export type PodcastQA = z.infer<typeof PodcastQASchema>;

/** A social-thread (e.g. Twitter) is just an ordered array of post strings. */
export const ThreadContentSchema = z.array(z.string().min(1));
export type ThreadContent = z.infer<typeof ThreadContentSchema>;

/** A storyboard scene for a video script. */
export const VideoStoryboardSceneSchema = z.object({
  time: z.string().min(1),
  scene: z.string().min(1),
  visuals: z.string().default(""),
  narration: z.string().default(""),
});
export const VideoStoryboardSchema = z.array(VideoStoryboardSceneSchema);
export type VideoStoryboard = z.infer<typeof VideoStoryboardSchema>;

/** One stat in an infographic. */
export const KeyStatItemSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  context: z.string().default(""),
});
export const KeyStatisticsSchema = z.array(KeyStatItemSchema);
export type KeyStatistics = z.infer<typeof KeyStatisticsSchema>;

/**
 * Validate a value against a schema; on failure, return the fallback
 * AND log the failure (best-effort — the caller passes a label for
 * the log line). Used at write time so a single bad AI generation
 * doesn't propagate garbage into the DB.
 *
 * Returning the fallback (rather than throwing) is the right choice
 * for this codebase because:
 *   1. AI generation is non-deterministic; a single retry rarely
 *      helps.
 *   2. The rest of the row (script, summary, etc.) is usually fine
 *      and worth saving.
 *   3. The export endpoint already uses safeJsonParse on read, so
 *      the empty array doesn't break downstream rendering.
 */
export function validateOrFallback<T>(
  raw: unknown,
  schema: z.ZodSchema<T>,
  fallback: T,
  label: string,
): T {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  // Lazy console import (this file is in shared/ which is consumed by
  // both client + server; can't take the server logger as a dep).
  console.warn(
    `[multi-format] ${label} failed validation; using fallback. ` +
      `First issue: ${result.error.issues[0]?.message ?? "unknown"}`,
  );
  return fallback;
}
