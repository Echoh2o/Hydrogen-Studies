import { describe, it, expect } from "vitest";
import { isCsrfExempt } from "../csrf-protection";

/**
 * The app's actual ignoreRoutes list (mirrors server/app.ts). Kept inline so
 * the test documents the intended exemption surface; if app.ts changes, the
 * relevant cases below should be revisited.
 */
const APP_IGNORE_ROUTES = [
  "/health",
  "/api/stats",
  "/api/search",
  "/api/categories",
  "/api/filters",
  "/api/overview",
  "/api/chat",
  "/api/advanced-chat",
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/client-errors",
  "/api/newsletter/subscribe",
  "/api/webhooks/",
  "/proxy/",
];

describe("isCsrfExempt", () => {
  describe("exact-match entries", () => {
    it("exempts an exactly matching path", () => {
      expect(isCsrfExempt("/api/chat", APP_IGNORE_ROUTES)).toBe(true);
      expect(isCsrfExempt("/api/auth/login", APP_IGNORE_ROUTES)).toBe(true);
      expect(isCsrfExempt("/api/client-errors", APP_IGNORE_ROUTES)).toBe(true);
      expect(isCsrfExempt("/api/newsletter/subscribe", APP_IGNORE_ROUTES)).toBe(
        true,
      );
    });

    it("does NOT exempt sibling paths under a formerly prefix-matched entry", () => {
      // These were all silently exempted by the old startsWith() matching.
      expect(isCsrfExempt("/api/search/save", APP_IGNORE_ROUTES)).toBe(false);
      expect(
        isCsrfExempt("/api/search/natural-language", APP_IGNORE_ROUTES),
      ).toBe(false);
      expect(isCsrfExempt("/api/search/parse-query", APP_IGNORE_ROUTES)).toBe(
        false,
      );
      expect(isCsrfExempt("/api/search/batch", APP_IGNORE_ROUTES)).toBe(false);
      expect(isCsrfExempt("/api/chat/feedback", APP_IGNORE_ROUTES)).toBe(false);
    });

    it("does NOT exempt paths that merely share a string prefix", () => {
      expect(isCsrfExempt("/api/statsExtra", ["/api/stats"])).toBe(false);
      expect(isCsrfExempt("/api/searches", ["/api/search"])).toBe(false);
      expect(isCsrfExempt("/healthcheck", ["/health"])).toBe(false);
    });
  });

  describe("explicit trailing-slash wildcard entries", () => {
    it("exempts subpaths under a wildcard entry", () => {
      expect(
        isCsrfExempt("/api/webhooks/shopify/order-created", APP_IGNORE_ROUTES),
      ).toBe(true);
      expect(isCsrfExempt("/proxy/export", APP_IGNORE_ROUTES)).toBe(true);
    });

    it("exempts the bare prefix itself", () => {
      expect(isCsrfExempt("/api/webhooks", APP_IGNORE_ROUTES)).toBe(true);
      expect(isCsrfExempt("/proxy", APP_IGNORE_ROUTES)).toBe(true);
    });

    it("does NOT exempt lookalike prefixes", () => {
      expect(isCsrfExempt("/api/webhooks-admin", APP_IGNORE_ROUTES)).toBe(
        false,
      );
      expect(isCsrfExempt("/proxyadmin", APP_IGNORE_ROUTES)).toBe(false);
    });
  });

  describe("non-exempt paths", () => {
    it("does not exempt unrelated mutating endpoints", () => {
      expect(isCsrfExempt("/api/trends/analyze", APP_IGNORE_ROUTES)).toBe(
        false,
      );
      expect(
        isCsrfExempt("/api/explorer/clear-cache", APP_IGNORE_ROUTES),
      ).toBe(false);
      expect(isCsrfExempt("/api/admin/anything", APP_IGNORE_ROUTES)).toBe(
        false,
      );
      expect(isCsrfExempt("/api/consensus/summarize", APP_IGNORE_ROUTES)).toBe(
        false,
      );
    });

    it("returns false for an empty ignore list", () => {
      expect(isCsrfExempt("/api/anything", [])).toBe(false);
    });
  });
});
