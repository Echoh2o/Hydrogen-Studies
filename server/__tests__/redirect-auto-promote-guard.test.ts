/**
 * The 404 → redirect auto-promoter must never shadow a live page.
 *
 * 2026-09-23: row 8929 `/study/hydrogen-producing-…-1788216910213` → 302
 * `/studies/<same slug>` ("auto-promoted from 404 (score 1.00, study)") for a
 * study that exists — the 404 was transient (deploy downtime, or a
 * /Study/Slug/ variant that normalizes onto the live URL). resolveRedirect
 * checks the redirects table before routing, so the row hijacked the
 * sitemap URL (re-audit 2026-09-28, N1).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const selectRows = vi.hoisted(() => ({ current: {} as Record<string, any[]> }));
const inserts = vi.hoisted(() => ({ tables: [] as string[] }));

vi.mock("../db", async () => {
  const { getTableName } = await import("drizzle-orm");
  function chain(state: { table?: string } = {}): any {
    const p: any = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: any, reject: any) =>
            Promise.resolve([...(selectRows.current[state.table ?? ""] ?? [])]).then(resolve, reject);
        }
        if (prop === "catch") return () => p;
        if (prop === "from") {
          return (table: any) => {
            try { state.table = getTableName(table); } catch { /* not a table */ }
            return p;
          };
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
      select: () => chain({}),
      update: () => chain({}),
      insert: (table: any) => {
        try { inserts.tables.push(getTableName(table)); } catch { /* ignore */ }
        return chain({});
      },
      execute: async () => ({ rows: [] }),
    },
    pool: { query: () => new Promise(() => {}) },
  };
});

import {
  autoPromoteBlockReason,
  backfillSuggestions,
  isSameSlugStudyAlias,
  pathResolvesToLiveContent,
} from "../services/redirect-service";

const LIVE_SLUG = "hydrogen-producing-facultative-anaerobic-bacteria-1788216910213";

beforeEach(() => {
  selectRows.current = {};
  inserts.tables = [];
});

describe("isSameSlugStudyAlias", () => {
  it("flags /study/X ↔ /studies/X in either direction, any case, trailing slash", () => {
    expect(isSameSlugStudyAlias(`/study/${LIVE_SLUG}`, `/studies/${LIVE_SLUG}`)).toBe(true);
    expect(isSameSlugStudyAlias(`/studies/${LIVE_SLUG}`, `/study/${LIVE_SLUG}`)).toBe(true);
    expect(isSameSlugStudyAlias(`/study/abc`, `/Studies/ABC/`)).toBe(true);
  });

  it("allows a genuine old-slug → new-slug study redirect", () => {
    expect(isSameSlugStudyAlias("/study/old-slug-1", "/studies/new-slug-2")).toBe(false);
    expect(isSameSlugStudyAlias("/blog/x", "/studies/x")).toBe(false);
  });
});

describe("pathResolvesToLiveContent", () => {
  it("true for an existing study under /study/ or /studies/", async () => {
    selectRows.current = { studies: [{ id: 1 }] };
    expect(await pathResolvesToLiveContent(`/study/${LIVE_SLUG}`)).toBe(true);
    expect(await pathResolvesToLiveContent(`/studies/${LIVE_SLUG}`)).toBe(true);
  });

  it("true for a published blog post", async () => {
    selectRows.current = { blog_articles: [{ id: 9 }] };
    expect(await pathResolvesToLiveContent("/blog/what-is-hydrogen-water")).toBe(true);
  });

  it("false when nothing matches, and for non-content paths", async () => {
    expect(await pathResolvesToLiveContent(`/study/${LIVE_SLUG}`)).toBe(false);
    expect(await pathResolvesToLiveContent("/blog/retired-post")).toBe(false);
    selectRows.current = { studies: [{ id: 1 }], blog_articles: [{ id: 2 }] };
    expect(await pathResolvesToLiveContent("/studies/tags")).toBe(false);
    expect(await pathResolvesToLiveContent("/secondary-topic/kidney")).toBe(false);
  });
});

describe("autoPromoteBlockReason", () => {
  it("refuses same-slug aliases even when the study lookup finds nothing", async () => {
    expect(await autoPromoteBlockReason(`/study/${LIVE_SLUG}`, `/studies/${LIVE_SLUG}`)).toMatch(/alias/);
  });

  it("refuses a from_path that is a live page", async () => {
    selectRows.current = { blog_articles: [{ id: 2 }] };
    expect(await autoPromoteBlockReason("/blog/live-post", "/studies/live-post")).toMatch(/live page/);
  });

  it("allows a dead legacy path", async () => {
    expect(await autoPromoteBlockReason("/old-site/some-study", "/studies/some-study")).toBeNull();
  });
});

describe("backfillSuggestions auto-promote", () => {
  it("does NOT insert a redirect for a transient 404 on a live study URL (row 8929)", async () => {
    selectRows.current = {
      not_found_log: [{ id: 1, path: `/study/${LIVE_SLUG}` }],
      studies: [{ id: 1, slug: LIVE_SLUG, title: "Hydrogen-producing bacteria", plt: null }],
    };
    const out = await backfillSuggestions(10);
    expect(out.suggested).toBe(1); // suggestions are still saved for review
    expect(out.autoPromoted).toBe(0);
    expect(inserts.tables).not.toContain("redirects");
  });

  it("does NOT insert when the from_path is a live blog post", async () => {
    selectRows.current = {
      not_found_log: [{ id: 2, path: "/blog/live-post" }],
      // exact-slug suggestion resolves to a study with the same slug
      studies: [{ id: 5, slug: "live-post", title: "A study", plt: null }],
      blog_articles: [{ id: 7, slug: "live-post", title: "Live post" }],
    };
    const out = await backfillSuggestions(10);
    expect(out.autoPromoted).toBe(0);
    expect(inserts.tables).not.toContain("redirects");
  });

  it("still promotes a genuinely dead legacy path to its exact-slug study", async () => {
    selectRows.current = {
      not_found_log: [{ id: 3, path: "/research/some-study-1775650467100" }],
      studies: [{ id: 6, slug: "some-study-1775650467100", title: "Some study", plt: null }],
    };
    const out = await backfillSuggestions(10);
    expect(out.autoPromoted).toBe(1);
    expect(inserts.tables).toContain("redirects");
  });
});
