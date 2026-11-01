/**
 * Page-data API for the Next.js front door (PLAN Phase 3, web/).
 *
 * Next renders public pages; Express stays the single source of truth for
 * page data, redirects and 410s. Each endpoint returns exactly what one page
 * type needs, already shaped by the shared helpers the crawler renderer and
 * SPA use (shared/seo-markup.ts, shared/study-page.ts) — so all three render
 * identical content and schema.
 *
 * Never returns a full abstract (CLAUDE.md): only the ≤300-char excerpt.
 */
import { Router, type Request, type Response } from "express";
import { resolveRedirect } from "../services/redirect-service";
import { isExcludedStudyPath } from "../services/excluded-studies";
import { studyService } from "../services/study-service";
import {
  getConditionHubs,
  getRelatedBlogs,
  getRelatedStudies,
  getTopConditions,
} from "../middleware/seo-body-renderer";
import { abstractExcerpt, studySourceLink, withoutPlaceholders } from "../../shared/seo-markup";
import { studyHubLinks } from "../../shared/study-page";
import { logger } from "../utils/logger";

const router = Router();

/**
 * What a public GET path should get before rendering: a redirect, 410, or
 * nothing. Same decision the Express middleware chain makes (redirects
 * table → URL hygiene → excluded-study 410).
 */
router.get("/route-status", async (req: Request, res: Response) => {
  const path = typeof req.query.path === "string" ? req.query.path : "";
  if (!path.startsWith("/")) return res.status(400).json({ error: "path must start with /" });
  try {
    const search = typeof req.query.search === "string" ? req.query.search : "";
    const originalUrl = search ? `${path}?${search}` : path;
    const decision = await resolveRedirect({
      method: "GET",
      path,
      originalUrl,
      query: Object.fromEntries(new URLSearchParams(search)),
    } as unknown as Request);
    if (decision?.kind === "redirect") {
      return res.json({ kind: "redirect", status: decision.status, location: decision.location });
    }
    if (decision?.kind === "gone" || (await isExcludedStudyPath(path))) return res.json({ kind: "gone" });
    res.set("Cache-Control", "no-store");
    res.json({ kind: "ok" });
  } catch (error) {
    logger.error("route-status failed", error, "PageData");
    res.json({ kind: "ok" }); // fail open: render normally rather than 5xx every page
  }
});

/** Everything /study/[slug] renders. 404 unknown, 410 excluded. */
router.get("/study/:slug", async (req: Request, res: Response) => {
  try {
    const raw = /^\d+$/.test(req.params.slug)
      ? await studyService.getStudyById(Number(req.params.slug))
      : await studyService.getStudyBySlug(req.params.slug);
    if (!raw) return res.status(404).json({ error: "not found" });
    if (raw.isExcluded) return res.status(410).json({ error: "gone" });

    const study: any = withoutPlaceholders(raw as any);
    const conditions: string[] = (study.healthConditions || []).filter((c: string) => c?.trim());
    const condition = conditions[0] || study.category || null;
    const [hubs, related, relatedBlogs, footerConditions] = await Promise.all([
      getConditionHubs(),
      getRelatedStudies(study.id, condition),
      getRelatedBlogs(condition || ""),
      getTopConditions(),
    ]);

    const { abstract, ...rest } = study;
    res.set("Cache-Control", "no-store");
    res.json({
      study: { ...rest, abstractExcerpt: abstractExcerpt(abstract), sourceLink: studySourceLink(study) },
      hubLinks: studyHubLinks({ healthConditions: conditions, bodySystems: study.bodySystems }, hubs),
      related,
      relatedBlogs,
      footerConditions,
    });
  } catch (error) {
    logger.error("study page-data failed", error, "PageData");
    res.status(500).json({ error: "failed" });
  }
});

/** Footer data every Next page needs. */
router.get("/layout", async (_req: Request, res: Response) => {
  res.json({ footerConditions: await getTopConditions() });
});

export default router;
