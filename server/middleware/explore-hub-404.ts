/**
 * Unknown explore hubs answer HTTP 404 to browsers too.
 *
 * Crawlers get a hard 404 from the bot middleware when the renderer has no
 * body for a hub (seo-body-renderer exploreHubExists). Browsers used to get
 * the SPA shell with 200 for ANY /explore-by-<type>/<slug> — e.g.
 * /explore-by-demographic/xyzzy was an empty 200 page (soft 404). The SPA
 * fallback (server/index.ts, and the dev server in server/vite.ts) asks this
 * module first and sends the same shell with status 404; the SPA then renders
 * the site's NotFound page (noindex) because GET /api/explore/:type/:slug
 * answers 404 too. Same status for bots and browsers — CLAUDE.md.
 */
import type { Request, Response } from "express";
import { parseExploreHubPath } from "../../shared/explore-hubs";
import { exploreHubExists } from "./seo-body-renderer";
import { logger } from "../utils/logger";

/**
 * True when `pathname` is an /explore-by-<type>/<slug> URL whose hub does not
 * exist. Fails open (false → the usual 200 shell) when the hub lookup errors,
 * so a DB blip never 404s a real hub; the SPA then shows the page or its own
 * error state.
 */
export async function isUnknownExploreHubPath(pathname: string): Promise<boolean> {
  const hub = parseExploreHubPath(pathname);
  if (!hub) return false;
  try {
    return !(await exploreHubExists(hub.type, hub.slug));
  } catch (err) {
    logger.warn(`Explore hub check failed for ${pathname}: ${(err as Error)?.message ?? err}`, "ExploreHub404");
    return false;
  }
}

/** HTTP status the SPA shell should carry for `pathname` (404 for unknown hubs). */
export async function spaShellStatus(pathname: string): Promise<200 | 404> {
  return (await isUnknownExploreHubPath(pathname)) ? 404 : 200;
}

/**
 * Send the SPA shell (index.html) for a browser request — HTTP 404 (uncached,
 * so the URL recovers the moment the hub exists) for an unknown explore hub,
 * the usual 200 otherwise. The production SPA fallback (server/index.ts).
 */
export async function sendSpaShell(req: Request, res: Response, indexPath: string): Promise<void> {
  if ((await spaShellStatus(req.path)) === 404) {
    res.status(404).set("Cache-Control", "no-cache");
  }
  res.sendFile(indexPath);
}
