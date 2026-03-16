/**
 * SEO Routes — Dynamic sitemaps, robots.txt, and SEO utilities
 *
 * Replaces static sitemap XML files with database-driven dynamic generation.
 * All content is automatically included as it's added to the database.
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { studies, blogArticles, categories } from "../../shared/schema";
import { eq, desc, isNotNull, sql, and } from "drizzle-orm";

const router = Router();
const SITE_URL = process.env.SITE_URL || "https://hydrogenstudies.com";

// Cache sitemaps for 1 hour to avoid hammering the DB on every crawl
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const sitemapCache: Record<string, { content: string; timestamp: number }> = {};

function getCached(key: string): string | null {
  const entry = sitemapCache[key];
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.content;
  return null;
}

function setCache(key: string, content: string): void {
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

# Crawl-delay for polite crawling
Crawl-delay: 1

# Sitemaps
Sitemap: ${baseUrl}/sitemap-index.xml
`;

  res.set("Content-Type", "text/plain");
  res.set("Cache-Control", "public, max-age=86400");
  res.send(robotsTxt);
});

// ============================================================
// Sitemap Index
// ============================================================
router.get("/sitemap-index.xml", (req: Request, res: Response) => {
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
    { url: "/search", priority: "0.8", freq: "weekly" },
    { url: "/advanced-search", priority: "0.7", freq: "weekly" },
    { url: "/benefits", priority: "0.8", freq: "monthly" },
    { url: "/about", priority: "0.6", freq: "monthly" },
    { url: "/products", priority: "0.7", freq: "monthly" },
    { url: "/recommendations", priority: "0.7", freq: "weekly" },
    { url: "/contact", priority: "0.4", freq: "yearly" },
    { url: "/learn/basics", priority: "0.8", freq: "monthly" },
    { url: "/learn/health-benefits", priority: "0.8", freq: "monthly" },
    { url: "/learn/therapy-guide", priority: "0.8", freq: "monthly" },
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

    const allStudies = await db.select({
      id: studies.id,
      slug: studies.slug,
      lastModified: studies.lastModified,
      createdAt: studies.createdAt,
      imageUrl: studies.imageUrl,
      title: studies.title,
      publishYear: studies.publishYear,
    }).from(studies).orderBy(desc(studies.id));

    const urls = allStudies.map(s => {
      const slug = s.slug || `id/${s.id}`;
      const lastmod = formatDate(s.lastModified || s.createdAt);
      const imageTag = s.imageUrl ? `
    <image:image>
      <image:loc>${escapeXml(s.imageUrl)}</image:loc>
      <image:title>${escapeXml(s.title)}</image:title>
    </image:image>` : "";
      return `  <url>
    <loc>${SITE_URL}/study/${encodeURIComponent(slug)}</loc>
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
      <image:loc>${escapeXml(b.imageUrl)}</image:loc>
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

    const allCategories = await db.select({
      id: categories.id,
      name: categories.name,
    }).from(categories);

    const urls = allCategories.map(c => {
      const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      return `  <url>
    <loc>${SITE_URL}/explore-by-condition/${encodeURIComponent(slug)}</loc>
    <lastmod>${formatDate(new Date())}</lastmod>
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

    // Get unique categories from studies
    const categoryResults = await db.select({ category: studies.category })
      .from(studies)
      .groupBy(studies.category);

    // Get unique body systems, conditions, mechanisms from array fields
    const urls: string[] = [];
    const today = formatDate(new Date());

    // Category explore pages
    for (const c of categoryResults) {
      if (!c.category) continue;
      const slug = c.category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      urls.push(`  <url>
    <loc>${SITE_URL}/explore-by-condition/${encodeURIComponent(slug)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
    }

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

function escapeXml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export default router;
