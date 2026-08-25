import { test, expect } from "@playwright/test";

test.describe("End-to-End Navigation Flows", () => {
  test("homepage → studies → study detail flow", async ({ page }) => {
    // Start at homepage
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Navigate to studies
    const studiesLink = page.getByRole("link", { name: /studies|research/i }).first();
    if (await studiesLink.isVisible()) {
      await studiesLink.click();
      await page.waitForLoadState("networkidle");
      expect(page.url()).toMatch(/\/studies|\/search/);
    }
  });

  test("homepage → benefits → search flow", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Navigate to benefits
    const benefitsLink = page.getByRole("link", { name: /benefits/i }).first();
    if (await benefitsLink.isVisible()) {
      await benefitsLink.click();
      await page.waitForLoadState("networkidle");
      // A "benefits" link may point at /benefits (which now redirects to the
      // real /learn page) or straight at /learn — accept either destination.
      expect(page.url()).toMatch(/\/benefits|\/learn/);

      // Click a "browse studies" or similar link
      const browseLink = page.locator('a[href*="/studies"], a[href*="/search"]').first();
      if (await browseLink.isVisible()) {
        const href = await browseLink.getAttribute("href");
        // Verify it doesn't link to the broken /research route
        expect(href).not.toBe("/research");
      }
    }
  });

  test("homepage → blog → article detail flow", async ({ page }) => {
    await page.goto("/blog");
    await page.waitForLoadState("networkidle");

    // Click first blog article
    const articleLink = page.locator('a[href*="/blog/"]').first();
    if ((await articleLink.count()) > 0) {
      await articleLink.click();
      await page.waitForLoadState("networkidle");

      // Should NOT show error
      const body = await page.textContent("body");
      expect(body).not.toMatch(/error.*failed.*load.*article/i);
    }
  });

  test("products page has external store links", async ({ page }) => {
    await page.goto("/products");
    await page.waitForLoadState("networkidle");

    // All product "View" buttons should link to echowater.com
    const storeLinks = page.locator('a[href*="echowater.com"]');
    const count = await storeLinks.count();
    expect(count).toBeGreaterThan(0);

    // Verify links have target="_blank"
    for (let i = 0; i < Math.min(count, 3); i++) {
      const target = await storeLinks.nth(i).getAttribute("target");
      expect(target).toBe("_blank");
    }
  });

  test("explore pages link to search, not broken routes", async ({ page }) => {
    const explorePages = [
      "/explore-by-body-system",
      "/explore-by-life-stage",
      "/explore-by-condition",
    ];

    for (const explorePage of explorePages) {
      await page.goto(explorePage);
      await page.waitForLoadState("networkidle");

      // Check that category/item links go to search or valid routes
      const links = page.locator("a[href]");
      const linkCount = await links.count();

      for (let i = 0; i < Math.min(linkCount, 10); i++) {
        const href = await links.nth(i).getAttribute("href");
        if (href && !href.startsWith("http") && !href.startsWith("#")) {
          // Should not link to broken routes like /body-system/:name
          expect(href).not.toMatch(/^\/body-system\/[^/]+$/);
          expect(href).not.toMatch(/^\/life-stage\/[^/]+$/);
        }
      }
    }
  });

  test("header navigation links work", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Get all header navigation links
    const header = page.locator("header");
    const navLinks = header.locator("a[href]");
    const count = await navLinks.count();

    const visitedUrls = new Set<string>();

    for (let i = 0; i < count; i++) {
      const href = await navLinks.nth(i).getAttribute("href");
      if (href && href.startsWith("/") && !visitedUrls.has(href)) {
        visitedUrls.add(href);
        // Navigate to each link
        await page.goto(href);
        await page.waitForLoadState("networkidle");
        // Should not show a server error
        const body = await page.textContent("body");
        expect(body).not.toMatch(/internal server error|500/i);
      }
    }
  });

  test("footer links are valid", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const footer = page.locator("footer");
    if (await footer.isVisible()) {
      const footerLinks = footer.locator("a[href^='/']");
      const count = await footerLinks.count();

      for (let i = 0; i < Math.min(count, 10); i++) {
        const href = await footerLinks.nth(i).getAttribute("href");
        if (href) {
          const response = await page.goto(href);
          // Should not be a 500 error
          expect(response?.status()).not.toBe(500);
        }
      }
    }
  });
});

test.describe("Mobile Responsiveness", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("homepage renders on mobile", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
    // No horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    // Allow small tolerance
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10);
  });

  test("studies page renders on mobile", async ({ page }) => {
    await page.goto("/studies");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });

  test("search page renders on mobile", async ({ page }) => {
    await page.goto("/search?q=hydrogen");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });
});
