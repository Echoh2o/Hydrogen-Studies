/**
 * The four /learn guides (/learn, /learn/basics, /learn/health-benefits,
 * /learn/therapy-guide). They are indexable since 2026-11-04 (PLAN 0.6/1.8
 * lifted by Josh after the 2026-11-02 accuracy review, PRs #129/#130), so each
 * shows the CLAUDE.md trio: funding disclosure (site footer), an author, and a
 * date. Same byline rules as the condition hubs: the editorial team is the
 * author; "Reviewed by" appears only once a named reviewer has reviewed the
 * page, never before.
 */
import { blogByline, type BlogByline } from "./seo-markup";

export const LEARN_PATHS = ["/learn", "/learn/basics", "/learn/health-benefits", "/learn/therapy-guide"] as const;

/** Date of the last editorial accuracy review of the /learn guides (#129, #130). */
export const LEARN_LAST_REVIEWED = "2026-11-02";

/** /learn/basics, /learn/health-benefits and /learn/therapy-guide: direct-answer headings (PLAN 6.5). */
export const LEARN_GUIDES_UPDATED = "2026-11-05";

export function learnByline(updatedAt: string = LEARN_LAST_REVIEWED): BlogByline {
  return blogByline({ authorName: null, reviewerName: null, updatedAt });
}
