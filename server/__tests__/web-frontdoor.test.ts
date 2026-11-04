/**
 * Express → Next.js front door (PLAN Phase 3): only enabled families proxy,
 * Next's own fallbacks never loop back, redirects stay on our host, and any
 * Next failure falls through to the existing SPA/bot path.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../utils/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const { enabledFamilies, ssrFamilyFor, localLocation, webFrontDoor } = await import("../middleware/web-frontdoor");

describe("family matching", () => {
  it("parses SSR_FAMILIES and ignores unknown keys", () => {
    expect(enabledFamilies("blog, hubs,nope,")).toEqual(["blog", "hubs"]);
    expect(enabledFamilies(undefined)).toEqual([]);
  });

  it("matches only the migrated route shapes", () => {
    const all = ["study", "blog", "hubs", "policy"];
    expect(ssrFamilyFor("/blog", all)).toBe("blog");
    expect(ssrFamilyFor("/blog/what-is-hydrogen-water", all)).toBe("blog");
    expect(ssrFamilyFor("/blog/a/b", all)).toBeNull();
    expect(ssrFamilyFor("/explore-by-condition/kidney-health", all)).toBe("hubs");
    expect(ssrFamilyFor("/explore-by-mechanism", all)).toBe("hubs");
    expect(ssrFamilyFor("/hydrogen-for/diabetes", all)).toBe("hubs");
    expect(ssrFamilyFor("/methodology", all)).toBe("policy");
    expect(ssrFamilyFor("/about", [...all, "pages"])).toBe("pages");
    expect(ssrFamilyFor("/contact", [...all, "pages"])).toBe("pages");
    expect(ssrFamilyFor("/learn", [...all, "learn"])).toBe("learn");
    expect(ssrFamilyFor("/learn/therapy-guide", [...all, "learn"])).toBe("learn");
    expect(ssrFamilyFor("/learn/a/b", [...all, "learn"])).toBeNull();
    expect(ssrFamilyFor("/research-analytics", [...all, "analytics"])).toBe("analytics");
    expect(ssrFamilyFor("/learn", all)).toBeNull();
    expect(ssrFamilyFor("/researchers", [...all, "profiles"])).toBe("profiles");
    expect(ssrFamilyFor("/journals/medical-gas-research", [...all, "profiles"])).toBe("profiles");
    expect(ssrFamilyFor("/researchers/a/b", [...all, "profiles"])).toBeNull();
    expect(ssrFamilyFor("/limits-of-the-evidence", [...all, "evidence"])).toBe("evidence");
    expect(ssrFamilyFor("/null-and-negative-results", [...all, "evidence"])).toBe("evidence");
    expect(ssrFamilyFor("/limits-of-the-evidence/x", [...all, "evidence"])).toBeNull();
    expect(ssrFamilyFor("/is-hydrogen-water-a-scam", [...all, "evidence"])).toBe("evidence");
    expect(ssrFamilyFor("/dataset", [...all, "data"])).toBe("data");
    expect(ssrFamilyFor("/state-of-hydrogen-research", [...all, "data"])).toBe("data");
    expect(ssrFamilyFor("/dataset/hydrogen-studies.csv", [...all, "data"])).toBeNull(); // the download stays on Express
    expect(ssrFamilyFor("/", [...all, "home"])).toBe("home");
    expect(ssrFamilyFor("/studies", [...all, "studies"])).toBe("studies");
    expect(ssrFamilyFor("/studies/tags", [...all, "studies"])).toBeNull();
    expect(ssrFamilyFor("/?ref=x".split("?")[0], [...all, "home"])).toBe("home");
    expect(ssrFamilyFor("/study/x", ["blog"])).toBeNull();
    for (const spa of ["/", "/studies", "/about", "/search", "/admin", "/api/blogs", "/login"]) {
      expect(ssrFamilyFor(spa, all)).toBeNull();
    }
  });

  it("rewrites Next's internal-host redirects to local paths", () => {
    const origin = "http://web.railway.internal:8080";
    expect(localLocation("http://web.railway.internal:8080/blog/x?a=1", origin)).toBe("/blog/x?a=1");
    expect(localLocation("https://web-production-6fb716d.up.railway.app/blog/x", origin)).toBe("/blog/x");
    expect(localLocation("https://hydrogenstudies.com/blog/x", origin)).toBe("https://hydrogenstudies.com/blog/x");
    expect(localLocation("/blog/x", origin)).toBe("/blog/x");
  });
});

describe("webFrontDoor proxy", () => {
  const fetchMock = vi.fn();
  let app: express.Express;

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    process.env.WEB_ORIGIN = "http://web.railway.internal:8080";
    process.env.SSR_FAMILIES = "blog";
    app = express();
    app.use(webFrontDoor());
    app.get(/.*/, (_req, res) => res.send("SPA"));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.WEB_ORIGIN;
    delete process.env.SSR_FAMILIES;
  });

  it("serves enabled families from Next", async () => {
    fetchMock.mockResolvedValue(new Response("<h1>Next</h1>", { status: 200, headers: { "content-type": "text/html" } }));
    const res = await request(app).get("/blog/x").set("user-agent", "Mozilla/5.0");
    expect(res.text).toBe("<h1>Next</h1>");
    expect(res.headers["x-served-by"]).toBe("web:blog");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://web.railway.internal:8080/blog/x");
    expect(init.headers["x-from-express"]).toBe("1");
  });

  it("proxies Next's /_next assets whenever a family is on, and passes Next's CSP through", async () => {
    fetchMock.mockResolvedValue(
      new Response("js", {
        status: 200,
        headers: { "content-type": "application/javascript", "content-security-policy": "script-src 'nonce-x'" },
      }),
    );
    const res = await request(app).get("/_next/static/chunks/main.js");
    expect(res.text).toBe("js");
    expect(res.headers["x-served-by"]).toBe("web:assets");
    expect(res.headers["content-security-policy"]).toBe("script-src 'nonce-x'");
  });

  it("passes 404s through (Next's not-found page)", async () => {
    fetchMock.mockResolvedValue(new Response("nf", { status: 404, headers: { "content-type": "text/html" } }));
    expect((await request(app).get("/blog/missing")).status).toBe(404);
  });

  it("falls back to the SPA path on Next 5xx or network error", async () => {
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 502 }));
    expect((await request(app).get("/blog/x")).text).toBe("SPA");
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect((await request(app).get("/blog/x")).text).toBe("SPA");
  });

  it("leaves disabled families, Next's own fallbacks and non-GETs alone", async () => {
    expect((await request(app).get("/explore-by-condition/x")).text).toBe("SPA");
    expect((await request(app).get("/blog/x").set("x-from-web", "1")).text).toBe("SPA");
    process.env.SSR_FAMILIES = "";
    expect((await request(app).get("/blog/x")).text).toBe("SPA");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
