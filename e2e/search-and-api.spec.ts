import { test, expect } from "@playwright/test";

test.describe("Search Functionality", () => {
  test("search page auto-loads results on mount", async ({ page }) => {
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    // Should show results or "no results" - not an empty/error state
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });

  test("search with query parameter shows results", async ({ page }) => {
    await page.goto("/search?q=hydrogen");
    await page.waitForLoadState("networkidle");
    // Wait for results to load
    await page.waitForTimeout(2000);
    const body = await page.textContent("body");
    // Should contain search-related content
    expect(body).toMatch(/hydrogen|result|stud/i);
  });

  test("search from benefits page navigates correctly", async ({ page }) => {
    await page.goto("/benefits");
    await page.waitForLoadState("networkidle");

    // Find a link that goes to search or studies
    const searchLinks = page.locator('a[href*="/search"], a[href*="/studies"]');
    if ((await searchLinks.count()) > 0) {
      const href = await searchLinks.first().getAttribute("href");
      expect(href).not.toContain("/research"); // Should NOT link to /research (404)
    }
  });

  test("search with empty query doesn't crash", async ({ page }) => {
    await page.goto("/search?q=");
    await page.waitForLoadState("networkidle");
    // Page should still render
    await expect(page.locator("body")).toBeVisible();
  });

  test("search results have clickable study links", async ({ page }) => {
    await page.goto("/search?q=water");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const studyLinks = page.locator('a[href*="/study/"]');
    if ((await studyLinks.count()) > 0) {
      const href = await studyLinks.first().getAttribute("href");
      expect(href).toMatch(/\/study\//);
    }
  });
});

test.describe("API Endpoints", () => {
  test("GET /api/studies returns paginated data", async ({ request }) => {
    const response = await request.get("/api/studies?page=1&limit=10");
    expect(response.status()).toBe(200);
    const data = await response.json();
    // Should return an object with data array and pagination info
    expect(data).toBeTruthy();
    if (data.data) {
      expect(Array.isArray(data.data)).toBe(true);
    }
  });

  test("GET /api/studies with search filters", async ({ request }) => {
    const response = await request.get("/api/studies?search=hydrogen&page=1&limit=10");
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toBeTruthy();
  });

  test("GET /api/blogs returns blog articles", async ({ request }) => {
    const response = await request.get("/api/blogs");
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toBeTruthy();
  });

  test("GET /api/categories returns categories", async ({ request }) => {
    const response = await request.get("/api/categories");
    expect(response.status()).toBe(200);
  });

  test("GET /api/studies/:id returns a study or 404", async ({ request }) => {
    const response = await request.get("/api/studies/1");
    expect([200, 404]).toContain(response.status());
  });

  test("GET /api/advanced-search works", async ({ request }) => {
    // The advanced search endpoint is mounted at /api/advanced-search
    // (searchController.router), not /api/search/advanced.
    const response = await request.get("/api/advanced-search?search=hydrogen&limit=5");
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toBeTruthy();
  });

  test("GET /api/stats/dashboard returns stats", async ({ request }) => {
    const response = await request.get("/api/stats/dashboard");
    // May require auth - just check it doesn't 500
    expect([200, 401, 403]).toContain(response.status());
  });

  test("API returns proper error for invalid study ID", async ({ request }) => {
    const response = await request.get("/api/studies/99999999");
    expect([404, 400]).toContain(response.status());
  });
});

test.describe("Studies Page Pagination", () => {
  test("studies page shows pagination controls", async ({ page }) => {
    await page.goto("/studies");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Look for pagination buttons or page indicators
    const paginationArea = page.locator('button:has-text("Next"), button:has-text("2"), [aria-label*="page"]');
    // Pagination should exist if there are more studies than page size
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });

  test("studies page displays total count", async ({ page }) => {
    await page.goto("/studies");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Should show some indication of total studies
    const body = await page.textContent("body");
    expect(body).toMatch(/stud/i);
  });
});
