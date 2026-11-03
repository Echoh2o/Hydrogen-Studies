/**
 * PLAN 3.5 — BreadcrumbList on every page with a visible trail, and the
 * page block's name is the visible H1 (CLAUDE.md: schema only for what the
 * page shows). Both sides build from shared/breadcrumbs.ts; this test proves
 * they stay in step by rendering each page type and comparing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const state = vi.hoisted(() => ({
  conditions: [] as { name: string; slug: string; study_count: number; description: string | null }[],
  conditionStudies: {} as Record<string, any[]>,
  blog: null as any,
}));

vi.mock("../db", () => {
  const dialect = new PgDialect();
  const liveConditions = () =>
    state.conditions.filter((c) => c.study_count > 0).sort((a, b) => b.study_count - a.study_count);
  // drizzle select() chains (page-meta's blog lookup) resolve to the blog row.
  function chain(): any {
    const p: any = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: any, reject: any) => Promise.resolve(state.blog ? [state.blog] : []).then(resolve, reject);
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
        const { sql, params } = dialect.sqlToQuery(q);
        if (/FROM health_conditions/i.test(sql)) {
          if (/WHERE slug = \$1/i.test(sql)) return { rows: state.conditions.filter((c) => c.slug === params[0]) };
          return { rows: /COALESCE\(study_count, 0\) > 0/i.test(sql) ? liveConditions() : state.conditions };
        }
        if (/FROM studies/i.test(sql) && /authors/i.test(sql) && /health_conditions/i.test(sql) && !/LIKE/i.test(sql)) {
          // profile index rows: one prolific author, one journal over the threshold
          return {
            rows: Array.from({ length: 12 }, (_, i) => ({
              id: 500 + i, slug: `p-${i}`, title: `Profile study ${i}`, publish_year: 2010 + i, journal: "Medical Gas Research",
              study_design: "animal", study_type: "rat", is_human_trial: false, authors: "Xue-jun Sun, Someone & Else", health_conditions: ["Type 2 Diabetes"],
            })),
          };
        }
        if (/FROM blog_articles/i.test(sql)) {
          if (/WHERE (slug|id) = \$1/i.test(sql) && state.blog) return { rows: [state.blog] };
          return { rows: [] };
        }
        if (/SELECT 1 FROM studies/i.test(sql) && /body_systems/i.test(sql)) {
          return { rows: params.includes("%cardiovascular%") ? [{ "?column?": 1 }] : [] };
        }
        if (/h2_delivery_method/i.test(sql)) {
          const term = String(params[0] ?? "").replace(/^%|%$/g, "");
          return { rows: ["hydrogen water", "athletes", "antioxidant", "pregnancy"].includes(term) ? [{ slug: `${term}-1`, title: "S", publish_year: 2024 }] : [] };
        }
        if (/FROM studies/i.test(sql) && /body_systems/i.test(sql)) {
          return { rows: [{ slug: "bs-1", title: "Body system study", publish_year: 2024, journal: "J" }] };
        }
        if (/FROM studies/i.test(sql) && /health_conditions/i.test(sql)) {
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
vi.mock("../utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { renderPageBody, __resetConditionHubsForTests } = await import("../middleware/seo-body-renderer");
const { __resetProfilesForTests } = await import("../services/profiles");
const { resolvePageMeta } = await import("../services/page-meta");

const SITE = "https://hydrogenstudies.com";
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
const asArray = (x: unknown) => (Array.isArray(x) ? x : x ? [x] : []) as any[];

/** The visible trail: [label, href?][] from <nav aria-label="Breadcrumb">. */
function visibleTrail(html: string): { name: string; item?: string }[] {
  const nav = html.match(/<nav aria-label="Breadcrumb"><ol>([\s\S]*?)<\/ol><\/nav>/);
  if (!nav) return [];
  return [...nav[1].matchAll(/<li[^>]*>(?:<a href="([^"]*)">)?([^<]*)/g)].map((m) => ({
    name: decode(m[2]),
    ...(m[1] ? { item: `${SITE}${decode(m[1])}` } : {}),
  }));
}

const h1Text = (html: string) => decode((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) ?? [])[1] ?? "").replace(/<[^>]+>/g, "").trim();

const studies = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({
    slug: `${prefix}-${i + 1}`, title: `${prefix} study ${i + 1}`, publish_year: 2020 + i, journal: "J", study_type: "human", abstract: "A.",
  }));

beforeEach(() => {
  __resetConditionHubsForTests();
  __resetProfilesForTests();
  state.conditions = [
    { name: "Type 2 Diabetes", slug: "type-2-diabetes", study_count: 265, description: null },
    { name: "Anxiety & Stress", slug: "anxiety-stress", study_count: 120, description: "Old generic copy." },
  ];
  state.conditionStudies = { "Type 2 Diabetes": studies("t2d", 3), "Anxiety & Stress": studies("anx", 2) };
  state.blog = {
    id: 7,
    slug: "a-very-long-post-title-that-keeps-going-well-past-fifty-characters",
    title: "A Very Long Post Title That Keeps Going Well Past Fifty Characters & More",
    content: "<p>Body</p>",
    summary: "Summary",
    isPublished: true,
    isArchived: false,
    is_published: true,
    is_archived: false,
    created_at: "2026-01-01T00:00:00Z",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
  };
});

const PATHS = [
  "/blog/a-very-long-post-title-that-keeps-going-well-past-fifty-characters",
  "/explore-by-condition/type-2-diabetes", // reviewed intro
  "/explore-by-condition/anxiety-stress", // generic hub, "&" in the name
  "/explore-by-body-system/cardiovascular",
  "/explore-by-mechanism/hydrogen-water",
  "/explore-by-demographic/athletes",
  "/explore-by-benefit/antioxidant",
  "/explore-by-life-stage/pregnancy",
  "/explore-by-condition",
  "/explore-by-body-system",
  "/explore-by-benefit",
  "/hydrogen-for/diabetes",
  "/studies",
  "/blog",
  "/editorial-policy",
  "/methodology",
  "/researchers",
  "/researchers/xuejun-sun",
  "/journals",
  "/journals/medical-gas-research",
];

describe("BreadcrumbList = the visible trail; page block name = the visible H1", () => {
  it.each(PATHS)("%s", async (path) => {
    const [meta, html] = await Promise.all([resolvePageMeta(path), renderPageBody(path)]);
    expect(meta, path).not.toBeNull();
    expect(html, path).toBeTruthy();
    const blocks = asArray(meta!.jsonLd);
    const trail = blocks.find((b) => b["@type"] === "BreadcrumbList");
    expect(trail, `${path} has a BreadcrumbList`).toBeDefined();
    const items = trail.itemListElement.map((n: any) => ({ name: n.name, ...(n.item ? { item: n.item } : {}) }));
    expect(items).toEqual(visibleTrail(html!));
    expect(items.at(-1).item, "current page has no link").toBeUndefined();
    expect(trail.itemListElement.map((n: any) => n.position)).toEqual(items.map((_: any, i: number) => i + 1));

    const page = blocks.find((b) => ([] as string[]).concat(b["@type"]).some((t) => t === "CollectionPage" || t === "MedicalWebPage" || t === "ProfilePage"));
    if (page) {
      expect(page.name, path).toBe(h1Text(html!));
      expect(page.url, path).toBe(meta!.canonical);
    }
    expect(JSON.stringify(blocks)).not.toContain("MedicalCondition");
  });

  it("condition and hydrogen-for hubs are MedicalWebPage + CollectionPage; other hubs plain CollectionPage", async () => {
    const type = async (p: string) => asArray((await resolvePageMeta(p))!.jsonLd)[0]["@type"];
    expect(await type("/explore-by-condition/type-2-diabetes")).toEqual(["MedicalWebPage", "CollectionPage"]);
    expect(await type("/explore-by-condition/anxiety-stress")).toEqual(["MedicalWebPage", "CollectionPage"]);
    expect(await type("/hydrogen-for/diabetes")).toEqual(["MedicalWebPage", "CollectionPage"]);
    expect(await type("/explore-by-body-system/cardiovascular")).toBe("CollectionPage");
    expect(await type("/explore-by-condition")).toBe("CollectionPage");
  });

  it("the blog crumb is the title cut to 50 characters, exactly as shown", async () => {
    const meta = await resolvePageMeta("/blog/a-very-long-post-title-that-keeps-going-well-past-fifty-characters");
    const trail = asArray(meta!.jsonLd).find((b) => b["@type"] === "BreadcrumbList");
    expect(trail.itemListElement[2].name).toBe("A Very Long Post Title That Keeps Going Well Pa...");
  });
});
