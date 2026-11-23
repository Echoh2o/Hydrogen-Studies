/**
 * Byline + last-updated date on hub / listing / profile / static pages
 * (CLAUDE.md trust fields; audit 2026-11-22 06-indexable-pages-missing-trust-fields.csv).
 * Express renderer side; the Next pages either wrap this HTML (genericPage)
 * or render the shared content components (PageBylineLine).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { PgDialect } from "drizzle-orm/pg-core";

const dialect = new PgDialect();
const state = vi.hoisted(() => ({
  handler: null as null | ((sqlText: string, params: unknown[]) => any[]),
}));

vi.mock("../db", () => ({
  db: {
    execute: async (query: any) => {
      const { sql: text, params } = dialect.sqlToQuery(query);
      const normalized = text.replace(/\s+/g, " ").trim();
      return { rows: state.handler ? state.handler(normalized, params) : [] };
    },
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
  },
  pool: { query: async () => ({ rows: [] }) },
}));
vi.mock("../services/live-blog-index", () => ({
  getLiveBlogPredicate: async () => () => false,
  invalidateLiveBlogIndex: () => {},
}));
vi.mock("../utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { renderPageBody, __resetConditionHubsForTests } = await import("../middleware/seo-body-renderer");
const { __resetStudyDatesForTests, latestModifiedForSlugs } = await import("../services/study-dates");
const { pageByline, pageBylineHtml, newestDate, STATIC_PAGE_UPDATED } = await import("../../shared/page-byline");
const { STUDY_REVIEWER } = await import("../../shared/reviewer");

const LISTED_LATEST = "2026-10-14T09:00:00.000Z";
const SITE_LATEST = "2026-11-20T12:00:00.000Z";

beforeEach(() => {
  __resetConditionHubsForTests();
  __resetStudyDatesForTests();
  state.handler = (text) => {
    if (/MAX\(COALESCE\(last_modified, created_at\)\) AS latest FROM studies WHERE is_excluded = false AND slug IN/.test(text)) {
      return [{ latest: LISTED_LATEST }];
    }
    if (/MAX\(COALESCE\(last_modified, created_at\)\) AS latest FROM studies WHERE is_excluded = false$/.test(text)) {
      return [{ latest: SITE_LATEST }];
    }
    if (/h2_delivery_method/.test(text)) return [{ slug: "s1", title: "Study one", publish_year: 2024, journal: "J" }];
    if (/COUNT\(\*\) OVER\(\)/.test(text)) return [{ slug: "s1", title: "Study one", publish_year: 2024, total_count: 1 }];
    return [];
  };
});

describe("shared/page-byline", () => {
  it("formats the line; no date → nothing", () => {
    expect(pageBylineHtml("2026-11-05")).toBe(
      `<p class="byline">By the <a href="/editorial-policy">Hydrogen Studies Editorial Team</a> · Last updated <time datetime="2026-11-05">November 5, 2026</time></p>\n`,
    );
    expect(pageBylineHtml(null)).toBe("");
    expect(pageByline("not a date")).toBeNull();
  });

  it("newestDate picks the newest", () => {
    expect(newestDate(["2026-01-01", null, "2026-03-01", "bad"])!.toISOString().slice(0, 10)).toBe("2026-03-01");
  });

  it("static page dates are fixed YYYY-MM-DD constants", () => {
    for (const p of ["/about", "/contact", "/terms", "/privacy"]) {
      expect(STATIC_PAGE_UPDATED[p]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("latestModifiedForSlugs skips the query for an empty list", async () => {
    expect(await latestModifiedForSlugs([])).toBeNull();
  });
});

describe("Express renderer bylines", () => {
  it.each([
    ["/hydrogen-for/diabetes", "October 14, 2026"],
    ["/explore-by-mechanism/hydrogen-water", "October 14, 2026"],
    ["/explore-by-mechanism", "November 20, 2026"],
    ["/explore-by-condition", "November 20, 2026"],
    ["/researchers", "November 20, 2026"],
    ["/journals", "November 20, 2026"],
    ["/", "November 20, 2026"],
    ["/studies", "November 20, 2026"],
    ["/about", "March 13, 2026"],
    ["/terms", "August 4, 2026"],
  ])("%s shows the editorial byline with a truthful date", async (p, date) => {
    const html = (await renderPageBody(p))!;
    expect(html).toContain("By the <a href=\"/editorial-policy\">Hydrogen Studies Editorial Team</a> · Last updated");
    expect(html).toContain(`>${date}</time>`);
    // Byline right after the H1.
    expect(html).toMatch(/<\/h1>\n<p class="byline">By the /);
    // The study reviewer reviews studies, not hubs.
    expect(html).not.toContain(STUDY_REVIEWER.name);
  });
});

describe("shared content components (SPA + Next)", () => {
  const read = (f: string) => fs.readFileSync(path.join(__dirname, "../../client/src/pages/content", f), "utf8");
  it.each([
    ["AboutContent.tsx", 'STATIC_PAGE_UPDATED["/about"]'],
    ["ContactContent.tsx", 'STATIC_PAGE_UPDATED["/contact"]'],
    ["TermsContent.tsx", 'STATIC_PAGE_UPDATED["/terms"]'],
    ["PrivacyContent.tsx", 'STATIC_PAGE_UPDATED["/privacy"]'],
    ["HomeContent.tsx", "siteStats?.latestStudyUpdate"],
    ["StudiesContent.tsx", "useSiteLastUpdated()"],
    ["ResearchAnalyticsContent.tsx", "useSiteLastUpdated()"],
  ])("%s renders <PageBylineLine> with %s", (file, needle) => {
    const src = read(file);
    expect(src).toContain("<PageBylineLine");
    expect(src).toContain(needle);
  });
});
