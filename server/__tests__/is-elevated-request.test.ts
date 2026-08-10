import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request } from "express";

// Configurable stub for the users lookup. `db.select().from().where().limit()`
// resolves to whatever the current test set here.
let dbRows: any[] = [];
const limitSpy = vi.fn(() => Promise.resolve(dbRows));

vi.mock("../db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: limitSpy,
  },
}));

const { isElevatedRequest } = await import("../auth");

function reqWith(session: any): Request {
  return { session } as unknown as Request;
}

describe("isElevatedRequest", () => {
  beforeEach(() => {
    dbRows = [];
    limitSpy.mockClear();
  });

  it("returns false for an anonymous request without hitting the database", async () => {
    const result = await isElevatedRequest(reqWith(undefined));
    expect(result).toBe(false);
    expect(limitSpy).not.toHaveBeenCalled();
  });

  it("returns false for a session with no userId without hitting the database", async () => {
    const result = await isElevatedRequest(reqWith({}));
    expect(result).toBe(false);
    expect(limitSpy).not.toHaveBeenCalled();
  });

  it("trusts a fresh cached admin role without a database lookup", async () => {
    const result = await isElevatedRequest(
      reqWith({
        userId: "u1",
        userRole: "admin",
        userIsActive: true,
        roleCachedAt: Date.now(),
      }),
    );
    expect(result).toBe(true);
    expect(limitSpy).not.toHaveBeenCalled();
  });

  it("returns true for a fresh cached editor role", async () => {
    const result = await isElevatedRequest(
      reqWith({
        userId: "u1",
        userRole: "editor",
        userIsActive: true,
        roleCachedAt: Date.now(),
      }),
    );
    expect(result).toBe(true);
  });

  it("returns false for a fresh cached non-privileged role (customer)", async () => {
    const result = await isElevatedRequest(
      reqWith({
        userId: "u1",
        userRole: "customer",
        userIsActive: true,
        roleCachedAt: Date.now(),
      }),
    );
    expect(result).toBe(false);
    expect(limitSpy).not.toHaveBeenCalled();
  });

  it("returns false when a cached admin is deactivated", async () => {
    const result = await isElevatedRequest(
      reqWith({
        userId: "u1",
        userRole: "admin",
        userIsActive: false,
        roleCachedAt: Date.now(),
      }),
    );
    expect(result).toBe(false);
  });

  it("falls back to a database lookup when the role cache is stale, admin -> true", async () => {
    dbRows = [{ role: "admin", isActive: true }];
    const result = await isElevatedRequest(
      reqWith({ userId: "u1", roleCachedAt: 0 }),
    );
    expect(result).toBe(true);
    expect(limitSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back to a database lookup, customer -> false", async () => {
    dbRows = [{ role: "customer", isActive: true }];
    const result = await isElevatedRequest(
      reqWith({ userId: "u1", roleCachedAt: 0 }),
    );
    expect(result).toBe(false);
  });

  it("returns false when the user row no longer exists", async () => {
    dbRows = [];
    const result = await isElevatedRequest(
      reqWith({ userId: "ghost", roleCachedAt: 0 }),
    );
    expect(result).toBe(false);
  });
});
