/**
 * SPA shell for every visitor (PLAN 3.4 — the bot-only prerender is gone):
 * correct head tags and status regardless of user agent; scripts untouched.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs";
import os from "os";
import path from "path";

const state = vi.hoisted(() => ({ meta: null as any, unknownHub: false }));

vi.mock("../services/page-meta", () => ({
  resolvePageMeta: async () => state.meta,
  resolveStaticPageMeta: (p: string) =>
    p === "/"
      ? { title: "Home", description: "Home desc", canonical: "https://hydrogenstudies.com/", ogType: "website", ogImage: "https://hydrogenstudies.com/logo.png" }
      : null,
}));
vi.mock("../middleware/explore-hub-404", () => ({ isUnknownExploreHubPath: async () => state.unknownHub }));
vi.mock("../utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { injectShellMeta, isKnownSpaRoute, sendSpaShell } = await import("../middleware/spa-shell");

const SHELL = `<!doctype html><html><head><meta charset="UTF-8" />
    <title>Hydrogen Studies Research Database</title>
    <meta
      name="description"
      content="old"
    />
    <meta property="og:title" content="old" />
    <meta name="twitter:title" content="old" />
    <script type="module" src="/assets/index.js"></script>
  </head><body><div id="root"></div></body></html>`;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spa-shell-"));
fs.writeFileSync(path.join(dir, "index.html"), SHELL);
const app = express();
app.get("*", (req, res) => sendSpaShell(req, res, path.join(dir, "index.html")));

const ABOUT = {
  title: "About | Hydrogen Studies",
  description: "Who we are",
  canonical: "https://hydrogenstudies.com/research-analytics",
  ogType: "website",
  ogImage: "https://hydrogenstudies.com/logo.png",
  jsonLd: { "@type": "WebPage" },
};

describe("SPA shell", () => {
  beforeEach(() => {
    state.meta = null;
    state.unknownHub = false;
  });

  it("swaps the head tags, keeps the scripts", () => {
    const html = injectShellMeta(SHELL, { ...ABOUT, robots: "index, follow" });
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html).toContain("<title>About | Hydrogen Studies</title>");
    expect(html).not.toContain('content="old"');
    expect(html).toContain('<link rel="canonical" href="https://hydrogenstudies.com/research-analytics" />');
    expect(html).toContain('<script type="application/ld+json">{"@type":"WebPage"}</script>');
    expect(html).toContain('<script type="module" src="/assets/index.js"></script>');
  });

  it("serves identical HTML to browsers and Googlebot", async () => {
    state.meta = ABOUT;
    const a = await request(app).get("/research-analytics").set("User-Agent", "Mozilla/5.0 Chrome/130");
    const b = await request(app).get("/research-analytics").set("User-Agent", "Mozilla/5.0 (compatible; Googlebot/2.1)");
    expect(a.status).toBe(200);
    expect(a.text).toBe(b.text);
  });

  it("noindexes app pages with no SEO meta", async () => {
    const res = await request(app).get("/my-dashboard");
    expect(res.status).toBe(200);
    expect(res.text).toContain('<meta name="robots" content="noindex, follow" />');
    expect(res.text).toContain('<link rel="canonical" href="https://hydrogenstudies.com/my-dashboard" />');
  });

  it("404s unknown paths and unknown hubs for everyone", async () => {
    const junk = await request(app).get("/wp-login.php-ish");
    expect(junk.status).toBe(404);
    expect(junk.text).toContain("noindex");
    state.unknownHub = true;
    expect((await request(app).get("/explore-by-condition/xyzzy")).status).toBe(404);
  });

  it("knows the SPA routes", () => {
    expect(isKnownSpaRoute("/")).toBe(true);
    expect(isKnownSpaRoute("/learn/basics")).toBe(true);
    expect(isKnownSpaRoute("/random-junk")).toBe(false);
  });
});
