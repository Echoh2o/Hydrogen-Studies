/**
 * Admin edits reach the Next.js front door (web/) at once: post the changed
 * path to web/app/web_revalidate so its cached page data is dropped.
 */
import { logger } from "../utils/logger";

/**
 * Tell the Next.js front door (web/) to drop its cached page data for a
 * changed page — a blog change also refreshes the /blog index. Fire and
 * forget: a failure only means the page refreshes on its normal schedule.
 */
export function notifyWebRevalidate(path?: string): void {
  const origin = process.env.WEB_ORIGIN;
  const key = process.env.PAGE_DATA_KEY;
  if (!origin || !key) return;
  // A blog post also refreshes the /blog index; posts and studies also feed
  // the homepage's "Latest" lists.
  const paths = path
    ? [path, ...(path.startsWith("/blog/") ? ["/blog", "/"] : []), ...(/^\/stud(y|ies)\//.test(path) ? ["/"] : [])]
    : [];
  fetch(`${origin}/web_revalidate`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-page-data-key": key },
    body: JSON.stringify({ paths }),
    signal: AbortSignal.timeout(5000),
  }).catch((err) => {
    logger.warn("web revalidate failed", "WebRevalidate", { path, error: err instanceof Error ? err.message : String(err) });
  });
}
