import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import express from "express";
import vm from "node:vm";
import type { AddressInfo } from "net";
import type { Server } from "http";

const getPublicStudyStats = vi.fn();
vi.mock("../services/public-study-stats", () => ({ getPublicStudyStats }));
vi.mock("../utils/logger", () => ({ logger: { error: vi.fn() } }));

const { default: embedRoutes, buildStudyCountScript, renderBadgeSvg } = await import("../routes/embed-routes");

const STATS = { totalStudies: 2283, humanTrials: 475, healthConditions: 21 };

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use("/embed", embedRoutes);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  getPublicStudyStats.mockReset();
  getPublicStudyStats.mockResolvedValue(STATS);
});

function expectCrossOriginHeaders(res: globalThis.Response) {
  expect(res.headers.get("access-control-allow-origin")).toBe("*");
  expect(res.headers.get("access-control-allow-credentials")).toBeNull();
  expect(res.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
  expect(res.headers.get("x-robots-tag")).toBe("noindex");
}

describe("GET /embed/stats.json", () => {
  it("returns live counts readable from any origin", async () => {
    const res = await fetch(`${base}/embed/stats.json`, { headers: { Origin: "https://echowater.com" } });
    expect(res.status).toBe(200);
    expectCrossOriginHeaders(res);
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    expect(await res.json()).toEqual(STATS);
  });

  it("503s (never a zero count) when the DB fails", async () => {
    getPublicStudyStats.mockRejectedValue(new Error("db down"));
    const res = await fetch(`${base}/embed/stats.json`);
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("public, max-age=60");
  });

  it("503s when the count is zero", async () => {
    getPublicStudyStats.mockResolvedValue({ totalStudies: 0, humanTrials: 0, healthConditions: 0 });
    expect((await fetch(`${base}/embed/stats.json`)).status).toBe(503);
  });
});

describe("GET /embed/badge.svg", () => {
  it("renders the live count as an SVG image", async () => {
    const res = await fetch(`${base}/embed/badge.svg`);
    expect(res.status).toBe(200);
    expectCrossOriginHeaders(res);
    expect(res.headers.get("content-type")).toMatch(/^image\/svg\+xml/);
    const svg = await res.text();
    expect(svg).toContain("2,283 studies indexed");
    expect(svg).toContain("OUR RESEARCH LIBRARY");
    expect(svg).toContain('fill="#FFFFFF"');
  });

  it("supports the dark theme and ignores unknown themes", async () => {
    expect(await (await fetch(`${base}/embed/badge.svg?theme=dark`)).text()).toContain('fill="#111827"');
    expect(await (await fetch(`${base}/embed/badge.svg?theme=<script>`)).text()).toContain('fill="#FFFFFF"');
  });

  it("drops the count line (never shows 0) when stats are unavailable", async () => {
    getPublicStudyStats.mockRejectedValue(new Error("db down"));
    const res = await fetch(`${base}/embed/badge.svg`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=60");
    const svg = await res.text();
    expect(svg).toContain("Molecular hydrogen research");
    expect(svg).not.toMatch(/\d+ studies/);
  });

  it("never uses certification wording", () => {
    const svg = renderBadgeSvg(2283, "light");
    expect(svg).not.toMatch(/authori[sz]ed|certified|verified|approved/i);
  });
});

describe("GET /embed/study-count.js", () => {
  it("serves cacheable JavaScript", async () => {
    const res = await fetch(`${base}/embed/study-count.js`);
    expect(res.status).toBe(200);
    expectCrossOriginHeaders(res);
    expect(res.headers.get("content-type")).toMatch(/^application\/javascript/);
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
  });
});

/** Runs the loader against fake elements and a stubbed fetch. */
async function runLoader(els: Array<{ attrs: Record<string, string>; text: string }>, response: unknown, ok = true) {
  const fetchCalls: Array<[string, unknown]> = [];
  const elements = els.map((e) => ({
    get textContent() { return e.text; },
    set textContent(v: string) { e.text = v; },
    getAttribute: (name: string) => (name in e.attrs ? e.attrs[name] : null),
  }));
  const window: Record<string, unknown> = {
    fetch: (url: string, opts: unknown) => {
      fetchCalls.push([url, opts]);
      return Promise.resolve({ ok, json: () => Promise.resolve(response) });
    },
  };
  const context = {
    window,
    fetch: window.fetch,
    document: { readyState: "complete", querySelectorAll: () => elements, addEventListener: () => {} },
  };
  vm.runInNewContext(buildStudyCountScript("https://hydrogenstudies.com"), context);
  await new Promise((r) => setTimeout(r, 0));
  return fetchCalls;
}

describe("study-count.js loader", () => {
  it("fetches stats without credentials and fills each element", async () => {
    const els: Array<{ attrs: Record<string, string>; text: string }> = [
      { attrs: { "data-hs-count": "" }, text: "2,000" },
      { attrs: { "data-hs-count": "humanTrials" }, text: "400" },
      { attrs: { "data-hs-count": "", "data-hs-format": "floor" }, text: "2,000+" },
      { attrs: { "data-hs-count": "bogus" }, text: "x" },
    ];
    const calls = await runLoader(els, STATS);
    expect(calls).toEqual([["https://hydrogenstudies.com/embed/stats.json", { credentials: "omit" }]]);
    expect(els.map((e) => e.text)).toEqual(["2,283", "475", "2,200+", "2,283"]);
  });

  it("keeps the fallback text when the request fails", async () => {
    const els = [{ attrs: { "data-hs-count": "" }, text: "2,000+" }];
    await runLoader(els, null, false);
    expect(els[0].text).toBe("2,000+");
  });
});
