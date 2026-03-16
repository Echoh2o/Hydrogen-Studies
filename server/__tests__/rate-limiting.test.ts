import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request } from "express";

// Mock express-rate-limit so the module can load without side effects
vi.mock("express-rate-limit", () => ({
  default: vi.fn(() => vi.fn()),
}));

const { skipForAdmin } = await import("../utils/rate-limiting");

/**
 * Build a minimal Express-like Request stub.
 * Only the fields referenced by skipForAdmin are included.
 */
function fakeReq(overrides: {
  session?: Record<string, unknown>;
  headers?: Record<string, string | undefined>;
}): Request {
  return {
    session: overrides.session ?? {},
    headers: overrides.headers ?? {},
  } as unknown as Request;
}

describe("skipForAdmin", () => {
  let originalToken: string | undefined;

  beforeEach(() => {
    originalToken = process.env.ADMIN_BYPASS_TOKEN;
  });

  afterEach(() => {
    if (originalToken !== undefined) {
      process.env.ADMIN_BYPASS_TOKEN = originalToken;
    } else {
      delete process.env.ADMIN_BYPASS_TOKEN;
    }
  });

  // --- Session-based checks ---

  it("returns true when session userRole is admin", () => {
    const req = fakeReq({ session: { userRole: "admin" } });
    expect(skipForAdmin(req)).toBe(true);
  });

  it("returns false when session userRole is a non-admin value", () => {
    const req = fakeReq({ session: { userRole: "user" } });
    expect(skipForAdmin(req)).toBe(false);
  });

  it("returns false when session has no userRole", () => {
    const req = fakeReq({ session: {} });
    expect(skipForAdmin(req)).toBe(false);
  });

  // --- Token-based checks (timing-safe comparison) ---

  it("returns true when x-admin-token matches ADMIN_BYPASS_TOKEN", () => {
    const secret = "super-secret-token-value-1234";
    process.env.ADMIN_BYPASS_TOKEN = secret;
    const req = fakeReq({ headers: { "x-admin-token": secret } });
    expect(skipForAdmin(req)).toBe(true);
  });

  it("returns false when x-admin-token does not match", () => {
    process.env.ADMIN_BYPASS_TOKEN = "correct-token";
    const req = fakeReq({ headers: { "x-admin-token": "wrong-token!!" } });
    expect(skipForAdmin(req)).toBe(false);
  });

  it("returns false when ADMIN_BYPASS_TOKEN env var is not set", () => {
    delete process.env.ADMIN_BYPASS_TOKEN;
    const req = fakeReq({ headers: { "x-admin-token": "anything" } });
    expect(skipForAdmin(req)).toBe(false);
  });

  it("returns false when x-admin-token header is missing", () => {
    process.env.ADMIN_BYPASS_TOKEN = "some-token";
    const req = fakeReq({ headers: {} });
    expect(skipForAdmin(req)).toBe(false);
  });

  it("returns false for length-mismatched tokens (timingSafeEqual throws)", () => {
    // timingSafeEqual throws when buffers have different lengths.
    // skipForAdmin should catch that and return false.
    process.env.ADMIN_BYPASS_TOKEN = "short";
    const req = fakeReq({ headers: { "x-admin-token": "a-much-longer-token" } });
    expect(skipForAdmin(req)).toBe(false);
  });

  // --- Priority: session check wins before token check ---

  it("returns true via session even if token header is wrong", () => {
    process.env.ADMIN_BYPASS_TOKEN = "correct";
    const req = fakeReq({
      session: { userRole: "admin" },
      headers: { "x-admin-token": "wrong" },
    });
    expect(skipForAdmin(req)).toBe(true);
  });
});
