/**
 * Every PUBLIC surface filters excluded (off-topic hydrogen-energy) studies.
 *
 * Runs the real query builders against a real drizzle instance whose pg
 * client only RECORDS the SQL (no database — mocked-db convention), then
 * asserts the invariant: every statement that reads the studies table
 * carries the `is_excluded` filter. A new public query that forgets it fails
 * here.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const captured = vi.hoisted(() => ({ sql: [] as string[] }));

vi.mock("../db", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const schema = await import("@shared/schema");
  const client = {
    query: async (q: any) => {
      captured.sql.push(typeof q === "string" ? q : q?.text ?? "");
      return { rows: [], rowCount: 0, fields: [] };
    },
  };
  const db = drizzle(client as any, { schema });
  return { db, pool: client, migrationDb: db };
});

vi.mock("../services/ai-provider", () => ({
  ai: { generateText: vi.fn(), generateJSON: vi.fn(), getProviderStatus: () => ({ primary: "none" }) },
  MODELS: {},
}));

vi.mock("../auth", () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
  isElevatedRequest: async () => false,
}));

/**
 * Statements that read the studies table (FROM/JOIN studies, quoted or not),
 * minus zero-row feature probes (`SELECT search_vector FROM studies LIMIT 0`).
 */
function studyReads(): string[] {
  return captured.sql.filter(
    (s) => /\b(from|join)\s+"?studies"?(\s|$|\)|,)/i.test(s) && !/\bLIMIT 0\b/i.test(s),
  );
}

/** The exclusion PREDICATE (not merely the column appearing in a select list). */
const EXCLUSION_PREDICATE = /is_excluded"?\s*=\s*(false|\$\d+)/i;

function expectAllFiltered(label: string) {
  const reads = studyReads();
  expect(reads.length, `${label}: expected at least one studies query`).toBeGreaterThan(0);
  for (const s of reads) {
    expect(s, `${label}: unfiltered studies query:\n${s}`).toMatch(EXCLUSION_PREDICATE);
  }
}

beforeEach(() => {
  captured.sql = [];
});

describe("study service — public listing/search/stats queries", async () => {
  const { studyService } = await import("../services/study-service");

  it.each([
    ["getStudies (browse)", () => studyService.getStudies({})],
    ["getStudies (search)", () => studyService.getStudies({ query: "sleep quality" })],
    ["getStudies (filters)", () => studyService.getStudies({ category: "brain", yearFrom: 2020, author: "ohta" })],
    ["getLatestStudies", () => studyService.getLatestStudies(10)],
    ["getRelatedStudies", () => studyService.getRelatedStudies(1, "Whole Body")],
    ["getOverview", () => studyService.getOverview()],
    ["getFilterStats", () => studyService.getFilterStats()],
    ["getResearchTrends", () => studyService.getResearchTrends()],
    ["getHealthOutcomes", () => studyService.getHealthOutcomes()],
    ["getTrendingTopics", () => studyService.getTrendingTopics()],
  ] as const)("%s", async (label, run) => {
    await run();
    expectAllFiltered(label);
  });

  it("admins can opt in to see excluded studies (controller only sets this when elevated)", async () => {
    await studyService.getStudies({ includeExcluded: true });
    expect(studyReads().some((s) => !EXCLUSION_PREDICATE.test(s))).toBe(true);
  });

  it("dedupe lookups still see excluded rows, so imports never re-add them", async () => {
    await studyService.checkStudyExists("10.1016/j.jbiotec.2025.01.001");
    await studyService.getStudyByIdentifier("10.1016/j.jbiotec.2025.01.001");
    for (const s of studyReads()) expect(s).not.toMatch(EXCLUSION_PREDICATE);
  });
});

describe("crawler-facing SSR bodies (same HTML for bots and browsers)", async () => {
  const { renderPageBody, renderStudy, renderHydrogenForPage, __resetConditionHubsForTests } = await import(
    "../middleware/seo-body-renderer"
  );
  // Index hub lists are cached — drop the cache so the index's own queries run.
  const fresh = (path: string) => () => {
    __resetConditionHubsForTests();
    return renderPageBody(path);
  };

  it.each([
    ["homepage", () => renderPageBody("/")],
    ["/studies directory", () => renderPageBody("/studies")],
    ["body-system hub", () => renderPageBody("/explore-by-body-system/cardiovascular")],
    ["body-system index", fresh("/explore-by-body-system")],
    ["mechanism hub", () => renderPageBody("/explore-by-mechanism/hydrogen-water")],
    ["benefit hub", fresh("/explore-by-benefit/antioxidant")],
    ["benefit index", fresh("/explore-by-benefit")],
    ["life-stage index", fresh("/explore-by-life-stage")],
    ["mechanism index", fresh("/explore-by-mechanism")],
    ["demographic hub", () => renderPageBody("/explore-by-demographic/athletes")],
    ["demographic index", fresh("/explore-by-demographic")],
    ["delivery-method hub", () => renderPageBody("/explore-by-delivery-method/inhalation")],
    ["delivery-method index", fresh("/explore-by-delivery-method")],
    ["study page", () => renderStudy("some-study-slug")],
    ["hydrogen-for page", () => renderHydrogenForPage("heart-disease")],
  ] as const)("%s", async (label, run) => {
    await run();
    expectAllFiltered(label);
  });
});

describe("sitemaps, llms.txt and public stats", async () => {
  const { default: seoRoutes } = await import("../routes/seo-routes");
  const { default: learnStatsRoutes } = await import("../routes/learn-stats-routes");
  const app = express();
  app.use(seoRoutes);
  app.use("/api/learn-stats", learnStatsRoutes);

  it.each(["/sitemap-studies.xml", "/llms.txt", "/api/learn-stats"])("%s", async (path) => {
    await request(app).get(path);
    expectAllFiltered(path);
  });
});

describe("hub and explorer APIs", async () => {
  const { default: consumerCategoriesRoutes } = await import("../routes/consumer-categories-routes");
  const { default: hydrogenRoutes } = await import("../routes/hydrogen-routes");
  const { explorerDataService } = await import("../services/explorer-data-service");
  const app = express();
  app.use("/api/consumer-categories", consumerCategoriesRoutes);
  app.use(hydrogenRoutes);

  it.each([
    "/api/consumer-categories/counts",
    "/api/consumer-categories/studies?model=condition&category=Heart%20Disease%20%26%20Hypertension",
    "/api/consumer-categories/life-stages",
    "/api/explore/mechanism/hydrogen-water/studies",
    "/api/explore/benefit/antioxidant/studies",
    "/api/explore/benefit/hubs",
    "/api/explore/life-stage/hubs",
    "/api/explore/mechanism/hubs",
    "/api/explore/demographic/athletes/studies",
    "/api/explore/delivery-method/inhalation/studies",
    "/api/explore/demographic/hubs",
    "/api/explore/delivery-method/hubs",
  ])("%s", async (path) => {
    // Hub lists are cached; drop the cache so this request's queries run.
    const { __resetConditionHubsForTests } = await import("../middleware/seo-body-renderer");
    __resetConditionHubsForTests();
    await request(app).get(path);
    expectAllFiltered(path);
  });

  it.each([
    ["timeline", () => explorerDataService.getTimelineData(2001, 2002)],
    ["body systems", () => explorerDataService.getBodySystemsData()],
    ["connections", () => explorerDataService.getStudyConnections()],
    ["evolution", () => explorerDataService.getResearchEvolution(2003)],
    ["geography", () => explorerDataService.getGeographicDistribution()],
    ["comparison", () => explorerDataService.getComparisonData([1, 2])],
  ] as const)("explorer %s", async (label, run) => {
    explorerDataService.clearCache();
    await run();
    expectAllFiltered(label);
  });
});

describe("Shopify App Proxy pages", async () => {
  const { default: proxyRoutes } = await import("../routes/proxy-routes");
  const app = express();
  app.use("/proxy", proxyRoutes);

  it.each(["/proxy/", "/proxy/?q=sleep", "/proxy/stats", "/proxy/sitemap.xml", "/proxy/export"])("%s", async (path) => {
    await request(app).get(path);
    expectAllFiltered(path);
  });
});

describe("redirect auto-promoter", async () => {
  const { pathResolvesToLiveContent, getRankedSuggestions } = await import("../services/redirect-service");

  it("an excluded study slug is not 'live content' and is never a suggestion target", async () => {
    await pathResolvesToLiveContent("/study/some-slug");
    await getRankedSuggestions("/study/biohydrogen-production-review");
    expectAllFiltered("redirect suggestions");
  });
});

describe("recommendations and internal links", async () => {
  const { getPersonalizedRecommendations } = await import("../services/recommendation-engine");
  const { getLinksFor } = await import("../services/internal-linking-engine");

  it.each(["trending", "recent", "personalized"] as const)("recommendations: %s", async (type) => {
    await getPersonalizedRecommendations({ recommendationType: type, maxResults: 4 } as any).catch(() => {});
    expectAllFiltered(`recommendations ${type}`);
  });

  it("internal links never point at excluded studies", async () => {
    await getLinksFor("blog", 1);
    const q = captured.sql.find((s) => /smart_links/.test(s))!;
    expect(q).toMatch(EXCLUSION_PREDICATE);
  });
});
