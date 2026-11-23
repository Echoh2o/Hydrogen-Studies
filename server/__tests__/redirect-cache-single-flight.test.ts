import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";

// When the 5-min redirect cache went stale, every request in flight reloaded
// all ~14k rows at once (prod logs: "Redirect cache loaded" twice in the same
// second). Concurrent requests must share one load.
let loads = 0;
vi.mock("../db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => {
          loads++;
          await new Promise((r) => setTimeout(r, 20));
          return [{ id: 1, fromPath: "/old", toPath: "/new", statusCode: 301 }];
        },
      }),
    }),
    execute: async () => ({ rows: [] }),
  },
}));
vi.mock("../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { resolveRedirect } = await import("../services/redirect-service");

const req = (path: string) => ({ method: "GET", path, originalUrl: path, query: {}, headers: {}, get: () => undefined }) as unknown as Request;

describe("redirect cache", () => {
  it("loads once for concurrent requests", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => resolveRedirect(req("/old"))));
    expect(loads).toBe(1);
    expect(results[0]).toMatchObject({ kind: "redirect", status: 301, location: "/new" });
  });
});
