/**
 * Demographic + delivery-method hubs (2026-09-28, owner: "fix the no studies
 * found bug") and the /benefits → benefits-guide merge cleanup.
 *
 *  - /explore-by-demographic and /explore-by-delivery-method (crawler body)
 *    link exactly the curated hubs whose page lists ≥1 study — the same list
 *    GET /api/explore/:type/hubs serves the SPA index. Before, the crawler
 *    index linked nothing and the SPA linked `demographics` table rows (empty
 *    in production) to the unrouted /demographics/<slug>.
 *  - detail hubs: crawler meta + body use the shared title/H1/canonical, and
 *    GET /api/explore/:type/:slug/studies returns the list the crawler renders.
 *  - /benefits (now a 301 to the benefits guide) is out of the sitemap,
 *    robots.txt and every template link; it has no crawler page of its own.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { PgDialect } from "drizzle-orm/pg-core";

const state = vi.hoisted(() => ({
  /** Studies per explore-detail search term ("older adults" → rows). */
  studiesByTerm: {} as Record<string, any[]>,
  /** Every explore-detail query's SQL text. */
  detailSql: [] as string[],
}));

vi.mock("../db", () => {
  function chain(): any {
    const p: any = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === "then") return (resolve: any) => Promise.resolve([]).then(resolve);
        return () => p;
      },
      apply() {
        return p;
      },
    });
    return p;
  }
  const dialect = new PgDialect();
  return {
    db: {
      execute: async (q: any) => {
        const { sql, params } = dialect.sqlToQuery(q);
        if (/h2_delivery_method/i.test(sql)) {
          state.detailSql.push(sql);
          const term = String(params[0] ?? "").replace(/^%|%$/g, "");
          return { rows: state.studiesByTerm[term] ?? [] };
        }
        return { rows: [] };
      },
      select: () => chain(),
    },
    pool: { query: () => new Promise(() => {}) },
  };
});

vi.mock("../auth", () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

import {
  DEMOGRAPHIC_HUB_SLUGS,
  DELIVERY_METHOD_HUB_SLUGS,
  exploreDetailCopy,
  exploreDetailMeta,
  exploreIndexCopy,
  listedExploreHubs,
  studyCountLabel,
} from "../../shared/explore-hubs";
import { renderPageBody, __resetConditionHubsForTests } from "../middleware/seo-body-renderer";
import { resolveStaticPageMeta } from "../middleware/seo-bot-middleware";
import seoRoutes from "../routes/seo-routes";
import hydrogenRoutes from "../routes/hydrogen-routes";

const SITE = "https://hydrogenstudies.com";
const BENEFITS_GUIDE = "/blog/molecular-hydrogen-benefits-guide-pillar";

function rows(prefix: string, n: number) {
  return Array.from({ length: n }, (_, i) => ({
    slug: `${prefix}-${i + 1}`,
    title: `${prefix} study ${i + 1}`,
    publish_year: 2020 + i,
    journal: "J Test",
  }));
}

function apiApp() {
  const app = express();
  app.use(hydrogenRoutes);
  return app;
}

/** Hub links in an index body (between the H1 and "More Ways to Browse"). */
function indexHubLinks(body: string, type: string) {
  const list = body.slice(body.indexOf("<h1>"), body.indexOf("More Ways to Browse"));
  return [...list.matchAll(new RegExp(`href="(/explore-by-${type}/[a-z0-9-]+)"`, "g"))].map((m) => m[1]);
}

beforeEach(() => {
  __resetConditionHubsForTests();
  state.detailSql = [];
  state.studiesByTerm = {
    athletes: rows("athletes", 3),
    "older adults": rows("older-adults", 1),
    women: rows("women", 2),
    // healthy-adults, elderly, children: no studies → not linked
    "drinking water": rows("drinking-water", 2),
    inhalation: rows("inhalation", 4),
    // bathing, saline-injection, tablets: no studies → not linked
  };
});

describe("listedExploreHubs (shared 'hub exists' predicate)", () => {
  it("keeps curated order, drops hubs without studies, builds the shared path", () => {
    const hubs = listedExploreHubs("demographic", { women: 2, athletes: 3, elderly: 0, nope: 9 });
    expect(hubs).toEqual([
      { slug: "athletes", name: "Athletes", path: "/explore-by-demographic/athletes", studyCount: 3 },
      { slug: "women", name: "Women", path: "/explore-by-demographic/women", studyCount: 2 },
    ]);
  });

  it("count labels are grammatical", () => {
    expect(studyCountLabel(1)).toBe("1 study");
    expect(studyCountLabel(12)).toBe("12 studies");
  });
});

describe.each([
  { type: "demographic" as const, slugs: DEMOGRAPHIC_HUB_SLUGS, live: ["athletes", "older-adults", "women"] },
  { type: "delivery-method" as const, slugs: DELIVERY_METHOD_HUB_SLUGS, live: ["drinking-water", "inhalation"] },
])("/explore-by-$type index — crawler and SPA link the same hubs", ({ type, slugs, live }) => {
  it("crawler index links exactly the curated hubs that list studies, with counts", async () => {
    const body = (await renderPageBody(`/explore-by-${type}`))!;
    expect(indexHubLinks(body, type)).toEqual(live.map((s) => `/explore-by-${type}/${s}`));
    for (const s of slugs.filter((x) => !live.includes(x))) {
      expect(body).not.toContain(`/explore-by-${type}/${s}"`);
    }
    const first = live[0];
    const n = state.studiesByTerm[first.replace(/-/g, " ")].length;
    expect(body).toContain(
      `<li><a href="/explore-by-${type}/${first}">${exploreDetailCopy(first).name}</a> (${studyCountLabel(n)})</li>`,
    );
  });

  it("crawler index H1/intro and meta come from the shared index copy", async () => {
    const copy = exploreIndexCopy(type);
    const body = (await renderPageBody(`/explore-by-${type}`))!;
    expect(body).toContain(`<h1>${copy.h1}</h1>`);
    expect(body).toContain(`<p>${copy.intro}</p>`);
    const meta = resolveStaticPageMeta(`/explore-by-${type}`)!;
    expect(meta.title).toBe(copy.title);
    expect(meta.description).toBe(copy.description);
  });

  it("GET /api/explore/:type/hubs returns the crawler index's list", async () => {
    const body = (await renderPageBody(`/explore-by-${type}`))!;
    __resetConditionHubsForTests();
    const res = await request(apiApp()).get(`/api/explore/${type}/hubs`);
    expect(res.status).toBe(200);
    expect(res.body.hubs.map((h: any) => h.path)).toEqual(indexHubLinks(body, type));
    for (const hub of res.body.hubs) {
      expect(hub.studyCount).toBe(state.studiesByTerm[hub.slug.replace(/-/g, " ")].length);
      expect(hub.name).toBe(exploreDetailCopy(hub.slug).name);
    }
  });

  it("hub counts come from the hub page's own query (excluded studies filtered)", async () => {
    await request(apiApp()).get(`/api/explore/${type}/hubs`);
    expect(state.detailSql.length).toBe(slugs.length);
    for (const s of state.detailSql) expect(s).toMatch(/is_excluded = false/);
  });
});

describe("GET /api/explore/:type/hubs guards", () => {
  it("404s for types without a hub list", async () => {
    for (const type of ["body-system", "nope", "benefits"]) {
      expect((await request(apiApp()).get(`/api/explore/${type}/hubs`)).status).toBe(404);
    }
  });

  it("serves every listed type (benefit, life-stage, mechanism since the hub-404 change) and condition", async () => {
    for (const type of ["demographic", "delivery-method", "benefit", "life-stage", "mechanism", "condition"]) {
      const res = await request(apiApp()).get(`/api/explore/${type}/hubs`);
      expect(res.status, type).toBe(200);
      expect(Array.isArray(res.body.hubs), type).toBe(true);
    }
  });
});

describe.each(["demographic", "delivery-method"] as const)("/explore-by-%s/:slug detail hub", (type) => {
  const slug = type === "demographic" ? "athletes" : "inhalation";

  it("crawler meta = shared exploreDetailMeta (title, description, lowercase canonical)", () => {
    const meta = resolveStaticPageMeta(`/explore-by-${type}/${slug}`)!;
    const shared = exploreDetailMeta(type, slug);
    expect(meta.title).toBe(shared.title);
    expect(meta.description).toBe(shared.description);
    expect(meta.canonical).toBe(`${SITE}/explore-by-${type}/${slug}`);
    expect(resolveStaticPageMeta(`/explore-by-${type}/${slug.toUpperCase()}`)!.canonical)
      .toBe(`${SITE}/explore-by-${type}/${slug}`);
  });

  it("crawler body and GET /api/explore/:type/:slug/studies list the same studies", async () => {
    const body = (await renderPageBody(`/explore-by-${type}/${slug}`))!;
    const { h1, intro } = exploreDetailCopy(slug);
    expect(body).toContain(`<h1>${h1}</h1>`);
    expect(body).toContain(`<p>${intro}</p>`);
    const res = await request(apiApp()).get(`/api/explore/${type}/${slug}/studies`);
    expect(res.status).toBe(200);
    expect(res.body.studies).toEqual(state.studiesByTerm[slug.replace(/-/g, " ")]);
    for (const s of res.body.studies) {
      expect(body).toContain(`<a href="/study/${s.slug}">${s.title}</a>`);
    }
    for (const q of state.detailSql) expect(q).toMatch(/is_excluded = false/);
  });
});

// ── /benefits merged into the benefits guide ────────────────────

describe("/benefits → /blog/molecular-hydrogen-benefits-guide-pillar cleanup", () => {
  it("sitemap-pages no longer lists /benefits", async () => {
    const app = express();
    app.use(seoRoutes);
    const res = await request(app).get("/sitemap-pages.xml");
    expect(res.status).toBe(200);
    expect(res.text).not.toContain(`<loc>${SITE}/benefits</loc>`);
    expect(res.text).toContain(`<loc>${SITE}/about</loc>`);
  });

  it("robots.txt drops the stale Allow: /benefits line", async () => {
    const app = express();
    app.use(seoRoutes);
    const res = await request(app).get("/robots.txt");
    expect(res.status).toBe(200);
    expect(res.text).not.toMatch(/^Allow: \/benefits$/m);
    expect(res.text).toMatch(/^Allow: \/explore-by-benefit\/$/m);
  });

  it("has no crawler page of its own (the 301 row owns the URL)", async () => {
    expect(resolveStaticPageMeta("/benefits")).toBeNull();
    expect(await renderPageBody("/benefits")).toBeNull();
  });

  it.each(["/", "/explore-by-demographic", "/about"])("%s links the guide, never /benefits", async (path) => {
    const body = (await renderPageBody(path))!;
    expect(body).not.toContain('href="/benefits"');
    expect(body).toContain(`<a href="${BENEFITS_GUIDE}">Hydrogen water benefits (evidence-graded)</a>`);
  });
});
