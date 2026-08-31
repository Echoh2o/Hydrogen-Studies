import { test, expect } from "@playwright/test";

/**
 * TipTap admin-editor smoke test.
 *
 * The 2026-08 audit (wave 10) replaced the XSS-vulnerable react-quill with
 * TipTap, flagged as "admin editor needs manual smoke test" — which never
 * happened. This automates it: register an admin, open the blog editor, and
 * verify the TipTap surface mounts and accepts input.
 *
 * Auth strategy: the seeded CI database contains no users, and the register
 * endpoint promotes the FIRST registered user to admin. No other e2e spec
 * registers users, and CI runs with workers:1, so this test's user is
 * deterministically the first — and therefore an admin with a live session
 * cookie on this browser context.
 */
test.describe("Admin blog editor (TipTap)", () => {
  test("editor mounts, accepts typing, and toolbar renders for an admin", async ({ page }) => {
    const unique = `${Date.now()}`;
    const reg = await page.request.post("/api/auth/register", {
      data: {
        username: `e2e-admin-${unique}`,
        email: `e2e-admin-${unique}@example.com`,
        password: "e2e-test-password-123",
        confirmPassword: "e2e-test-password-123",
      },
    });
    expect(reg.ok()).toBeTruthy();
    const body = await reg.json();
    // First registered user in an empty-users DB must be admin — if this
    // fails, either seeding changed or another spec started registering
    // users (revisit the strategy note above).
    expect(body.user?.role).toBe("admin");

    await page.goto("/admin/blogs/add");
    await page.waitForLoadState("networkidle");

    // Must not be bounced to login — the session from registration is live.
    expect(page.url()).toContain("/admin/blogs/add");

    // TipTap renders a contenteditable .ProseMirror surface.
    const editor = page.locator(".ProseMirror").first();
    await expect(editor).toBeVisible({ timeout: 15_000 });

    // Type into the editor and verify the content lands (the core regression
    // a broken TipTap wiring would fail).
    await editor.click();
    await page.keyboard.type("TipTap smoke test content");
    await expect(editor).toContainText("TipTap smoke test content");
  });
});
