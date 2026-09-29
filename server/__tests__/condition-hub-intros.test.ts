/**
 * Keyword plan wave 3 — evidence-graded intros on 4 condition hubs
 * (/explore-by-condition/{kidney-health,chronic-fatigue,exercise-recovery,skin-aging}).
 *
 * One record per hub (shared/condition-hub-intros.ts) feeds the crawler
 * <head> (seo-bot-middleware), the crawler body (seo-body-renderer) and the
 * SPA page (ConditionCategoryPage.tsx — client/src/pages/__tests__/
 * ConditionHubIntro.test.tsx), so bots and browsers get the same title,
 * description, H1, byline, intro, FAQ + FAQPage, sources and owner link.
 *
 *  - meta title ≤ 60 incl. " | Hydrogen Studies"; description 140–160
 *  - exactly one H1; intro headings never add a second
 *  - FAQPage only because the FAQ is visible (checked against the body)
 *  - "Updated <date>" byline — no named reviewer, so never "Last reviewed"
 *  - the old health_conditions.description / generic copy is gone
 *  - no product/sponsor content (bridgeTopic null; disease topics refused)
 *  - hubs without a record keep their current rendering
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs";
import os from "os";
import path from "path";
import { PgDialect } from "drizzle-orm/pg-core";

const state = vi.hoisted(() => ({
  conditions: [] as { name: string; slug: string; study_count: number; description: string | null }[],
  /** Studies the shared condition-hub query finds, per hub name. */
  conditionStudies: {} as Record<string, any[]>,
}));

vi.mock("../db", () => {
  const dialect = new PgDialect();
  return {
    db: {
      execute: async (q: any) => {
        const { sql, params } = dialect.sqlToQuery(q);
        if (/FROM health_conditions/i.test(sql)) return { rows: state.conditions };
        if (/FROM studies/i.test(sql) && /health_conditions/i.test(sql)) {
          const name = String(params.find((p) => typeof p === "string" && p.startsWith("%")) ?? "").replace(/^%|%$/g, "");
          const found = state.conditionStudies[name] ?? [];
          if (/count\(\*\)/i.test(sql)) return { rows: [{ n: found.length }] };
          return { rows: found };
        }
        return { rows: [] };
      },
    },
    pool: { query: () => new Promise(() => {}) },
  };
});

import {
  CONDITION_HUB_FAQ_HEADING,
  CONDITION_HUB_INTROS,
  CONDITION_HUB_OWNER_GUIDE_LEAD,
  CONDITION_HUB_SOURCES_HEADING,
  CONDITION_HUB_STUDIES_HEADING,
  conditionHubByline,
  conditionHubJsonLd,
  conditionHubSourceLinks,
  getConditionHubIntro,
  type ConditionHubIntro,
} from "../../shared/condition-hub-intros";
import { isBridgeAllowed } from "../../shared/bridge-policy";
import { EDITORIAL_TEAM, faqPairsIfVisible, isPlaceholder } from "../../shared/seo-markup";
import {
  __resetConditionHubsForTests,
  renderConditionHubIntroHtml,
  renderPageBody,
} from "../middleware/seo-body-renderer";
import { invalidateBotCache, resolveStaticPageMeta, seoBotMiddleware } from "../middleware/seo-bot-middleware";

const SITE = "https://hydrogenstudies.com";
const SLUGS = ["kidney-health", "chronic-fatigue", "exercise-recovery", "skin-aging", "sleep-quality"];
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

/** What the seed (007_seed_health_conditions) stores — must never render on these hubs. */
const OLD_DESCRIPTIONS: Record<string, { name: string; description: string }> = {
  "kidney-health": {
    name: "Kidney Health",
    description: "The functional integrity of the kidneys. Hydrogen may protect against kidney damage from various causes including ischemia and toxins.",
  },
  "chronic-fatigue": {
    name: "Chronic Fatigue",
    description: "Persistent exhaustion not relieved by rest. Hydrogen may support energy production through mitochondrial function improvement.",
  },
  "exercise-recovery": {
    name: "Exercise Recovery",
    description: "The process of muscle repair and adaptation after physical exercise. Hydrogen water may reduce exercise-induced oxidative stress and accelerate recovery.",
  },
  "skin-aging": {
    name: "Skin Aging",
    description: "The progressive deterioration of skin structure and function. Hydrogen water bathing may reduce UV damage and improve skin elasticity.",
  },
  "sleep-quality": {
    name: "Sleep Quality",
    description: "Research on molecular hydrogen and sleep in adults, from small drinking, jelly and inhalation trials to animal studies.",
  },
};

const intros = Object.values(CONDITION_HUB_INTROS);
const allStrings = (x: unknown): string[] =>
  typeof x === "string" ? [x] : Array.isArray(x) ? x.flatMap(allStrings) : x && typeof x === "object" ? Object.values(x).flatMap(allStrings) : [];
const count = (hay: string, re: RegExp) => (hay.match(re) ?? []).length;
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();

function studyRows(prefix: string, n: number) {
  return Array.from({ length: n }, (_, i) => ({
    slug: `${prefix}-study-${i + 1}`,
    title: `${prefix} study ${i + 1}`,
    publish_year: 2020 + i,
    journal: "J Test",
    study_type: "human",
    abstract: `Abstract of ${prefix} ${i + 1}.`,
  }));
}

let staticDir: string;
beforeAll(() => {
  staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "condition-hub-intros-"));
  fs.writeFileSync(
    path.join(staticDir, "index.html"),
    `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><title>Hydrogen Studies Research Database</title></head><body><div id="root"></div></body></html>`,
  );
});

beforeEach(() => {
  __resetConditionHubsForTests();
  invalidateBotCache();
  state.conditions = [
    ...SLUGS.map((slug, i) => ({ slug, ...OLD_DESCRIPTIONS[slug], study_count: 100 - i })),
    {
      name: "Type 2 Diabetes",
      slug: "type-2-diabetes",
      study_count: 265,
      description: "A metabolic disorder. Hydrogen water may improve insulin sensitivity.",
    },
  ];
  state.conditionStudies = Object.fromEntries(
    [...SLUGS.map((s) => OLD_DESCRIPTIONS[s].name), "Type 2 Diabetes"].map((name, i) => [
      name,
      studyRows(name.toLowerCase().replace(/\W+/g, "-"), 3 + i),
    ]),
  );
});

// ── The shared records ──────────────────────────────────────────

describe("shared/condition-hub-intros records", () => {
  it("covers exactly the wave-3 and wave-4 hubs; lookup is case-insensitive", () => {
    expect(Object.keys(CONDITION_HUB_INTROS).sort()).toEqual([...SLUGS].sort());
    for (const slug of SLUGS) {
      expect(CONDITION_HUB_INTROS[slug].slug).toBe(slug);
      expect(getConditionHubIntro(slug.toUpperCase())).toBe(CONDITION_HUB_INTROS[slug]);
    }
    expect(getConditionHubIntro("type-2-diabetes")).toBeNull();
    expect(getConditionHubIntro("")).toBeNull();
    expect(getConditionHubIntro(undefined)).toBeNull();
  });

  it.each(SLUGS)("%s: meta title ≤ 60 incl. suffix, description 140–160", (slug) => {
    const r = CONDITION_HUB_INTROS[slug];
    expect(r.metaTitle.length).toBeLessThanOrEqual(60);
    expect(r.metaTitle.endsWith(" | Hydrogen Studies")).toBe(true);
    expect(r.metaDescription.length).toBeGreaterThanOrEqual(140);
    expect(r.metaDescription.length).toBeLessThanOrEqual(160);
    expect(r.h1.trim().length).toBeGreaterThan(0);
  });

  it.each(SLUGS)("%s: no placeholder or generic 'treat' copy anywhere in the record", (slug) => {
    for (const s of allStrings(CONDITION_HUB_INTROS[slug])) {
      expect(isPlaceholder(s), JSON.stringify(s).slice(0, 80)).toBe(false);
      expect(s).not.toMatch(/__[a-z_]+__|\bundefined\b|\bN\/A\b/);
      expect(s).not.toMatch(/may benefit and treat/i);
    }
  });

  it.each(SLUGS)("%s: intro has no H1 ('# ') — the page owns the only H1", (slug) => {
    expect(CONDITION_HUB_INTROS[slug].introMarkdown).not.toMatch(/^# /m);
  });

  it.each(SLUGS)("%s: sources numbered 1..N, every [n] ref resolves, each has PubMed or DOI", (slug) => {
    const r = CONDITION_HUB_INTROS[slug];
    expect(r.sources.map((s) => s.n)).toEqual(r.sources.map((_, i) => i + 1));
    const refs = [...r.introMarkdown.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
    for (const n of refs) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(r.sources.length);
    }
    for (const s of r.sources) {
      expect(s.citation.length).toBeGreaterThan(20);
      expect(Boolean(s.pmid) || Boolean(s.doi), `source ${s.n}`).toBe(true);
      if (s.pmid) expect(s.pmid).toMatch(/^\d+$/);
      // Permanent study URLs (PMID/DOI-derived slug + id suffix), never regenerated.
      if (s.ourStudyPath) expect(s.ourStudyPath).toMatch(/^\/study\/[a-z0-9-]+-\d{10,}$/);
    }
  });

  it.each(SLUGS)("%s: no product/sponsor bridge (bridgeTopic null)", (slug) => {
    const r = CONDITION_HUB_INTROS[slug];
    expect(r.bridgeTopic).toBeNull();
    expect(isBridgeAllowed(r.bridgeTopic)).toBe(false);
    expect(allStrings(r).join(" ")).not.toMatch(/echowater\.com/i);
  });

  it("disease hubs are refused by the bridge policy even by slug", () => {
    expect(isBridgeAllowed("kidney-health")).toBe(false);
    expect(isBridgeAllowed("chronic-fatigue")).toBe(false);
  });

  it.each(SLUGS)("%s: owner link and internal study links are site-relative", (slug) => {
    const r = CONDITION_HUB_INTROS[slug];
    expect(r.ownerLink.href).toMatch(/^\/(blog|hydrogen-for|explore-by-condition)\//);
    expect(r.ownerLink.label.length).toBeGreaterThan(0);
    for (const m of r.introMarkdown.matchAll(/\]\(([^)]+)\)/g)) {
      expect(m[1], m[1]).toMatch(/^(\/[a-z0-9/#-]+|https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/)$/);
    }
  });

  it("byline: editorial team + 'Updated <lastReviewed>' — never 'Last reviewed' (no named reviewer)", () => {
    for (const r of intros) {
      expect(r.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const by = conditionHubByline(r);
      expect(by.author).toBe(EDITORIAL_TEAM);
      expect(by.authorIsPerson).toBe(false);
      expect(by.reviewer).toBeNull();
      expect(by.dateLabel).toBe("Updated");
      expect(by.date?.toISOString().slice(0, 10)).toBe(r.lastReviewed);
    }
    expect(conditionHubByline({ lastReviewed: "2026-09-29" }).dateText).toBe("September 29, 2026");
  });

  it("source links: PubMed when there is a PMID, else DOI; plus our summary when we have the study", () => {
    const base = { n: 1, citation: "A B, et al. Title. J. 2020;1:1." };
    expect(conditionHubSourceLinks({ ...base, pmid: "123", doi: "10.1/x", ourStudyPath: "/study/x-1775650467159" })).toEqual([
      { href: "https://pubmed.ncbi.nlm.nih.gov/123/", label: "PubMed", external: true },
      { href: "/study/x-1775650467159", label: "Our summary", external: false },
    ]);
    expect(conditionHubSourceLinks({ ...base, pmid: null, doi: "https://doi.org/10.1/x", ourStudyPath: null })).toEqual([
      { href: "https://doi.org/10.1/x", label: "DOI", external: true },
    ]);
    expect(conditionHubSourceLinks({ ...base, pmid: null, doi: null, ourStudyPath: null })).toEqual([]);
    // kidney-health [6] has no study page on our site: PubMed only.
    const k6 = CONDITION_HUB_INTROS["kidney-health"].sources[5];
    expect(conditionHubSourceLinks(k6).map((l) => l.label)).toEqual(["PubMed"]);
  });

  it("JSON-LD: CollectionPage + FAQPage built from the same FAQ records; no reviewedBy/lastReviewed", () => {
    for (const r of intros) {
      const canonical = `${SITE}/explore-by-condition/${r.slug}`;
      const ld = conditionHubJsonLd(r, { canonical, siteUrl: SITE });
      expect(ld.map((x) => x["@type"])).toEqual(["CollectionPage", "FAQPage"]);
      expect(ld[0].name).toBe(r.h1);
      expect(ld[0].url).toBe(canonical);
      expect(ld[0].author).toMatchObject({ "@type": "Organization", name: EDITORIAL_TEAM });
      expect(ld[0].dateModified.slice(0, 10)).toBe(r.lastReviewed);
      expect(ld[1].mainEntity.map((q: any) => q.name)).toEqual(r.faqs.map((f) => f.question));
      expect(ld[1].mainEntity.map((q: any) => q.acceptedAnswer.text)).toEqual(r.faqs.map((f) => f.answer));
      const json = JSON.stringify(ld);
      expect(json).not.toContain("reviewedBy");
      expect(json).not.toContain("lastReviewed");
      expect(json).not.toContain("MedicalCondition");
    }
  });
});

// ── Crawler body ────────────────────────────────────────────────

describe("crawler body (seo-body-renderer) for hubs with an intro", () => {
  async function body(slug: string) {
    const html = await renderPageBody(`/explore-by-condition/${slug}`);
    expect(html, slug).toBeTruthy();
    return html!;
  }

  it.each(SLUGS)("%s: exactly one H1 = record.h1, then the Updated byline", async (slug) => {
    const r = CONDITION_HUB_INTROS[slug];
    const html = await body(slug);
    expect(count(html, /<h1\b/g)).toBe(1);
    expect(html).toContain(`<h1>${r.h1}</h1>\n<p class="byline">By <a href="/editorial-policy">${EDITORIAL_TEAM}</a> · Updated <time datetime="${r.lastReviewed}T00:00:00.000Z">${conditionHubByline(r).dateText}</time></p>`);
    expect(html).not.toContain("Last reviewed");
    expect(html).not.toContain("Reviewed by");
  });

  it.each(SLUGS)("%s: the old description and generic copy are gone", async (slug) => {
    const html = await body(slug);
    expect(html).not.toContain(OLD_DESCRIPTIONS[slug].description);
    expect(html).not.toContain(`Hydrogen Research for ${OLD_DESCRIPTIONS[slug].name}`);
    expect(html).not.toMatch(/research stud(y|ies) on hydrogen therapy for/);
    expect(html).not.toMatch(/may benefit and treat/i);
  });

  it.each(SLUGS)("%s: intro rendered as HTML — headings, bold, links; no raw markdown", async (slug) => {
    const r = CONDITION_HUB_INTROS[slug];
    const html = await body(slug);
    const intro = html.slice(html.indexOf('<div class="hub-intro">'), html.indexOf('<section aria-labelledby="faq">'));
    expect(intro).toContain("<strong>");
    expect(intro).toContain("<em>");
    expect(count(intro, /<h2 id="[a-z0-9-]+">/g)).toBe(count(r.introMarkdown, /^## /gm));
    expect(intro).not.toMatch(/\*\*|\]\(\/|^## /m);
    // Every markdown link became an <a> with the same href.
    const mdLinks = [...r.introMarkdown.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
    const htmlLinks = [...intro.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
    expect(htmlLinks).toEqual(mdLinks);
    expect(intro).toContain('<a href="/editorial-policy">editorial policy</a>');
  });

  it("inline citations: [[n]](/study/…) is a link labelled [n]; bare [n] stays text", async () => {
    const html = await body("skin-aging");
    const r = CONDITION_HUB_INTROS["skin-aging"];
    expect(html).toContain(`<a href="${r.sources[0].ourStudyPath}">[1]</a>`);
    expect(html).toContain("0.2 to 0.4 ppm, daily, for one to six months [2][3].");
  });

  it.each(SLUGS)("%s: visible FAQ (H2 + H3 per question) backs the FAQPage", async (slug) => {
    const r = CONDITION_HUB_INTROS[slug];
    const html = await body(slug);
    const start = html.indexOf(`<h2 id="faq">${CONDITION_HUB_FAQ_HEADING}</h2>`);
    expect(start).toBeGreaterThan(-1);
    const faq = html.slice(start, html.indexOf("</section>", start));
    const h3s = [...faq.matchAll(/<h3>([^<]+)<\/h3>/g)].map((m) => m[1]);
    expect(h3s).toEqual(r.faqs.map((f) => f.question.replace(/"/g, "&quot;")));
    for (const f of r.faqs) expect(faq).toContain(`<p>${f.answer.replace(/"/g, "&quot;")}</p>`);
    expect(faqPairsIfVisible(r.faqs, html)).toEqual(r.faqs);
  });

  it.each(SLUGS)("%s: numbered Sources list with PubMed / DOI / our-summary links", async (slug) => {
    const r = CONDITION_HUB_INTROS[slug];
    const html = await body(slug);
    const start = html.indexOf(`<h2 id="sources">${CONDITION_HUB_SOURCES_HEADING}</h2>`);
    expect(start).toBeGreaterThan(-1);
    const sources = html.slice(start, html.indexOf("</ol>", start));
    expect(count(sources, /<li id="source-\d+">/g)).toBe(r.sources.length);
    for (const s of r.sources) {
      expect(sources).toContain(`<li id="source-${s.n}">`);
      if (s.pmid) expect(sources).toContain(`<a href="https://pubmed.ncbi.nlm.nih.gov/${s.pmid}/" target="_blank" rel="noopener noreferrer">PubMed</a>`);
      if (s.ourStudyPath) expect(sources).toContain(`<a href="${s.ourStudyPath}">Our summary</a>`);
    }
  });

  it.each(SLUGS)("%s: order is intro → FAQ → sources → study list → owner guide", async (slug) => {
    const r = CONDITION_HUB_INTROS[slug];
    const html = await body(slug);
    const at = (needle: string) => {
      const i = html.indexOf(needle);
      expect(i, needle).toBeGreaterThan(-1);
      return i;
    };
    const order = [
      at(`<h1>`),
      at(`<div class="hub-intro">`),
      at(`<h2 id="faq">`),
      at(`<h2 id="sources">`),
      at(`<h2>${CONDITION_HUB_STUDIES_HEADING}</h2>`),
      at(`<strong>${CONDITION_HUB_OWNER_GUIDE_LEAD}</strong> <a href="${r.ownerLink.href}">`),
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it.each(SLUGS)("%s: lists the shared query's studies with a count", async (slug) => {
    const name = OLD_DESCRIPTIONS[slug].name;
    const html = await body(slug);
    const start = html.indexOf(`<h2>${CONDITION_HUB_STUDIES_HEADING}</h2>`);
    const section = html.slice(start, html.indexOf("</section>", start));
    const expected = state.conditionStudies[name];
    expect(section).toContain(`<p>${expected.length} studies in our database.</p>`);
    expect([...section.matchAll(/<a href="\/study\/([^"]+)">/g)].map((m) => m[1])).toEqual(expected.map((s) => s.slug));
  });

  it.each(SLUGS)("%s: no product/sponsor content — the only echowater link is the footer disclosure", async (slug) => {
    const html = await body(slug);
    const main = html.slice(0, html.indexOf("<footer"));
    expect(main).not.toMatch(/echowater\.com/i);
    expect(main).not.toMatch(/aria-label="Sponsor"|rel="sponsored/);
    expect(count(html, /rel="sponsored/g)).toBe(1);
  });

  it.each(SLUGS)("%s: no placeholder text reaches the HTML", async (slug) => {
    const html = await body(slug);
    expect(html).not.toMatch(/__no_content__|__[a-z_]+__|>\s*(undefined|null|N\/A)\s*</);
  });

  it("the intro HTML demotes a stray '# ' heading (one H1 even if the copy regresses)", () => {
    const r: ConditionHubIntro = { ...CONDITION_HUB_INTROS["skin-aging"], introMarkdown: "# Stray title\n\nBody." };
    const html = renderConditionHubIntroHtml(r);
    expect(count(html, /<h1\b/g)).toBe(1);
    expect(html).toContain('<div class="hub-intro"><h2>Stray title</h2>');
  });

  it("a hub without a record keeps its current rendering", async () => {
    const html = (await renderPageBody("/explore-by-condition/type-2-diabetes"))!;
    expect(html).toContain("<h1>Hydrogen Research for Type 2 Diabetes</h1>");
    expect(html).toContain("<p>A metabolic disorder. Hydrogen water may improve insulin sensitivity.</p>");
    expect(html).toContain(`<p>${state.conditionStudies["Type 2 Diabetes"].length} research studies on hydrogen therapy for type 2 diabetes.</p>`);
    expect(html).not.toContain('class="byline"');
    expect(html).not.toContain(CONDITION_HUB_FAQ_HEADING);
    expect(html).not.toContain('<h2 id="sources">');
  });
});

// ── Crawler <head> ──────────────────────────────────────────────

describe("crawler meta (seo-bot-middleware) for hubs with an intro", () => {
  it.each(SLUGS)("%s: title/description from the record, canonical self, CollectionPage + FAQPage", (slug) => {
    const r = CONDITION_HUB_INTROS[slug];
    const meta = resolveStaticPageMeta(`/explore-by-condition/${slug}`)!;
    expect(meta.title).toBe(r.metaTitle);
    expect(meta.description).toBe(r.metaDescription);
    expect(meta.canonical).toBe(`${SITE}/explore-by-condition/${slug}`);
    expect(meta.robots).toBeUndefined();
    const ld = meta.jsonLd as any[];
    expect(ld).toEqual(conditionHubJsonLd(r, { canonical: meta.canonical, siteUrl: SITE }));
  });

  it("a hub without a record keeps the generic meta and no FAQPage", () => {
    const meta = resolveStaticPageMeta("/explore-by-condition/type-2-diabetes")!;
    expect(meta.title).toBe("Hydrogen Research for Type 2 Diabetes | Hydrogen Studies");
    expect(meta.jsonLd).toBeUndefined();
  });

  it.each(SLUGS)("%s: full Googlebot response — head + body agree, FAQPage only with the visible FAQ", async (slug) => {
    const r = CONDITION_HUB_INTROS[slug];
    const app = express();
    app.use(seoBotMiddleware(staticDir));
    const res = await request(app).get(`/explore-by-condition/${slug}`).set("User-Agent", GOOGLEBOT);
    expect(res.status).toBe(200);
    const html = res.text;
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    expect(html).toContain(`<title>${esc(r.metaTitle)}</title>`);
    expect(html).toContain(`<meta name="description" content="${esc(r.metaDescription)}" />`);
    expect(html).toContain(`<meta property="og:description" content="${esc(r.metaDescription)}" />`);
    expect(html).toContain(`<meta name="twitter:title" content="${esc(r.metaTitle)}" />`);
    expect(html).toContain(`<link rel="canonical" href="${SITE}/explore-by-condition/${slug}" />`);
    expect(html).not.toMatch(/may benefit and treat/i);
    const types = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((m) => JSON.parse(m[1])["@type"]);
    expect(types).toEqual(["CollectionPage", "FAQPage"]);
    expect(count(html, /<h1\b/g)).toBe(1);
    // Every FAQPage question is on the page.
    expect(faqPairsIfVisible(r.faqs, html.slice(html.indexOf("<body")))).toEqual(r.faqs);
    expect(text(html)).toContain(text(`<h1>${r.h1}</h1>`));
  });
});
