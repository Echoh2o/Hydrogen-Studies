import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Shopify App Proxy SSR Routes — E2E Tests
//
// These routes are mounted at /proxy and serve fully server-rendered HTML.
// In local dev the Shopify HMAC auth middleware is skipped (no SHOPIFY_APP_SECRET),
// so we can test them directly with the Playwright request API context.
// ---------------------------------------------------------------------------

test.describe("Proxy Routes — Main Search Page (GET /proxy/)", () => {
  test("returns 200 with correct content type", async ({ request }) => {
    const response = await request.get("/proxy/");
    expect(response.status()).toBe(200);
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("text/html");
  });

  test("contains research database title", async ({ request }) => {
    const response = await request.get("/proxy/");
    const html = await response.text();
    expect(html).toContain("Hydrogen Water Research Database");
  });

  test("has a search form", async ({ request }) => {
    const response = await request.get("/proxy/");
    const html = await response.text();
    expect(html).toContain('<form class="h2r-search-form"');
    expect(html).toContain('name="q"');
    expect(html).toContain('placeholder="Search studies..."');
    expect(html).toContain("Search</button>");
  });

  test("has stats bar with study counts", async ({ request }) => {
    const response = await request.get("/proxy/");
    const html = await response.text();
    expect(html).toContain("h2r-stats-bar");
    expect(html).toContain("Total Studies");
    expect(html).toContain("Human Trials");
    expect(html).toContain("Conditions");
  });

  test("contains study cards", async ({ request }) => {
    const response = await request.get("/proxy/");
    const html = await response.text();
    expect(html).toContain("h2r-card");
    // Study cards should have links to individual study pages
    expect(html).toContain("/tools/hydrogen-research/study/");
  });

  test("has condition filter dropdown", async ({ request }) => {
    const response = await request.get("/proxy/");
    const html = await response.text();
    expect(html).toContain('name="condition"');
    expect(html).toContain("All Conditions");
  });

  test("has study type filter dropdown", async ({ request }) => {
    const response = await request.get("/proxy/");
    const html = await response.text();
    expect(html).toContain('name="type"');
    expect(html).toContain("All Types");
    expect(html).toContain("Human Trial");
    expect(html).toContain("Animal Study");
  });

  test("has footer links to stats, methodology, and CSV export", async ({ request }) => {
    const response = await request.get("/proxy/");
    const html = await response.text();
    expect(html).toContain("/tools/hydrogen-research/stats");
    expect(html).toContain("/tools/hydrogen-research/methodology");
    expect(html).toContain("/tools/hydrogen-research/export");
  });

  test("has proper meta tags", async ({ request }) => {
    const response = await request.get("/proxy/");
    const html = await response.text();
    expect(html).toContain('<link rel="canonical"');
    expect(html).toContain('og:title');
    expect(html).toContain('og:description');
    expect(html).toContain('og:url');
  });

  test("pagination renders when there are enough studies", async ({ request }) => {
    const response = await request.get("/proxy/");
    const html = await response.text();
    // If there are more than 20 studies, pagination should exist
    const hasCards = html.includes("h2r-card");
    if (hasCards) {
      // Check for either pagination or just a single page of results
      const hasPagination = html.includes("h2r-pagination");
      const hasStudyCards = (html.match(/h2r-card/g) || []).length;
      // If 20 cards rendered (the page limit), pagination should be present
      if (hasStudyCards >= 20) {
        expect(hasPagination).toBe(true);
      }
    }
  });
});

test.describe("Proxy Routes — Study Detail Page (GET /proxy/study/:slug)", () => {
  // Helper: fetch a valid study slug from the main listing page
  async function getFirstStudySlug(request: any): Promise<string | null> {
    const response = await request.get("/proxy/");
    const html = await response.text();
    const match = html.match(/\/tools\/hydrogen-research\/study\/([a-z0-9-]+)/);
    return match ? match[1] : null;
  }

  test("returns 200 for a valid study slug", async ({ request }) => {
    const slug = await getFirstStudySlug(request);
    if (!slug) {
      test.skip();
      return;
    }
    const response = await request.get(`/proxy/study/${slug}`);
    expect(response.status()).toBe(200);
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("text/html");
  });

  test("returns 404 for an invalid slug", async ({ request }) => {
    const response = await request.get("/proxy/study/nonexistent-slug-that-will-never-exist-12345");
    expect(response.status()).toBe(404);
    const html = await response.text();
    expect(html).toContain("Not Found");
    expect(html).toContain("Study not found");
  });

  test("contains ScholarlyArticle JSON-LD", async ({ request }) => {
    const slug = await getFirstStudySlug(request);
    if (!slug) {
      test.skip();
      return;
    }
    const response = await request.get(`/proxy/study/${slug}`);
    const html = await response.text();
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"ScholarlyArticle"');
    expect(html).toContain('"@context":"https://schema.org"');
  });

  test("has Key Finding section", async ({ request }) => {
    const slug = await getFirstStudySlug(request);
    if (!slug) {
      test.skip();
      return;
    }
    const response = await request.get(`/proxy/study/${slug}`);
    const html = await response.text();
    expect(html).toContain("h2r-key-finding");
    expect(html).toContain("Key Finding");
  });

  test("has What This Study Found section or abstract", async ({ request }) => {
    const slug = await getFirstStudySlug(request);
    if (!slug) {
      test.skip();
      return;
    }
    const response = await request.get(`/proxy/study/${slug}`);
    const html = await response.text();
    // Should have at least one content section
    const hasStudyFound = html.includes("What This Study Found");
    const hasAbstract = html.includes("Abstract");
    const hasMethodology = html.includes("How It Was Conducted");
    expect(hasStudyFound || hasAbstract || hasMethodology).toBe(true);
  });

  test("has citation box", async ({ request }) => {
    const slug = await getFirstStudySlug(request);
    if (!slug) {
      test.skip();
      return;
    }
    const response = await request.get(`/proxy/study/${slug}`);
    const html = await response.text();
    expect(html).toContain("h2r-citation-box");
    expect(html).toContain("Links &amp; Citation");
  });

  test("has canonical URL meta tag", async ({ request }) => {
    const slug = await getFirstStudySlug(request);
    if (!slug) {
      test.skip();
      return;
    }
    const response = await request.get(`/proxy/study/${slug}`);
    const html = await response.text();
    expect(html).toContain(`<link rel="canonical"`);
    expect(html).toContain(`/study/${slug}`);
  });

  test("has OG meta tags", async ({ request }) => {
    const slug = await getFirstStudySlug(request);
    if (!slug) {
      test.skip();
      return;
    }
    const response = await request.get(`/proxy/study/${slug}`);
    const html = await response.text();
    expect(html).toContain('og:title');
    expect(html).toContain('og:description');
    expect(html).toContain('og:url');
    expect(html).toContain('og:type');
  });

  test("has breadcrumb navigation", async ({ request }) => {
    const slug = await getFirstStudySlug(request);
    if (!slug) {
      test.skip();
      return;
    }
    const response = await request.get(`/proxy/study/${slug}`);
    const html = await response.text();
    expect(html).toContain("h2r-breadcrumb");
    expect(html).toContain("Research Database");
  });

  test("has disclaimer section", async ({ request }) => {
    const slug = await getFirstStudySlug(request);
    if (!slug) {
      test.skip();
      return;
    }
    const response = await request.get(`/proxy/study/${slug}`);
    const html = await response.text();
    expect(html).toContain("h2r-disclaimer");
    expect(html).toContain("Disclaimer");
    expect(html).toContain("does not constitute medical advice");
  });
});

test.describe("Proxy Routes — Condition Page (GET /proxy/condition/:slug)", () => {
  // Helper: fetch a valid condition slug from the main page filter dropdown
  async function getFirstConditionSlug(request: any): Promise<string | null> {
    const response = await request.get("/proxy/");
    const html = await response.text();
    // Condition slugs appear as <option value="slug-name"> in the dropdown
    const match = html.match(/<option value="([a-z0-9-]+)"/);
    return match ? match[1] : null;
  }

  test("returns 200 for a valid condition slug", async ({ request }) => {
    const slug = await getFirstConditionSlug(request);
    if (!slug) {
      test.skip();
      return;
    }
    const response = await request.get(`/proxy/condition/${slug}`);
    expect(response.status()).toBe(200);
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("text/html");
  });

  test("returns 404 for an invalid condition slug", async ({ request }) => {
    const response = await request.get("/proxy/condition/nonexistent-condition-xyz-99999");
    expect(response.status()).toBe(404);
    const html = await response.text();
    expect(html).toContain("Not Found");
    expect(html).toContain("Condition not found");
  });

  test("shows condition name and study count", async ({ request }) => {
    const slug = await getFirstConditionSlug(request);
    if (!slug) {
      test.skip();
      return;
    }
    const response = await request.get(`/proxy/condition/${slug}`);
    const html = await response.text();
    // Title format is "Hydrogen & <condition name>"
    expect(html).toContain("Hydrogen &amp;");
    // Should show study count: "<N> study/studies found for this condition"
    expect(html).toMatch(/\d+ stud(y|ies) found for this condition/);
  });

  test("has study cards", async ({ request }) => {
    const slug = await getFirstConditionSlug(request);
    if (!slug) {
      test.skip();
      return;
    }
    const response = await request.get(`/proxy/condition/${slug}`);
    const html = await response.text();
    // Should have study cards (or no studies message)
    const hasCards = html.includes("h2r-card");
    const hasNoStudies = html.includes("0 studies found");
    expect(hasCards || hasNoStudies).toBe(true);
  });

  test("has breadcrumb navigation", async ({ request }) => {
    const slug = await getFirstConditionSlug(request);
    if (!slug) {
      test.skip();
      return;
    }
    const response = await request.get(`/proxy/condition/${slug}`);
    const html = await response.text();
    expect(html).toContain("h2r-breadcrumb");
    expect(html).toContain("Research Database");
  });

  test("has canonical URL for condition", async ({ request }) => {
    const slug = await getFirstConditionSlug(request);
    if (!slug) {
      test.skip();
      return;
    }
    const response = await request.get(`/proxy/condition/${slug}`);
    const html = await response.text();
    expect(html).toContain(`<link rel="canonical"`);
    expect(html).toContain(`/condition/${slug}`);
  });
});

test.describe("Proxy Routes — Stats Page (GET /proxy/stats)", () => {
  test("returns 200", async ({ request }) => {
    const response = await request.get("/proxy/stats");
    expect(response.status()).toBe(200);
  });

  test("contains correct title", async ({ request }) => {
    const response = await request.get("/proxy/stats");
    const html = await response.text();
    expect(html).toContain("The State of Hydrogen Water Research");
  });

  test("has overall stats bar", async ({ request }) => {
    const response = await request.get("/proxy/stats");
    const html = await response.text();
    expect(html).toContain("h2r-stats-bar");
    expect(html).toContain("Total Studies");
    expect(html).toContain("Human Trials");
    expect(html).toContain("Peer Reviewed");
    expect(html).toContain("Year Range");
  });

  test("has data tables for studies by year and type", async ({ request }) => {
    const response = await request.get("/proxy/stats");
    const html = await response.text();
    expect(html).toContain("Studies by Year");
    expect(html).toContain("Studies by Type");
    expect(html).toContain("Top Conditions Studied");
    expect(html).toContain("Studies by Country");
    // Should contain HTML tables
    expect(html).toContain("h2r-table");
  });

  test("has CSV download link", async ({ request }) => {
    const response = await request.get("/proxy/stats");
    const html = await response.text();
    expect(html).toContain("/tools/hydrogen-research/export");
    expect(html).toContain("Download CSV");
  });

  test("has breadcrumb navigation", async ({ request }) => {
    const response = await request.get("/proxy/stats");
    const html = await response.text();
    expect(html).toContain("h2r-breadcrumb");
    expect(html).toContain("Research Database");
    expect(html).toContain("Statistics");
  });
});

test.describe("Proxy Routes — Methodology Page (GET /proxy/methodology)", () => {
  test("returns 200", async ({ request }) => {
    const response = await request.get("/proxy/methodology");
    expect(response.status()).toBe(200);
  });

  test("contains methodology content", async ({ request }) => {
    const response = await request.get("/proxy/methodology");
    const html = await response.text();
    expect(html).toContain("Our Research Curation Methodology");
    expect(html).toContain("Source Selection");
    expect(html).toContain("Inclusion Criteria");
    expect(html).toContain("Study Classification");
    expect(html).toContain("Plain Language Summaries");
    expect(html).toContain("Limitations &amp; Transparency");
  });

  test("has breadcrumb navigation", async ({ request }) => {
    const response = await request.get("/proxy/methodology");
    const html = await response.text();
    expect(html).toContain("h2r-breadcrumb");
    expect(html).toContain("Research Database");
    expect(html).toContain("Methodology");
  });

  test("has disclaimer", async ({ request }) => {
    const response = await request.get("/proxy/methodology");
    const html = await response.text();
    expect(html).toContain("h2r-disclaimer");
    expect(html).toContain("Disclaimer");
  });

  test("has canonical URL", async ({ request }) => {
    const response = await request.get("/proxy/methodology");
    const html = await response.text();
    expect(html).toContain('<link rel="canonical"');
    expect(html).toContain("/methodology");
  });
});

test.describe("Proxy Routes — Sitemap (GET /proxy/sitemap.xml)", () => {
  test("returns 200 with XML content type", async ({ request }) => {
    const response = await request.get("/proxy/sitemap.xml");
    expect(response.status()).toBe(200);
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("application/xml");
  });

  test("contains urlset root element", async ({ request }) => {
    const response = await request.get("/proxy/sitemap.xml");
    const xml = await response.text();
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain("<urlset");
    expect(xml).toContain("http://www.sitemaps.org/schemas/sitemap/0.9");
  });

  test("contains at least one url entry", async ({ request }) => {
    const response = await request.get("/proxy/sitemap.xml");
    const xml = await response.text();
    expect(xml).toContain("<url>");
    expect(xml).toContain("<loc>");
    expect(xml).toContain("<lastmod>");
    expect(xml).toContain("<changefreq>");
    expect(xml).toContain("<priority>");
  });

  test("includes static pages (root, stats, methodology)", async ({ request }) => {
    const response = await request.get("/proxy/sitemap.xml");
    const xml = await response.text();
    expect(xml).toContain("hydrogen-research/</loc>");
    expect(xml).toContain("hydrogen-research/stats</loc>");
    expect(xml).toContain("hydrogen-research/methodology</loc>");
  });

  test("includes study and condition URLs", async ({ request }) => {
    const response = await request.get("/proxy/sitemap.xml");
    const xml = await response.text();
    // Should contain study URLs
    expect(xml).toContain("/study/");
    // Should contain condition URLs
    expect(xml).toContain("/condition/");
  });
});

test.describe("Proxy Routes — Embed Widget (GET /proxy/embed/:conditionSlug)", () => {
  async function getFirstConditionSlug(request: any): Promise<string | null> {
    const response = await request.get("/proxy/");
    const html = await response.text();
    const match = html.match(/<option value="([a-z0-9-]+)"/);
    return match ? match[1] : null;
  }

  test("returns 200 for a valid condition", async ({ request }) => {
    const slug = await getFirstConditionSlug(request);
    if (!slug) {
      test.skip();
      return;
    }
    const response = await request.get(`/proxy/embed/${slug}`);
    expect(response.status()).toBe(200);
  });

  test("contains View all studies link", async ({ request }) => {
    const slug = await getFirstConditionSlug(request);
    if (!slug) {
      test.skip();
      return;
    }
    const response = await request.get(`/proxy/embed/${slug}`);
    const html = await response.text();
    expect(html).toContain("View all studies");
    expect(html).toContain(`/condition/${slug}`);
  });

  test("has frame-ancestors * CSP header for embedding", async ({ request }) => {
    const slug = await getFirstConditionSlug(request);
    if (!slug) {
      test.skip();
      return;
    }
    const response = await request.get(`/proxy/embed/${slug}`);
    const csp = response.headers()["content-security-policy"];
    expect(csp).toContain("frame-ancestors *");
  });

  test("does NOT have X-Frame-Options header", async ({ request }) => {
    const slug = await getFirstConditionSlug(request);
    if (!slug) {
      test.skip();
      return;
    }
    const response = await request.get(`/proxy/embed/${slug}`);
    const xfo = response.headers()["x-frame-options"];
    expect(xfo).toBeFalsy();
  });

  test("has embed widget structure", async ({ request }) => {
    const slug = await getFirstConditionSlug(request);
    if (!slug) {
      test.skip();
      return;
    }
    const response = await request.get(`/proxy/embed/${slug}`);
    const html = await response.text();
    expect(html).toContain("h2r-embed");
    expect(html).toContain("h2r-embed-header");
    expect(html).toContain("h2r-embed-body");
    expect(html).toContain("h2r-embed-footer");
  });

  test("returns 404 for nonexistent condition", async ({ request }) => {
    const response = await request.get("/proxy/embed/nonexistent-condition-xyz-99999");
    expect(response.status()).toBe(404);
  });
});

test.describe("Proxy Routes — CSV Export (GET /proxy/export)", () => {
  test("returns 200 with CSV content type", async ({ request }) => {
    const response = await request.get("/proxy/export");
    expect(response.status()).toBe(200);
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("text/csv");
  });

  test("has Content-Disposition attachment header", async ({ request }) => {
    const response = await request.get("/proxy/export");
    const disposition = response.headers()["content-disposition"];
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("hydrogen-research-database.csv");
  });

  test("contains CSV headers", async ({ request }) => {
    const response = await request.get("/proxy/export");
    const csv = await response.text();
    // First line should be the header row
    const firstLine = csv.split("\n")[0];
    expect(firstLine).toContain("Title");
    expect(firstLine).toContain("Authors");
    expect(firstLine).toContain("Journal");
    expect(firstLine).toContain("Year");
    expect(firstLine).toContain("Study Type");
    expect(firstLine).toContain("DOI");
    expect(firstLine).toContain("Peer Reviewed");
    expect(firstLine).toContain("Human Trial");
  });

  test("has data rows beyond the header", async ({ request }) => {
    const response = await request.get("/proxy/export");
    const csv = await response.text();
    const lines = csv.split("\n").filter((l) => l.trim().length > 0);
    // Should have at least header + 1 data row
    expect(lines.length).toBeGreaterThan(1);
  });

  test("condition-filtered export uses condition-specific filename", async ({ request }) => {
    // First get a valid condition slug
    const mainResponse = await request.get("/proxy/");
    const mainHtml = await mainResponse.text();
    const match = mainHtml.match(/<option value="([a-z0-9-]+)"/);
    if (!match) {
      test.skip();
      return;
    }
    const slug = match[1];
    const response = await request.get(`/proxy/export?condition=${slug}`);
    expect(response.status()).toBe(200);
    const disposition = response.headers()["content-disposition"];
    expect(disposition).toContain(`hydrogen-research-${slug}.csv`);
  });
});

test.describe("Proxy Routes — Input Validation & Edge Cases", () => {
  test("page=999999 returns 200 (capped at 500, not error)", async ({ request }) => {
    const response = await request.get("/proxy/?page=999999");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Hydrogen Water Research Database");
  });

  test("page=-1 returns 200 (clamped to page 1)", async ({ request }) => {
    const response = await request.get("/proxy/?page=-1");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Hydrogen Water Research Database");
  });

  test("page=abc (non-numeric) returns 200 (defaults to page 1)", async ({ request }) => {
    const response = await request.get("/proxy/?page=abc");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Hydrogen Water Research Database");
  });

  test("very long search query does not crash", async ({ request }) => {
    const longQuery = "a".repeat(500);
    const response = await request.get(`/proxy/?q=${longQuery}`);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Hydrogen Water Research Database");
  });

  test("empty search query returns main page", async ({ request }) => {
    const response = await request.get("/proxy/?q=");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Hydrogen Water Research Database");
  });

  test("search with special characters does not crash", async ({ request }) => {
    const response = await request.get("/proxy/?q=%3Cscript%3Ealert(1)%3C/script%3E");
    expect(response.status()).toBe(200);
    const html = await response.text();
    // Should not contain raw script tags (XSS protection via escapeHtml)
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  test("nonexistent study slug returns 404", async ({ request }) => {
    const response = await request.get("/proxy/study/nonexistent-slug-12345");
    expect(response.status()).toBe(404);
  });

  test("nonexistent condition slug returns 404", async ({ request }) => {
    const response = await request.get("/proxy/condition/nonexistent-condition-12345");
    expect(response.status()).toBe(404);
  });

  test("nonexistent embed condition slug returns 404", async ({ request }) => {
    const response = await request.get("/proxy/embed/nonexistent-condition-12345");
    expect(response.status()).toBe(404);
  });

  test("study slug with path traversal attempt returns 404", async ({ request }) => {
    const response = await request.get("/proxy/study/../../etc/passwd");
    // Should either 404 or be handled gracefully, never expose file system
    expect([200, 404]).toContain(response.status());
    const html = await response.text();
    expect(html).not.toContain("root:");
  });

  test("search query is HTML-escaped in output", async ({ request }) => {
    const response = await request.get('/proxy/?q=<img src=x onerror=alert(1)>');
    expect(response.status()).toBe(200);
    const html = await response.text();
    // The query value should appear escaped in the input, not as raw HTML
    expect(html).not.toContain('<img src=x onerror');
  });
});
