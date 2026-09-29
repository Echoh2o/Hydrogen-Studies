/**
 * Re-audit 2026-09-28 (live crawl) fixes — crawler side + shared helpers.
 *
 *  #3 mechanism hubs: bot + SPA share title/H1/canonical/study list
 *  #4 life-stage canonical = sitemap URL (/explore-by-life-stage/<slug>)
 *  #5 study pages link a condition/body system only when a real hub exists;
 *     /explore-by-body-system lists the canonical hubs; no "System System"
 *  #7 /hydrogen-therapy-guide (a 301) is not in sitemap-pages
 *  #8 an editorial-team author is schema Organization, never Person
 *  #9 excerpts: no "No abstract available", no literal &lt;b&gt;
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { PgDialect } from "drizzle-orm/pg-core";

const state = vi.hoisted(() => ({
  studyRow: null as any,
  conditionHubs: [] as { name: string; slug: string }[],
  exploreStudies: [] as any[],
  /** LIKE patterns whose body-system hub has no study (→ hub 404s). */
  emptyHubPatterns: [] as string[],
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
        if (/FROM health_conditions/i.test(sql)) return { rows: state.conditionHubs };
        // A condition hub exists when its page lists ≥1 study (the shared
        // condition-hub query, counted) — every hub row here has studies.
        if (/count\(\*\)/i.test(sql) && /FROM studies/i.test(sql) && /health_conditions/i.test(sql)) {
          return { rows: [{ n: 1 }] };
        }
        if (/SELECT 1 FROM studies/i.test(sql) && /body_systems/i.test(sql)) {
          return { rows: params.some((p) => state.emptyHubPatterns.includes(p as string)) ? [] : [{ "?column?": 1 }] };
        }
        if (/FROM studies WHERE slug = \$1/i.test(sql)) return { rows: state.studyRow ? [state.studyRow] : [] };
        if (/h2_delivery_method/i.test(sql)) return { rows: state.exploreStudies };
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
  BODY_SYSTEM_HUBS,
  LIFE_STAGE_HUB_SLUGS,
  bodySystemHubForValue,
  bodySystemHubName,
  conditionHubForValue,
  exploreDetailCopy,
  exploreHubPath,
  mechanismHubMeta,
} from "../../shared/explore-hubs";
import {
  abstractExcerpt,
  blogArticleJsonLd,
  blogByline,
  isOrganizationAuthorName,
  plainText,
  stripTags,
} from "../../shared/seo-markup";
import { renderPageBody, __resetConditionHubsForTests } from "../middleware/seo-body-renderer";
import { buildBlogMeta, resolveStaticPageMeta } from "../middleware/seo-bot-middleware";
import seoRoutes from "../routes/seo-routes";
import hydrogenRoutes from "../routes/hydrogen-routes";

const SITE = "https://hydrogenstudies.com";

function study(overrides: Record<string, any> = {}) {
  return {
    id: 42,
    title: "Hydrogen water and glucose control",
    plain_language_title: null,
    slug: "hydrogen-water-glucose-1775650467100",
    authors: "A. Author",
    journal: "J Test",
    publish_year: 2024,
    doi: "10.1000/test",
    pmid: "12345678",
    url: null,
    study_type: "human",
    outcome: "Positive",
    peer_reviewed: true,
    country: null,
    category: null,
    health_conditions: ["Type 2 Diabetes"],
    body_systems: ["Central Nervous System"],
    tldr: null,
    key_finding: null,
    plain_summary: "Our summary.",
    summary_100_words: null,
    summary_50_words: null,
    practical_takeaway: null,
    how_to_apply: null,
    abstract: "Background: a real abstract.",
    last_modified: "2026-09-01T00:00:00Z",
    created_at: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  __resetConditionHubsForTests();
  state.conditionHubs = [
    { name: "Type 2 Diabetes", slug: "type-2-diabetes" },
    { name: "Oxidative Stress", slug: "oxidative-stress" },
  ];
  state.studyRow = study();
  state.exploreStudies = [];
  state.emptyHubPatterns = [];
});

// ── #5 shared link predicates ───────────────────────────────────

describe("hub link predicates (shared/explore-hubs)", () => {
  it("maps body-system values to the canonical hub whose page lists them", () => {
    expect(bodySystemHubForValue("Central Nervous System")?.slug).toBe("brain-nervous-system");
    expect(bodySystemHubForValue("Cardiovascular System")?.slug).toBe("cardiovascular");
    expect(bodySystemHubForValue("Integumentary System")?.slug).toBe("skin-dermatology");
    expect(bodySystemHubForValue("Immune System")?.slug).toBe("immune-system");
    expect(bodySystemHubForValue("Visual System")?.slug).toBe("eyes-vision");
  });

  it("has no hub for long-tail values that 404ed in the crawl", () => {
    for (const v of ["Acid-Base Balance", "B-Cell Compartment", "Renin-Angiotensin System",
      "Not Applicable (Non-Clinical Study)", "Sleep-Wake Cycle", "T-Cell Compartment", "", null]) {
      expect(bodySystemHubForValue(v as any), String(v)).toBeUndefined();
    }
  });

  it("links a condition only when a health_conditions hub exists (slug or name)", () => {
    const hubs = [{ name: "Type 2 Diabetes", slug: "type-2-diabetes" }, { name: "Fatty Liver (NAFLD)", slug: "fatty-liver-nafld" }];
    expect(conditionHubForValue("Type 2 Diabetes", hubs)?.slug).toBe("type-2-diabetes");
    expect(conditionHubForValue("type 2 diabetes", hubs)?.slug).toBe("type-2-diabetes");
    expect(conditionHubForValue("Fatty Liver (NAFLD)", hubs)?.slug).toBe("fatty-liver-nafld");
    expect(conditionHubForValue("Cardiovascular Disease", hubs)).toBeUndefined();
    expect(conditionHubForValue("Cancer", hubs)).toBeUndefined();
    expect(conditionHubForValue("", hubs)).toBeUndefined();
  });

  it("body-system hub names end in 'System' exactly once", () => {
    expect(bodySystemHubName("immune-system")).toBe("Immune System");
    expect(bodySystemHubName("brain-nervous-system")).toBe("Brain & Nervous System");
    expect(bodySystemHubName("cardiovascular")).toBe("Cardiovascular System");
    expect(bodySystemHubName("cardiovascular-system")).toBe("Cardiovascular System");
    for (const h of BODY_SYSTEM_HUBS) expect(bodySystemHubName(h.slug)).not.toMatch(/system system/i);
  });
});

// ── #5 crawler output ───────────────────────────────────────────

describe("study page hub links (bot renderer)", () => {
  const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

  it("links a condition and body system that have hubs, to the canonical hub URLs", async () => {
    const body = (await renderPageBody(`/study/${state.studyRow.slug}`))!;
    expect(body).toContain('<a href="/explore-by-condition/type-2-diabetes">Type 2 Diabetes</a>');
    expect(body).toContain('<a href="/explore-by-body-system/brain-nervous-system">Central Nervous System</a>');
    // breadcrumb carries the condition hub too
    expect(body).toMatch(/<nav aria-label="Breadcrumb">.*href="\/explore-by-condition\/type-2-diabetes"/);
  });

  it("renders long-tail values as plain text — no link to a URL without a hub", async () => {
    state.studyRow = study({
      health_conditions: ["Cardiovascular Disease"],
      body_systems: ["Acid-Base Balance"],
    });
    const body = (await renderPageBody(`/study/${state.studyRow.slug}`))!;
    expect(body).toContain("<dt>Health Condition</dt><dd>Cardiovascular Disease</dd>");
    expect(body).toContain("<dt>Body System</dt><dd>Acid-Base Balance</dd>");
    for (const h of hrefs(body)) {
      expect(h).not.toBe("/explore-by-condition/cardiovascular-disease");
      expect(h).not.toBe("/explore-by-body-system/acid-base-balance");
    }
  });

  it("renders the condition as plain text when it has no hub row", async () => {
    state.conditionHubs = [];
    const body = (await renderPageBody(`/study/${state.studyRow.slug}`))!;
    expect(body).toContain("<dt>Health Condition</dt><dd>Type 2 Diabetes</dd>");
    const crumbs = body.slice(0, body.indexOf("</nav>"));
    expect(crumbs).not.toContain("/explore-by-condition/");
  });
});

describe("/explore-by-body-system index + hub titles (bot)", () => {
  const indexHubLinks = (body: string) => {
    const list = body.slice(body.indexOf("<h1>"), body.indexOf("More Ways to Browse"));
    return [...list.matchAll(/href="\/explore-by-body-system\/([a-z0-9-]+)"/g)].map((m) => m[1]);
  };

  it("lists exactly the canonical hubs (the sitemap list)", async () => {
    const body = (await renderPageBody("/explore-by-body-system"))!;
    expect(indexHubLinks(body)).toEqual(BODY_SYSTEM_HUBS.map((h) => h.slug));
  });

  it("omits a canonical hub that has no studies (it would 404)", async () => {
    state.emptyHubPatterns = ["%liver%"];
    const body = (await renderPageBody("/explore-by-body-system"))!;
    expect(indexHubLinks(body)).toEqual(BODY_SYSTEM_HUBS.map((h) => h.slug).filter((s) => s !== "liver"));
  });

  it("titles and descriptions never say 'System System'", () => {
    expect(resolveStaticPageMeta("/explore-by-body-system/brain-nervous-system")!.title)
      .toBe("Hydrogen Research: Brain & Nervous System | Hydrogen Studies");
    expect(resolveStaticPageMeta("/explore-by-body-system/immune-system")!.title)
      .toBe("Hydrogen Research: Immune System | Hydrogen Studies");
    expect(resolveStaticPageMeta("/explore-by-body-system/cardiovascular")!.title)
      .toBe("Hydrogen Research: Cardiovascular System | Hydrogen Studies");
    for (const h of BODY_SYSTEM_HUBS) {
      const meta = resolveStaticPageMeta(`/explore-by-body-system/${h.slug}`)!;
      expect(meta.title).not.toMatch(/system system/i);
      expect(meta.description).not.toMatch(/system system/i);
    }
  });
});

// ── #3 mechanism hubs ───────────────────────────────────────────

describe("mechanism hubs — bot and SPA share copy + data", () => {
  const rows = [
    { slug: "h2-water-trial-1", title: "Hydrogen water trial", publish_year: 2025, journal: "J A" },
    { slug: "h2-water-trial-2", title: "Hydrogen water in rats", publish_year: null, journal: null },
  ];

  it("bot meta uses the shared title/description/canonical", () => {
    const meta = resolveStaticPageMeta("/explore-by-mechanism/hydrogen-water")!;
    const shared = mechanismHubMeta("hydrogen-water");
    expect(meta.title).toBe(shared.title);
    expect(meta.description).toBe(shared.description);
    expect(meta.canonical).toBe(`${SITE}/explore-by-mechanism/hydrogen-water`);
    expect(shared.title).toBe("Hydrogen Water Hydrogen Therapy Research | Hydrogen Studies");
  });

  it("bot body uses the shared H1/intro and lists the shared query's studies", async () => {
    state.exploreStudies = rows;
    const body = (await renderPageBody("/explore-by-mechanism/hydrogen-water"))!;
    const { h1, intro } = exploreDetailCopy("hydrogen-water");
    expect(body).toContain(`<h1>${h1}</h1>`);
    expect(body).toContain(`<p>${intro}</p>`);
    expect(body).toContain('<a href="/study/h2-water-trial-1">Hydrogen water trial</a> (2025)');
    expect(body).toContain('<a href="/study/h2-water-trial-2">Hydrogen water in rats</a></li>');
  });

  it("GET /api/explore/mechanism/:slug/studies returns the same list the bot renders", async () => {
    state.exploreStudies = rows;
    const app = express();
    app.use(hydrogenRoutes);
    const res = await request(app).get("/api/explore/mechanism/hydrogen-water/studies");
    expect(res.status).toBe(200);
    expect(res.body.studies).toEqual(rows);
  });

  it("the API rejects unknown hub types and malformed slugs", async () => {
    const app = express();
    app.use(hydrogenRoutes);
    expect((await request(app).get("/api/explore/nope/hydrogen-water/studies")).status).toBe(404);
    expect((await request(app).get("/api/explore/mechanism/Bad%20Slug/studies")).status).toBe(404);
  });
});

// ── #4 life-stage canonical ─────────────────────────────────────

describe("life-stage hubs: sitemap URL = canonical", () => {
  it("sitemap-explore advertises /explore-by-life-stage/<slug> and the bot canonical matches", async () => {
    const app = express();
    app.use(seoRoutes);
    const res = await request(app).get("/sitemap-explore.xml");
    expect(res.status).toBe(200);
    for (const slug of LIFE_STAGE_HUB_SLUGS) {
      const url = `${SITE}${exploreHubPath("life-stage", slug)}`;
      expect(url).toBe(`${SITE}/explore-by-life-stage/${slug}`);
      expect(res.text).toContain(`<loc>${url}</loc>`);
      expect(resolveStaticPageMeta(`/explore-by-life-stage/${slug}`)!.canonical).toBe(url);
    }
    expect(res.text).not.toContain("/life-stage/");
  });
});

// ── #7 sitemap-pages ────────────────────────────────────────────

describe("sitemap-pages.xml", () => {
  it("does not list /hydrogen-therapy-guide (it 301s)", async () => {
    const app = express();
    app.use(seoRoutes);
    const res = await request(app).get("/sitemap-pages.xml");
    expect(res.status).toBe(200);
    expect(res.text).not.toContain("/hydrogen-therapy-guide");
    expect(res.text).toContain(`<loc>${SITE}/research-analytics</loc>`);
  });
});

// ── #8 Article author typing ────────────────────────────────────

describe("Article JSON-LD author type", () => {
  const opts = { canonical: `${SITE}/blog/h2-tabs-side-effects`, siteUrl: SITE, description: "d" };

  it("types the stored editorial-team author as Organization (h2-tabs-side-effects)", () => {
    const ld = blogArticleJsonLd(
      { title: "Hydrogen Tablets", authorName: "Hydrogen Studies Editorial Team", updatedAt: "2026-09-23" },
      opts,
    );
    expect(ld.author["@type"]).toBe("Organization");
    expect(ld.author.name).toBe("Hydrogen Studies Editorial Team");
    expect(blogByline({ authorName: "Hydrogen Studies Editorial Team" }).authorIsPerson).toBe(false);
  });

  it("bot meta (buildBlogMeta) agrees", () => {
    const meta = buildBlogMeta({
      title: "Hydrogen Tablets: Side Effects",
      slug: "h2-tabs-side-effects",
      summary: "Summary text.",
      authorName: "Hydrogen Studies Editorial Team",
      updatedAt: "2026-09-23",
    });
    expect((meta.jsonLd as any).author["@type"]).toBe("Organization");
  });

  it("keeps Person for a named human author", () => {
    const ld = blogArticleJsonLd({ title: "T", authorName: "Jane Smith, PhD" }, opts);
    expect(ld.author).toEqual({ "@type": "Person", name: "Jane Smith, PhD" });
  });

  it("recognizes team/staff names", () => {
    expect(isOrganizationAuthorName("Hydrogen Studies Editorial Team")).toBe(true);
    expect(isOrganizationAuthorName("hydrogen studies editorial team")).toBe(true);
    expect(isOrganizationAuthorName("Hydrogen Studies Staff")).toBe(true);
    expect(isOrganizationAuthorName("Research Team")).toBe(true);
    expect(isOrganizationAuthorName("Jane Smith")).toBe(false);
    expect(isOrganizationAuthorName("")).toBe(false);
  });
});

// ── #9 excerpt hygiene ──────────────────────────────────────────

describe("abstract excerpt hygiene", () => {
  it.each([
    "No abstract available",
    "No abstract available.",
    "[No abstract available]",
    "Abstract not available",
    "<p>No abstract available</p>",
  ])("omits the excerpt for the placeholder %j", (abs) => {
    expect(abstractExcerpt(abs)).toBe("");
  });

  it("decodes entity-escaped markup instead of showing literal &lt;b&gt;", () => {
    const abs = "&lt;b&gt;&lt;i&gt;Background:&lt;/i&gt;&lt;/b&gt; Hydrogen-oxygen mixture (H&lt;sub&gt;2&lt;/sub&gt;/O&lt;sub&gt;2&lt;/sub&gt;) was studied.";
    const out = abstractExcerpt(abs);
    expect(out).toBe("Background: Hydrogen-oxygen mixture (H2/O2) was studied.");
    expect(out).not.toMatch(/&lt;|&gt;|<|>/);
  });

  it("decodes double-escaped markup too, and stays ≤300 chars", () => {
    const abs = "&amp;lt;b&amp;gt;Background:&amp;lt;/b&amp;gt; " + "word ".repeat(120);
    const out = abstractExcerpt(abs);
    expect(out.startsWith("Background: word")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(300);
    expect(out).not.toMatch(/&lt;|&amp;|<b>/);
  });

  it("keeps comparison operators in the text", () => {
    expect(plainText("p &lt; 0.05 and n &gt; 10")).toBe("p < 0.05 and n > 10");
    expect(stripTags("p < 0.05 and n > 10")).toBe("p < 0.05 and n > 10");
  });

  it("bot study page: no placeholder excerpt, section keeps only the source link", async () => {
    state.studyRow = study({ abstract: "No abstract available" });
    const body = (await renderPageBody(`/study/${state.studyRow.slug}`))!;
    expect(body).not.toMatch(/No abstract available/i);
    expect(body).toContain("https://pubmed.ncbi.nlm.nih.gov/12345678/");
  });

  it("bot study page: escaped markup renders as clean text", async () => {
    state.studyRow = study({ abstract: "&lt;b&gt;&lt;i&gt;Background:&lt;/i&gt;&lt;/b&gt; The present study aimed at investigating." });
    const body = (await renderPageBody(`/study/${state.studyRow.slug}`))!;
    expect(body).toContain("<p>Background: The present study aimed at investigating.</p>");
    expect(body).not.toContain("&amp;lt;");
  });
});
