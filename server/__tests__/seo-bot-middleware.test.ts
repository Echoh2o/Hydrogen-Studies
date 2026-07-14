/**
 * SEO bot middleware — locks in the 2026-07 SEO audit fixes:
 *
 *  1. og:image / twitter:image / JSON-LD image are ABSOLUTE URLs even when
 *     the DB stores a relative /uploads/... path (social crawlers silently
 *     drop relative URLs).
 *  2. AI crawlers (GPTBot, ClaudeBot, PerplexityBot, CCBot, ...) are
 *     detected as bots so they receive prerendered content instead of the
 *     empty SPA shell.
 *  3. Dead /study/:slug and /blog/:slug URLs return a real HTTP 404 with
 *     noindex — not a soft-404 (200 + homepage meta). Unknown NON-content
 *     paths still fall through with 200 so legit SPA routes that simply
 *     aren't in the static-meta map don't get de-indexed.
 *  4. The injected viewport does not disable pinch-zoom (no maximum-scale).
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs";
import os from "os";
import path from "path";

// Rows returned by every awaited drizzle chain. Tests set this per-case.
const dbRows = vi.hoisted(() => ({ current: [] as any[] }));

vi.mock("../db", () => {
  // Chainable, awaitable stand-in for drizzle's fluent builder: any method
  // returns the chain; awaiting it resolves to dbRows.current.
  function chain(): any {
    const p: any = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: any, reject: any) =>
            Promise.resolve([...dbRows.current]).then(resolve, reject);
        }
        return () => p;
      },
      apply() {
        return p;
      },
    });
    return p;
  }
  return { db: chain(), pool: { query: () => new Promise(() => {}) } };
});

// Body prerendering is exercised elsewhere; keep these tests about meta/status.
vi.mock("../middleware/seo-body-renderer", () => ({
  renderPageBody: async () => null,
}));

import { seoBotMiddleware, isBot } from "../middleware/seo-bot-middleware";

const GOOGLEBOT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

let staticDir: string;
let app: express.Express;

beforeAll(() => {
  staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "seo-bot-test-"));
  fs.writeFileSync(
    path.join(staticDir, "index.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <title>Hydrogen Studies Research Database</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`
  );
});

afterAll(() => {
  fs.rmSync(staticDir, { recursive: true, force: true });
});

beforeEach(() => {
  dbRows.current = [];
  // Fresh middleware instance per test; the module-level bot HTML cache is
  // avoided by using a unique slug per test case.
  app = express();
  app.use(seoBotMiddleware(staticDir));
  app.get(/.*/, (_req, res) => res.send("SPA"));
});

describe("isBot — AI crawler detection", () => {
  it.each([
    "GPTBot/1.2 (+https://openai.com/gptbot)",
    "OAI-SearchBot/1.0; +https://openai.com/searchbot",
    "ChatGPT-User/1.0; +https://openai.com/bot",
    "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
    "Mozilla/5.0 (compatible; Claude-Web/1.0)",
    "anthropic-ai/1.0",
    "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
    "Perplexity-User/1.0",
    "CCBot/2.0 (https://commoncrawl.org/faq/)",
    "meta-externalagent/1.1",
  ])("treats %s as a bot", (ua) => {
    expect(isBot(ua)).toBe(true);
  });

  it("does not treat a normal browser as a bot", () => {
    expect(isBot(CHROME)).toBe(false);
  });
});

describe("absolute social image URLs", () => {
  it("emits absolute og:image/twitter:image/JSON-LD image for a relative DB imageUrl", async () => {
    dbRows.current = [
      {
        id: 41,
        slug: "abs-image-study",
        title: "Hydrogen and Oxidative Stress",
        summary100Words: "A study.",
        imageUrl: "/uploads/study-images/study_41.png",
      },
    ];

    const res = await request(app)
      .get("/study/abs-image-study")
      .set("User-Agent", GOOGLEBOT);

    expect(res.status).toBe(200);
    const abs = "https://hydrogenstudies.com/uploads/study-images/study_41.png";
    expect(res.text).toContain(`<meta property="og:image" content="${abs}" />`);
    expect(res.text).toContain(`<meta name="twitter:image" content="${abs}" />`);
    // JSON-LD "image" must be absolute too
    expect(res.text).toContain(`"image":"${abs}"`);
  });
});

describe("hard 404 for dead content URLs", () => {
  it("returns 404 + noindex for an unknown study slug", async () => {
    dbRows.current = [];
    const res = await request(app)
      .get("/study/this-does-not-exist-999999")
      .set("User-Agent", GOOGLEBOT);

    expect(res.status).toBe(404);
    expect(res.text).toContain('content="noindex');
  });

  it("returns 404 for an unknown blog slug", async () => {
    dbRows.current = [];
    const res = await request(app)
      .get("/blog/ghost-post")
      .set("User-Agent", GOOGLEBOT);

    expect(res.status).toBe(404);
  });

  it("does not cache the 404 — the page recovers once content exists", async () => {
    dbRows.current = [];
    const miss = await request(app)
      .get("/study/late-published-study")
      .set("User-Agent", GOOGLEBOT);
    expect(miss.status).toBe(404);

    dbRows.current = [
      {
        id: 42,
        slug: "late-published-study",
        title: "Late Published Study",
        summary100Words: "Now it exists.",
        imageUrl: null,
      },
    ];
    const hit = await request(app)
      .get("/study/late-published-study")
      .set("User-Agent", GOOGLEBOT);
    expect(hit.status).toBe(200);
    expect(hit.text).toContain("Late Published Study");
  });

  it("still serves 200 fallback meta for unknown non-content paths", async () => {
    const res = await request(app)
      .get("/totally-fake-page-xyz")
      .set("User-Agent", GOOGLEBOT);

    // Legit SPA routes aren't all in the static-meta map; only definitive
    // content misses (study/blog slugs) may 404.
    expect(res.status).toBe(200);
  });
});

describe("viewport accessibility", () => {
  it("injected head does not disable pinch-zoom", async () => {
    dbRows.current = [];
    const res = await request(app).get("/about").set("User-Agent", GOOGLEBOT);

    expect(res.status).toBe(200);
    expect(res.text).not.toContain("maximum-scale");
  });
});

describe("human pass-through", () => {
  it("normal browsers fall through to the SPA", async () => {
    const res = await request(app).get("/study/whatever").set("User-Agent", CHROME);
    expect(res.text).toBe("SPA");
  });
});
