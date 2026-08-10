/**
 * Tests the REAL verifyShopifyWebhook from server/routes/shopify-webhook-routes.ts
 * (named export; the router stays the default export).
 *
 * The real function reads SHOPIFY_WEBHOOK_SECRET and NODE_ENV from process.env
 * rather than taking them as parameters, so each test sets/clears those env
 * vars and the suite restores them afterwards.
 *
 * Invariants covered (ported from the previous copy-based test, re-aimed at
 * the real implementation):
 *  - valid HMAC-SHA256(base64) signature over the raw body → accepted
 *  - tampered body / wrong secret → rejected (timing-safe compare)
 *  - no secret configured in production → fail closed (rejected)
 *  - no secret configured in development → verification skipped (accepted)
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import crypto from "crypto";

// The route module imports ../db (which throws without DATABASE_URL) plus
// customer-sync/auth modules. Mock the db seam so importing the module for
// its named export has no side effects; nothing in these tests touches it.
vi.mock("../db", () => ({
  db: {},
  pool: { query: async () => ({ rows: [] }), on: () => {} },
  sqlQuery: async () => [],
}));

const { verifyShopifyWebhook } = await import("../routes/shopify-webhook-routes");

describe("verifyShopifyWebhook (real implementation)", () => {
  const testSecret = "test-webhook-secret";
  const testBody = Buffer.from('{"email":"test@example.com"}');

  const savedSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
  const savedNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    // Silence the logger warnings the real function emits on the
    // no-secret paths.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  beforeEach(() => {
    process.env.SHOPIFY_WEBHOOK_SECRET = testSecret;
    process.env.NODE_ENV = "production";
  });

  afterAll(() => {
    if (savedSecret !== undefined) process.env.SHOPIFY_WEBHOOK_SECRET = savedSecret;
    else delete process.env.SHOPIFY_WEBHOOK_SECRET;
    if (savedNodeEnv !== undefined) process.env.NODE_ENV = savedNodeEnv;
    else delete process.env.NODE_ENV;
    vi.restoreAllMocks();
  });

  function computeHmac(body: Buffer, secret: string): string {
    return crypto.createHmac("sha256", secret).update(body).digest("base64");
  }

  it("returns true for a valid HMAC signature", () => {
    const hmac = computeHmac(testBody, testSecret);
    expect(verifyShopifyWebhook(testBody, hmac)).toBe(true);
  });

  it("returns false when the body was tampered with", () => {
    // Signature computed over a different payload (same length after base64,
    // so this exercises the timing-safe compare rather than a length check).
    const fakeHmac = computeHmac(Buffer.from("tampered"), testSecret);
    expect(verifyShopifyWebhook(testBody, fakeHmac)).toBe(false);
  });

  it("returns false when signed with the wrong secret", () => {
    const hmac = computeHmac(testBody, "wrong-secret");
    expect(verifyShopifyWebhook(testBody, hmac)).toBe(false);
  });

  it("fails closed in production when no secret is configured", () => {
    delete process.env.SHOPIFY_WEBHOOK_SECRET;
    process.env.NODE_ENV = "production";
    expect(verifyShopifyWebhook(testBody, computeHmac(testBody, testSecret))).toBe(false);
  });

  it("skips verification in development when no secret is configured", () => {
    delete process.env.SHOPIFY_WEBHOOK_SECRET;
    process.env.NODE_ENV = "development";
    expect(verifyShopifyWebhook(testBody, "any-hmac")).toBe(true);
  });

  it("uses a timing-safe comparison (correct base64 sha256 length, one byte off)", () => {
    const hmac = computeHmac(testBody, testSecret);
    // Flip the first character to a different one — same length, near-identical
    // content. A naive prefix-compare bug or an accepted-anyway bug would pass.
    const flipped = (hmac[0] === "A" ? "B" : "A") + hmac.slice(1);
    expect(verifyShopifyWebhook(testBody, flipped)).toBe(false);
  });

  it("returns false (does not throw) for a wrong-length signature", () => {
    // Previously timingSafeEqual threw RangeError on unequal lengths, which a
    // handler's catch turned into a 200 ack. Must be a clean false now.
    expect(() => verifyShopifyWebhook(testBody, "short")).not.toThrow();
    expect(verifyShopifyWebhook(testBody, "short")).toBe(false);
  });

  it("returns false for a missing/empty signature header", () => {
    expect(verifyShopifyWebhook(testBody, "")).toBe(false);
  });
});
