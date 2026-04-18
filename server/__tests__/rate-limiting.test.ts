import { describe, it, expect, vi } from "vitest";
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
}): Request {
  return {
    session: overrides.session ?? {},
  } as unknown as Request;
}

describe("skipForAdmin", () => {
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

  it("returns false when session is missing entirely", () => {
    const req = { } as unknown as Request;
    expect(skipForAdmin(req)).toBe(false);
  });
});
