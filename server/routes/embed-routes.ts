/**
 * Public embeds for echowater.com (and any other site): a live study count
 * and a footer badge. Mounted at /embed BEFORE the CORS allowlist and session
 * middleware — every response here is public, credential-free and cacheable.
 *
 *   GET /embed/stats.json      { totalStudies, humanTrials, healthConditions }
 *   GET /embed/study-count.js  fills every [data-hs-count] element on the page
 *   GET /embed/badge.svg       live "Hydrogen Studies" badge (?theme=light|dark)
 *
 * Badge wording is deliberately NOT a seal/certification ("authorized",
 * "verified"): Hydrogen Studies is funded by Echo Technologies, so a
 * certification-style badge on echowater.com would be a self-issued seal
 * (FTC Endorsement Guides). "Our research library" states the relationship.
 */
import { Router, type Response } from "express";
import { getPublicStudyStats, type PublicStudyStats } from "../services/public-study-stats";
import { logger } from "../utils/logger";

const SITE_URL = process.env.SITE_URL || "https://hydrogenstudies.com";

const router = Router();

/** Headers every embed response needs to be usable from another origin. */
function setEmbedHeaders(res: Response, maxAgeSeconds: number): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  // helmet defaults CORP to same-origin, which makes browsers refuse the
  // script/image when echowater.com loads it.
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cache-Control", `public, max-age=${maxAgeSeconds}`);
  res.setHeader("X-Robots-Tag", "noindex");
}

/** Never let a DB hiccup show "0 studies" on the store — treat 0 as unknown. */
async function loadStats(): Promise<PublicStudyStats | null> {
  try {
    const stats = await getPublicStudyStats();
    return stats.totalStudies > 0 ? stats : null;
  } catch (error) {
    logger.error("embed stats query failed", error, "Embed");
    return null;
  }
}

router.get("/stats.json", async (_req, res) => {
  const stats = await loadStats();
  if (!stats) {
    setEmbedHeaders(res, 60);
    return res.status(503).json({ error: "stats unavailable" });
  }
  setEmbedHeaders(res, 300);
  return res.json(stats);
});

/**
 * Loader script. Usage:
 *   <span data-hs-count>2,283</span>            -> 2,283 (exact, live)
 *   <span data-hs-count data-hs-format="floor">  -> 2,200+
 *   <span data-hs-count="humanTrials">           -> human-trial count
 * The element's existing text is the no-JS / failure fallback.
 */
export function buildStudyCountScript(siteUrl: string): string {
  return `/* Hydrogen Studies live study count — ${siteUrl}/embed */
(function () {
  "use strict";
  if (window.__hsStudyCount) return;
  window.__hsStudyCount = true;
  var ORIGIN = ${JSON.stringify(siteUrl)};
  var KEYS = { totalStudies: 1, humanTrials: 1, healthConditions: 1 };
  function fmt(n, mode) {
    if (mode === "floor") {
      var step = n >= 1000 ? 100 : n >= 100 ? 10 : 1;
      return (Math.floor(n / step) * step).toLocaleString("en-US") + "+";
    }
    return n.toLocaleString("en-US");
  }
  function apply(stats) {
    var els = document.querySelectorAll("[data-hs-count]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute("data-hs-count") || "totalStudies";
      if (!KEYS[key]) key = "totalStudies";
      var n = stats[key];
      if (typeof n !== "number" || n <= 0) continue;
      el.textContent = fmt(n, el.getAttribute("data-hs-format"));
    }
  }
  function run() {
    if (!window.fetch) return;
    fetch(ORIGIN + "/embed/stats.json", { credentials: "omit" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (s) { if (s) apply(s); })
      .catch(function () {});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
`;
}

const STUDY_COUNT_SCRIPT = buildStudyCountScript(SITE_URL);

router.get("/study-count.js", (_req, res) => {
  setEmbedHeaders(res, 3600);
  res.type("application/javascript").send(STUDY_COUNT_SCRIPT);
});

const BADGE_THEMES = {
  light: { bg: "#FFFFFF", border: "#E5E7EB", text: "#111827", muted: "#6B7280", accent: "#007C88", mark: "#00A6B5" },
  dark: { bg: "#111827", border: "#374151", text: "#F9FAFB", muted: "#9CA3AF", accent: "#2DD4BF", mark: "#00A6B5" },
} as const;

export type BadgeTheme = keyof typeof BADGE_THEMES;

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function renderBadgeSvg(totalStudies: number | null, theme: BadgeTheme): string {
  const c = BADGE_THEMES[theme];
  const statLine = totalStudies
    ? `${totalStudies.toLocaleString("en-US")} studies indexed`
    : "Molecular hydrogen research";
  const label = `Hydrogen Studies — our research library${totalStudies ? `, ${statLine}` : ""}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="64" viewBox="0 0 220 64" role="img" aria-label="${label}">
<title>${label}</title>
<rect x="0.5" y="0.5" width="219" height="63" rx="10" fill="${c.bg}" stroke="${c.border}"/>
<circle cx="32" cy="32" r="18" fill="${c.mark}"/>
<text x="32" y="37" text-anchor="middle" fill="#FFFFFF" font-family="${FONT}" font-size="15" font-weight="700">H<tspan font-size="9" dy="3">2</tspan></text>
<text x="60" y="21" fill="${c.muted}" font-family="${FONT}" font-size="8.5" font-weight="600" letter-spacing="1.1">OUR RESEARCH LIBRARY</text>
<text x="60" y="38" fill="${c.text}" font-family="${FONT}" font-size="15" font-weight="700">Hydrogen Studies</text>
<text x="60" y="53" fill="${c.accent}" font-family="${FONT}" font-size="11" font-weight="500">${statLine}</text>
</svg>`;
}

router.get("/badge.svg", async (req, res) => {
  const theme: BadgeTheme = req.query.theme === "dark" ? "dark" : "light";
  const stats = await loadStats();
  setEmbedHeaders(res, stats ? 3600 : 60);
  res.type("image/svg+xml").send(renderBadgeSvg(stats?.totalStudies ?? null, theme));
});

export default router;
