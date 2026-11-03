/**
 * PLAN 4.6 — /limits-of-the-evidence and /null-and-negative-results: every
 * number on the page is the database's, the prose makes no treatment claim,
 * the schema trail is the visible one, and the hub lists exactly the studies
 * whose recorded outcome is not positive.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

vi.mock("../db", () => {
  const dialect = new PgDialect();
  return {
    db: {
      execute: async (q: any) => {
        const { sql } = dialect.sqlToQuery(q);
        if (/since2010/i.test(sql)) return { rows: [{ total: 2276, human: 348, since2010: 2149 }] };
        if (/AS design/i.test(sql)) {
          return { rows: [{ design: "animal", n: 1070 }, { design: "review", n: 426 }, { design: "in_vitro", n: 276 }, { design: "rct", n: 126 }, { design: "unknown", n: 67 }] };
        }
        if (/median_n/i.test(sql)) {
          return { rows: [{ with_n: 297, median_n: 23, lt30: 169, lt100: 258, ge100: 39, max_n: 2364, with_dur: 258, median_days: 28, single_day: 43, up_to_4w: 106, to_6m: 90, over_6m: 19 }] };
        }
        if (/human_non_positive/i.test(sql)) return { rows: [{ positive: 1764, neutral: 99, negative: 11, mixed: 10, with_outcome: 1884, human_non_positive: 31 }] };
        if (/SELECT country/i.test(sql)) return { rows: [{ country: "China", n: 1097 }, { country: "Japan", n: 523 }, { country: "United States", n: 121 }] };
        if (/registration_mention/i.test(sql)) return { rows: [{ funding: 166, coi: 187, concentration: 550, registration_mention: 37 }] };
        if (/conditions_with_rct/i.test(sql)) return { rows: [{ conditions_with_rct: 228, conditions_with_2plus: 48 }] };
        if (/lower\(outcome\) AS outcome/i.test(sql)) {
          return {
            rows: [
              { slug: "null-human", title: "Hydrogen water did not change HbA1c", publish_year: 2022, journal: "Diabetes J", study_design: "rct", study_type: "human", is_human_trial: true, outcome: "neutral" },
              { slug: "mixed-rat", title: "Mixed results in rats", publish_year: 2019, journal: "Rat J", study_design: "animal", study_type: "rat", is_human_trial: false, outcome: "mixed" },
            ],
          };
        }
        if (/FROM health_conditions/i.test(sql)) return { rows: [] };
        return { rows: [] };
      },
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    },
    pool: { query: () => new Promise(() => {}) },
  };
});
vi.mock("../utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { renderPageBody } = await import("../middleware/seo-body-renderer");
const { resolvePageMeta } = await import("../services/page-meta");
const { __resetEvidenceStatsForTests, getEvidenceStats } = await import("../services/evidence-stats");

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const OVERCLAIMS = [/\b(can|will|does|may) (cure|treat|prevent)\b/i, /\bproven to\b/i, /\bclinically proven\b/i, /\bmiracle\b/i, /hydrogen works\b(?! \d)/i];

beforeEach(() => __resetEvidenceStatsForTests());

describe("/limits-of-the-evidence", () => {
  it("states the database's numbers, with percentages, and one H1", async () => {
    const html = (await renderPageBody("/limits-of-the-evidence"))!;
    expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
    const t = text(html);
    expect(t).toContain("348 of the 2,276 studies (15%) involved human participants");
    expect(t).toContain("1,070 (47%) were done in animals");
    expect(t).toContain("Only 126 studies are randomized controlled trials");
    expect(t).toContain("The median is 23 participants");
    expect(t).toContain("169 studies (57%) had fewer than 30 people");
    expect(t).toContain("1,764 (94%) are positive; 120 (6%) are neutral, negative or mixed, 31 of them in people");
    expect(t).toContain("China accounts for 1,097 studies (48%), Japan accounts for 523 studies (23%) and United States accounts for 121 studies (5%)");
    expect(t).toContain("only 48 of those tags have two or more randomized trials");
    expect(t).toContain("Only 37 of the 348 human studies mention a trial-registry identifier");
    expect(html).toContain('href="/null-and-negative-results"');
    expect(html).toContain("<table>");
    expect(html).toContain("Design not yet classified"); // the unknown bucket is shown, not hidden
    expect(html).not.toMatch(/\$\{/); // no unrendered template
  });

  it("carries a visible byline with the prose review date, and makes no treatment claims", async () => {
    const html = (await renderPageBody("/limits-of-the-evidence"))!;
    expect(html).toContain("Hydrogen Studies Editorial Team");
    expect(html).toContain('<time datetime="2026-11-03T00:00:00.000Z">');
    for (const re of OVERCLAIMS) expect(text(html)).not.toMatch(re);
  });

  it("meta: WebPage named by the H1 with the review date, BreadcrumbList = visible trail", async () => {
    const meta = (await resolvePageMeta("/limits-of-the-evidence"))!;
    expect(meta.title.length).toBeLessThanOrEqual(65);
    const [page, trail] = meta.jsonLd as any[];
    expect(page["@type"]).toBe("WebPage");
    expect(page.name).toBe("The limits of the evidence on molecular hydrogen");
    expect(page.dateModified).toBe("2026-11-03T00:00:00.000Z");
    expect(trail.itemListElement.map((n: any) => n.name)).toEqual(["Home", "The limits of the evidence on molecular hydrogen"]);
    const html = (await renderPageBody("/limits-of-the-evidence"))!;
    expect(html).toContain("<h1>The limits of the evidence on molecular hydrogen</h1>");
  });

  it("caches the statistics for the page's lifetime", async () => {
    const a = await getEvidenceStats();
    const b = await getEvidenceStats();
    expect(b).toBe(a);
  });
});

describe("/is-hydrogen-water-a-scam", () => {
  it("answers first, states the live numbers, lists every hub grade, and shows the FAQ it declares", async () => {
    const html = (await renderPageBody("/is-hydrogen-water-a-scam"))!;
    expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
    const t = text(html);
    expect(t).toMatch(/Short answer: hydrogen water is not a scam in the sense of a made-up product/);
    expect(t).toContain("studied in 2,276 papers, 348 of them in people");
    expect(t).toContain("Of 348 human studies, 126 are randomized controlled trials");
    expect(t).toContain("94% of the 1,884 studies with a recorded outcome direction are positive");
    expect(t).toContain('the strongest grade on any topic is "Low"');
    const { CONDITION_HUB_INTROS } = await import("../../shared/condition-hub-intros");
    const hubCount = Object.keys(CONDITION_HUB_INTROS).length;
    expect((html.match(/: evidence (Very low|Low|Moderate|High)<\/li>/g) ?? []).length).toBe(hubCount);
    expect(html).toContain('href="/explore-by-condition/type-2-diabetes"');
    expect(html).toContain("Our conflict of interest");
    expect(html).toContain("Echo Technologies LLC");
    expect(html.slice(0, html.indexOf("<footer>"))).not.toContain("echowater.com"); // no product content in the article (the footer carries the disclosure link)
    for (const re of OVERCLAIMS) expect(t).not.toMatch(re);
    expect(html).not.toMatch(/\$\{/);
  });

  it("meta: WebPage + FAQPage (every question visible) + trail", async () => {
    const meta = (await resolvePageMeta("/is-hydrogen-water-a-scam"))!;
    expect(meta.title.length).toBeLessThanOrEqual(65);
    const [page, faq, trail] = meta.jsonLd as any[];
    expect(page["@type"]).toBe("WebPage");
    expect(page.name).toBe("Is hydrogen water a scam? An honest answer");
    expect(faq["@type"]).toBe("FAQPage");
    const html = (await renderPageBody("/is-hydrogen-water-a-scam"))!;
    const { faqPairsIfVisible } = await import("../../shared/seo-markup");
    const pairs = faq.mainEntity.map((q: any) => ({ question: q.name, answer: q.acceptedAnswer.text }));
    expect(faqPairsIfVisible(pairs, html)).toEqual(pairs);
    expect(pairs.length).toBe(6);
    expect(trail.itemListElement.map((n: any) => n.name)).toEqual(["Home", "Is hydrogen water a scam? An honest answer"]);
  });
});

describe("/null-and-negative-results", () => {
  it("lists only non-positive studies, people first, each with its recorded result", async () => {
    const html = (await renderPageBody("/null-and-negative-results"))!;
    expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
    expect(text(html)).toContain("2 of the 1,884 studies with a recorded outcome direction (0%) report a neutral, negative or mixed result for hydrogen, 1 of them in people");
    expect(html.indexOf("null-human")).toBeLessThan(html.indexOf("mixed-rat"));
    expect(html).toContain("In people (1)");
    expect(html).toContain("result: neutral");
    expect(html).toContain("Randomized controlled trial · Human study");
    expect(html).toContain('href="/limits-of-the-evidence"');
    expect(html).toContain("machine-drafted"); // how a study gets here is explained
  });

  it("meta: CollectionPage named by the H1 + trail", async () => {
    const meta = (await resolvePageMeta("/null-and-negative-results"))!;
    const [page, trail] = meta.jsonLd as any[];
    expect(page["@type"]).toBe("CollectionPage");
    expect(page.name).toBe("Null and negative results");
    expect(trail.itemListElement.map((n: any) => n.name)).toEqual(["Home", "Null and negative results"]);
  });
});
