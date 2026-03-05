import { test, expect } from "@playwright/test";

test.describe("Blog Pages", () => {
  test("blog listing loads with articles", async ({ page }) => {
    await page.goto("/blog");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body).toMatch(/blog|article|research/i);
  });

  test("blog listing shows article cards with images", async ({ page }) => {
    await page.goto("/blog");
    await page.waitForLoadState("networkidle");
    // Should have at least one image (hero or article cards)
    const images = page.locator("img");
    const count = await images.count();
    expect(count).toBeGreaterThan(0);
  });

  test("blog listing has search or filter functionality", async ({ page }) => {
    await page.goto("/blog");
    await page.waitForLoadState("networkidle");
    // Should have a search input or category filter
    const hasInput = await page.locator("input[type='text'], input[type='search']").count();
    const hasSelect = await page.locator("select, [role='combobox'], button:has-text('All')").count();
    expect(hasInput + hasSelect).toBeGreaterThan(0);
  });

  test("individual blog article page has content structure", async ({ page }) => {
    // Navigate to blog list first
    await page.goto("/blog");
    await page.waitForLoadState("networkidle");

    // Try to find and click on a blog article link
    const articleLink = page.locator("a[href*='/blog/']").first();
    if (await articleLink.isVisible()) {
      await articleLink.click();
      await page.waitForLoadState("networkidle");

      // Article should have a title (h1)
      const h1 = page.locator("h1");
      await expect(h1.first()).toBeVisible();

      // Should have article content
      const body = await page.textContent("body");
      expect(body!.length).toBeGreaterThan(100);
    }
  });

  test("blog images have alt text", async ({ page }) => {
    await page.goto("/blog");
    await page.waitForLoadState("networkidle");
    const images = page.locator("article img, [class*='blog'] img, img[loading='lazy']");
    const count = await images.count();
    for (let i = 0; i < Math.min(count, 5); i++) {
      const alt = await images.nth(i).getAttribute("alt");
      expect(alt).toBeTruthy();
    }
  });
});
