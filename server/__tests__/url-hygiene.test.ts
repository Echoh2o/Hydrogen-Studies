/**
 * URL hygiene (2026-09-23 audit): case + trailing-slash normalization, legacy
 * `/search/?search=<term>` links, and single-hop resolution of redirects-table
 * rows for non-canonical spellings. Before this, `/about/`, `/About`,
 * `/STUDIES`, `/search/` and every `/study/<slug>/` served Googlebot a hard 404
 * while browsers got a 200 SPA shell.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Rows per table name for every awaited drizzle select chain.
const tableRows = vi.hoisted(() => ({ current: {} as Record<string, any[]> }));

vi.mock("../db", async () => {
  const { getTableName } = await import("drizzle-orm");
  function chain(state: { table?: string } = {}): any {
    const p: any = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: any, reject: any) =>
            Promise.resolve([...(tableRows.current[state.table ?? ""] ?? [])]).then(resolve, reject);
        }
        if (prop === "catch") return () => p;
        if (prop === "from") {
          return (table: any) => {
            try { state.table = getTableName(table); } catch { /* not a table */ }
            return p;
          };
        }
        return () => p;
      },
      apply() {
        return p;
      },
    });
    return p;
  }
  const db: any = new Proxy({}, { get: () => () => chain({}) });
  return { db, pool: { query: () => new Promise(() => {}) } };
});

import {
  canonicalizePath,
  normalizationTarget,
  searchTermKey,
  buildHubIndex,
  resolveSearchRedirect,
  withQuery,
  rawQueryOf,
  resetSearchHubIndexCache,
} from "../services/url-hygiene";
import { redirectMiddleware, invalidateRedirectCache } from "../services/redirect-service";

const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

describe("canonicalizePath", () => {
  it("lowercases letters and strips trailing slashes", () => {
    expect(canonicalizePath("/About/")).toBe("/about");
    expect(canonicalizePath("/STUDIES")).toBe("/studies");
    expect(canonicalizePath("/study/Some-Slug-1775650467136///")).toBe("/study/some-slug-1775650467136");
  });

  it("keeps the root and uppercases percent-escapes (RFC 3986 canonical)", () => {
    expect(canonicalizePath("/")).toBe("/");
    expect(canonicalizePath("//")).toBe("/");
    expect(canonicalizePath("/study/non%e2%80%91alcoholic/")).toBe("/study/non%E2%80%91alcoholic");
    expect(canonicalizePath("/study/id%2F123")).toBe("/study/id%2F123");
  });

  it("is idempotent", () => {
    for (const p of ["/About/", "/study/X%e2%80%91Y/", "/search/"]) {
      expect(canonicalizePath(canonicalizePath(p))).toBe(canonicalizePath(p));
    }
  });
});

describe("normalizationTarget", () => {
  it("returns the canonical path for non-canonical public paths", () => {
    expect(normalizationTarget("/about/")).toBe("/about");
    expect(normalizationTarget("/About")).toBe("/about");
    expect(normalizationTarget("/STUDIES")).toBe("/studies");
    expect(normalizationTarget("/study/old-title/")).toBe("/study/old-title");
    expect(normalizationTarget("/Explore-By-Condition/Kidney-Health")).toBe("/explore-by-condition/kidney-health");
  });

  it("returns null for already-canonical paths", () => {
    expect(normalizationTarget("/")).toBeNull();
    expect(normalizationTarget("/about")).toBeNull();
    expect(normalizationTarget("/study/some-slug-1775650467136")).toBeNull();
    // %2F stays uppercase, so the /study/id%2F{n} handler still sees it
    expect(normalizationTarget("/study/id%2F123")).toBeNull();
  });

  it("never touches API, assets, admin, proxy, uploads, health or files", () => {
    for (const p of [
      "/api/Studies/",
      "/assets/Index-ABC.js",
      "/admin/Studies/",
      "/Admin",
      "/proxy/Study/x/",
      "/uploads/Study-Images/A.PNG",
      "/images/Logo.png",
      "/health/",
      "/Robots.txt",
      "/Sitemap-Studies.xml",
      "/.well-known/Security.txt",
      "/studies/tags/Cardiovascular",
      "/@vite/client",
    ]) {
      expect(normalizationTarget(p), p).toBeNull();
    }
  });

  it("refuses protocol-relative and backslash paths (no open redirect)", () => {
    expect(normalizationTarget("//evil.com/")).toBeNull();
    expect(normalizationTarget("//Evil.com")).toBeNull();
    expect(normalizationTarget("/\\evil.com/")).toBeNull();
  });
});

describe("query helpers", () => {
  it("extracts the raw query and appends it only when the target has none", () => {
    expect(rawQueryOf("/a/?x=1&y=2")).toBe("?x=1&y=2");
    expect(rawQueryOf("/a")).toBe("");
    expect(withQuery("/b", "?x=1")).toBe("/b?x=1");
    expect(withQuery("/b?keep=1", "?x=1")).toBe("/b?keep=1");
    expect(withQuery("/b", "")).toBe("/b");
    expect(withQuery("/b", "?")).toBe("/b");
  });
});

describe("searchTermKey", () => {
  it("normalizes case, punctuation, '&'/'and' and diacritics", () => {
    expect(searchTermKey("Oxidative Stress")).toBe("oxidative stress");
    expect(searchTermKey("oxidative-stress")).toBe("oxidative stress");
    expect(searchTermKey("  Anxiety & Stress ")).toBe("anxiety stress");
    expect(searchTermKey("anxiety and stress")).toBe("anxiety stress");
    expect(searchTermKey("Fatty Liver (NAFLD)")).toBe("fatty liver nafld");
    expect(searchTermKey("Ménière")).toBe("meniere");
    expect(searchTermKey("")).toBe("");
  });
});

describe("resolveSearchRedirect", () => {
  const index = buildHubIndex([
    { names: ["Oxidative Stress", "oxidative-stress"], path: "/explore-by-condition/oxidative-stress" },
    { names: ["Brain & Nervous System", "brain-nervous-system"], path: "/explore-by-body-system/brain-nervous-system" },
    // A later hub with a colliding key never overrides the first (conditions win)
    { names: ["oxidative stress"], path: "/explore-by-mechanism/should-not-win" },
  ]);

  it("maps a term that names a hub to that hub (either spelling of /search)", () => {
    expect(resolveSearchRedirect("/search/", "oxidative stress", "?search=oxidative+stress&sortBy=x", index))
      .toBe("/explore-by-condition/oxidative-stress");
    expect(resolveSearchRedirect("/search", "Oxidative Stress", "?search=Oxidative%20Stress", index))
      .toBe("/explore-by-condition/oxidative-stress");
    expect(resolveSearchRedirect("/search/", "brain & nervous system", "?search=x", index))
      .toBe("/explore-by-body-system/brain-nervous-system");
  });

  it("sends non-hub terms on non-canonical spellings to /search with the query intact", () => {
    expect(resolveSearchRedirect("/search/", "sleep", "?search=sleep", index)).toBe("/search?search=sleep");
    expect(resolveSearchRedirect("/Search", "", "?search=", index)).toBe("/search?search=");
    expect(resolveSearchRedirect("/search/", undefined, "", index)).toBe("/search");
  });

  it("leaves the live /search page alone when the term is not a hub", () => {
    expect(resolveSearchRedirect("/search", "sleep", "?search=sleep", index)).toBeNull();
    expect(resolveSearchRedirect("/search", undefined, "", index)).toBeNull();
    expect(resolveSearchRedirect("/search", ["a", "b"], "?search=a&search=b", index)).toBeNull();
  });

  it("ignores other paths", () => {
    expect(resolveSearchRedirect("/search/natural-language", "oxidative stress", "", index)).toBeNull();
    expect(resolveSearchRedirect("/advanced-search", "oxidative stress", "", index)).toBeNull();
  });
});

describe("redirectMiddleware — single-hop resolution", () => {
  function makeApp() {
    const app = express();
    app.use(redirectMiddleware());
    app.all("*", (req, res) => res.status(200).send(`page ${req.path}`));
    return app;
  }

  beforeEach(async () => {
    tableRows.current = {
      redirects: [
        { id: 1, fromPath: "/study/old-title", toPath: "/study/old-title-1775650467136", statusCode: 301 },
        { id: 2, fromPath: "/start", toPath: "/", statusCode: 301 },
        { id: 3, fromPath: "/blog/retired-post", toPath: "-", statusCode: 410 },
        { id: 4, fromPath: "/study", toPath: "/studies", statusCode: 301 },
      ],
      health_conditions: [
        { slug: "oxidative-stress", name: "Oxidative Stress" },
        { slug: "anxiety-stress", name: "Anxiety & Stress" },
      ],
    };
    resetSearchHubIndexCache();
    await invalidateRedirectCache();
  });

  it("resolves a legacy study URL with trailing slash + caps straight to the final URL", async () => {
    for (const ua of [GOOGLEBOT, CHROME]) {
      const res = await request(makeApp()).get("/Study/Old-Title/?ref=echowater").set("User-Agent", ua);
      expect(res.status).toBe(301);
      expect(res.headers.location).toBe("/study/old-title-1775650467136?ref=echowater");
    }
  });

  it("resolves /start/ and /study?id=N from table rows in one hop", async () => {
    const start = await request(makeApp()).get("/start/");
    expect(start.status).toBe(301);
    expect(start.headers.location).toBe("/");
    const study = await request(makeApp()).get("/study/?id=1219");
    expect(study.status).toBe(301);
    expect(study.headers.location).toBe("/studies?id=1219");
  });

  it("still serves 410 for retired rows under any spelling", async () => {
    const res = await request(makeApp()).get("/Blog/Retired-Post/");
    expect(res.status).toBe(410);
  });

  it("301s non-canonical paths without a table row to the canonical path, preserving the query", async () => {
    const about = await request(makeApp()).get("/About/?utm_source=x").set("User-Agent", GOOGLEBOT);
    expect(about.status).toBe(301);
    expect(about.headers.location).toBe("/about?utm_source=x");
    const studies = await request(makeApp()).get("/STUDIES");
    expect(studies.status).toBe(301);
    expect(studies.headers.location).toBe("/studies");
  });

  it("passes canonical paths, API routes and non-GET requests through", async () => {
    expect((await request(makeApp()).get("/about")).status).toBe(200);
    expect((await request(makeApp()).get("/api/Studies/")).status).toBe(200);
    expect((await request(makeApp()).post("/About/")).status).toBe(200);
    expect((await request(makeApp()).get("/Robots.txt")).status).toBe(200);
  });

  it("maps legacy /search/?search=<hub term> to the hub", async () => {
    const res = await request(makeApp())
      .get("/search/?search=oxidative+stress&sortBy=publish_year+DESC&perPage=25")
      .set("User-Agent", GOOGLEBOT);
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe("/explore-by-condition/oxidative-stress");
    const amp = await request(makeApp()).get("/search?search=Anxiety%20%26%20Stress");
    expect(amp.status).toBe(301);
    expect(amp.headers.location).toBe("/explore-by-condition/anxiety-stress");
  });

  it("normalizes /search/ for non-hub terms and keeps /search itself live", async () => {
    const legacy = await request(makeApp()).get("/search/?search=sleep");
    expect(legacy.status).toBe(301);
    expect(legacy.headers.location).toBe("/search?search=sleep");
    const bare = await request(makeApp()).get("/search/");
    expect(bare.status).toBe(301);
    expect(bare.headers.location).toBe("/search");
    expect((await request(makeApp()).get("/search?search=sleep")).status).toBe(200);
    expect((await request(makeApp()).get("/search")).status).toBe(200);
  });
});
