/**
 * Route-guard regression tests for the real Express app (server/app.ts),
 * driven with supertest. These lock in the 2026-07 audit findings:
 *
 *  1. /api/admin/* endpoints reject unauthenticated requests (401), across
 *     the different admin routers (per-route requireAdmin, router-level
 *     router.use(requireAdmin), and inline app.ts routes).
 *  2. The Google OAuth callbacks (/api/admin/gsc|ga4/oauth/callback) are
 *     reachable WITHOUT admin auth — they are gated by the signed state
 *     cookie instead. A bare request must fail with the router's own
 *     400 "state mismatch", NOT the admin guard's 401. This is the
 *     regression test for route ORDERING: if these routers ever get
 *     mounted below the /api/admin catch-all (which does
 *     router.use(requireAdmin)), Google's redirect would bounce off a 401.
 *  3. Recently-gated mutation endpoints (POST /api/trends/analyze,
 *     PUT /api/trends/alerts/:id/acknowledge, POST /api/explorer/clear-cache)
 *     stay gated: 403 without a CSRF token (defense in depth), and 401 from
 *     requireAdmin once a valid CSRF token is presented without a login.
 *
 * How the app import is made side-effect free:
 *  - ../db is mocked. pool.query("SELECT 1") returns a promise that never
 *    settles, so app.ts's floating boot chain (migrations → stale-job
 *    recovery → process.exit(1) on failure) never runs. All other db access
 *    resolves to empty results via a chainable thenable — irrelevant here
 *    because every assertion hits a guard that short-circuits before any
 *    handler touches data.
 *  - ../config/session-config is mocked with a real express-session backed
 *    by the in-memory store (same cookie/session semantics, no Postgres),
 *    so requireRole and the CSRF double-submit flow behave exactly as prod.
 *  - ../services/job-scheduler and ../utils/health-monitoring are mocked so
 *    no background intervals start.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";

// Env needed by modules in app.ts's import graph. db.ts itself is mocked,
// but SESSION_SECRET/DATABASE_URL are read defensively elsewhere.
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "a".repeat(64);
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";
delete process.env.SENTRY_DSN; // never init Sentry from tests

vi.mock("../db", () => {
  // A chainable, awaitable stand-in for drizzle's fluent builders: every
  // method returns the chain; awaiting it resolves to []. Guards return
  // 401/403 before handlers run, so no test depends on real data.
  function chain(): any {
    const p: any = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: any, reject: any) => Promise.resolve([]).then(resolve, reject);
        }
        return () => p;
      },
      apply: () => p,
    });
    return p;
  }
  const db = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return undefined; // db itself is not thenable
        return () => chain();
      },
    },
  );
  return {
    db,
    pool: {
      query: vi.fn((text?: unknown) => {
        // Never settle the boot probe: keeps app.ts's migration/exit chain
        // (pool.query("SELECT 1").then(...migrations...)) permanently pending.
        if (typeof text === "string" && text.trim() === "SELECT 1") {
          return new Promise(() => {});
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      }),
      on: vi.fn(),
      end: vi.fn(),
    },
    sqlQuery: vi.fn(async () => []),
  };
});

vi.mock("../config/session-config", async () => {
  const session = (await import("express-session")).default;
  return {
    getSessionMiddleware: () =>
      session({
        secret: "test-session-secret-0123456789abcdef",
        resave: false,
        saveUninitialized: false,
        name: "hydrogen.sid",
        cookie: { httpOnly: true, secure: false, sameSite: "lax" as const },
      }),
    getSessionConfig: async () => ({}),
    generateSessionSecret: () => "x".repeat(64),
  };
});

vi.mock("../services/job-scheduler", () => {
  const jobScheduler: any = new Proxy(
    {},
    { get: (_t, prop) => (prop === "then" ? undefined : vi.fn()) },
  );
  return { jobScheduler, JobScheduler: class { static getInstance = () => jobScheduler; } };
});

vi.mock("../utils/health-monitoring", () => ({
  initializeHealthMonitoring: vi.fn(),
  stopHealthMonitoring: vi.fn(),
  performHealthCheck: vi.fn(async () => ({
    status: "healthy",
    database: { connected: true, latency: 1 },
  })),
  trackRequest: vi.fn(),
  logError: vi.fn(),
  getHealthStatus: vi.fn(() => ({ status: "healthy" })),
  resetErrorCount: vi.fn(),
}));

const { app } = await import("../app");

/** Representative unauthenticated GETs across the different admin routers. */
const ADMIN_GET_ROUTES = [
  "/api/admin/gsc/status", //           admin-gsc-routes (per-route requireAdmin)
  "/api/admin/ga4/status", //           admin-ga4-routes (per-route requireAdmin)
  "/api/admin/settings", //             admin-settings-routes
  "/api/admin/links", //                admin-link-routes
  "/api/admin/redirects", //            admin-redirect-routes
  "/api/admin/monitoring/status", //    admin-monitoring-routes (router.use(requireAdmin))
  "/api/admin/journal-date-stats", //   inline route in app.ts
  "/api/webhooks/shopify/sync-status", // admin-facing route on the webhook router
];

describe("admin route guards (unauthenticated)", () => {
  beforeAll(() => {
    // The app logs route errors and session-init chatter; keep output clean.
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  describe("1. /api/admin/* GETs return 401, never 200", () => {
    for (const route of ADMIN_GET_ROUTES) {
      it(`GET ${route} → 401`, async () => {
        const res = await request(app).get(route);
        expect(res.status).toBe(401);
        expect(res.body).toMatchObject({ error: expect.stringContaining("Unauthorized") });
      });
    }
  });

  describe("2. OAuth callbacks bypass the admin guard (state-cookie gated instead)", () => {
    for (const route of [
      "/api/admin/gsc/oauth/callback",
      "/api/admin/ga4/oauth/callback",
    ]) {
      it(`GET ${route} reaches the router's own state validation (400, not the guard's 401)`, async () => {
        const res = await request(app).get(route);
        // The callback handler's OWN failure mode for a bare request:
        // missing code/state/cookie → 400 "state mismatch".
        expect(res.status).toBe(400);
        expect(res.text).toContain("state mismatch");
        // Regression guard for mount ordering: if this router slipped below
        // the /api/admin catch-all (router.use(requireAdmin)), we'd see the
        // guard's 401 JSON here instead and Google's redirect would break.
        expect(res.status).not.toBe(401);
        expect(res.body?.error).toBeUndefined();
      });
    }
  });

  describe("3. recently-gated mutation endpoints stay gated", () => {
    const MUTATIONS: Array<[method: "post" | "put", route: string]> = [
      ["post", "/api/trends/analyze"],
      ["put", "/api/trends/alerts/1/acknowledge"],
      ["post", "/api/explorer/clear-cache"],
    ];

    it("without a CSRF token: rejected 403 by CSRF protection (defense in depth)", async () => {
      for (const [method, route] of MUTATIONS) {
        const res = await request(app)[method](route).send({});
        expect(res.status, `${method.toUpperCase()} ${route}`).toBe(403);
        expect(res.body.error).toContain("CSRF");
      }
    });

    it("with a valid CSRF token but no login: rejected 401 by requireAdmin", async () => {
      // Obtain a CSRF token the way the real client does: any GET /api/*
      // issues the session + double-submit cookie and echoes the token in
      // the X-CSRF-Token response header. The agent persists the cookies.
      const agent = request.agent(app);
      const seed = await agent.get("/api/admin/gsc/status"); // any /api GET works, even a 401
      const csrfToken = seed.headers["x-csrf-token"];
      expect(csrfToken).toBeTruthy();

      for (const [method, route] of MUTATIONS) {
        const res = await agent[method](route).set("X-CSRF-Token", csrfToken).send({});
        // CSRF passed (not 403-CSRF), auth guard fired: proves requireAdmin
        // is mounted on the route itself.
        expect(res.status, `${method.toUpperCase()} ${route}`).toBe(401);
        expect(res.body.error).toContain("Unauthorized");
      }
    });
  });
});
