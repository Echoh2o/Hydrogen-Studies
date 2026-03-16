import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";

// Test the HMAC verification logic directly (extracted from the route file)
function verifyShopifyWebhook(
  rawBody: Buffer,
  hmacHeader: string,
  secret: string | undefined,
  nodeEnv: string,
): boolean {
  if (!secret) {
    if (nodeEnv === "production") {
      return false;
    }
    return true;
  }

  const computed = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");

  return crypto.timingSafeEqual(
    Buffer.from(computed),
    Buffer.from(hmacHeader),
  );
}

describe("verifyShopifyWebhook", () => {
  const testSecret = "test-webhook-secret";
  const testBody = Buffer.from('{"email":"test@example.com"}');

  function computeHmac(body: Buffer, secret: string): string {
    return crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("base64");
  }

  it("returns true for valid HMAC signature", () => {
    const hmac = computeHmac(testBody, testSecret);
    expect(verifyShopifyWebhook(testBody, hmac, testSecret, "production")).toBe(
      true,
    );
  });

  it("returns false for invalid HMAC signature", () => {
    const fakeHmac = computeHmac(Buffer.from("tampered"), testSecret);
    expect(
      verifyShopifyWebhook(testBody, fakeHmac, testSecret, "production"),
    ).toBe(false);
  });

  it("returns false for wrong secret", () => {
    const hmac = computeHmac(testBody, "wrong-secret");
    expect(
      verifyShopifyWebhook(testBody, hmac, testSecret, "production"),
    ).toBe(false);
  });

  it("rejects in production when secret is not configured", () => {
    expect(
      verifyShopifyWebhook(testBody, "any-hmac", undefined, "production"),
    ).toBe(false);
  });

  it("allows in development when secret is not configured", () => {
    expect(
      verifyShopifyWebhook(testBody, "any-hmac", undefined, "development"),
    ).toBe(true);
  });
});
