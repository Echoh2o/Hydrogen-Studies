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
