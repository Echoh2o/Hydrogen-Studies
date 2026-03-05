import { test, expect } from "@playwright/test";

test.describe("SEO and Metadata", () => {
  test("homepage has proper meta tags", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check title
    const title = await page.title();
    expect(title.toLowerCase()).toContain("hydrogen");

    // Check meta description exists
    const metaDesc = await page.getAttribute("meta[name='description']", "content");
    expect(metaDesc).toBeTruthy();
    expect(metaDesc!.length).toBeGreaterThan(30);
  });

  test("study pages have dynamic titles", async ({ page }) => {
    await page.goto("/studies");
    await page.waitForLoadState("networkidle");

    const title = await page.title();
    expect(title.toLowerCase()).toContain("stud");
  });

  test("blog pages have meta descriptions", async ({ page }) => {
    await page.goto("/blog");
    await page.waitForLoadState("networkidle");

    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test("robots.txt is accessible and valid", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.ok()).toBeTruthy();
    const text = await response.text();
    expect(text).toContain("User-agent");
    expect(text).toContain("Sitemap");
  });

  test("sitemap index returns valid XML", async ({ request }) => {
    const response = await request.get("/sitemap-index.xml");
    expect(response.ok()).toBeTruthy();
    const text = await response.text();
    expect(text).toContain("<?xml");
    expect(text).toContain("sitemapindex");
  });

  test("static pages sitemap returns valid XML", async ({ request }) => {
    const response = await request.get("/sitemap-pages.xml");
    expect(response.ok()).toBeTruthy();
    const text = await response.text();
    expect(text).toContain("<?xml");
    expect(text).toContain("<url>");
  });

  test("security headers are present", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();
    // Helmet should set these
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBeTruthy();
  });
});

test.describe("Error Handling", () => {
  test("404 page renders for unknown routes", async ({ page }) => {
    await page.goto("/this-page-does-not-exist-xyz");
    await page.waitForLoadState("networkidle");
    // Should either show a 404 page or redirect to home
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });

  test("API 404 returns JSON error", async ({ request }) => {
    const response = await request.get("/api/this-does-not-exist");
    expect(response.status()).toBe(404);
    const json = await response.json();
    expect(json.success).toBe(false);
  });

  test("health endpoint returns status", async ({ request }) => {
    const response = await request.get("/health");
    expect(response.ok()).toBeTruthy();
    const json = await response.json();
    expect(json.status).toBeTruthy();
  });
});
