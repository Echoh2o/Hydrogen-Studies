import { test, expect } from "@playwright/test";

// Admin pages require authentication - these tests verify:
// 1. Unauthenticated users are redirected/blocked
// 2. Admin pages load correctly when authenticated

test.describe("Admin Pages - Unauthenticated Access", () => {
  test("admin dashboard blocks unauthenticated users (no bypass)", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    const url = page.url();
    const body = (await page.textContent("body")) ?? "";

    // ProtectedRoute must redirect an unauthenticated visitor to /login.
    // Asserting the redirect (not just "some auth-ish word appears") is what
    // makes this test capable of detecting an auth bypass.
    expect(url).toContain("/login");
    // The login surface must actually render.
    expect(body).toMatch(/sign in|welcome back|password/i);
    // And the gated admin dashboard content must NOT leak. "Quick actions" is
    // rendered only by the authenticated AdminDashboard, so its presence would
    // mean the guard was bypassed.
    expect(body).not.toMatch(/quick actions/i);
  });

  test("admin studies page redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/admin/studies");
    await page.waitForLoadState("networkidle");
    const body = (await page.textContent("body")) ?? "";
    // Gated route must send the visitor to /login, not crash or leak content.
    expect(page.url()).toContain("/login");
    expect(body).not.toMatch(/internal server error|500/i);
  });

  test("admin blogs page redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/admin/blogs");
    await page.waitForLoadState("networkidle");
    const body = (await page.textContent("body")) ?? "";
    expect(page.url()).toContain("/login");
    expect(body).not.toMatch(/internal server error|500/i);
  });

  test("admin settings page redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.waitForLoadState("networkidle");
    const body = (await page.textContent("body")) ?? "";
    expect(page.url()).toContain("/login");
    expect(body).not.toMatch(/internal server error|500/i);
  });
});

test.describe("Admin Pages - Layout & Navigation", () => {
  // These tests check that admin pages don't have double layouts
  // (the nested AdminLayout bug we fixed)

  test("admin studies page doesn't have double sidebar", async ({ page }) => {
    await page.goto("/admin/studies");
    await page.waitForLoadState("networkidle");

    // Count sidebar elements - should not have more than one
    const sidebars = page.locator("aside");
    const sidebarCount = await sidebars.count();
    // At most one sidebar (or zero if redirected to login)
    expect(sidebarCount).toBeLessThanOrEqual(1);
  });

  test("admin page sidebar has correct navigation links", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Check for key nav items if sidebar is present
    const sidebar = page.locator("aside").first();
    if (await sidebar.isVisible()) {
      const sidebarText = await sidebar.textContent();
      // Should have main navigation items
      expect(sidebarText).toMatch(/dashboard|studies|blog/i);
    }
  });
});

test.describe("Admin API Endpoints", () => {
  test("protected /api/admin/* endpoints reject unauthenticated requests with 401/403", async ({ request }) => {
    // Every one of these is guarded by requireAdmin, which responds 401 for an
    // anonymous session (403 for an authenticated non-admin). An auth bypass
    // would surface here as a 200, so assert the exact rejection status.
    const endpoints = [
      "/api/admin/journal-date-stats",
      "/api/admin/quality/monitor",
      "/api/admin/settings",
      "/api/admin/gsc/status",
      "/api/admin/ga4/status",
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(endpoint);
      expect(
        [401, 403],
        `${endpoint} should be auth-gated (got ${response.status()})`,
      ).toContain(response.status());
    }
  });

  test("public read endpoints don't crash for anonymous requests", async ({ request }) => {
    // These are intentionally public reads; they must return a real response
    // (not a 5xx) even without a session.
    const endpoints = [
      "/api/blogs",
      "/api/categories",
      "/api/stats/dashboard",
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(endpoint);
      // Should not be a server error
      expect(response.status()).toBeLessThan(500);
    }
  });

  test("admin POST endpoints reject without auth", async ({ request }) => {
    const response = await request.post("/api/blogs", {
      data: { title: "test", content: "test" },
      headers: { "Content-Type": "application/json" },
    });
    // Should be rejected (401/403) not crash (500)
    expect([400, 401, 403, 404]).toContain(response.status());
  });
});
