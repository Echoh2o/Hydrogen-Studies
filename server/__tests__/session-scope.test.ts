import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("../db", () => ({ pool: {} }));
const { csrfProtection } = await import("../csrf-protection");
const { skipsSession } = await import("../config/session-config");

// Every cookie-less GET used to mint a CSRF secret into a brand-new session,
// which express-session then saved: ~1,000 session rows an hour from crawlers,
// page views and even /assets/*.js requests (prod, 2026-11-22). The browser
// app only reads its token from GET /api/* responses (client/src/lib/csrf.ts).

function run(path: string) {
  const session: Record<string, unknown> = {};
  const cookies: string[] = [];
  const req = { method: "GET", path, session, headers: {} } as unknown as Request;
  const res = { locals: {}, cookie: (name: string) => cookies.push(name) } as unknown as Response;
  let nextCalled = false;
  csrfProtection()(req, res, () => (nextCalled = true));
  return { session, cookies, nextCalled };
}

describe("CSRF token minting", () => {
  it("does not touch the session on page GETs", () => {
    for (const path of ["/", "/blog/some-post", "/study/abc", "/assets/index.js"]) {
      const { session, cookies, nextCalled } = run(path);
      expect(nextCalled).toBe(true);
      expect(session).toEqual({});
      expect(cookies).toEqual([]);
    }
  });

  it("still mints a token on API GETs, where the client reads it", () => {
    const { session, cookies } = run("/api/auth/me");
    expect(session.csrfSecret).toBeTruthy();
    expect(session.csrfToken).toBeTruthy();
    expect(cookies.length).toBe(1);
  });
});

describe("skipsSession", () => {
  it("skips the session store for static files", () => {
    for (const p of ["/assets/index-abc.js", "/assets/BlogPage-Rw3ok7GY.js.map", "/_next/static/chunks/1.js", "/favicon.svg", "/logo.png", "/fonts/x.woff2"]) {
      expect(skipsSession(p)).toBe(true);
    }
  });

  it("keeps sessions for pages and every API route", () => {
    for (const p of ["/", "/blog", "/admin", "/study/abc", "/api/auth/me", "/api/og/study.png"]) {
      expect(skipsSession(p)).toBe(false);
    }
  });
});
