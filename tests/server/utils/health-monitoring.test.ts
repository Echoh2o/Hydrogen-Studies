import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB before importing
vi.mock("../../../server/db", () => ({
  db: {
    execute: vi.fn(),
  },
}));

vi.mock("drizzle-orm", () => ({
  sql: vi.fn(),
}));

import { trackRequest } from "../../../server/utils/health-monitoring";

describe("trackRequest", () => {
  it("should track a successful request without error", () => {
    // Should not throw
    expect(() => trackRequest(100, false)).not.toThrow();
  });

  it("should track a failed request", () => {
    expect(() => trackRequest(500, true)).not.toThrow();
  });

  it("should handle zero duration", () => {
    expect(() => trackRequest(0, false)).not.toThrow();
  });

  it("should handle very large duration", () => {
    expect(() => trackRequest(999999, false)).not.toThrow();
  });
});
