/**
 * Bot body renderer — markup compliance (PR A, audit 2026-09-23).
 *
 * db.execute is mocked; each query's SQL is rendered with PgDialect so the
 * tests can assert on the real SQL text (e.g. no `category` column, every
 * blog listing requires is_published AND NOT is_archived) and answer with
 * fixture rows.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const dialect = new PgDialect();

type Handler = (sqlText: string, params: unknown[]) => any[] | Promise<any[]>;
const state = vi.hoisted(() => ({
  handler: null as null | ((sqlText: string, params: unknown[]) => any[] | Promise<any[]>),
  queries: [] as string[],
}));

vi.mock("../db", () => ({
  db: {
    execute: async (query: any) => {
      const { sql: text, params } = dialect.sqlToQuery(query);
      const normalized = text.replace(/\s+/g, " ").trim();
      state.queries.push(normalized);
      const rows = state.handler ? await state.handler(normalized, params) : [];
      return { rows };
    },
  },
  pool: { query: () => new Promise(() => {}) },
}));

// Live blog index: only "live-post" (and id 7) are live.
vi.mock("../services/live-blog-index", () => ({
  getLiveBlogPredicate: async () => (ref: string) => ref === "live-post" || ref === "7",
  invalidateLiveBlogIndex: () => {},
}));

import {
  renderPageBody,
  renderBlogList,
  renderStudy,
} from "../middleware/seo-body-renderer";

const CONDITIONS = [{ name: "Diabetes", slug: "diabetes" }, { name: "Fatigue", slug: "fatigue" }];

const LONG_ABSTRACT =
  "Background: Molecular hydrogen has been proposed as a selective antioxidant. " +
  "Methods: In this randomized, double-blind, placebo-controlled trial, 120 healthy adults consumed 1.5 L/day of hydrogen-rich water or placebo water for 8 weeks. " +
  "Results: Hydrogen-rich water reduced urinary 8-OHdG by 14% and serum MDA by 9% compared with placebo, with no adverse events. " +
  "Conclusions: Daily intake of hydrogen-rich water may reduce oxidative stress biomarkers in healthy adults; UNIQUE-TAIL-MARKER.";

function baseHandler(extra: Handler): Handler {
  return (text, params) => {
    if (/FROM health_conditions/i.test(text) && /LIMIT 20/.test(text)) return CONDITIONS;
    return extra(text, params);
  };
}

beforeEach(() => {
  state.queries = [];
  state.handler = baseHandler(() => []);
});

const UTM = (campaign: string, content: string) =>
  `utm_source=hydrogenstudies&amp;utm_medium=referral&amp;utm_campaign=${campaign}&amp;utm_content=${content}`;

describe("#5 bot /blog index", () => {
  it("does not select the nonexistent category column and only lists live posts", async () => {
    state.handler = baseHandler((text) => {
      if (/FROM blog_articles/.test(text)) {
        // Emulate Postgres: selecting a column that doesn't exist throws.
        if (/\bcategory\b/.test(text)) throw new Error('column "category" does not exist');
        return [
          { slug: "live-post", title: "Live Post", created_at: "2026-09-01T00:00:00Z" },
          { slug: "second-post", title: "Second Post", created_at: "2026-08-01T00:00:00Z" },
        ];
      }
      return [];
    });

    const html = await renderBlogList();
    expect(html).toContain("<h1>Hydrogen Health Blog</h1>");
    expect(html).toContain('<a href="/blog/live-post">Live Post</a>');
    expect(html).toContain('<a href="/blog/second-post">Second Post</a>');

    const listQuery = state.queries.find((q) => /FROM blog_articles/.test(q))!;
    expect(listQuery).not.toMatch(/\bcategory\b/);
    expect(listQuery).toMatch(/is_published = true/);
    expect(listQuery).toMatch(/is_archived = false/);
  });

  it("renders a non-empty page for /blog through the dispatcher", async () => {
    state.handler = baseHandler((text) =>
      /FROM blog_articles/.test(text) ? [{ slug: "live-post", title: "Live Post", created_at: null }] : [],
    );
    const html = await renderPageBody("/blog");
    expect(html).toBeTruthy();
    expect(html).toContain("Live Post");
  });
});

describe("#2/#3/#12 bot study page", () => {
  const STUDY = {
    id: 11,
    title: "Hydrogen-rich water and oxidative stress in healthy adults",
    plain_language_title: null,
    slug: "h2-oxidative-stress",
    authors: "A. One, B. Two",
    journal: "J Test",
    publish_year: 2024,
    doi: "10.1000/test",
    pmid: "38000001",
    url: null,
    study_type: "RCT",
    outcome: "Positive",
    peer_reviewed: true,
    country: "N/A",
    category: "Oxidative Stress",
    health_conditions: ["Oxidative Stress"],
    body_systems: [],
    tldr: "Hydrogen water lowered oxidative stress markers.",
    key_finding: "__no_content__",
    plain_summary: "__no_content__",
    summary_100_words: "Our own 100-word summary of the study.",
    summary_50_words: null,
    practical_takeaway: "",
    how_to_apply: "   ",
    abstract: LONG_ABSTRACT,
    last_modified: "2026-09-10T12:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
  };

  beforeEach(() => {
    state.handler = baseHandler((text) => (/FROM studies WHERE slug/.test(text) ? [STUDY] : []));
  });

  it("never renders placeholder or empty fields", async () => {
    const html = (await renderStudy("h2-oxidative-stress"))!;
    expect(html).not.toContain("__no_content__");
    expect(html).not.toContain("Key Finding");
    expect(html).not.toContain("Practical Takeaway");
    expect(html).not.toContain("How to Apply");
    expect(html).not.toContain("<dt>Country</dt>");
    // falls back to the real summary instead of the sentinel plain_summary
    expect(html).toContain("Our own 100-word summary of the study.");
    expect(html).toContain("<h2>TL;DR</h2>");
  });

  it("shows a ≤300-char abstract excerpt plus a PubMed link — never the full abstract", async () => {
    const html = (await renderStudy("h2-oxidative-stress"))!;
    expect(html).not.toContain("UNIQUE-TAIL-MARKER");
    const section = html.match(/<section><h2>Abstract \(excerpt\)<\/h2><p>([^<]*)<\/p>/);
    expect(section).not.toBeNull();
    const excerpt = section![1].replace(/&amp;/g, "&");
    expect(excerpt.length).toBeLessThanOrEqual(300);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(html).toContain(
      '<a href="https://pubmed.ncbi.nlm.nih.gov/38000001/" rel="noopener">Read the full abstract on PubMed</a>',
    );
  });

  it("shows the 'Summary by … · Updated' line linking to /methodology", async () => {
    const html = (await renderStudy("h2-oxidative-stress"))!;
    expect(html).toContain(
      '<p class="byline">Summary by <a href="/methodology">Hydrogen Studies Editorial Team</a> · Updated <time datetime="2026-09-10T12:00:00.000Z">September 10, 2026</time></p>',
    );
  });

  it("related-article queries only use live blog posts", async () => {
    await renderStudy("h2-oxidative-stress");
    const blogQueries = state.queries.filter((q) => /FROM blog_articles/.test(q));
    expect(blogQueries.length).toBeGreaterThan(0);
    for (const q of blogQueries) {
      expect(q).toMatch(/is_published = true/);
      expect(q).toMatch(/is_archived = false/);
    }
  });
});

describe("#6/#9/#10/#12 bot blog page", () => {
  const BLOG = {
    id: 5,
    title: "Hydrogen Water and Sleep",
    slug: "h2-sleep",
    summary: "Summary.",
    content: [
      "# Hydrogen Water and Sleep",
      "",
      "Intro with [an old post](/blog/retired-post), [a live one](/blog/live-post) and [the Flask](https://echowater.com/products/echo-flask?utm_campaign=old).",
      "",
      "## Findings",
      "",
      "Plain **text**.",
    ].join("\n"),
    created_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-09-02T00:00:00Z",
    published_at: "2026-02-01T00:00:00Z",
    author_name: null,
    reviewer_name: null,
    // machine-stamped at generation time — must NOT show as "Last reviewed"
    last_reviewed: "2026-02-01T00:00:00Z",
  };

  beforeEach(() => {
    state.handler = baseHandler((text) => {
      if (/FROM blog_articles WHERE slug =/.test(text)) return [BLOG];
      if (/FROM blog_articles/.test(text)) return [{ slug: "live-post", title: "Live Post" }];
      return [];
    });
  });

  it("has exactly one <h1>; body H1s are demoted to <h2>", async () => {
    const html = (await renderPageBody("/blog/h2-sleep"))!;
    expect(html.match(/<h1\b/g)?.length).toBe(1);
    expect(html).toContain('<h1 itemprop="headline">Hydrogen Water and Sleep</h1>');
    expect(html).toMatch(/<h2[^>]*>Hydrogen Water and Sleep<\/h2>/);
  });

  it("unwraps links to retired posts but keeps live ones", async () => {
    const html = (await renderPageBody("/blog/h2-sleep"))!;
    expect(html).not.toContain("/blog/retired-post");
    expect(html).toContain("an old post");
    expect(html).toContain('<a href="/blog/live-post">a live one</a>');
  });

  it("tags in-body echowater links with the page's campaign/content", async () => {
    const html = (await renderPageBody("/blog/h2-sleep"))!;
    expect(html).toContain(`https://echowater.com/products/echo-flask?${UTM("blog", "h2-sleep")}`);
    expect(html).not.toContain("utm_campaign=old");
  });

  it("renders the byline directly under the H1 (editorial team + Updated date)", async () => {
    const html = (await renderPageBody("/blog/h2-sleep"))!;
    expect(html).toContain(
      '<h1 itemprop="headline">Hydrogen Water and Sleep</h1>\n<p class="byline">By <a href="/editorial-policy">Hydrogen Studies Editorial Team</a> · Updated <time datetime="2026-09-02T00:00:00.000Z">September 2, 2026</time></p>',
    );
    expect(html).not.toContain("Reviewed by");
  });

  it("shows reviewer + last reviewed only when set", async () => {
    state.handler = baseHandler((text) =>
      /FROM blog_articles WHERE slug =/.test(text)
        ? [{ ...BLOG, author_name: "Jane Roe", reviewer_name: "John Doe, PhD", last_reviewed: "2026-09-15T00:00:00Z" }]
        : [],
    );
    const html = (await renderPageBody("/blog/h2-sleep"))!;
    expect(html).toContain(
      '<p class="byline">By <a href="/editorial-policy">Jane Roe</a> · Reviewed by John Doe, PhD · Last reviewed <time datetime="2026-09-15T00:00:00.000Z">September 15, 2026</time></p>',
    );
  });

  it("related-post queries require published AND not archived", async () => {
    await renderPageBody("/blog/h2-sleep");
    const related = state.queries.filter((q) => /FROM blog_articles/.test(q) && /id !=/.test(q));
    expect(related.length).toBe(1);
    expect(related[0]).toMatch(/is_published = true AND is_archived = false/);
  });
});

describe("#4/#10 footer + /hydrogen-for bridge placement", () => {
  it("footer has no product links; the disclosure link carries this page's UTMs", async () => {
    state.handler = baseHandler((text) =>
      /FROM blog_articles/.test(text) ? [{ slug: "live-post", title: "Live Post", created_at: null }] : [],
    );
    const html = (await renderPageBody("/blog"))!;
    expect(html).not.toMatch(/echowater\.com\/products\//);
    expect(html).toContain(`<a href="https://echowater.com/?${UTM("blog", "blog")}" rel="sponsored noopener">Echo Water</a>`);
    expect(html).toContain("built and funded by Echo Technologies LLC");
  });

  it("disease page (/hydrogen-for/diabetes): no product content, visible FAQ", async () => {
    const html = (await renderPageBody("/hydrogen-for/diabetes"))!;
    expect(html).toContain("<h1>Hydrogen for Diabetes &amp; Metabolic Health</h1>");
    expect(html).not.toMatch(/echowater\.com\/products\//);
    expect(html).not.toContain("From our sponsor");
    expect(html).toContain("<h3>Can hydrogen water help manage diabetes?</h3>");
    // the only echowater link left is the footer ownership disclosure
    expect(html.match(/echowater\.com/g)?.length).toBe(1);
  });

  it("allowlisted topic (/hydrogen-for/athletic-performance): labeled sponsor card with UTMs", async () => {
    const html = (await renderPageBody("/hydrogen-for/athletic-performance"))!;
    expect(html).toContain("From our sponsor, Echo Water");
    expect(html).toContain(
      `<a href="https://echowater.com/products/echo-flask?${UTM("hydrogen-for", "athletic-performance")}" rel="sponsored noopener">`,
    );
  });

  it("unknown /hydrogen-for slug has no page", async () => {
    expect(await renderPageBody("/hydrogen-for/not-a-topic")).toBeNull();
  });
});
