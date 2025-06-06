/**
 * SEO Routes for Sitemap and Robots.txt Generation
 * Generates dynamic sitemaps based on actual study data
 */

import { Router } from 'express';
import { db } from '../db';
import { studies, categories } from '@shared/schema';
import { desc, asc, gt } from 'drizzle-orm';

const router = Router();

// Generate XML sitemap
router.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const currentDate = new Date().toISOString().split('T')[0];

    // Get all studies and categories from database
    const [studiesData, categoriesData] = await Promise.all([
      db.select({
        id: studies.id,
        publishDate: studies.publishDate,
        createdAt: studies.createdAt
      }).from(studies).orderBy(desc(studies.id)),
      db.select({
        id: categories.id,
        studyCount: categories.studyCount
      }).from(categories).where(gt(categories.studyCount, 0)).orderBy(asc(categories.name))
    ]);

    const urls = [
      // Main pages
      {
        loc: baseUrl,
        lastmod: currentDate,
        changefreq: 'daily',
        priority: '1.0'
      },
      {
        loc: `${baseUrl}/studies`,
        lastmod: currentDate,
        changefreq: 'daily',
        priority: '0.9'
      },
      {
        loc: `${baseUrl}/categories`,
        lastmod: currentDate,
        changefreq: 'weekly',
        priority: '0.8'
      },
      {
        loc: `${baseUrl}/search`,
        lastmod: currentDate,
        changefreq: 'weekly',
        priority: '0.7'
      },

      // Category pages
      ...categoriesData.map(category => ({
        loc: `${baseUrl}/categories/${category.id}`,
        lastmod: currentDate,
        changefreq: 'weekly',
        priority: '0.8'
      })),

      // Study pages
      ...studiesData.map(study => ({
        loc: `${baseUrl}/studies/${study.id}`,
        lastmod: study.publishDate || study.createdAt?.toISOString().split('T')[0] || currentDate,
        changefreq: 'monthly',
        priority: '0.6'
      }))
    ];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    res.set('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

// Generate robots.txt
router.get('/robots.txt', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  const robotsTxt = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml

# Crawl-delay for respectful crawling
Crawl-delay: 1

# Additional directives for major search engines
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Slurp
Allow: /`;

  res.set('Content-Type', 'text/plain');
  res.send(robotsTxt);
});

// Structured data endpoint for homepage
router.get('/structured-data/organization', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Hydrogen Research Database",
    "url": baseUrl,
    "logo": `${baseUrl}/logo.png`,
    "description": "Comprehensive database of hydrogen health research studies with advanced categorization and AI-powered analysis",
    "foundingDate": "2023",
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer service",
      "availableLanguage": "English"
    },
    "sameAs": [
      "https://twitter.com/hydrogenstudies",
      "https://linkedin.com/company/hydrogenstudies"
    ],
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${baseUrl}/search?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };

  res.json(organizationSchema);
});

export default router;