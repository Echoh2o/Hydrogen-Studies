/**
 * Unknown explore hubs return HTTP 404 — to bots AND browsers (2026-09-28,
 * owner: "yes on hub pages").
 *
 * Before: any /explore-by-<type>/<slug> could be a 200 empty page (soft 404),
 * e.g. /explore-by-demographic/xyzzy, and ~100 long-tail body-system slugs
 * (/explore-by-body-system/molecular …) rendered a words-or-slug match.
 * Browsers got the SPA shell with 200 for every one of them.
 *
 * Now one predicate per hub type (seo-body-renderer exploreHubExists) drives:
 *   - the crawler body (null → the bot middleware's hard 404 + noindex)
 *   - the SPA shell status for browsers (explore-hub-404 sendSpaShell → 404)
 *   - GET /api/explore/:type/:slug and …/studies (404 → SPA NotFound)
 *   - the indexes (crawler + SPA) and sitemaps, which list only valid hubs.
 * Plus: /explore-by-benefit/:slug hubs (curated BENEFIT_HUB_SLUGS, ≥1 study).
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs";
import os from "os";
import path from "path";
import { PgDialect } from "drizzle-orm/pg-core";

const state = vi.hoisted(() => ({
  /** health_conditions rows — the canonical condition hubs. */
  conditions: [] as { name: string; slug: string; study_count: number; description?: string | null }[],
  /** Studies the shared condition-hub query finds, per hub name. */
  conditionStudies: {} as Record<string, any[]>,
  /** Every condition-hub study query (SQL + params). */
  conditionStudySql: [] as { sql: string; params: unknown[] }[],
  /** LIKE patterns (e.g. "%cardiovascular%") whose body-system hub has a study. */
  bodySystemPatternsWithStudies: [] as string[],
  /** Studies per explore-detail search term ("older adults" → rows). */
  studiesByTerm: {} as Record<string, any[]>,
  /** Every SQL statement run against health_conditions. */
  conditionSql: [] as string[],
  /** Make every db call fail (fail-open test). */
  dbDown: false,
}));

vi.mock("../db", () => {
  const dialect = new PgDialect();
  const liveConditions = () =>
    state.conditions.filter((c) => c.study_count > 0).sort((a, b) => b.study_count - a.study_count);
  function chain(): any {
    // drizzle select() chains: sitemap-categories reads health_conditions.
    const p: any = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: any, reject: any) =>
            (state.dbDown
              ? Promise.reject(new Error("db down"))
              : Promise.resolve(state.conditions.map((c) => ({ slug: c.slug, createdAt: new Date("2026-01-01") })))
            ).then(resolve, reject);
        }
        return () => p;
      },
      apply() {
        return p;
      },
    });
    return p;
  }
  return {
    db: {
      execute: async (q: any) => {
        if (state.dbDown) throw new Error("db down");
        const { sql, params } = dialect.sqlToQuery(q);
        if (/FROM health_conditions/i.test(sql)) {
          state.conditionSql.push(sql);
          if (/WHERE slug = \$1/i.test(sql)) {
            return { rows: state.conditions.filter((c) => c.slug === params[0]) };
          }
          // The hub list filters study_count in SQL; emulate it only when the
          // statement asks for it (so a missing filter fails the tests).
          return { rows: /COALESCE\(study_count, 0\) > 0/i.test(sql) ? liveConditions() : state.conditions };
        }
        if (/SELECT 1 FROM studies/i.test(sql) && /body_systems/i.test(sql)) {
          return {
            rows: params.some((p) => state.bodySystemPatternsWithStudies.includes(p as string)) ? [{ "?column?": 1 }] : [],
          };
        }
        if (/h2_delivery_method/i.test(sql)) {
          const term = String(params[0] ?? "").replace(/^%|%$/g, "");
          return { rows: state.studiesByTerm[term] ?? [] };
        }
        if (/FROM studies/i.test(sql) && /body_systems/i.test(sql)) {
          // body-system hub page study list
          return { rows: [{ slug: "bs-study-1", title: "Body system study", publish_year: 2024, journal: "J" }] };
        }
        if (/FROM studies/i.test(sql) && /health_conditions/i.test(sql)) {
          // The shared condition-hub query: keyed by the name-tag ILIKE param.
          state.conditionStudySql.push({ sql, params });
          const name = String(params.find((p) => typeof p === "string" && p.startsWith("%")) ?? "").replace(/^%|%$/g, "");
          const found = state.conditionStudies[name] ?? [];
          if (/count\(\*\)/i.test(sql)) return { rows: [{ n: found.length }] };
          return { rows: found };
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
  BENEFIT_HUB_SLUGS,
  DEMOGRAPHIC_HUB_SLUGS,
  LIFE_STAGE_HUB_SLUGS,
  MECHANISM_HUB_SLUGS,
  exploreDetailCopy,
  exploreDetailMeta,
  exploreIndexCopy,
  parseExploreHubPath,
  studyCountLabel,
} from "../../shared/explore-hubs";
import {
  exploreHubExists,
  renderPageBody,
  __resetConditionHubsForTests,
} from "../middleware/seo-body-renderer";
import { seoBotMiddleware, invalidateBotCache, resolveStaticPageMeta } from "../middleware/seo-bot-middleware";
import { sendSpaShell, spaShellStatus } from "../middleware/explore-hub-404";
import hydrogenRoutes from "../routes/hydrogen-routes";
import seoRoutes, { __resetSitemapCacheForTests } from "../routes/seo-routes";

const SITE = "https://hydrogenstudies.com";
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

function rows(prefix: string, n: number) {
  return Array.from({ length: n }, (_, i) => ({
    slug: `${prefix}-${i + 1}`,
    title: `${prefix} study ${i + 1}`,
    publish_year: 2020 + i,
    journal: "J Test",
  }));
}

let staticDir: string;
/** The production wiring: bot middleware first, then the SPA shell fallback. */
function siteApp() {
  const app = express();
  app.use(hydrogenRoutes);
  app.use(seoBotMiddleware(staticDir));
  app.get("*", (req, res) => sendSpaShell(req, res, path.join(staticDir, "index.html")));
  return app;
}

beforeAll(() => {
  staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "explore-hub-404-"));
  fs.writeFileSync(
    path.join(staticDir, "index.html"),
    `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><title>Hydrogen Studies Research Database</title></head><body><div id="root"></div></body></html>`,
  );
});

beforeEach(() => {
  __resetConditionHubsForTests();
  __resetSitemapCacheForTests();
  invalidateBotCache();
  state.dbDown = false;
  state.conditionSql = [];
  state.conditionStudySql = [];
  state.conditions = [
    { name: "Type 2 Diabetes", slug: "type-2-diabetes", study_count: 265, description: null },
    { name: "Anxiety & Stress", slug: "anxiety-stress", study_count: 1295, description: null },
    { name: "Kidney Health", slug: "kidney-health", study_count: 309, description: null },
    // A row whose page lists no study under the shared query → not a hub.
    { name: "Stale Row", slug: "stale-row", study_count: 12, description: null },
  ];
  const condRows = (prefix: string, n: number) =>
    rows(prefix, n).map((r) => ({ ...r, study_type: "human", abstract: `Abstract of ${prefix}.` }));
  state.conditionStudies = {
    "Type 2 Diabetes": condRows("t2d", 3),
    "Anxiety & Stress": condRows("anxiety", 2),
    // kidney-health: no study carries the "Kidney Health" tag in production —
    // these come from the synonym half of the shared query.
    "Kidney Health": condRows("kidney", 4),
    "Stale Row": [],
  };
  state.bodySystemPatternsWithStudies = ["%cardiovascular%", "%nervous%"];
  state.studiesByTerm = {
    athletes: rows("athletes", 3),
    women: rows("women", 1),
    inhalation: rows("inhalation", 4),
    antioxidant: rows("antioxidant", 5),
    neuroprotective: rows("neuroprotective", 2),
    "hydrogen water": rows("h2-water", 2),
    pregnancy: rows("pregnancy", 2),
    // hydrogen-bath, infants-children, elderly-aging, tablets, sleep, …: no studies
  };
});

// ── The predicate ───────────────────────────────────────────────

describe("exploreHubExists — one rule per hub type", () => {
  it.each([
    // condition: a health_conditions row whose page lists ≥1 study
    ["condition", "type-2-diabetes", true],
    ["condition", "anxiety-stress", true],
    ["condition", "kidney-health", true],
    ["condition", "stale-row", false],
    ["condition", "general-health-conditions", false],
    // body-system: canonical hub with ≥1 study; long-tail slugs never
    ["body-system", "cardiovascular", true],
    ["body-system", "brain-nervous-system", true],
    ["body-system", "eyes-vision", false],
    ["body-system", "molecular", false],
    ["body-system", "multi-system", false],
    ["body-system", "cardiovascular-system", false],
    // mechanism / life-stage: the sitemap hubs (even while empty)
    ["mechanism", "hydrogen-water", true],
    ["mechanism", "hydrogen-bath", true],
    ["mechanism", "antioxidant", false],
    ["life-stage", "pregnancy", true],
    ["life-stage", "infants-children", false],
    ["life-stage", "elderly-aging", false],
    ["life-stage", "adolescents", false],
    ["life-stage", "older-adults", false],
    // demographic / delivery-method / benefit: curated AND ≥1 study
    ["demographic", "athletes", true],
    ["demographic", "elderly", false],
    ["demographic", "xyzzy", false],
    ["delivery-method", "inhalation", true],
    ["delivery-method", "tablets", false],
    ["delivery-method", "hydrogen-water", false],
    ["benefit", "antioxidant", true],
    ["benefit", "neuroprotective", true],
    ["benefit", "sleep", false],
    ["benefit", "anti-inflammatory", false],
    // shape / type guards
    ["demographic", "Athletes", false],
    ["life-stage", "men's-health", false],
    ["nope", "athletes", false],
  ] as const)("%s/%s → %s", async (type, slug, expected) => {
    expect(await exploreHubExists(type, slug)).toBe(expected);
  });

  it("condition hubs are decided by the shared study query (name tag OR synonyms, excluded filtered)", async () => {
    await exploreHubExists("condition", "kidney-health");
    const kidney = state.conditionStudySql.find((q) => q.params.includes("%Kidney Health%"))!;
    expect(kidney.sql).toMatch(/is_excluded = false/);
    expect(kidney.sql).toMatch(/ILIKE \$\d+/);
    expect(kidney.sql).toMatch(/~ \$\d+/);
    const pattern = kidney.params.find((p) => typeof p === "string" && p.startsWith("\\m")) as string;
    expect(pattern).toContain("kidney");
    expect(pattern).toContain("renal");
    expect(pattern).toContain("nephro");
  });

  it("parseExploreHubPath recognises every hub type and nothing else", () => {
    expect(parseExploreHubPath("/explore-by-benefit/antioxidant")).toEqual({ type: "benefit", slug: "antioxidant" });
    expect(parseExploreHubPath("/explore-by-body-system/molecular")).toEqual({ type: "body-system", slug: "molecular" });
    expect(parseExploreHubPath("/explore-by-benefit")).toBeNull();
    expect(parseExploreHubPath("/explore-by-benefit/a/b")).toBeNull();
    expect(parseExploreHubPath("/explore-by-nope/x")).toBeNull();
    expect(parseExploreHubPath("/study/x")).toBeNull();
  });
});

// ── Same status for bots and browsers ───────────────────────────

describe("unknown hubs: HTTP 404 for Googlebot AND Chrome; real hubs 200 for both", () => {
  const invalid = [
    "/explore-by-demographic/xyzzy",
    "/explore-by-demographic/elderly",
    "/explore-by-delivery-method/tablets",
    "/explore-by-benefit/xyzzy",
    "/explore-by-benefit/sleep",
    "/explore-by-mechanism/antioxidant",
    "/explore-by-life-stage/adolescents",
    "/explore-by-body-system/molecular",
    "/explore-by-body-system/whole-body",
    "/explore-by-condition/general-health-conditions",
    "/explore-by-condition/stale-row",
  ];
  const valid = [
    "/explore-by-demographic/athletes",
    "/explore-by-delivery-method/inhalation",
    "/explore-by-benefit/antioxidant",
    "/explore-by-mechanism/hydrogen-water",
    "/explore-by-life-stage/pregnancy",
    "/explore-by-body-system/cardiovascular",
    "/explore-by-condition/type-2-diabetes",
  ];

  it.each(invalid)("%s → 404 (bot: noindex page; browser: SPA shell)", async (url) => {
    const app = siteApp();
    const bot = await request(app).get(url).set("User-Agent", GOOGLEBOT);
    expect(bot.status).toBe(404);
    expect(bot.text).toMatch(/<meta name="robots" content="noindex, follow"/);
    const browser = await request(app).get(url).set("User-Agent", CHROME);
    expect(browser.status).toBe(404);
    expect(browser.text).toContain('<div id="root"></div>');
    expect(browser.headers["cache-control"]).toBe("no-cache");
  });

  it.each(valid)("%s → 200 for both", async (url) => {
    const app = siteApp();
    const bot = await request(app).get(url).set("User-Agent", GOOGLEBOT);
    expect(bot.status).toBe(200);
    expect(bot.text).not.toMatch(/content="noindex/);
    const browser = await request(app).get(url).set("User-Agent", CHROME);
    expect(browser.status).toBe(200);
  });

  it("non-hub SPA routes keep the 200 shell", async () => {
    for (const url of ["/explore-by-demographic", "/studies", "/about"]) {
      expect(await spaShellStatus(url)).toBe(200);
    }
  });

  it("fails open: a DB error never 404s the browser shell", async () => {
    state.dbDown = true;
    expect(await spaShellStatus("/explore-by-condition/type-2-diabetes")).toBe(200);
    const res = await request(siteApp()).get("/explore-by-condition/type-2-diabetes").set("User-Agent", CHROME);
    expect(res.status).toBe(200);
  });
});

// ── APIs the SPA reads ──────────────────────────────────────────

describe("GET /api/explore/:type/:slug (SPA NotFound switch)", () => {
  function apiApp() {
    const app = express();
    app.use(hydrogenRoutes);
    return app;
  }

  it.each([
    ["condition", "type-2-diabetes"],
    ["body-system", "cardiovascular"],
    ["life-stage", "pregnancy"],
    ["benefit", "antioxidant"],
  ])("%s/%s → 200 with the hub path", async (type, slug) => {
    const res = await request(apiApp()).get(`/api/explore/${type}/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ type, slug, path: `/explore-by-${type}/${slug}` });
  });

  it.each([
    ["condition", "general-health-conditions"],
    ["body-system", "molecular"],
    ["life-stage", "older-adults"],
    ["demographic", "xyzzy"],
    ["benefit", "anti-inflammatory"],
    ["nope", "x"],
  ])("%s/%s → 404", async (type, slug) => {
    expect((await request(apiApp()).get(`/api/explore/${type}/${slug}`)).status).toBe(404);
  });

  it("…/studies 404s for an unknown hub and lists the crawler's studies for a real one", async () => {
    expect((await request(apiApp()).get("/api/explore/demographic/xyzzy/studies")).status).toBe(404);
    expect((await request(apiApp()).get("/api/explore/benefit/sleep/studies")).status).toBe(404);
    expect((await request(apiApp()).get("/api/explore/condition/stale-row/studies")).status).toBe(404);
    expect((await request(apiApp()).get("/api/explore/body-system/cardiovascular/studies")).status).toBe(404);
    const res = await request(apiApp()).get("/api/explore/benefit/antioxidant/studies");
    expect(res.status).toBe(200);
    expect(res.body.studies).toEqual(state.studiesByTerm.antioxidant);
  });

  it("condition hub: crawler page and GET /api/explore/condition/:slug/studies list the same studies (kidney-health)", async () => {
    const res = await request(apiApp()).get("/api/explore/condition/kidney-health/studies");
    expect(res.status).toBe(200);
    expect(res.body.hub).toEqual({ slug: "kidney-health", name: "Kidney Health", description: null });
    expect(res.body.studies.map((s: any) => s.slug)).toEqual(state.conditionStudies["Kidney Health"].map((s) => s.slug));
    // An excerpt, never the full abstract field.
    expect(res.body.studies[0]).not.toHaveProperty("abstract");
    expect(res.body.studies[0].excerpt).toBe("Abstract of kidney.");

    const body = (await renderPageBody("/explore-by-condition/kidney-health"))!;
    expect(body).toContain("<h1>Hydrogen Research for Kidney Health</h1>");
    expect(body).toContain("4 research studies on hydrogen therapy for kidney health.");
    const listed = [...body.matchAll(/<a href="\/study\/([^"]+)">/g)].map((m) => m[1]);
    expect(listed).toEqual(res.body.studies.map((s: any) => s.slug));
    for (const q of state.conditionStudySql) expect(q.sql).toMatch(/is_excluded = false/);
  });

  it("a DB error is a 500, never a 404 (the SPA must not show NotFound for a real hub)", async () => {
    state.dbDown = true;
    expect((await request(apiApp()).get("/api/explore/condition/type-2-diabetes")).status).toBe(500);
  });
});

// ── Benefit hubs ────────────────────────────────────────────────

describe("benefit hubs (/explore-by-benefit/:slug)", () => {
  it("crawler meta = shared exploreDetailMeta; body = shared H1/intro + the API's studies", async () => {
    const meta = resolveStaticPageMeta("/explore-by-benefit/antioxidant")!;
    const shared = exploreDetailMeta("benefit", "antioxidant");
    expect(meta.title).toBe(shared.title);
    expect(meta.description).toBe(shared.description);
    expect(meta.canonical).toBe(`${SITE}/explore-by-benefit/antioxidant`);

    const body = (await renderPageBody("/explore-by-benefit/antioxidant"))!;
    const { h1, intro } = exploreDetailCopy("antioxidant");
    expect(body).toContain(`<h1>${h1}</h1>`);
    expect(body).toContain(`<p>${intro}</p>`);
    for (const s of state.studiesByTerm.antioxidant) {
      expect(body).toContain(`<a href="/study/${s.slug}">${s.title}</a>`);
    }
  });

  it("crawler index and GET /api/explore/benefit/hubs link the same hubs (curated, ≥1 study)", async () => {
    const body = (await renderPageBody("/explore-by-benefit"))!;
    const copy = exploreIndexCopy("benefit");
    expect(body).toContain(`<h1>${copy.h1}</h1>`);
    expect(body).toContain(`<p>${copy.intro}</p>`);
    const list = body.slice(body.indexOf("<h1>"), body.indexOf("More Ways to Browse"));
    const linked = [...list.matchAll(/href="(\/explore-by-benefit\/[a-z0-9-]+)"/g)].map((m) => m[1]);
    expect(linked).toEqual(["/explore-by-benefit/antioxidant", "/explore-by-benefit/neuroprotective"]);
    expect(body).toContain(`<a href="/explore-by-benefit/antioxidant">Antioxidant</a> (${studyCountLabel(5)})`);

    __resetConditionHubsForTests();
    const res = await request(express().use(hydrogenRoutes)).get("/api/explore/benefit/hubs");
    expect(res.body.hubs.map((h: any) => h.path)).toEqual(linked);
    for (const slug of BENEFIT_HUB_SLUGS) expect(slug).toMatch(/^[a-z0-9-]+$/);

    const meta = resolveStaticPageMeta("/explore-by-benefit")!;
    expect(meta.title).toBe(copy.title);
    expect(meta.description).toBe(copy.description);
  });
});

// ── Indexes link only valid hubs ────────────────────────────────

describe("indexes (crawler) = GET /api/explore/:type/hubs (SPA)", () => {
  async function crawlerLinks(type: string) {
    const body = (await renderPageBody(`/explore-by-${type}`))!;
    const list = body.slice(body.indexOf("<h1>"), body.indexOf("More Ways to Browse"));
    return [...list.matchAll(new RegExp(`href="(/explore-by-${type}/[a-z0-9-]+)"`, "g"))].map((m) => m[1]);
  }
  async function apiLinks(type: string) {
    __resetConditionHubsForTests();
    const res = await request(express().use(hydrogenRoutes)).get(`/api/explore/${type}/hubs`);
    expect(res.status).toBe(200);
    return res.body.hubs.map((h: any) => h.path);
  }

  it("condition: rows whose page lists studies, most-listed first", async () => {
    const links = await crawlerLinks("condition");
    expect(links).toEqual([
      "/explore-by-condition/kidney-health",
      "/explore-by-condition/type-2-diabetes",
      "/explore-by-condition/anxiety-stress",
    ]);
    expect(await apiLinks("condition")).toEqual(links);
    expect(links).not.toContain("/explore-by-condition/stale-row");
  });

  it("life-stage: the sitemap hubs with studies (never consumer-category names)", async () => {
    const links = await crawlerLinks("life-stage");
    expect(links).toEqual(["/explore-by-life-stage/pregnancy", "/explore-by-life-stage/athletes"]);
    expect(await apiLinks("life-stage")).toEqual(links);
    for (const slug of LIFE_STAGE_HUB_SLUGS) {
      if (!links.includes(`/explore-by-life-stage/${slug}`)) {
        // Unlinked sitemap hubs still resolve (removal needs owner approval).
        expect(await exploreHubExists("life-stage", slug)).toBe(true);
      }
    }
  });

  it("mechanism: the sitemap hubs with studies (never `mechanisms` table slugs)", async () => {
    const links = await crawlerLinks("mechanism");
    expect(links).toEqual(["/explore-by-mechanism/hydrogen-water"]);
    expect(await apiLinks("mechanism")).toEqual(links);
    expect(MECHANISM_HUB_SLUGS).toContain("hydrogen-water");
  });

  it("demographic: unchanged — curated hubs with studies", async () => {
    const links = await crawlerLinks("demographic");
    expect(links).toEqual(
      DEMOGRAPHIC_HUB_SLUGS.filter((s) => ["athletes", "women"].includes(s)).map((s) => `/explore-by-demographic/${s}`),
    );
    expect(await apiLinks("demographic")).toEqual(links);
  });
});

// ── Sitemaps ────────────────────────────────────────────────────

describe("sitemaps list only valid hubs", () => {
  it("sitemap-categories: condition rows with studies only", async () => {
    const res = await request(express().use(seoRoutes)).get("/sitemap-categories.xml");
    expect(res.status).toBe(200);
    expect(res.text).toContain(`<loc>${SITE}/explore-by-condition/type-2-diabetes</loc>`);
    expect(res.text).toContain(`<loc>${SITE}/explore-by-condition/anxiety-stress</loc>`);
    expect(res.text).not.toContain("/explore-by-condition/stale-row");
  });

  it("sitemap-explore: every advertised hub URL is a valid hub", async () => {
    const res = await request(express().use(seoRoutes)).get("/sitemap-explore.xml");
    expect(res.status).toBe(200);
    const locs = [...res.text.matchAll(/<loc>https:\/\/hydrogenstudies\.com([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBeGreaterThan(0);
    for (const loc of locs) {
      const hub = parseExploreHubPath(loc)!;
      expect(hub, loc).not.toBeNull();
      expect(await exploreHubExists(hub.type, hub.slug), loc).toBe(true);
    }
    // Canonical body-system hubs without studies are left out.
    expect(res.text).not.toContain("/explore-by-body-system/eyes-vision<");
    expect(res.text).toContain("/explore-by-body-system/cardiovascular<");
  });
});
