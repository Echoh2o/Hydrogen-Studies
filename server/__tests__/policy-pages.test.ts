/**
 * PLAN.md 4.2 — /editorial-policy and /methodology are real pages (≥600 words
 * each) that cover: who runs the site, Echo's funding and editorial
 * independence, inclusion/exclusion criteria, AI-assisted drafting and the
 * human review step, update cadence, the corrections process, and contact.
 * One source (shared/policy-pages.ts) feeds the renderer and the SPA.
 */
import { describe, it, expect, vi } from "vitest";
import { EDITORIAL_POLICY, METHODOLOGY, POLICY_PAGES, policyPageWordCount } from "../../shared/policy-pages";

vi.mock("../db", () => ({
  db: { execute: async () => ({ rows: [] }), select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }) },
  pool: { query: () => new Promise(() => {}) },
}));
vi.mock("../utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { renderPageBody } = await import("../middleware/seo-body-renderer");
const { resolvePageMeta } = await import("../services/page-meta");

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Phrases that would turn a research database into a treatment claim. */
const OVERCLAIMS = [/\b(can|will|does|may) (cure|treat|prevent)\b/i, /\bproven to (treat|cure|prevent)/i, /\bclinically proven\b/i, /\bguarantee/i, /\bmiracle\b/i, /\bcures\b/i];

describe.each([EDITORIAL_POLICY, METHODOLOGY])("$path", (page) => {
  it("has at least 600 words of prose", () => {
    expect(policyPageWordCount(page)).toBeGreaterThanOrEqual(600);
  });

  it("carries a visible last-updated date and an author in both renderers", async () => {
    const html = await renderPageBody(page.path);
    expect(html).toBeTruthy();
    expect(html).toContain(`<time datetime="${new Date(page.lastUpdated).toISOString()}">`);
    expect(html).toContain("Hydrogen Studies Editorial Team");
    expect((html!.match(/<h1\b/g) ?? []).length).toBe(1);
    expect(html!.match(/<h2\b/g)?.length).toBe(page.sections.length);
  });

  it("renders every section's markdown as HTML (links become anchors, no raw markdown)", async () => {
    const html = (await renderPageBody(page.path))!;
    expect(html).not.toMatch(/\]\(\//); // no [text](/href) left
    expect(html).not.toMatch(/\*\*/);
    expect(html).toContain('<a href="/contact">');
    expect(words(text(html))).toBeGreaterThanOrEqual(600);
  });

  it("makes no treatment claims", () => {
    for (const s of page.sections) for (const re of OVERCLAIMS) expect(s.markdown, `${s.heading}: ${re}`).not.toMatch(re);
  });

  it("page meta carries only a BreadcrumbList whose trail matches the body", async () => {
    const meta = await resolvePageMeta(page.path);
    const blocks = Array.isArray(meta!.jsonLd) ? meta!.jsonLd : [meta!.jsonLd];
    const trail = blocks.find((b: any) => b["@type"] === "BreadcrumbList") as any;
    expect(trail.itemListElement.map((n: any) => n.name)).toEqual(["Home", page.h1]);
    const html = (await renderPageBody(page.path))!;
    expect(html).toContain(`<li aria-current="page">${page.h1}</li>`);
  });
});

describe("editorial policy covers PLAN 4.2's list", () => {
  const all = [EDITORIAL_POLICY.intro, ...EDITORIAL_POLICY.sections.map((s) => `${s.heading}\n${s.markdown}`)].join("\n");
  it.each([
    ["who runs it", /Echo Technologies LLC/],
    ["funding + independence", /does not choose which studies appear/],
    ["AI-assisted drafting", /large language models/],
    ["human review step", /reviewed by a person before it is published/],
    ["named reviewer + disclosed affiliation", /Sarah Taylor-Laine[\s\S]*Research Director at Echo Water[\s\S]*not independent of Echo/],
    ["update cadence", /every six hours/],
    ["corrections process", /fix the page/],
    ["contact", /\/contact/],
    ["sponsor rules", /sponsor modules/],
  ])("%s", (_label, re) => {
    expect(all).toMatch(re);
  });
});

describe("methodology covers PLAN 4.2's list", () => {
  const all = [METHODOLOGY.intro, ...METHODOLOGY.sections.map((s) => `${s.heading}\n${s.markdown}`)].join("\n");
  it.each([
    ["inclusion criteria", /PubMed, Europe PMC and CrossRef/],
    ["exclusion criteria", /retracted/],
    ["evidence labels", /randomized controlled trial/i],
    ["AI-assisted drafting", /large language models/],
    ["funding fields", /conflicts of interest/],
    ["limits of the data", /leans positive/],
    ["abstract policy", /300 characters/],
    ["contact", /\/contact/],
  ])("%s", (_label, re) => {
    expect(all).toMatch(re);
  });

  it("every factual count is dated", () => {
    for (const page of Object.values(POLICY_PAGES)) {
      for (const s of page.sections) {
        if (/\b\d{1,3}(,\d{3})+\b|\b\d+%/.test(s.markdown)) {
          expect(s.markdown, s.heading).toMatch(/(As of|as of|In) (January|February|March|April|May|June|July|August|September|October|November|December) 20\d\d|November 2026|September 2026/);
        }
      }
    }
  });
});

describe("reviewer: byline = schema (CLAUDE.md: reviewedBy only for a named, visible reviewer)", () => {
  it("study schema names the same reviewer the byline shows, with affiliation, and no lastReviewed date", async () => {
    const { studyJsonLd } = await import("../../shared/seo-markup");
    const { STUDY_REVIEWER, reviewerBylineLabel } = await import("../../shared/reviewer");
    const ld = studyJsonLd({ title: "T", slug: "t" } as any, { canonical: "https://hydrogenstudies.com/study/t", siteUrl: "https://hydrogenstudies.com" });
    expect(ld.reviewedBy.name).toBe(STUDY_REVIEWER.name);
    expect(ld.reviewedBy.worksFor.name).toBe("Echo Water");
    expect(ld.lastReviewed).toBeUndefined();
    expect(reviewerBylineLabel()).toBe("Sarah Taylor-Laine, M.Sc., Research Director, Echo Water");
    expect(JSON.stringify(STUDY_REVIEWER).toLowerCase()).not.toMatch(/independent reviewer|verified|certified|doctor/);
  });
});
