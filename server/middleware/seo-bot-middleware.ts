/**
 * SEO Bot Middleware — Server-side meta tag injection for crawlers
 *
 * Detects search engine bots and social media crawlers, then injects
 * correct meta tags (title, description, OG, Twitter, JSON-LD) into
 * the HTML before serving. Human visitors get the normal SPA.
 */

import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../db";
import { studies, blogArticles } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { jsonLdSafe } from "../utils/html-safety";
import { toAbsoluteUrl } from "../utils/absolute-url";
import { ECHOWATER_ORIGIN } from "../../shared/echo-products";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_URL = process.env.SITE_URL || "https://hydrogenstudies.com";
const SITE_NAME = "Hydrogen Studies";

// ── Cross-domain canonicals (env-gated, OFF by default) ────────
//
// When ECHOWATER_CANONICAL=1, prerendered study and condition pages declare
// their canonical URL (and JSON-LD url/mainEntityOfPage, and og:url — all
// derive from PageMeta.canonical) as the echowater.com App Proxy equivalent,
// consolidating search authority onto the store domain.
//
// IMPORTANT: flip this only after the App Proxy is verified live and indexed
// (https://echowater.com/tools/hydrogen-research/...), otherwise we'd be
// canonicalizing every study/condition page to a 404.
//
// Blog pages are intentionally NOT remapped — they stay canonical on
// hydrogenstudies.com until native syndication exists on echowater.
const ECHOWATER_CANONICAL = process.env.ECHOWATER_CANONICAL === "1";
const ECHOWATER_PROXY_BASE = `${ECHOWATER_ORIGIN}/tools/hydrogen-research`;

function canonicalForStudy(slug: string): string {
  return ECHOWATER_CANONICAL
    ? `${ECHOWATER_PROXY_BASE}/study/${slug}`
    : `${SITE_URL}/study/${slug}`;
}

function canonicalForCondition(slug: string): string {
  return ECHOWATER_CANONICAL
    ? `${ECHOWATER_PROXY_BASE}/condition/${slug}`
    : `${SITE_URL}/explore-by-condition/${slug}`;
}

// Bot user-agent patterns
const BOT_PATTERNS = [
  /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i, /baiduspider/i,
  /yandexbot/i, /sogou/i, /exabot/i, /facebot/i, /facebookexternalhit/i,
  /ia_archiver/i, /twitterbot/i, /linkedinbot/i, /embedly/i, /quora link preview/i,
  /showyoubot/i, /outbrain/i, /pinterest/i, /slackbot/i, /vkshare/i,
  /w3c_validator/i, /redditbot/i, /applebot/i, /whatsapp/i, /flipboard/i,
  /tumblr/i, /bitlybot/i, /skypeuripreview/i, /nuzzel/i, /discordbot/i,
  /google page speed/i, /chromelighthouse/i, /headlesschrome/i,
  /petalbot/i, /ahrefsbot/i, /semrushbot/i, /dotbot/i, /rogerbot/i,
  // AI assistants/search — these citing the site is a distribution channel
  /gptbot/i, /oai-searchbot/i, /chatgpt-user/i, /claudebot/i, /claude-web/i,
  /anthropic-ai/i, /perplexitybot/i, /perplexity-user/i, /ccbot/i,
  /meta-externalagent/i,
];

export function isBot(userAgent: string): boolean {
  return BOT_PATTERNS.some(pattern => pattern.test(userAgent));
}

// Paths whose content is definitively DB-backed: a resolution miss means the
// page truly doesn't exist (vs. a SPA route missing from the static-meta map),
// so bots must get a hard 404 instead of a soft-404 fallback.
const CONTENT_PATH_PATTERNS = [
  /^\/study\/[^/]+$/,
  /^\/studies\/(?!tags$)[^/]+$/,
  /^\/blog\/[^/]+$/,
];

function isContentPath(pathname: string): boolean {
  return CONTENT_PATH_PATTERNS.some(pattern => pattern.test(pathname));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function truncate(str: string, maxLen: number): string {
  if (!str) return "";
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + "...";
}

function stripHtml(str: string): string {
  if (!str) return "";
  return str.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  ogType: string;
  ogImage: string;
  jsonLd?: object;
  robots?: string;
}

/** Resolve meta tags for a given URL path */
async function resolvePageMeta(pathname: string): Promise<PageMeta | null> {
  try {
    // Study page: /study/:slug
    const studySlugMatch = pathname.match(/^\/study\/([^/]+)$/);
    if (studySlugMatch) {
      const slug = studySlugMatch[1];
      // Skip if it's a numeric ID (legacy route)
      if (/^\d+$/.test(slug)) {
        const [study] = await db.select().from(studies).where(eq(studies.id, parseInt(slug))).limit(1);
        if (study) return buildStudyMeta(study);
      } else {
        const [study] = await db.select().from(studies).where(eq(studies.slug, slug)).limit(1);
        if (study) return buildStudyMeta(study);
      }
      return null;
    }

    // Alternative study path: /studies/:slug
    const studiesSlugMatch = pathname.match(/^\/studies\/([^/]+)$/);
    if (studiesSlugMatch && !/^(tags)$/.test(studiesSlugMatch[1])) {
      const slug = studiesSlugMatch[1];
      const [study] = await db.select().from(studies).where(eq(studies.slug, slug)).limit(1);
      if (study) return buildStudyMeta(study);
      return null;
    }

    // Blog page: /blog/:slug or /blog/:id
    const blogMatch = pathname.match(/^\/blog\/([^/]+)$/);
    if (blogMatch) {
      const idOrSlug = blogMatch[1];
      let blog;
      // Only published, non-archived articles are prerendered — drafts and
      // soft-deleted posts must fall through to the hard-404 branch, matching
      // the body renderer (seo-body-renderer.ts) and every other public query.
      if (/^\d+$/.test(idOrSlug)) {
        [blog] = await db.select().from(blogArticles).where(and(
          eq(blogArticles.id, parseInt(idOrSlug)),
          eq(blogArticles.isPublished, true),
          eq(blogArticles.isArchived, false),
        )).limit(1);
      } else {
        [blog] = await db.select().from(blogArticles).where(and(
          eq(blogArticles.slug, idOrSlug),
          eq(blogArticles.isPublished, true),
          eq(blogArticles.isArchived, false),
        )).limit(1);
      }
      if (blog) return buildBlogMeta(blog);
      return null;
    }

    // Static pages
    return resolveStaticPageMeta(pathname);
  } catch (err) {
    console.error("[SEO Bot] Error resolving meta for", pathname, err);
    return null;
  }
}

function buildStudyMeta(study: any): PageMeta {
  const title = study.metaTitle
    || study.plainLanguageTitle
    || study.title;
  const description = study.metaDescription
    || study.summary100Words
    || study.summary50Words
    || stripHtml(study.abstract);
  const slug = study.slug || `id/${study.id}`;
  const canonical = canonicalForStudy(slug);
  const ogImage = toAbsoluteUrl(study.ogImage || study.imageUrl || "/logo.png", SITE_URL);

  const jsonLd: any = {
    "@context": "https://schema.org",
    "@type": "MedicalScholarlyArticle",
    "headline": truncate(study.title, 110),
    "description": truncate(stripHtml(description), 300),
    "url": canonical,
    "image": ogImage,
    "datePublished": study.journalPublishDate || study.publishDate,
    "publisher": {
      "@type": "Organization",
      "name": SITE_NAME,
      "url": SITE_URL,
      "logo": { "@type": "ImageObject", "url": `${SITE_URL}/logo.png` }
    },
    "mainEntityOfPage": { "@type": "WebPage", "@id": canonical }
  };

  if (study.authors) {
    const authorList = study.authors.split(",").map((a: string) => a.trim()).filter(Boolean);
    jsonLd.author = authorList.map((name: string) => ({ "@type": "Person", "name": name }));
  }
  if (study.journal) jsonLd.isPartOf = { "@type": "Periodical", "name": study.journal };
  if (study.doi) jsonLd.sameAs = `https://doi.org/${study.doi}`;
  if (study.keywords?.length) jsonLd.keywords = study.keywords.join(", ");

  // Add FAQ schema if Q&A pairs exist
  let faqLd: any = null;
  if (study.questionAnswerPairs) {
    try {
      const qaPairs = JSON.parse(study.questionAnswerPairs);
      if (Array.isArray(qaPairs) && qaPairs.length > 0) {
        faqLd = {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": qaPairs.slice(0, 5).map((qa: any) => ({
            "@type": "Question",
            "name": qa.question || qa.q,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": qa.answer || qa.a
            }
          }))
        };
      }
    } catch {}
  }

  return {
    title: truncate(title, 60) + ` | ${SITE_NAME}`,
    description: truncate(stripHtml(description), 160),
    canonical,
    ogType: "article",
    ogImage,
    jsonLd: faqLd ? [jsonLd, faqLd] : jsonLd,
  };
}

function buildBlogMeta(blog: any): PageMeta {
  const title = blog.metaTitle || blog.title;
  const description = blog.metaDescription || blog.summary100Words || blog.summary;
  const canonical = `${SITE_URL}/blog/${blog.slug}`;
  const ogImage = toAbsoluteUrl(blog.ogImage || blog.imageUrl || "/logo.png", SITE_URL);

  const jsonLd: any = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": truncate(blog.title, 110),
    "description": truncate(stripHtml(description), 300),
    "url": canonical,
    "image": ogImage,
    "datePublished": blog.createdAt?.toISOString?.() || new Date().toISOString(),
    "dateModified": blog.updatedAt?.toISOString?.() || blog.createdAt?.toISOString?.(),
    "author": {
      "@type": "Organization",
      "name": SITE_NAME,
      "url": SITE_URL
    },
    "publisher": {
      "@type": "Organization",
      "name": SITE_NAME,
      "url": SITE_URL,
      "logo": { "@type": "ImageObject", "url": `${SITE_URL}/logo.png` }
    },
    "mainEntityOfPage": { "@type": "WebPage", "@id": canonical }
  };

  if (blog.semanticKeywords?.length) jsonLd.keywords = blog.semanticKeywords.join(", ");

  // FAQ schema from blog Q&A
  let faqLd: any = null;
  if (blog.questionAnswerPairs) {
    try {
      const qaPairs = JSON.parse(blog.questionAnswerPairs);
      if (Array.isArray(qaPairs) && qaPairs.length > 0) {
        faqLd = {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": qaPairs.slice(0, 5).map((qa: any) => ({
            "@type": "Question",
            "name": qa.question || qa.q,
            "acceptedAnswer": { "@type": "Answer", "text": qa.answer || qa.a }
          }))
        };
      }
    } catch {}
  }

  return {
    title: truncate(title, 60) + ` | ${SITE_NAME}`,
    description: truncate(stripHtml(description), 160),
    canonical,
    ogType: "article",
    ogImage,
    jsonLd: faqLd ? [jsonLd, faqLd] : jsonLd,
  };
}

function resolveStaticPageMeta(pathname: string): PageMeta | null {
  const pages: Record<string, { title: string; description: string }> = {
    "/": {
      title: `Hydrogen Studies | ${SITE_NAME} Research Database`,
      description: "Explore 1,300+ peer-reviewed hydrogen therapy research studies. Evidence-based insights on molecular hydrogen for health conditions, organized by body system, condition, and mechanism."
    },
    "/studies": {
      title: `Research Studies Directory | ${SITE_NAME}`,
      description: "Browse our comprehensive directory of hydrogen therapy research studies. Filter by condition, body system, study type, and outcome."
    },
    "/blog": {
      title: `Hydrogen Health Blog | ${SITE_NAME}`,
      description: "Plain-language articles explaining hydrogen therapy research. Understand the science behind molecular hydrogen and its health benefits."
    },
    "/about": {
      title: `About | ${SITE_NAME}`,
      description: "Learn about Hydrogen Studies — the most comprehensive database of molecular hydrogen research, dedicated to making scientific research accessible."
    },
    "/search": {
      title: `Search Research | ${SITE_NAME}`,
      description: "Search our database of hydrogen therapy research studies by keyword, condition, body system, or mechanism of action."
    },
    "/advanced-search": {
      title: `Advanced Research Search | ${SITE_NAME}`,
      description: "Advanced search with filters for study type, outcome, date range, body system, and health condition across hydrogen therapy research."
    },
    "/benefits": {
      title: `Health Benefits of Hydrogen | ${SITE_NAME}`,
      description: "Discover the scientifically-studied health benefits of molecular hydrogen, from anti-inflammatory effects to neuroprotection."
    },
    "/explore-by-condition": {
      title: `Hydrogen Research by Health Condition | ${SITE_NAME}`,
      description: "Explore hydrogen therapy research organized by health condition. Find studies on diabetes, Alzheimer's, arthritis, cancer support, and more."
    },
    "/explore-by-body-system": {
      title: `Hydrogen Research by Body System | ${SITE_NAME}`,
      description: "Browse hydrogen therapy studies organized by body system — brain, heart, digestive, immune, musculoskeletal, and more."
    },
    "/explore-by-mechanism": {
      title: `Hydrogen Delivery Mechanisms Research | ${SITE_NAME}`,
      description: "Explore research on different hydrogen delivery methods — hydrogen water, inhalation therapy, hydrogen-rich saline, and more."
    },
    "/explore-by-life-stage": {
      title: `Hydrogen Research by Life Stage | ${SITE_NAME}`,
      description: "Find hydrogen therapy research relevant to your life stage — pregnancy, childhood, adults, elderly, and athletes."
    },
    "/explore-by-demographic": {
      title: `Hydrogen Research by Demographics | ${SITE_NAME}`,
      description: "Explore hydrogen therapy research filtered by demographic groups and population types."
    },
    "/explore-by-delivery-method": {
      title: `Hydrogen Delivery Methods Research | ${SITE_NAME}`,
      description: "Compare research on hydrogen water, hydrogen gas inhalation, hydrogen-rich saline, hydrogen baths, and other delivery methods."
    },
    "/explore-by-benefit": {
      title: `Hydrogen Research by Health Benefit | ${SITE_NAME}`,
      description: "Browse hydrogen therapy research organized by health benefit — antioxidant, anti-inflammatory, neuroprotective, and more."
    },
    "/learn/basics": {
      title: `Hydrogen Therapy Basics | ${SITE_NAME}`,
      description: "Everything you need to know about molecular hydrogen therapy — what it is, how it works, and what the research shows."
    },
    "/learn/health-benefits": {
      title: `Hydrogen Health Benefits Guide | ${SITE_NAME}`,
      description: "A comprehensive guide to the health benefits of molecular hydrogen, backed by peer-reviewed research studies."
    },
    "/learn/therapy-guide": {
      title: `Hydrogen Therapy Guide | ${SITE_NAME}`,
      description: "Your complete guide to hydrogen therapy — methods, dosages studied, safety profile, and what to expect from research findings."
    },
    "/recommendations": {
      title: `Research Recommendations | ${SITE_NAME}`,
      description: "Personalized hydrogen therapy research recommendations based on your interests, health conditions, and reading history."
    },
    "/products": {
      title: `Hydrogen Products | ${SITE_NAME}`,
      description: "Explore hydrogen water generators, inhalation devices, and other hydrogen therapy products backed by research."
    },
    "/contact": {
      title: `Contact Us | ${SITE_NAME}`,
      description: "Get in touch with the Hydrogen Studies team. Questions about hydrogen research, partnership inquiries, or feedback welcome."
    },
    "/privacy": {
      title: `Privacy Policy | ${SITE_NAME}`,
      description: "Hydrogen Studies privacy policy — how we collect, use, and protect your personal information."
    },
    "/terms": {
      title: `Terms of Service | ${SITE_NAME}`,
      description: "Terms of service for using the Hydrogen Studies research database and website."
    },
  };

  // Check explore-by-condition category pages
  const conditionMatch = pathname.match(/^\/explore-by-condition\/([^/]+)$/);
  if (conditionMatch) {
    const category = conditionMatch[1].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    return {
      title: `Hydrogen Research for ${category} | ${SITE_NAME}`,
      description: `Explore peer-reviewed research studies on hydrogen therapy for ${category.toLowerCase()}. Evidence-based findings, study summaries, and clinical insights.`,
      canonical: canonicalForCondition(conditionMatch[1]),
      ogType: "website",
      ogImage: `${SITE_URL}/logo.png`,
    };
  }

  // Check explore-by-body-system category pages
  const bodySystemMatch = pathname.match(/^\/explore-by-body-system\/([^/]+)$/);
  if (bodySystemMatch) {
    const system = bodySystemMatch[1].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    return {
      title: `Hydrogen Research: ${system} System | ${SITE_NAME}`,
      description: `Research studies on molecular hydrogen's effects on the ${system.toLowerCase()} system. Browse clinical trials, reviews, and findings.`,
      canonical: `${SITE_URL}${pathname}`,
      ogType: "website",
      ogImage: `${SITE_URL}/logo.png`,
    };
  }

  // Check explore-by-mechanism pages
  const mechanismMatch = pathname.match(/^\/explore-by-mechanism\/([^/]+)$/);
  if (mechanismMatch) {
    const mechanism = mechanismMatch[1].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    return {
      title: `${mechanism} Hydrogen Therapy Research | ${SITE_NAME}`,
      description: `Research on ${mechanism.toLowerCase()} as a hydrogen delivery mechanism. Studies, protocols, and clinical outcomes.`,
      canonical: `${SITE_URL}${pathname}`,
      ogType: "website",
      ogImage: `${SITE_URL}/logo.png`,
    };
  }

  // Check explore-by-life-stage pages
  const lifeStageMatch = pathname.match(/^\/explore-by-life-stage\/([^/]+)$/);
  if (lifeStageMatch) {
    const stage = lifeStageMatch[1].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    return {
      title: `Hydrogen Research for ${stage} | ${SITE_NAME}`,
      description: `Hydrogen therapy research studies relevant to ${stage.toLowerCase()}. Evidence-based findings and clinical applications.`,
      canonical: `${SITE_URL}${pathname}`,
      ogType: "website",
      ogImage: `${SITE_URL}/logo.png`,
    };
  }

  const pageMeta = pages[pathname];
  if (!pageMeta) return null;

  return {
    title: pageMeta.title,
    description: pageMeta.description,
    canonical: `${SITE_URL}${pathname}`,
    ogType: "website",
    ogImage: `${SITE_URL}/logo.png`,
  };
}

/**
 * Extract the Vite entry <script> and <link rel="stylesheet"|"modulepreload">
 * tags from the original template <head>. The production build places the app
 * JS bundle and CSS inside <head>; injectMeta rebuilds <head> from scratch, so
 * these must be re-appended or every bot-served page loses its CSS and has an
 * empty #root with no script to hydrate it (a blank thin page).
 */
function extractHeadAssets(html: string): string {
  const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
  if (!headMatch) return "";
  const head = headMatch[1];
  const assets: string[] = [];
  const scriptRe = /<script\b[^>]*>[\s\S]*?<\/script>|<script\b[^>]*\/>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(head)) !== null) assets.push(m[0]);
  const linkRe = /<link\b[^>]*>/gi;
  while ((m = linkRe.exec(head)) !== null) {
    if (/rel=["'](?:stylesheet|modulepreload)["']/i.test(m[0])) assets.push(m[0]);
  }
  return assets.length ? "\n    " + assets.join("\n    ") : "";
}

/** Inject meta tags into HTML template */
function injectMeta(html: string, meta: PageMeta): string {
  const title = escapeHtml(meta.title);
  const desc = escapeHtml(meta.description);
  const canonical = escapeHtml(meta.canonical);
  const ogImage = escapeHtml(meta.ogImage);
  const ogType = escapeHtml(meta.ogType);

  // Build JSON-LD script tag(s)
  let jsonLdScript = "";
  if (meta.jsonLd) {
    if (Array.isArray(meta.jsonLd)) {
      jsonLdScript = meta.jsonLd.map(ld =>
        `<script type="application/ld+json">${jsonLdSafe(ld)}</script>`
      ).join("\n    ");
    } else {
      jsonLdScript = `<script type="application/ld+json">${jsonLdSafe(meta.jsonLd)}</script>`;
    }
  }

  // Replace the <head> content with proper meta tags
  const newHead = `<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- Primary SEO Meta Tags (Server-Injected for Crawlers) -->
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    ${meta.robots ? `<meta name="robots" content="${escapeHtml(meta.robots)}" />` : '<meta name="robots" content="index, follow" />'}

    <!-- Open Graph -->
    <meta property="og:type" content="${ogType}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:locale" content="en_US" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${ogImage}" />

    <!-- Canonical URL -->
    <link rel="canonical" href="${canonical}" />

    ${jsonLdScript}

    <!-- Ahrefs Analytics -->
    <script src="https://analytics.ahrefs.com/analytics.js" data-key="rjIt9UY/qFbTPzCzRK8BRg" async></script>`;

  // Replace existing <head> tag content up to the closing </head>, but preserve
  // the original Vite JS bundle / CSS / modulepreload tags so the page stays
  // styled and hydratable.
  const preservedAssets = extractHeadAssets(html);
  return html.replace(/<head>[\s\S]*?(?=<\/head>)/, `${newHead}${preservedAssets}\n  `);
}

/** Inject rendered body content into the empty #root div */
function injectBody(html: string, body: string): string {
  return html.replace(/<div id="root">\s*<\/div>/, `<div id="root">${body}</div>`);
}

// ── LRU Cache for bot-rendered HTML ───────────────────────────

const botHtmlCache = new Map<string, { html: string; expiry: number }>();
const BOT_CACHE_MAX = 6000; // enough for all study + blog + explore pages
const BOT_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

function getCachedBotHtml(key: string): string | null {
  const entry = botHtmlCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    botHtmlCache.delete(key);
    return null;
  }
  // Move to end (most recently used)
  botHtmlCache.delete(key);
  botHtmlCache.set(key, entry);
  return entry.html;
}

function setCachedBotHtml(key: string, html: string): void {
  botHtmlCache.delete(key);
  if (botHtmlCache.size >= BOT_CACHE_MAX) {
    const firstKey = botHtmlCache.keys().next().value;
    if (firstKey) botHtmlCache.delete(firstKey);
  }
  botHtmlCache.set(key, { html, expiry: Date.now() + BOT_CACHE_TTL });
}

/**
 * Invalidate cached bot HTML. Pass a specific path to drop just that entry —
 * call this from study/blog delete, unpublish, and slug-change flows so a
 * removed or changed page stops being served to crawlers with a stale 200
 * (old canonical/JSON-LD) until the 2h TTL expires. Pass no argument to clear
 * the entire cache.
 */
export function invalidateBotCache(path?: string): void {
  if (path) {
    botHtmlCache.delete(path);
  } else {
    botHtmlCache.clear();
  }
}

// ── Middleware ─────────────────────────────────────────────────

import { renderPageBody } from "./seo-body-renderer";

/**
 * Express middleware: intercepts requests from bots, injects correct
 * meta tags AND body content, serves enhanced HTML. Human visitors pass through to SPA.
 */
export function seoBotMiddleware(staticPath: string) {
  let htmlTemplate: string | null = null;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only intercept GET requests for non-API, non-asset paths
    if (req.method !== "GET") return next();
    if (req.path.startsWith("/api/")) return next();
    if (req.path.startsWith("/assets/")) return next();
    if (req.path.startsWith("/proxy/")) return next();
    if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|webp)$/)) return next();

    const ua = req.headers["user-agent"] || "";
    if (!isBot(ua)) return next();

    // Check LRU cache first
    const cached = getCachedBotHtml(req.path);
    if (cached) {
      res.set("Content-Type", "text/html");
      // Responses vary entirely by User-Agent (prerendered bot HTML vs SPA
      // shell) — Vary keeps a shared/CDN cache from serving this to humans.
      res.set("Vary", "User-Agent");
      res.set("Cache-Control", "public, max-age=3600");
      res.set("X-Bot-Cache", "HIT");
      return res.send(cached);
    }

    // Load HTML template once
    if (!htmlTemplate) {
      const indexPath = path.join(staticPath, "index.html");
      if (fs.existsSync(indexPath)) {
        htmlTemplate = fs.readFileSync(indexPath, "utf-8");
      } else {
        return next();
      }
    }
    const template = htmlTemplate;

    // Hard 404 (noindex, uncached so the URL recovers the moment content
    // exists) for any recognized route with no real content to show.
    const serve404 = () => {
      const notFoundHtml = injectMeta(template, {
        title: `Page Not Found | ${SITE_NAME}`,
        description: "The page you're looking for doesn't exist or has moved.",
        canonical: `${SITE_URL}${req.path}`,
        ogType: "website",
        ogImage: `${SITE_URL}/logo.png`,
        robots: "noindex, follow",
      });
      res.status(404);
      res.set("Content-Type", "text/html");
      res.set("Vary", "User-Agent");
      res.set("Cache-Control", "no-cache");
      return res.send(notFoundHtml);
    };

    try {
      const meta = await resolvePageMeta(req.path);

      // DB-backed content path with no matching row: real 404. Resolved before
      // rendering a body to avoid a second dead DB lookup for known-dead slugs.
      if (!meta && isContentPath(req.path)) {
        return serve404();
      }

      // Prerender the body. A recognized route that yields no body — a
      // condition/body-system slug with zero matches, /this-week, /recent, or
      // any unknown junk path — has no real content, so serve a hard 404 rather
      // than a soft-404 blank 200 with homepage meta (a cloaking/soft-404
      // signal that also fills the LRU with junk paths).
      const body = await renderPageBody(req.path);
      if (!body) {
        return serve404();
      }

      // Meta may still be null for a legit SPA route that rendered a body but
      // is absent from the static-meta map: fall back to homepage meta with a
      // self-referential canonical, but never cache the fallback (it is not a
      // first-class page and must not evict prewarmed entries).
      const fallbackMeta = resolveStaticPageMeta("/");
      if (!meta && !fallbackMeta) return next();
      const effectiveMeta = meta || { ...fallbackMeta!, canonical: `${SITE_URL}${req.path}` };

      let enhancedHtml = injectMeta(template, effectiveMeta);
      enhancedHtml = injectBody(enhancedHtml, body);

      res.set("Content-Type", "text/html");
      res.set("Vary", "User-Agent");
      if (meta) {
        // First-class page with resolved meta — cache it.
        setCachedBotHtml(req.path, enhancedHtml);
        res.set("Cache-Control", "public, max-age=3600");
        res.set("X-Bot-Cache", "MISS");
      } else {
        // Fallback meta — serve but do not cache.
        res.set("Cache-Control", "no-cache");
        res.set("X-Bot-Cache", "FALLBACK");
      }
      res.send(enhancedHtml);
    } catch (err) {
      console.error("[SEO Bot] Middleware error:", err);
      next(); // Fall through to normal SPA on error
    }
  };
}

// ── Cache pre-warmer ──────────────────────────────────────────

/**
 * Pre-render and cache the most important pages so bot requests
 * never hit cold DB queries. Call after migrations complete.
 */
export async function prewarmBotCache(staticPath: string): Promise<void> {
  const indexPath = path.join(staticPath, "index.html");
  if (!fs.existsSync(indexPath)) return;
  const template = fs.readFileSync(indexPath, "utf-8");

  console.log("[SEO Bot] Pre-warming bot cache...");
  const start = Date.now();

  // Collect paths to pre-warm
  const paths: string[] = ["/", "/studies", "/blog", "/explore-by-condition", "/explore-by-body-system"];

  try {
    const { db: database } = await import("../db");
    const { sql } = await import("drizzle-orm");

    // All study slugs
    const studyRows = await database.execute(sql`SELECT slug FROM studies WHERE slug IS NOT NULL`);
    for (const row of (studyRows.rows || []) as any[]) {
      if (row.slug && !row.slug.startsWith("id/")) paths.push(`/study/${row.slug}`);
    }

    // All blog slugs
    const blogRows = await database.execute(sql`SELECT slug FROM blog_articles WHERE slug IS NOT NULL AND is_published = true`);
    for (const row of (blogRows.rows || []) as any[]) {
      if (row.slug) paths.push(`/blog/${row.slug}`);
    }

    // All condition slugs
    const condRows = await database.execute(sql`SELECT slug FROM health_conditions WHERE slug IS NOT NULL`);
    for (const row of (condRows.rows || []) as any[]) {
      if (row.slug) paths.push(`/explore-by-condition/${row.slug}`);
    }
  } catch (err) {
    console.error("[SEO Bot] Failed to fetch paths for pre-warm:", err);
  }

  let warmed = 0;
  let errors = 0;

  for (const pagePath of paths) {
    try {
      const meta = await resolvePageMeta(pagePath);
      const effectiveMeta = meta || resolveStaticPageMeta("/");
      if (!effectiveMeta) continue;

      let html = injectMeta(template, meta || { ...effectiveMeta, canonical: `${SITE_URL}${pagePath}` });
      const body = await renderPageBody(pagePath);
      if (body) html = injectBody(html, body);

      setCachedBotHtml(pagePath, html);
      warmed++;
    } catch {
      errors++;
    }

    // Yield to event loop every 50 pages to avoid blocking
    if (warmed % 50 === 0) await new Promise((r) => setTimeout(r, 1));
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[SEO Bot] Cache pre-warmed: ${warmed} pages in ${elapsed}s (${errors} errors, ${paths.length} total)`);
}
