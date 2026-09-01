/**
 * SEO Routes — Dynamic sitemaps, robots.txt, and SEO utilities
 *
 * Replaces static sitemap XML files with database-driven dynamic generation.
 * All content is automatically included as it's added to the database.
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { studies, blogArticles, healthConditions } from "../../shared/schema";
import { eq, desc, isNotNull, isNull, sql, and, count, inArray, gt } from "drizzle-orm";
import { requireAdmin } from "../auth";
import { logger } from "../utils/logger";
import { toAbsoluteUrl } from "../utils/absolute-url";

const router = Router();
const SITE_URL = process.env.SITE_URL || "https://hydrogenstudies.com";

// Cache sitemaps for 1 hour to avoid hammering the DB on every crawl
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_ENTRIES = 20; // Prevent unbounded memory growth
const sitemapCache: Record<string, { content: string; timestamp: number }> = {};

function getCached(key: string): string | null {
  const entry = sitemapCache[key];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    delete sitemapCache[key]; // Evict expired entries on read
    return null;
  }
  return entry.content;
}

function setCache(key: string, content: string): void {
  // Evict expired entries and enforce max size
  const keys = Object.keys(sitemapCache);
  if (keys.length >= MAX_CACHE_ENTRIES) {
    const now = Date.now();
    for (const k of keys) {
      if (now - sitemapCache[k].timestamp > CACHE_TTL) {
        delete sitemapCache[k];
      }
    }
    // If still at max, evict oldest
    const remaining = Object.keys(sitemapCache);
    if (remaining.length >= MAX_CACHE_ENTRIES) {
      let oldestKey = remaining[0];
      let oldestTime = sitemapCache[oldestKey].timestamp;
      for (const k of remaining) {
        if (sitemapCache[k].timestamp < oldestTime) {
          oldestKey = k;
          oldestTime = sitemapCache[k].timestamp;
        }
      }
      delete sitemapCache[oldestKey];
    }
  }
  sitemapCache[key] = { content, timestamp: Date.now() };
}

function xmlHeader(): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n';
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return new Date().toISOString().split("T")[0];
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return new Date().toISOString().split("T")[0];
  return date.toISOString().split("T")[0];
}

// ============================================================
// Dynamic robots.txt
// ============================================================
router.get("/robots.txt", (req: Request, res: Response) => {
  const host = req.get("host") || "hydrogenstudies.com";
  const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  const baseUrl = process.env.SITE_URL || `${protocol}://${host}`;

  const robotsTxt = `# Hydrogen Studies — robots.txt
# https://hydrogenstudies.com

User-agent: *
Allow: /
Allow: /study/
Allow: /blog/
Allow: /studies
Allow: /explore-by-condition/
Allow: /explore-by-body-system/
Allow: /explore-by-mechanism/
Allow: /explore-by-life-stage/
Allow: /explore-by-demographic/
Allow: /explore-by-delivery-method/
Allow: /explore-by-benefit/
Allow: /learn/
Allow: /search
Allow: /advanced-search
Allow: /about
Allow: /benefits
Allow: /products
Allow: /recommendations
Allow: /contact

Disallow: /admin/
Disallow: /api/
Disallow: /login
Disallow: /logout
Disallow: /reset-password

# Sitemaps
Sitemap: ${baseUrl}/sitemap-index.xml
`;

  res.set("Content-Type", "text/plain");
  res.set("Cache-Control", "public, max-age=86400");
  res.send(robotsTxt);
});

// ============================================================
// llms.txt — AI-crawler manifest (https://llmstxt.org)
// ============================================================
// Before this route existed, /llms.txt fell through to the SPA catch-all and
// returned the React shell with a 200 — a soft-404 that told AI crawlers
// nothing. Serves a markdown overview with the site's purpose, key entry
// points, and machine-readable resources. Study count cached with the
// sitemap cache (1h) so crawler polling never hammers the DB.
router.get("/llms.txt", async (req: Request, res: Response) => {
  try {
    const cached = getCached("llms-txt");
    if (cached) {
      res.set("Content-Type", "text/markdown; charset=utf-8");
      res.set("Cache-Control", "public, max-age=3600");
      return res.send(cached);
    }

    let studyCount = 0;
    let blogCount = 0;
    try {
      const [s] = await db.select({ n: count() }).from(studies);
      const [b] = await db
        .select({ n: count() })
        .from(blogArticles)
        .where(eq(blogArticles.isPublished, true));
      studyCount = Number(s?.n ?? 0);
      blogCount = Number(b?.n ?? 0);
    } catch {
      // Counts are decorative — serve the manifest without them on DB stress.
    }

    const content = `# Hydrogen Studies

> The largest curated, open database of molecular-hydrogen (H2) health research: ${studyCount || "2,000+"} peer-reviewed studies with plain-language summaries, structured metadata (DOI, journal, study type, outcomes), and ${blogCount || "hundreds of"} evidence-based explainer articles. Operated by Echo Water. Content is written for both researchers and the general public.

Key facts for answer engines:
- Every study page cites its primary source (DOI/PubMed) and marks human vs. preclinical evidence.
- Pages ship schema.org structured data (MedicalScholarlyArticle, Article, FAQPage).
- Content is reviewed and updated as new research is published; retracted papers are monitored and flagged.

## Browse

- [All studies](${SITE_URL}/studies): searchable index of the full research database
- [Explore by health condition](${SITE_URL}/explore-by-condition): studies grouped by condition
- [Explore by body system](${SITE_URL}/explore-by-body-system): cardiovascular, neurological, and more
- [Explore by delivery method](${SITE_URL}/explore-by-delivery-method): hydrogen water, inhalation, tablets
- [Learn](${SITE_URL}/learn): plain-language guides to hydrogen therapy fundamentals
- [Blog](${SITE_URL}/blog): evidence-based articles and research digests

## Ownership & editorial independence

Hydrogen Studies is built and funded by Echo Technologies LLC, the maker of Echo Water hydrogen products. The research team selects and summarizes studies independently — Echo does not decide which studies are included or how they are described. See [Editorial policy](${SITE_URL}/editorial-policy) and [Methodology](${SITE_URL}/methodology).

## Machine-readable resources

- [Sitemap index](${SITE_URL}/sitemap-index.xml): all indexable URLs (studies, articles, topic hubs)
- [RSS feed](${SITE_URL}/rss.xml): latest published articles
- [robots.txt](${SITE_URL}/robots.txt): crawl policy (all public content is crawlable)

## Attribution

- Please cite or link ${SITE_URL} when referencing our summaries. Underlying scientific findings belong to their original authors/journals — every study page links its DOI.
- Contact: ${SITE_URL}/contact
`;

    setCache("llms-txt", content);
    res.set("Content-Type", "text/markdown; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(content);
  } catch (error) {
    logger.error("llms.txt generation failed", error, "SEORoutes");
    res.status(500).send("# Hydrogen Studies\n\nTemporarily unavailable.");
  }
});

// ============================================================
// Sitemap Index
// ============================================================
// Serve the same content at both `/sitemap.xml` (the historical convention
// crawlers probe by default) and `/sitemap-index.xml` (what robots.txt
// advertises). Without this, the SPA catch-all caught /sitemap.xml and
// returned the React app's index.html — a soft-404 from Google's view.
router.get(["/sitemap.xml", "/sitemap-index.xml"], (req: Request, res: Response) => {
  const today = formatDate(new Date());
  const xml = xmlHeader() +
`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE_URL}/sitemap-pages.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-studies.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-blog.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-categories.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-explore.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>`;

  res.set("Content-Type", "application/xml");
  res.set("Cache-Control", "public, max-age=3600");
  res.send(xml);
});

// ============================================================
// Static Pages Sitemap
// ============================================================
router.get("/sitemap-pages.xml", (req: Request, res: Response) => {
  const today = formatDate(new Date());

  const pages = [
    { url: "/", priority: "1.0", freq: "daily" },
    { url: "/studies", priority: "0.9", freq: "daily" },
    { url: "/blog", priority: "0.9", freq: "daily" },
    // PLAN.md 0.6: internal search results are noindex and out of the sitemap.
    // PLAN.md 1.8: thin pages (/products, /recommendations, /learn/*) are
    // noindex until they carry real content — kept in nav, not in the sitemap.
    { url: "/benefits", priority: "0.8", freq: "monthly" },
    { url: "/about", priority: "0.6", freq: "monthly" },
    { url: "/contact", priority: "0.4", freq: "yearly" },
    { url: "/explore-by-condition", priority: "0.9", freq: "weekly" },
    { url: "/explore-by-body-system", priority: "0.9", freq: "weekly" },
    { url: "/explore-by-mechanism", priority: "0.8", freq: "weekly" },
    { url: "/explore-by-life-stage", priority: "0.8", freq: "weekly" },
    { url: "/explore-by-demographic", priority: "0.7", freq: "weekly" },
    { url: "/explore-by-delivery-method", priority: "0.8", freq: "weekly" },
    { url: "/explore-by-benefit", priority: "0.8", freq: "weekly" },
    { url: "/insights", priority: "0.7", freq: "weekly" },
    { url: "/research-analytics", priority: "0.7", freq: "weekly" },
    { url: "/hydrogen-therapy-guide", priority: "0.9", freq: "monthly" },
    // Programmatic hydrogen-for condition pages
    { url: "/hydrogen-for/heart-disease", priority: "0.8", freq: "weekly" },
    { url: "/hydrogen-for/diabetes", priority: "0.8", freq: "weekly" },
    { url: "/hydrogen-for/brain-health", priority: "0.8", freq: "weekly" },
    { url: "/hydrogen-for/inflammation", priority: "0.8", freq: "weekly" },
    { url: "/hydrogen-for/cancer-support", priority: "0.8", freq: "weekly" },
    { url: "/hydrogen-for/athletic-performance", priority: "0.8", freq: "weekly" },
    { url: "/hydrogen-for/skin-health", priority: "0.8", freq: "weekly" },
    { url: "/hydrogen-for/gut-health", priority: "0.8", freq: "weekly" },
    { url: "/hydrogen-for/kidney-health", priority: "0.8", freq: "weekly" },
    { url: "/hydrogen-for/lung-health", priority: "0.8", freq: "weekly" },
    { url: "/privacy", priority: "0.2", freq: "yearly" },
    { url: "/terms", priority: "0.2", freq: "yearly" },
  ];

  const urls = pages.map(p => `  <url>
    <loc>${SITE_URL}${p.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.freq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join("\n");

  const xml = xmlHeader() +
`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  res.set("Content-Type", "application/xml");
  res.set("Cache-Control", "public, max-age=3600");
  res.send(xml);
});

// ============================================================
// Studies Sitemap (dynamic from DB)
// ============================================================
router.get("/sitemap-studies.xml", async (req: Request, res: Response) => {
  try {
    const cached = getCached("studies");
    if (cached) {
      res.set("Content-Type", "application/xml");
      res.set("Cache-Control", "public, max-age=3600");
      return res.send(cached);
    }

    // Only include studies with proper SEO slugs — exclude id-only entries
    const allStudies = await db.select({
      id: studies.id,
      slug: studies.slug,
      lastModified: studies.lastModified,
      createdAt: studies.createdAt,
      imageUrl: studies.imageUrl,
      title: studies.title,
      publishYear: studies.publishYear,
    }).from(studies)
      .where(isNotNull(studies.slug))
      .orderBy(desc(studies.id));

    const urls = allStudies
      .filter(s => s.slug && !s.slug.startsWith("id/"))
      .map(s => {
      const lastmod = formatDate(s.lastModified || s.createdAt);
      const imageTag = s.imageUrl ? `
    <image:image>
      <image:loc>${escapeXml(toAbsoluteUrl(s.imageUrl, SITE_URL))}</image:loc>
      <image:title>${escapeXml(s.title)}</image:title>
    </image:image>` : "";
      return `  <url>
    <loc>${SITE_URL}/study/${encodeURIComponent(s.slug!)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>${imageTag}
  </url>`;
    }).join("\n");

    const xml = xmlHeader() +
`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>`;

    setCache("studies", xml);
    res.set("Content-Type", "application/xml");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (err) {
    console.error("[Sitemap] Error generating studies sitemap:", err);
    res.status(500).send("Error generating sitemap");
  }
});

// ============================================================
// Blog Sitemap (dynamic from DB)
// ============================================================
router.get("/sitemap-blog.xml", async (req: Request, res: Response) => {
  try {
    const cached = getCached("blog");
    if (cached) {
      res.set("Content-Type", "application/xml");
      res.set("Cache-Control", "public, max-age=3600");
      return res.send(cached);
    }

    const allBlogs = await db.select({
      id: blogArticles.id,
      slug: blogArticles.slug,
      updatedAt: blogArticles.updatedAt,
      createdAt: blogArticles.createdAt,
      imageUrl: blogArticles.imageUrl,
      title: blogArticles.title,
      isPublished: blogArticles.isPublished,
    }).from(blogArticles)
      .where(eq(blogArticles.isPublished, true))
      .orderBy(desc(blogArticles.id));

    const urls = allBlogs.map(b => {
      const lastmod = formatDate(b.updatedAt || b.createdAt);
      const imageTag = b.imageUrl ? `
    <image:image>
      <image:loc>${escapeXml(toAbsoluteUrl(b.imageUrl, SITE_URL))}</image:loc>
      <image:title>${escapeXml(b.title)}</image:title>
    </image:image>` : "";
      return `  <url>
    <loc>${SITE_URL}/blog/${encodeURIComponent(b.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>${imageTag}
  </url>`;
    }).join("\n");

    const xml = xmlHeader() +
`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>`;

    setCache("blog", xml);
    res.set("Content-Type", "application/xml");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (err) {
    console.error("[Sitemap] Error generating blog sitemap:", err);
    res.status(500).send("Error generating sitemap");
  }
});

// ============================================================
// Categories Sitemap (dynamic from DB)
// ============================================================
router.get("/sitemap-categories.xml", async (req: Request, res: Response) => {
  try {
    const cached = getCached("categories");
    if (cached) {
      res.set("Content-Type", "application/xml");
      res.set("Cache-Control", "public, max-age=3600");
      return res.send(cached);
    }

    // Generate condition URLs from health_conditions — the same table the
    // crawler-facing renderer validates slugs against — so every URL here
    // resolves to a real page (see seo-body-renderer.ts).
    const conditions = await db.select({
      slug: healthConditions.slug,
      createdAt: healthConditions.createdAt,
    }).from(healthConditions);

    const urls = conditions.map(c => {
      const lastmod = formatDate(c.createdAt);
      return `  <url>
    <loc>${SITE_URL}/explore-by-condition/${encodeURIComponent(c.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    }).join("\n");

    const xml = xmlHeader() +
`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

    setCache("categories", xml);
    res.set("Content-Type", "application/xml");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (err) {
    console.error("[Sitemap] Error generating categories sitemap:", err);
    res.status(500).send("Error generating sitemap");
  }
});

// ============================================================
// Explore Pages Sitemap (condition/body-system/mechanism sub-pages)
// ============================================================
router.get("/sitemap-explore.xml", async (req: Request, res: Response) => {
  try {
    const cached = getCached("explore");
    if (cached) {
      res.set("Content-Type", "application/xml");
      res.set("Cache-Control", "public, max-age=3600");
      return res.send(cached);
    }

    // NOTE: Condition pages are in sitemap-categories.xml — don't duplicate here.
    // This sitemap covers body systems, mechanisms, delivery methods, and life stages only.
    const urls: string[] = [];
    const today = formatDate(new Date());

    // Predefined body system explore pages
    const bodySystems = [
      "brain-nervous-system", "cardiovascular", "digestive", "immune-system",
      "musculoskeletal", "respiratory", "endocrine", "urinary-renal",
      "skin-dermatology", "reproductive", "liver", "eyes-vision",
    ];
    for (const bs of bodySystems) {
      urls.push(`  <url>
    <loc>${SITE_URL}/explore-by-body-system/${bs}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
    }

    // Predefined mechanism pages
    const mechanisms = [
      "hydrogen-water", "hydrogen-inhalation", "hydrogen-rich-saline",
      "hydrogen-bath", "topical-hydrogen", "hydrogen-gas",
    ];
    for (const m of mechanisms) {
      urls.push(`  <url>
    <loc>${SITE_URL}/explore-by-mechanism/${m}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
    }

    // Predefined life stage pages
    const lifeStages = [
      "pregnancy", "infants-children", "adults", "elderly-aging", "athletes",
    ];
    for (const ls of lifeStages) {
      urls.push(`  <url>
    <loc>${SITE_URL}/explore-by-life-stage/${ls}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
    }

    const xml = xmlHeader() +
`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

    setCache("explore", xml);
    res.set("Content-Type", "application/xml");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (err) {
    console.error("[Sitemap] Error generating explore sitemap:", err);
    res.status(500).send("Error generating sitemap");
  }
});

// ============================================================
// RSS Feed (RSS 2.0)
// ============================================================
router.get("/rss.xml", async (req: Request, res: Response) => {
  try {
    const cached = getCached("rss");
    if (cached) {
      res.set("Content-Type", "application/rss+xml; charset=utf-8");
      res.set("Cache-Control", "public, max-age=3600");
      return res.send(cached);
    }

    const recentPosts = await db.select({
      id: blogArticles.id,
      title: blogArticles.title,
      slug: blogArticles.slug,
      summary: blogArticles.summary,
      createdAt: blogArticles.createdAt,
    }).from(blogArticles)
      .where(eq(blogArticles.isPublished, true))
      .orderBy(desc(blogArticles.createdAt))
      .limit(50);

    const items = recentPosts.map(post => {
      const pubDate = post.createdAt
        ? new Date(post.createdAt).toUTCString()
        : new Date().toUTCString();
      const link = `${SITE_URL}/blog/${encodeURIComponent(post.slug)}`;
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <description>${escapeXml(post.summary)}</description>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
    </item>`;
    }).join("\n");

    const lastBuildDate = recentPosts.length > 0 && recentPosts[0].createdAt
      ? new Date(recentPosts[0].createdAt).toUTCString()
      : new Date().toUTCString();

    const xml = xmlHeader() +
`<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Hydrogen Studies Blog - Latest Research Insights</title>
    <description>Latest articles on hydrogen therapy research, health benefits, and scientific discoveries</description>
    <link>${SITE_URL}/blog</link>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>`;

    setCache("rss", xml);
    res.set("Content-Type", "application/rss+xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (err) {
    console.error("[RSS] Error generating RSS feed:", err);
    res.status(500).send("Error generating RSS feed");
  }
});

// Also serve at /feed.xml as an alias
router.get("/feed.xml", (req: Request, res: Response) => {
  res.redirect(301, "/rss.xml");
});

// ============================================================
// Blog RSS Feed (RSS 2.0) — /rss/blog.xml
// ============================================================
router.get("/rss/blog.xml", async (req: Request, res: Response) => {
  try {
    const cached = getCached("rss-blog");
    if (cached) {
      res.set("Content-Type", "application/rss+xml; charset=utf-8");
      res.set("Cache-Control", "public, max-age=3600");
      return res.send(cached);
    }

    const recentPosts = await db.select({
      id: blogArticles.id,
      title: blogArticles.title,
      slug: blogArticles.slug,
      summary: blogArticles.summary,
      content: blogArticles.content,
      imageUrl: blogArticles.imageUrl,
      createdAt: blogArticles.createdAt,
    }).from(blogArticles)
      .where(eq(blogArticles.isPublished, true))
      .orderBy(desc(blogArticles.createdAt))
      .limit(50);

    const items = recentPosts.map(post => {
      const pubDate = post.createdAt
        ? new Date(post.createdAt).toUTCString()
        : new Date().toUTCString();
      const link = `${SITE_URL}/blog/${encodeURIComponent(post.slug)}`;
      const description = post.summary || (post.content ? post.content.substring(0, 300) : "");
      const enclosureTag = post.imageUrl
        ? `\n      <enclosure url="${escapeXml(toAbsoluteUrl(post.imageUrl, SITE_URL))}" type="${mimeTypeFromUrl(post.imageUrl)}" length="0" />`
        : "";
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <description>${escapeXml(description)}</description>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>${enclosureTag}
    </item>`;
    }).join("\n");

    const lastBuildDate = recentPosts.length > 0 && recentPosts[0].createdAt
      ? new Date(recentPosts[0].createdAt).toUTCString()
      : new Date().toUTCString();

    const xml = xmlHeader() +
`<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Hydrogen Studies Research Blog</title>
    <description>Latest research insights on molecular hydrogen therapy and hydrogen water health benefits</description>
    <link>${SITE_URL}/blog</link>
    <atom:link href="${SITE_URL}/rss/blog.xml" rel="self" type="application/rss+xml" />
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>`;

    setCache("rss-blog", xml);
    res.set("Content-Type", "application/rss+xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (err) {
    console.error("[RSS] Error generating blog RSS feed:", err);
    res.status(500).send("Error generating RSS feed");
  }
});

// Derive an image MIME type from a URL's file extension for RSS enclosures.
// Feed parsers reject a hardcoded image/jpeg on png/webp/gif images.
function mimeTypeFromUrl(url: string): string {
  const ext = url.split(/[?#]/)[0].split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png": return "image/png";
    case "webp": return "image/webp";
    case "gif": return "image/gif";
    case "svg": return "image/svg+xml";
    case "avif": return "image/avif";
    default: return "image/jpeg";
  }
}

function escapeXml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ============================================================
// Admin routes — exported separately so they can be mounted
// AFTER session middleware in app.ts
// ============================================================
export const seoAdminRouter = Router();

seoAdminRouter.post("/blogs/populate-seo-fields", requireAdmin, async (req: Request, res: Response) => {
  try {
    const allBlogs = await db.select({
      id: blogArticles.id,
      title: blogArticles.title,
      slug: blogArticles.slug,
      summary: blogArticles.summary,
      imageUrl: blogArticles.imageUrl,
      imageAlt: blogArticles.imageAlt,
      metaTitle: blogArticles.metaTitle,
      metaDescription: blogArticles.metaDescription,
      canonicalUrl: blogArticles.canonicalUrl,
      ogTitle: blogArticles.ogTitle,
      ogDescription: blogArticles.ogDescription,
      ogImage: blogArticles.ogImage,
      twitterCard: blogArticles.twitterCard,
      twitterTitle: blogArticles.twitterTitle,
      twitterDescription: blogArticles.twitterDescription,
      breadcrumbs: blogArticles.breadcrumbs,
      lastReviewed: blogArticles.lastReviewed,
    }).from(blogArticles);

    if (allBlogs.length === 0) {
      return res.json({ message: "No blog articles found", updated: 0, total: 0, fields: {} });
    }

    const BATCH_SIZE = 50;
    let totalUpdated = 0;
    const fieldCounts: Record<string, number> = {
      imageAlt: 0,
      canonicalUrl: 0,
      ogTitle: 0,
      ogDescription: 0,
      ogImage: 0,
      twitterCard: 0,
      twitterTitle: 0,
      twitterDescription: 0,
      breadcrumbs: 0,
      lastReviewed: 0,
    };

    // Process in batches of BATCH_SIZE
    for (let i = 0; i < allBlogs.length; i += BATCH_SIZE) {
      const batch = allBlogs.slice(i, i + BATCH_SIZE);

      const updatePromises = batch.map(async (blog) => {
        const updates: Record<string, any> = {};
        const fieldsPopulated: string[] = [];

        // imageAlt: generate from title if NULL
        if (!blog.imageAlt) {
          const alt = `Illustration for: ${blog.title}`.substring(0, 125);
          updates.imageAlt = alt;
          fieldsPopulated.push("imageAlt");
        }

        // canonicalUrl: set from slug if NULL
        if (!blog.canonicalUrl) {
          updates.canonicalUrl = `https://hydrogenstudies.com/blog/${blog.slug}`;
          fieldsPopulated.push("canonicalUrl");
        }

        // ogTitle: set to metaTitle || title if NULL
        if (!blog.ogTitle) {
          updates.ogTitle = blog.metaTitle || blog.title;
          fieldsPopulated.push("ogTitle");
        }

        // ogDescription: set to metaDescription || summary (truncated to 200 chars) if NULL
        if (!blog.ogDescription) {
          const desc = (blog.metaDescription || blog.summary || "").substring(0, 200);
          updates.ogDescription = desc;
          fieldsPopulated.push("ogDescription");
        }

        // ogImage: set to imageUrl if it exists and ogImage is NULL
        if (!blog.ogImage && blog.imageUrl) {
          updates.ogImage = blog.imageUrl;
          fieldsPopulated.push("ogImage");
        }

        // twitterCard: set based on imageUrl if NULL
        if (!blog.twitterCard) {
          updates.twitterCard = blog.imageUrl ? "summary_large_image" : "summary";
          fieldsPopulated.push("twitterCard");
        }

        // twitterTitle: set to metaTitle || title if NULL
        if (!blog.twitterTitle) {
          updates.twitterTitle = blog.metaTitle || blog.title;
          fieldsPopulated.push("twitterTitle");
        }

        // twitterDescription: set to metaDescription || summary (truncated to 200 chars) if NULL
        if (!blog.twitterDescription) {
          const tDesc = (blog.metaDescription || blog.summary || "").substring(0, 200);
          updates.twitterDescription = tDesc;
          fieldsPopulated.push("twitterDescription");
        }

        // breadcrumbs: set navigation structure if NULL
        if (!blog.breadcrumbs) {
          updates.breadcrumbs = JSON.stringify([
            { name: "Home", url: "/" },
            { name: "Blog", url: "/blog" },
            { name: blog.title, url: `/blog/${blog.slug}` },
          ]);
          fieldsPopulated.push("breadcrumbs");
        }

        // lastReviewed: set to current date if NULL
        if (!blog.lastReviewed) {
          updates.lastReviewed = new Date();
          fieldsPopulated.push("lastReviewed");
        }

        // Only update if there are fields to set
        if (fieldsPopulated.length > 0) {
          updates.updatedAt = new Date();
          await db.update(blogArticles)
            .set(updates)
            .where(eq(blogArticles.id, blog.id));

          for (const field of fieldsPopulated) {
            fieldCounts[field]++;
          }
          return true;
        }
        return false;
      });

      const results = await Promise.all(updatePromises);
      totalUpdated += results.filter(Boolean).length;
    }

    logger.info(
      `Populated SEO fields for ${totalUpdated}/${allBlogs.length} blogs`,
      "SEO API",
    );

    res.json({
      message: `Populated SEO fields for ${totalUpdated} of ${allBlogs.length} blog articles`,
      updated: totalUpdated,
      total: allBlogs.length,
      fields: fieldCounts,
    });
  } catch (error) {
    logger.error("Populate SEO fields error", error, "SEO API");
    res.status(500).json({ error: "Failed to populate SEO fields" });
  }
});

// ============================================================
// Admin: Publish all blog articles that have content and title
// ============================================================
seoAdminRouter.post("/blogs/publish-all", requireAdmin, async (req: Request, res: Response) => {
  try {
    // Find all unpublished blogs that have both content and title
    const unpublished = await db.select({
      id: blogArticles.id,
      title: blogArticles.title,
    })
      .from(blogArticles)
      .where(
        and(
          eq(blogArticles.isPublished, false),
          isNotNull(blogArticles.content),
          isNotNull(blogArticles.title),
        ),
      );

    if (unpublished.length === 0) {
      return res.json({ message: "No unpublished blogs with content found", published: 0 });
    }

    const ids = unpublished.map((b) => b.id);

    // Batch update using IN clause
    await db.update(blogArticles)
      .set({
        isPublished: true,
        updatedAt: new Date(),
      })
      .where(
        sql`${blogArticles.id} IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`
      );

    logger.info(`Published ${unpublished.length} blog articles`, "SEO API");

    res.json({
      message: `Published ${unpublished.length} blog articles`,
      published: unpublished.length,
      articles: unpublished.map((b) => ({ id: b.id, title: b.title })),
    });
  } catch (error) {
    logger.error("Publish all blogs error", error, "SEO API");
    res.status(500).json({ error: "Failed to publish blog articles" });
  }
});

// ============================================================
// Admin: Batch generate blogs for studies that don't have one
// ============================================================
seoAdminRouter.post("/blogs/generate-batch", requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 50), 200);

    // Find all study IDs that do NOT have a corresponding blog article
    const studiesWithoutBlogs = await db
      .select({ id: studies.id })
      .from(studies)
      .leftJoin(blogArticles, eq(studies.id, blogArticles.studyId))
      .where(isNull(blogArticles.id))
      .limit(limit);

    const totalWithoutBlogs = studiesWithoutBlogs.length;

    if (totalWithoutBlogs === 0) {
      return res.json({
        total_studies_without_blogs: 0,
        batch_size: limit,
        generated: 0,
        failed: 0,
        errors: [],
        message: "All studies already have blog articles",
      });
    }

    const { generateBlogArticlesForStudy } = await import("../services/blog-generator-enhanced");
    const studyIds = studiesWithoutBlogs.map((s) => s.id);

    let generated = 0;
    let failed = 0;
    const errors: Array<{ studyId: number; error: string }> = [];

    // Process each study sequentially to avoid overwhelming AI APIs
    for (const studyId of studyIds) {
      try {
        // Fetch the full study record
        const [study] = await db.select().from(studies).where(eq(studies.id, studyId)).limit(1);
        if (!study) {
          failed++;
          errors.push({ studyId, error: "Study not found" });
          continue;
        }

        const result = await generateBlogArticlesForStudy(study, { count: 1, fallbackToBasic: true });

        if (result.articles.length > 0) {
          // Articles are already persisted by the generator — do not re-insert
          // (that collided on the unique slug).
          generated++;
        } else {
          failed++;
          errors.push({
            studyId,
            error: result.errors.length > 0 ? result.errors[0].error : "No articles generated",
          });
        }
      } catch (error) {
        failed++;
        errors.push({
          studyId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    logger.info(`Batch blog generation: ${generated} generated, ${failed} failed out of ${totalWithoutBlogs}`, "SEO API");

    res.json({
      total_studies_without_blogs: totalWithoutBlogs,
      batch_size: limit,
      generated,
      failed,
      errors,
    });
  } catch (error) {
    logger.error("Batch blog generation error", error, "SEO API");
    res.status(500).json({ error: "Failed to batch generate blogs" });
  }
});

// ============================================================
// Admin: Remove duplicate blog articles (same studyId, keep newest)
// ============================================================
seoAdminRouter.post("/blogs/cleanup-duplicates", requireAdmin, async (req: Request, res: Response) => {
  try {
    // Find all studyIds that have more than one blog article
    const duplicateStudyIds = await db
      .select({
        studyId: blogArticles.studyId,
        cnt: count(),
      })
      .from(blogArticles)
      .where(isNotNull(blogArticles.studyId))
      .groupBy(blogArticles.studyId)
      .having(gt(count(), 1));

    if (duplicateStudyIds.length === 0) {
      return res.json({
        duplicatesFound: 0,
        articlesDeleted: 0,
        details: [],
        message: "No duplicate blog articles found",
      });
    }

    let totalDeleted = 0;
    const details: Array<{ studyId: number; kept: number; deleted: number[] }> = [];

    for (const row of duplicateStudyIds) {
      const studyId = row.studyId!;

      // Get all blog articles for this studyId, ordered by ID descending (newest first)
      const blogs = await db
        .select({ id: blogArticles.id })
        .from(blogArticles)
        .where(eq(blogArticles.studyId, studyId))
        .orderBy(desc(blogArticles.id));

      if (blogs.length <= 1) continue;

      const keepId = blogs[0].id;
      const deleteIds = blogs.slice(1).map((b) => b.id);

      // Delete the duplicates
      await db
        .delete(blogArticles)
        .where(inArray(blogArticles.id, deleteIds));

      totalDeleted += deleteIds.length;
      details.push({
        studyId,
        kept: keepId,
        deleted: deleteIds,
      });
    }

    logger.info(`Cleaned up ${totalDeleted} duplicate blog articles across ${details.length} studies`, "SEO API");

    res.json({
      duplicatesFound: duplicateStudyIds.length,
      articlesDeleted: totalDeleted,
      details,
    });
  } catch (error) {
    logger.error("Cleanup duplicates error", error, "SEO API");
    res.status(500).json({ error: "Failed to cleanup duplicate blog articles" });
  }
});

// ============================================================
// Admin: Generate images for blogs that have no imageUrl
// ============================================================
seoAdminRouter.post("/blogs/generate-missing-images", requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 20), 50);

    // Query blogs where imageUrl IS NULL
    const blogsWithoutImages = await db
      .select({ id: blogArticles.id, title: blogArticles.title })
      .from(blogArticles)
      .where(isNull(blogArticles.imageUrl))
      .limit(limit);

    const totalMissing = blogsWithoutImages.length;

    if (totalMissing === 0) {
      return res.json({
        total_missing: 0,
        batch_size: limit,
        generated: 0,
        failed: 0,
        message: "All blogs already have images",
      });
    }

    const { generateBlogImage } = await import("../services/image-generator");

    let generated = 0;
    let failed = 0;
    const errors: Array<{ blogId: number; error: string }> = [];

    // Process sequentially with delays for image generation rate limits
    for (let i = 0; i < blogsWithoutImages.length; i++) {
      const blog = blogsWithoutImages[i];

      try {
        const result = await generateBlogImage(blog.id);

        if (result.success) {
          generated++;
        } else {
          failed++;
          errors.push({ blogId: blog.id, error: result.message || "Image generation failed" });
        }
      } catch (error) {
        failed++;
        errors.push({
          blogId: blog.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      // 2-second delay between requests to respect image generation rate limits (skip after last)
      if (i < blogsWithoutImages.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    logger.info(`Blog image generation: ${generated} generated, ${failed} failed out of ${totalMissing}`, "SEO API");

    res.json({
      total_missing: totalMissing,
      batch_size: limit,
      generated,
      failed,
      errors,
    });
  } catch (error) {
    logger.error("Generate missing images error", error, "SEO API");
    res.status(500).json({ error: "Failed to generate missing blog images" });
  }
});

export default router;
