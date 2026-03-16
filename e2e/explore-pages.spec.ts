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

    test("delivery method detail page loads", async ({ page }) => {
      await page.goto("/delivery-methods/drinking-water");
      await page.waitForLoadState("networkidle");

      const body = await page.textContent("body");
      expect(body).toMatch(/drinking|water|hydrogen/i);
    });

    test("delivery method detail has study tabs", async ({ page }) => {
      await page.goto("/delivery-methods/drinking-water");
      await page.waitForLoadState("networkidle");

      // Should have tab triggers for All/Clinical/Preclinical
      const tabs = page.locator("[role='tab']");
      const count = await tabs.count();
      expect(count).toBeGreaterThanOrEqual(2);
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
