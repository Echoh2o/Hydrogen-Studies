/**
 * Audit 2026-11-22 render fixes:
 *  1. /hydrogen-for matches topic.searchTerms, shows the true count, neutral copy
 *  2. model refusals / meta-commentary never render (isPlaceholder)
 *  3. leading markdown TL;DR labels are stripped
 *  4. entity-escaped journal names are decoded before escaping
 *  5. legacy study_type "clinical" is not shown
 *  6. jsonLdSafe lives in shared/ (Express re-exports it)
 *  7. sitemap-pages lists /editorial-policy, /methodology, /disclaimer
 *  8. utm_content keeps the permanent-ID suffix when a slug is shortened
 *
 * db.execute is mocked and each query rendered with PgDialect (same harness
 * as seo-body-renderer.test.ts).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { PgDialect } from "drizzle-orm/pg-core";

const dialect = new PgDialect();
const state = vi.hoisted(() => ({
  handler: null as null | ((sqlText: string, params: unknown[]) => any[]),
  queries: [] as { text: string; params: unknown[] }[],
}));

vi.mock("../db", () => ({
  db: {
    execute: async (query: any) => {
      const { sql: text, params } = dialect.sqlToQuery(query);
      const normalized = text.replace(/\s+/g, " ").trim();
      state.queries.push({ text: normalized, params });
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

import { hydrogenForIntro, hydrogenForMatch, renderHydrogenForPage, renderStudy } from "../middleware/seo-body-renderer";
import seoRoutes from "../routes/seo-routes";
import {
  decodeBasicEntities,
  displayStudyType,
  isModelRefusal,
  isPlaceholder,
  journalDisplayName,
  stripTldrLabel,
  studyJsonLd,
  withoutPlaceholders,
} from "../../shared/seo-markup";
import { jsonLdSafe as sharedJsonLdSafe } from "../../shared/json-ld";
import { jsonLdSafe as serverJsonLdSafe } from "../utils/html-safety";
import { buildEchoUrl, normalizeUtmValue } from "../../shared/echo-products";
import { journalBreadcrumbs } from "../../shared/breadcrumbs";
import { journalDescription, journalTitle } from "../../shared/profiles";
import { getHydrogenForTopic } from "../../shared/hydrogen-for-topics";

beforeEach(() => {
  state.queries = [];
  state.handler = null;
});

// ── 2. refusals / meta-commentary ───────────────────────────────

// Verbatim from reports/audit-2026-11-22/03-study-refusal-and-meta-commentary.csv (is_refusal = t).
const REFUSALS = [
  "I can't write a good summary because this study is missing all the important parts—we don't know what the researchers actually tested, how they did it, or what happened.",
  "I'd love to help, but without an abstract or any study content to work from, I don't have enough information to accurately summarize this paper.",
  "I'm sorry, but I can't write a meaningful TL;DR without an abstract or study content to summarize — just a title isn't enough to accurately represent the research findings.",
  "I cannot summarize this study without its abstract.",
  "I’m sorry, there is not enough information.",
  "Unfortunately, the abstract does not contain enough detail to summarize.",
  "Unfortunately this study lacks an abstract.",
  "No abstract available for this record; the summary is based on the title.",
  "**TL;DR:** I'm sorry, but I can't summarize this.",
];

// Real summaries from the same CSV (is_refusal = f) + the 3665 false positive.
const NORMAL = [
  "Researchers tested slightly acidic electrolyzed water (SAEW)—a chemically treated water solution—as an airborne disinfectant in rats.",
  "This study investigates hydrogen as a potential therapeutic agent for treating non-alcoholic steatohepatitis. While specific results and methods are not available in the provided information, the research suggests hydrogen may represent a novel treatment approach.",
  "This is early-stage research in mice, and specific results are not available.",
  "While the full study details are unavailable, hydrogen therapy shows potential as a therapeutic intervention for traumatic injuries.",
  "Four patients with myalgic encephalomyelitis/chronic fatigue syndrome reportedly improved with hydrogen gas therapy.",
  "In this landmark historical study, Humphry Davy systematically examined the chemical composition of nitrous oxide.",
  "Unfortunately, few trials have tested hydrogen water in people.",
  "Inhaled hydrogen did not improve outcomes; I cannot overstate how small the sample was.",
];

describe("#2 model refusals are placeholders", () => {
  it.each(REFUSALS)("treats %s as empty", (text) => {
    expect(isModelRefusal(text)).toBe(true);
    expect(isPlaceholder(text)).toBe(true);
  });

  it.each(NORMAL)("keeps real summary %s", (text) => {
    expect(isModelRefusal(text)).toBe(false);
    expect(isPlaceholder(text)).toBe(false);
  });

  it("withoutPlaceholders nulls a refusal TL;DR", () => {
    const s = withoutPlaceholders({ tldr: REFUSALS[2], plain_summary: NORMAL[0], id: 4357 });
    expect(s.tldr).toBeNull();
    expect(s.plain_summary).toBe(NORMAL[0]);
    expect(s.id).toBe(4357);
  });
});

// ── 3. markdown TL;DR labels ────────────────────────────────────

describe("#3 leading markdown TL;DR label", () => {
  it.each([
    ["**TL;DR:** Hydrogen water lowered MDA.", "Hydrogen water lowered MDA."],
    ["**TL;DR**: Hydrogen water lowered MDA.", "Hydrogen water lowered MDA."],
    ["# TL;DR\nHydrogen water lowered MDA.", "Hydrogen water lowered MDA."],
    ["## TL;DR: Hydrogen water lowered MDA.", "Hydrogen water lowered MDA."],
    ["TL;DR - Hydrogen water lowered MDA.", "Hydrogen water lowered MDA."],
    ["TLDR: Hydrogen water lowered MDA.", "Hydrogen water lowered MDA."],
  ])("strips %j", (input, expected) => {
    expect(stripTldrLabel(input)).toBe(expected);
    expect(withoutPlaceholders({ tldr: input }).tldr).toBe(expected);
  });

  it("leaves text without a leading label alone", () => {
    const t = "Hydrogen water lowered MDA (TL;DR: small trial).";
    expect(withoutPlaceholders({ tldr: t }).tldr).toBe(t);
  });

  it("a bare label is empty", () => {
    expect(withoutPlaceholders({ tldr: "**TL;DR:**" }).tldr).toBeNull();
  });
});

// ── 4. journal names ────────────────────────────────────────────

describe("#4 entity-escaped journal names", () => {
  it("decodes repeatedly until stable", () => {
    expect(decodeBasicEntities("Diabetology &amp;amp;amp; Metabolic Syndrome")).toBe("Diabetology & Metabolic Syndrome");
    expect(decodeBasicEntities("A &lt;b&gt; &quot;x&quot; &#39;y&#39;")).toBe(`A <b> "x" 'y'`);
    expect(journalDisplayName("  Food &amp;amp; Function ")).toBe("Food & Function");
    expect(journalDisplayName("N/A")).toBe("");
    expect(journalDisplayName(null)).toBe("");
  });

  it("study page decodes then escapes once", async () => {
    state.handler = (text) =>
      /FROM studies WHERE slug/.test(text)
        ? [{ id: 1, slug: "x-pmid-12345", title: "T", journal: "Diabetology &amp;amp;amp; Metabolic Syndrome", study_type: "clinical", tldr: "**TL;DR:** Lower MDA.", key_finding: "I'm sorry, but I can't summarize this study." }]
        : [];
    const html = (await renderStudy("x-pmid-12345"))!;
    expect(html).toContain("<dt>Journal</dt><dd>Diabetology &amp; Metabolic Syndrome</dd>");
    expect(html).not.toContain("&amp;amp;");
    // #5: legacy "clinical" bucket is not shown
    expect(html).not.toContain("<dt>Study Type</dt>");
    // #3 / #2
    expect(html).toContain("<section><h2>TL;DR</h2><p>Lower MDA.</p></section>");
    expect(html).not.toContain("**");
    expect(html).not.toContain("Key Finding");
    expect(html).not.toMatch(/I'm sorry|I&#39;m sorry/);
  });

  it("JSON-LD, breadcrumbs and journal-profile meta use the decoded name", () => {
    const ld: any = studyJsonLd({ title: "T", slug: "t", journal: "Food &amp;amp; Function" } as any, {
      canonical: "https://hydrogenstudies.com/study/t",
      siteUrl: "https://hydrogenstudies.com",
    } as any);
    expect(JSON.stringify(ld)).toContain('"name":"Food & Function"');
    expect(journalBreadcrumbs("Food &amp;amp; Function").at(-1)!.label).toBe("Food & Function");
    const j: any = { name: "Food &amp;amp; Function", studies: [1, 2], firstYear: 2020, lastYear: 2021, humanCount: 1 };
    expect(journalTitle(j)).toBe("Food & Function: hydrogen research (2 studies)");
    expect(journalDescription(j)).toContain("in Food & Function,");
  });
});

// ── 5. study type ───────────────────────────────────────────────

describe("#5 displayStudyType", () => {
  it("hides only the legacy 'clinical' bucket", () => {
    expect(displayStudyType("clinical")).toBe("");
    expect(displayStudyType(" Clinical ")).toBe("");
    expect(displayStudyType("Rat")).toBe("Rat");
    expect(displayStudyType("Human")).toBe("Human");
    expect(displayStudyType("clinical trial")).toBe("clinical trial");
    expect(displayStudyType(null)).toBe("");
  });

  it("non-clinical study types still render on the study page", async () => {
    state.handler = (text) => (/FROM studies WHERE slug/.test(text) ? [{ id: 2, slug: "y", title: "T", study_type: "Rat" }] : []);
    const html = (await renderStudy("y"))!;
    expect(html).toContain("<dt>Study Type</dt><dd>Rat</dd>");
  });
});

// ── 6. jsonLdSafe ───────────────────────────────────────────────

describe("#6 jsonLdSafe in shared/", () => {
  it("escapes </script> and is the same function Express imports", () => {
    const out = sharedJsonLdSafe({ name: "</script><script>alert(1)</script>&" });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c/script\\u003e");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>&");
    expect(serverJsonLdSafe).toBe(sharedJsonLdSafe);
  });
});

// ── 1. /hydrogen-for ────────────────────────────────────────────

describe("#1 /hydrogen-for/:slug", () => {
  it("matches the slug phrase and every searchTerm, parameterized, with a total count", async () => {
    const topic = getHydrogenForTopic("brain-health")!;
    state.handler = (text) => (/FROM studies WHERE slug IS NOT NULL/.test(text) ? [] : []);
    await renderHydrogenForPage("brain-health");
    const q = state.queries.find((x) => /COUNT\(\*\) OVER\(\)/.test(x.text))!;
    expect(q).toBeTruthy();
    expect(q.text).toMatch(/title ILIKE \$\d+ OR array_to_string\(health_conditions, ' '\) ILIKE \$\d+/);
    expect(q.text).toMatch(/LIMIT \$\d+/);
    expect(q.params).toContain("%brain health%");
    for (const t of topic.searchTerms) expect(q.params).toContain(`%${t}%`);
    // never string-built
    expect(q.text).not.toContain("cognitive");
  });

  it("escapes LIKE wildcards in terms", () => {
    const { params } = dialect.sqlToQuery(hydrogenForMatch(["50%_x"], "a"));
    expect(params).toContain("%50\\%\\_x%");
  });

  it("shows the true total while listing at most 30", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ slug: `s-${i}`, title: `Study ${i}`, publish_year: 2020, outcome: null, total_count: "57" }));
    state.handler = (text) => (/COUNT\(\*\) OVER\(\)/.test(text) ? rows : []);
    const html = (await renderHydrogenForPage("cancer-support"))!;
    expect(html).toContain(
      "<p>What published studies report on molecular hydrogen and cancer supportive care. 57 studies match this topic; the 30 most recent are listed below.</p>",
    );
    expect((html.match(/<li><a href="\/study\//g) || []).length).toBe(30);
    expect(html).not.toContain("may help with");
    expect(html).not.toContain("peer-reviewed studies below");
  });

  it("renders no count sentence with zero studies", async () => {
    const html = (await renderHydrogenForPage("kidney-health"))!;
    expect(html).toContain("<p>What published studies report on molecular hydrogen and kidney health.</p>");
    expect(html).not.toMatch(/\b0 studies\b/);
    expect(html).not.toContain("Research Studies");
  });

  it("intro copy", () => {
    expect(hydrogenForIntro("Skin Health", 1, 1)).toBe("What published studies report on molecular hydrogen and skin health. 1 study is listed below.");
    expect(hydrogenForIntro("Gut Health", 12, 12)).toBe("What published studies report on molecular hydrogen and gut health. 12 studies are listed below.");
    expect(hydrogenForIntro("Gut Health", 0, 0)).toBe("What published studies report on molecular hydrogen and gut health.");
  });
});

// ── 7. sitemap ──────────────────────────────────────────────────

describe("#7 sitemap-pages trust pages", () => {
  it("lists /editorial-policy, /methodology and /disclaimer (and keeps existing pages)", async () => {
    const app = express();
    app.use(seoRoutes);
    const res = await request(app).get("/sitemap-pages.xml");
    expect(res.status).toBe(200);
    for (const p of ["/editorial-policy", "/methodology", "/disclaimer", "/about", "/privacy", "/terms", "/hydrogen-for/lung-health"]) {
      expect(res.text).toContain(`<loc>https://hydrogenstudies.com${p}</loc>`);
    }
  });
});

// ── 8. utm_content ──────────────────────────────────────────────

describe("#8 utm_content keeps the permanent-ID suffix", () => {
  const longTitle =
    "effective-and-safe-long-term-aerosol-disinfection-of-slightly-acidic-electrolyzed-water-causes-no-harm-in-rats-and-mice";

  it.each([
    `${longTitle}-pmid-41615984`,
    `${longTitle}-hs-4357`,
    `${longTitle}-doi-10-13865-j-cnki-cjbmb-2019-10-01`,
  ])("%s", (slug) => {
    const v = normalizeUtmValue(slug);
    const suffix = slug.match(/-(?:pmid|hs|doi)-.*$/)![0];
    expect(v.length).toBeLessThanOrEqual(100);
    expect(v.endsWith(suffix)).toBe(true);
    // the title part is cut at a word boundary
    const head = v.slice(0, v.length - suffix.length);
    expect(longTitle.startsWith(head)).toBe(true);
    expect(longTitle[head.length]).toBe("-");
  });

  it("two long slugs that differ only by ID no longer collide", () => {
    expect(normalizeUtmValue(`${longTitle}-pmid-11111111`)).not.toBe(normalizeUtmValue(`${longTitle}-pmid-22222222`));
  });

  it("short values and non-study values are unchanged", () => {
    expect(normalizeUtmValue("h2-oxidative-stress-pmid-38000001")).toBe("h2-oxidative-stress-pmid-38000001");
    expect(normalizeUtmValue("x".repeat(150))).toBe("x".repeat(100));
    expect(normalizeUtmValue("")).toBe("unknown");
  });

  it("all four UTM params stay present on a long study slug", () => {
    const url = new URL(buildEchoUrl("/products/echo-flask", { pageType: "study", slug: `${longTitle}-pmid-41615984` }));
    expect(url.searchParams.get("utm_source")).toBe("hydrogenstudies");
    expect(url.searchParams.get("utm_medium")).toBe("referral");
    expect(url.searchParams.get("utm_campaign")).toBe("study");
    expect(url.searchParams.get("utm_content")).toMatch(/-pmid-41615984$/);
  });
});
