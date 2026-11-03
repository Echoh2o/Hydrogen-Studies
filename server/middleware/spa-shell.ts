/**
 * The SPA shell (index.html) for every visitor — browsers and crawlers alike
 * (PLAN 3.4: no user-agent branching). Replaces the bot-only prerender: pages
 * that need real HTML are served by the Next.js front door (web-frontdoor.ts);
 * what's left on the SPA (search, learn, account, analytics dashboards…) gets
 * the shell with its correct head tags and HTTP status:
 *
 *   - meta from resolvePageMeta / resolveStaticPageMeta (title, description,
 *     robots, canonical, OG/Twitter, page JSON-LD) — the same values crawlers
 *     used to get, now for everyone; scripts in index.html are left alone
 *     (consent-gated analytics keeps working)
 *   - no known meta → noindex (account/app pages, unreviewed /learn)
 *   - unknown path or unknown explore hub → 404 + noindex
 */
import fs from "fs";
import type { Request, Response } from "express";
import { jsonLdSafe } from "../utils/html-safety";
import { isUnknownExploreHubPath } from "./explore-hub-404";
import { resolvePageMeta, resolveStaticPageMeta, type PageMeta } from "../services/page-meta";
import { logger } from "../utils/logger";

const SITE_URL = "https://hydrogenstudies.com";

/** Routes the SPA renders; anything else is a 404 for everyone. */
const KNOWN_SPA_ROUTES =
  /^\/(study|studies|blog|explore-by-|hydrogen-for|learn|admin|search|advanced-search|improved-search|about|benefits|contact|products|recommendations|privacy|terms|disclaimer|cookies|editorial-policy|methodology|insights|research-analytics|researchers|journals|login|register|reset-password|my-dashboard|this-week|recent)\b/;

export function isKnownSpaRoute(pathname: string): boolean {
  return pathname === "/" || KNOWN_SPA_ROUTES.test(pathname);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Replace the shell's head tags with the page's own; everything else stays. */
export function injectShellMeta(html: string, meta: PageMeta): string {
  const stripped = html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
    .replace(/<meta\s+(?:name|property)="(?:description|robots|og:[a-z_:]+|twitter:[a-z_:]+)"[\s\S]*?\/>\s*/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, "");
  const ld = meta.jsonLd ? (Array.isArray(meta.jsonLd) ? meta.jsonLd : [meta.jsonLd]) : [];
  const tags = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<meta name="robots" content="${esc(meta.robots ?? "index, follow")}" />`,
    `<link rel="canonical" href="${esc(meta.canonical)}" />`,
    `<meta property="og:type" content="${esc(meta.ogType)}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:image" content="${esc(meta.ogImage)}" />`,
    `<meta property="og:url" content="${esc(meta.canonical)}" />`,
    `<meta property="og:site_name" content="Hydrogen Studies" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(meta.ogImage)}" />`,
    ...ld.map((block) => `<script type="application/ld+json">${jsonLdSafe(block)}</script>`),
  ];
  return stripped.replace(/<\/head>/i, `    ${tags.join("\n    ")}\n  </head>`);
}

const NOT_FOUND: Omit<PageMeta, "canonical"> = {
  title: "Page Not Found | Hydrogen Studies",
  description: "The page you're looking for doesn't exist or has moved.",
  ogType: "website",
  ogImage: `${SITE_URL}/logo.png`,
  robots: "noindex, follow",
};

/** Status + head tags for a SPA-served path. */
export async function shellFor(pathname: string): Promise<{ status: 200 | 404; meta: PageMeta }> {
  const canonical = `${SITE_URL}${pathname === "/" ? "/" : pathname}`;
  if (!isKnownSpaRoute(pathname) || (await isUnknownExploreHubPath(pathname))) {
    return { status: 404, meta: { ...NOT_FOUND, canonical } };
  }
  const meta = (await resolvePageMeta(pathname).catch(() => null)) ?? resolveStaticPageMeta(pathname);
  if (meta) return { status: 200, meta };
  // An app/account page with no SEO meta: usable, never indexed.
  const home = resolveStaticPageMeta("/")!;
  return { status: 200, meta: { ...home, canonical, robots: "noindex, follow" } };
}

let template: { path: string; mtimeMs: number; html: string } | null = null;

function readTemplate(indexPath: string): string {
  const { mtimeMs } = fs.statSync(indexPath);
  if (!template || template.path !== indexPath || template.mtimeMs !== mtimeMs) {
    template = { path: indexPath, mtimeMs, html: fs.readFileSync(indexPath, "utf-8") };
  }
  return template.html;
}

/** The production SPA fallback (server/index.ts). */
export async function sendSpaShell(req: Request, res: Response, indexPath: string): Promise<void> {
  try {
    const { status, meta } = await shellFor(req.path);
    res.status(status).type("html");
    if (status === 404) res.set("Cache-Control", "no-cache");
    res.send(injectShellMeta(readTemplate(indexPath), meta));
  } catch (err) {
    logger.error("SPA shell failed — sending the bare shell", err, "SpaShell");
    res.sendFile(indexPath);
  }
}
