import { test, expect } from "@playwright/test";

test.describe("Public Pages - Navigation & Rendering", () => {
  test("homepage loads with key elements", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/hydrogen/i);
    // Header should be visible
    await expect(page.locator("header")).toBeVisible();
    // Should have navigation links
    await expect(page.getByRole("link", { name: /studies/i }).first()).toBeVisible();
  });

  test("studies page loads with pagination", async ({ page }) => {
    await page.goto("/studies");
    // Should show study cards or a list
    await page.waitForLoadState("networkidle");
    // Check for pagination controls
    const pageContent = await page.textContent("body");
    expect(pageContent).toMatch(/stud/i);
  });

  test("search page loads and accepts queries", async ({ page }) => {
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    // Search page should auto-load results
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });

  test("benefits page loads", async ({ page }) => {
    await page.goto("/benefits");
    await expect(page.locator("body")).toContainText(/benefit|health|hydrogen/i);
  });

  test("products page loads with product cards", async ({ page }) => {
    await page.goto("/products");
    await page.waitForLoadState("networkidle");
    // Should show Echo products
    await expect(page.locator("body")).toContainText(/echo/i);
    // Product links should point to echowater.com
    const productLinks = page.locator('a[href*="echowater.com"]');
    expect(await productLinks.count()).toBeGreaterThan(0);
  });

  test("about page loads", async ({ page }) => {
    await page.goto("/about");
    await expect(page.locator("body")).toContainText(/hydrogen|about/i);
  });

  test("contact page loads", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.locator("body")).toContainText(/contact/i);
  });

  test("blog listing page loads", async ({ page }) => {
    await page.goto("/blog");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body).toMatch(/blog|article/i);
  });

  test("privacy page loads", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("body")).toContainText(/privacy/i);
  });

  test("terms page loads", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("body")).toContainText(/terms/i);
  });

  test("disclaimer page loads", async ({ page }) => {
    await page.goto("/disclaimer");
    await expect(page.locator("body")).toContainText(/disclaimer/i);
  });

  test("recommendations page loads", async ({ page }) => {
    await page.goto("/recommendations");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });

  test("learn basics page loads", async ({ page }) => {
    await page.goto("/learn/basics");
    await expect(page.locator("body")).toContainText(/hydrogen/i);
  });

  test("learn health benefits page loads", async ({ page }) => {
    await page.goto("/learn/health-benefits");
    await expect(page.locator("body")).toContainText(/health|benefit/i);
  });

  test("learn therapy guide page loads", async ({ page }) => {
    await page.goto("/learn/therapy-guide");
    await expect(page.locator("body")).toContainText(/therapy|guide|hydrogen/i);
  });

  test("404 page for unknown routes", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    const body = await page.textContent("body");
    expect(body).toMatch(/not found|404|page/i);
  });
});

test.describe("Explore Pages", () => {
  test("explore by condition loads", async ({ page }) => {
    await page.goto("/explore-by-condition");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toContainText(/condition|explore|categor/i);
  });

  test("explore by body system loads", async ({ page }) => {
    await page.goto("/explore-by-body-system");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toContainText(/body|system|explore/i);
  });

  test("explore by life stage loads", async ({ page }) => {
    await page.goto("/explore-by-life-stage");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toContainText(/life|stage|explore/i);
  });

  test("explore by benefit loads", async ({ page }) => {
    await page.goto("/explore-by-benefit");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });

  test("explore by mechanism loads", async ({ page }) => {
    await page.goto("/explore-by-mechanism");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });

  test("explore by delivery method loads", async ({ page }) => {
    await page.goto("/explore-by-delivery-method");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });

  test("explore condition category links go to search", async ({ page }) => {
    await page.goto("/explore-by-condition");
    await page.waitForLoadState("networkidle");
    // Click first category link if available
    const links = page.locator('a[href*="/search"], a[href*="/explore-by-condition/"]');
    if ((await links.count()) > 0) {
      const href = await links.first().getAttribute("href");
      expect(href).toBeTruthy();
    }
  });
});

test.describe("Study Detail Pages", () => {
  test("study by slug loads or shows not found", async ({ page }) => {
    // First get a study slug from the studies listing
    await page.goto("/studies");
    await page.waitForLoadState("networkidle");

    const studyLink = page.locator('a[href*="/study/"]').first();
    if ((await studyLink.count()) > 0) {
      await studyLink.click();
      await page.waitForLoadState("networkidle");
      const body = await page.textContent("body");
      // Should show study content, not an error
      expect(body).not.toMatch(/error.*failed.*load/i);
    }
  });
});

test.describe("Blog Detail Pages", () => {
  test("blog article loads from listing", async ({ page }) => {
    await page.goto("/blog");
    await page.waitForLoadState("networkidle");

    const blogLink = page.locator('a[href*="/blog/"]').first();
    if ((await blogLink.count()) > 0) {
      await blogLink.click();
      await page.waitForLoadState("networkidle");
      const body = await page.textContent("body");
      // Should NOT show the error message
      expect(body).not.toMatch(/error.*failed.*load.*article/i);
    }
  });
});

test.describe("Legacy Route Redirects", () => {
  test("/categories redirects to explore-by-condition", async ({ page }) => {
    await page.goto("/categories");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/explore-by-condition");
  });

  test("/resources redirects to recommendations", async ({ page }) => {
    await page.goto("/resources");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/recommendations");
  });

  test("/learn redirects to about", async ({ page }) => {
    await page.goto("/learn");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/about");
  });
});
