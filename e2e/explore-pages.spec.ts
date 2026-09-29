import { test, expect } from "@playwright/test";

test.describe("Explore Pages - Deep Tests", () => {
  test.describe("Explore by Benefit", () => {
    test("shows three categorization tabs", async ({ page }) => {
      await page.goto("/explore-by-benefit");
      await page.waitForLoadState("networkidle");

      // Should have tabs for condition, body system, life stage
      await expect(page.getByRole("tab", { name: /condition/i })).toBeVisible();
      await expect(page.getByRole("tab", { name: /body system/i })).toBeVisible();
      await expect(page.getByRole("tab", { name: /life stage/i })).toBeVisible();
    });

    test("clicking a category loads studies", async ({ page }) => {
      await page.goto("/explore-by-benefit");
      await page.waitForLoadState("networkidle");

      // Click the first category card
      const card = page.locator("[class*='cursor-pointer']").first();
      if (await card.isVisible()) {
        await card.click();
        await page.waitForLoadState("networkidle");

        // Should show research results or a "Back to Categories" button
        const body = await page.textContent("body");
        expect(body).toMatch(/research|studies|back to categories/i);
      }
    });

    test("category cards show study counts", async ({ page }) => {
      await page.goto("/explore-by-benefit");
      await page.waitForLoadState("networkidle");

      // Look for badge elements with study count text
      const badges = page.locator("[class*='badge'], .badge");
      const count = await badges.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe("Explore by Delivery Method", () => {
    test("shows three primary delivery method groups", async ({ page }) => {
      await page.goto("/explore-by-delivery-method");
      await page.waitForLoadState("networkidle");

      const body = await page.textContent("body");
      expect(body).toMatch(/hydrogen water/i);
      expect(body).toMatch(/inhalation/i);
    });

    // The hub route is /explore-by-delivery-method/<slug> (/delivery-methods/*
    // was never routed — these tests used to pass on the NotFound page).
    test("delivery method detail page loads", async ({ page }) => {
      const res = await page.goto("/explore-by-delivery-method/drinking-water");
      expect(res?.status()).toBe(200);
      await page.waitForLoadState("networkidle");

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Drinking Water — Hydrogen Therapy Research",
      );
      await expect(page).toHaveTitle("Drinking Water: Hydrogen Research | Hydrogen Studies");
    });

    test("delivery method detail lists its studies", async ({ page }) => {
      await page.goto("/explore-by-delivery-method/drinking-water");
      await page.waitForLoadState("networkidle");

      // The hub renders the crawler's study list (GET /api/explore/…/studies):
      // a "Research Studies" section of links to /study/<slug>.
      await expect(page.getByRole("heading", { name: "Research Studies" })).toBeVisible();
      const studyLinks = page.locator('main a[href^="/study/"]');
      expect(await studyLinks.count()).toBeGreaterThanOrEqual(1);
      await expect(page.getByText(/No studies found/i)).toHaveCount(0);
    });
  });

  test.describe("Unknown explore hubs", () => {
    test("/explore-by-demographic/xyzzy is a 404 with the NotFound page (noindex)", async ({ page }) => {
      const res = await page.goto("/explore-by-demographic/xyzzy");
      expect(res?.status()).toBe(404);
      await page.waitForLoadState("networkidle");

      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page Not Found");
      await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toHaveCount(1);
    });

    test("crawlers get the same 404 for an unknown hub", async ({ request }) => {
      const res = await request.get("/explore-by-demographic/xyzzy", {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
      });
      expect(res.status()).toBe(404);
      expect(await res.text()).toMatch(/<meta name="robots" content="noindex/);
    });
  });

  test.describe("Explore by Condition", () => {
    test("condition exploration page loads", async ({ page }) => {
      await page.goto("/explore-by-condition");
      await page.waitForLoadState("networkidle");

      const body = await page.textContent("body");
      expect(body).toMatch(/condition|health|explore/i);
    });
  });

  test.describe("Explore by Body System", () => {
    test("body system exploration page loads", async ({ page }) => {
      await page.goto("/explore-by-body-system");
      await page.waitForLoadState("networkidle");

      const body = await page.textContent("body");
      expect(body).toMatch(/body|system|explore/i);
    });
  });
});
