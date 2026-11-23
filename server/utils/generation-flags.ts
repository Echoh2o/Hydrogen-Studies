/**
 * Automatic content drafts when a study is added (import, approval, pipeline
 * waterfall) are OFF by default. Bulk per-study drafts read as templated SEO
 * spam; content is now planned deliberately instead (see docs/PLAN.md).
 *
 * Opt back in with AUTO_STUDY_BLOG_DRAFTS=true. The docs/PLAN.md master
 * kill-switch GENERATION_ENABLED=false still wins. Admin-triggered "generate
 * blog" actions are unaffected.
 */
export function autoStudyBlogDraftsEnabled(): boolean {
  return (
    process.env.AUTO_STUDY_BLOG_DRAFTS === "true" &&
    process.env.GENERATION_ENABLED !== "false"
  );
}

export const AUTO_DRAFTS_DISABLED_MESSAGE =
  "Skipped: automatic blog drafts on study upload are off (AUTO_STUDY_BLOG_DRAFTS)";

/**
 * Master AI-generation kill-switch (docs/PLAN.md §2: "Generation stays off:
 * GENERATION_ENABLED=false unless Josh flips it; if on, drafts only").
 * Same semantics as the existing checks in blog-generation-worker.ts /
 * blog-lifecycle.ts / job-scheduler.ts: only the literal "false" turns it off.
 * Every generator that writes reader-facing content must check this BEFORE
 * calling the model, and must insert drafts only when it is on.
 */
export function generationEnabled(): boolean {
  return process.env.GENERATION_ENABLED !== "false";
}

export const GENERATION_DISABLED_MESSAGE =
  "Content generation is paused (GENERATION_ENABLED=false — see docs/PLAN.md)";
