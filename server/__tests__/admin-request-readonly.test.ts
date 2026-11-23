import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";

// isAdminRequest runs on every /api request (public-abstracts). It must read
// the role without writing the session: parallel requests from a logged-in
// admin each saving the session raced and broke the admin editor in E2E.
vi.mock("../db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ role: "admin", isActive: true }] }) }) }),
  },
}));
vi.mock("../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { isAdminRequest } = await import("../auth");

describe("isAdminRequest", () => {
  it("answers from the DB without writing role-cache fields to the session", async () => {
    const session: Record<string, unknown> = { userId: 7 };
    expect(await isAdminRequest({ session } as unknown as Request)).toBe(true);
    expect(session).toEqual({ userId: 7 });
  });

  it("is false without a session user", async () => {
    expect(await isAdminRequest({ session: {} } as unknown as Request)).toBe(false);
  });
});
