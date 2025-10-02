/**
 * Sitemap Generator for SEO Enhancement
 * Creates XML sitemaps for better search engine crawling
 */

export const generateSitemap = async (studies: any[], categories: any[]) => {
  const baseUrl = window.location.origin;
  const currentDate = new Date().toISOString().split("T")[0];

  const urls = [
    // Main pages
    {
      loc: baseUrl,
      lastmod: currentDate,
      changefreq: "daily",
      priority: "1.0",
    },
    {
      loc: `${baseUrl}/studies`,
      lastmod: currentDate,
      changefreq: "daily",
      priority: "0.9",
    },
    {
      loc: `${baseUrl}/categories`,
      lastmod: currentDate,
      changefreq: "weekly",
      priority: "0.8",
    },
    {
      loc: `${baseUrl}/search`,
      lastmod: currentDate,
      changefreq: "weekly",
      priority: "0.7",
    },

    // Category pages
    ...categories.map((category) => ({
      loc: `${baseUrl}/categories/${category.id}`,
      lastmod: currentDate,
      changefreq: "weekly",
      priority: "0.8",
    })),

    // Study pages
    ...studies.map((study) => ({
      loc: `${baseUrl}/studies/${study.id}`,
      lastmod: study.publishDate || currentDate,
      changefreq: "monthly",
      priority: "0.6",
    })),
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return sitemap;
};

export const generateRobotsTxt = () => {
  const baseUrl = window.location.origin;

  return `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml

# Additional crawl delays for respectful crawling
Crawl-delay: 1`;
};
