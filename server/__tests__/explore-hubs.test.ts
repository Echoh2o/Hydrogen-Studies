/**
 * Body-system hubs: the URLs sitemap-explore.xml advertises must resolve.
 * 2026-09-23: brain-nervous-system, skin-dermatology and eyes-vision were in
 * the sitemap but served Googlebot a hard 404 — the renderer searched
 * `body_systems` for "brain nervous system" etc., which no row contains.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { PgDialect } from "drizzle-orm/pg-core";

// Every db.execute() is captured; the test decides which rows come back.
const executed = vi.hoisted(() => ({ queries: [] as { sql: string; params: unknown[] }[] }));
const studyRowsFor = vi.hoisted(() => ({ fn: (_params: unknown[]) => [] as any[] }));

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
        executed.queries.push({ sql, params });
        if (/FROM studies/i.test(sql) && /body_systems/i.test(sql)) return { rows: studyRowsFor.fn(params) };
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

import { BODY_SYSTEM_HUBS, bodySystemLikePatterns, findBodySystemHub } from "../utils/explore-hubs";
import { renderPageBody, __resetConditionHubsForTests } from "../middleware/seo-body-renderer";
import seoRoutes, { __resetSitemapCacheForTests } from "../routes/seo-routes";

/** SQL LIKE (with only % wildcards) against the joined, lowercased array. */
function likeMatches(values: string[], pattern: string): boolean {
  const joined = values.join(" ").toLowerCase();
  const re = new RegExp("^" + pattern.split("%").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
  return re.test(joined);
}

describe("BODY_SYSTEM_HUBS", () => {
  it("has unique lowercase slugs", () => {
    const slugs = BODY_SYSTEM_HUBS.map((h) => h.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
  });

  it("the three previously-404 hubs match the body_systems values the DB actually stores", () => {
    const cases: Record<string, string[][]> = {
      "brain-nervous-system": [["Nervous System"], ["Central Nervous System"], ["Brain"], ["Neurological"]],
      "skin-dermatology": [["Integumentary"], ["Skin"], ["Dermatological"], ["Integumentary System"]],
      "eyes-vision": [["Visual System"], ["Ocular"], ["Ophthalmologic"], ["Retinal Tissue"]],
    };
    for (const [slug, samples] of Object.entries(cases)) {
      const patterns = bodySystemLikePatterns(slug);
      for (const values of samples) {
        expect(patterns.some((p) => likeMatches(values, p)), `${slug} ~ ${values}`).toBe(true);
      }
      // …and not unrelated systems
      expect(patterns.some((p) => likeMatches(["Cardiovascular"], p)), `${slug} !~ Cardiovascular`).toBe(false);
    }
  });

  it("keeps the historical words-or-slug match for hubs that already resolved and for unknown slugs", () => {
    expect(bodySystemLikePatterns("immune-system")).toEqual(["%immune system%", "%immune-system%"]);
    expect(bodySystemLikePatterns("cardiovascular")).toEqual(["%cardiovascular%", "%cardiovascular%"]);
    expect(bodySystemLikePatterns("nervous-system")).toEqual(["%nervous system%", "%nervous-system%"]);
    expect(findBodySystemHub("nervous-system")).toBeUndefined();
  });
});

describe("body-system hub rendering", () => {
  beforeEach(() => {
    __resetConditionHubsForTests();
    executed.queries = [];
    studyRowsFor.fn = (params) =>
      params.includes("%nervous%")
        ? [{ slug: "h2-and-the-brain-1775650467136", title: "H2 and the brain", publish_year: 2024, journal: "J" }]
        : [];
  });

  it("renders /explore-by-body-system/brain-nervous-system (was a bot 404)", async () => {
    const body = await renderPageBody("/explore-by-body-system/brain-nervous-system");
    expect(body).not.toBeNull();
    expect(body).toContain("Brain &amp; Nervous System");
    expect(body).toContain("/study/h2-and-the-brain-1775650467136");
    const q = executed.queries.find((x) => /body_systems/.test(x.sql))!;
    expect(q.params).toEqual(expect.arrayContaining(["%nervous%", "%brain%"]));
  });

  it("still 404s (null body) when no study matches", async () => {
    studyRowsFor.fn = () => [];
    expect(await renderPageBody("/explore-by-body-system/eyes-vision")).toBeNull();
  });
});

describe("sitemap-explore.xml", () => {
  beforeEach(() => {
    __resetConditionHubsForTests();
    __resetSitemapCacheForTests();
  });

  it("advertises exactly the hubs the renderer resolves", async () => {
    // Every canonical hub has a study → every one resolves (200).
    studyRowsFor.fn = () => [{ slug: "s-1", title: "S", publish_year: 2024, journal: "J" }];
    const app = express();
    app.use(seoRoutes);
    const res = await request(app).get("/sitemap-explore.xml");
    expect(res.status).toBe(200);
    for (const h of BODY_SYSTEM_HUBS) {
      expect(res.text).toContain(`/explore-by-body-system/${h.slug}</loc>`);
      expect(await renderPageBody(`/explore-by-body-system/${h.slug}`)).not.toBeNull();
    }
    const advertised = [...res.text.matchAll(/\/explore-by-body-system\/([a-z0-9-]+)<\/loc>/g)].map((m) => m[1]);
    expect(advertised.sort()).toEqual(BODY_SYSTEM_HUBS.map((h) => h.slug).sort());
  });

  it("leaves out a canonical hub without studies — that URL is a 404", async () => {
    // Only the brain hub's terms match a study.
    studyRowsFor.fn = (params) =>
      params.includes("%nervous%") ? [{ slug: "s-1", title: "S", publish_year: 2024, journal: "J" }] : [];
    const app = express();
    app.use(seoRoutes);
    const res = await request(app).get("/sitemap-explore.xml");
    const advertised = [...res.text.matchAll(/\/explore-by-body-system\/([a-z0-9-]+)<\/loc>/g)].map((m) => m[1]);
    expect(advertised).toEqual(["brain-nervous-system"]);
    expect(await renderPageBody("/explore-by-body-system/eyes-vision")).toBeNull();
  });
});

describe("long-tail body-system slugs (not canonical hubs)", () => {
  beforeEach(() => {
    __resetConditionHubsForTests();
    // Rows exist for anything — the old words-or-slug match would render them.
    studyRowsFor.fn = () => [{ slug: "s-1", title: "S", publish_year: 2024, journal: "J" }];
  });

  it.each(["molecular", "multi-system", "whole-body", "nervous-system", "cardiovascular-system", "renal-system"])(
    "/explore-by-body-system/%s is a hard 404 (null body), even when studies match its words",
    async (slug) => {
      expect(await renderPageBody(`/explore-by-body-system/${slug}`)).toBeNull();
    },
  );
});
