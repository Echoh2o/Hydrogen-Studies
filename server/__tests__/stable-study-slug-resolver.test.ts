/**
 * PLAN 3.3 — studyService.getStudyBySlug resolves a stable slug by its
 * permanent-ID suffix when the exact slug misses (drifted title portion),
 * and never runs a second query for a legacy slug.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const state = vi.hoisted(() => ({ results: [] as any[][], wheres: [] as any[] }));

vi.mock("../db", () => {
  function chain(): any {
    const p: any = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: any, reject: any) => Promise.resolve(state.results.shift() ?? []).then(resolve, reject);
        }
        return (...args: any[]) => {
          if (prop === "where") state.wheres.push(args[0]);
          return p;
        };
      },
      apply() {
        return p;
      },
    });
    return p;
  }
  return { db: { select: () => chain(), execute: async () => ({ rows: [] }) } };
});
vi.mock("../utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { studyService } = await import("../services/study-service");
const dialect = new PgDialect();
const rendered = (i: number) => dialect.sqlToQuery(state.wheres[i]);

beforeEach(() => {
  state.results = [];
  state.wheres = [];
});

describe("getStudyBySlug — stable suffix fallback", () => {
  it("returns the exact match with one query", async () => {
    state.results = [[{ id: 1, slug: "a-study-pmid-27826423" }]];
    const row = await studyService.getStudyBySlug("a-study-pmid-27826423");
    expect(row?.id).toBe(1);
    expect(state.wheres).toHaveLength(1);
    expect(rendered(0).params).toEqual(["a-study-pmid-27826423"]);
  });

  it("a drifted title portion resolves by PMID", async () => {
    state.results = [[], [{ id: 2, slug: "new-title-pmid-27826423" }]];
    const row = await studyService.getStudyBySlug("old-title-pmid-27826423");
    expect(row?.id).toBe(2);
    expect(state.wheres).toHaveLength(2);
    const q = rendered(1);
    expect(q.sql).toContain('"pmid"');
    expect(q.params).toEqual(["27826423"]);
  });

  it("resolves by row id for -hs-<id>", async () => {
    state.results = [[], [{ id: 3751, slug: "x-hs-3751" }]];
    const row = await studyService.getStudyBySlug("anything-hs-3751");
    expect(row?.id).toBe(3751);
    const q = rendered(1);
    expect(q.sql).toContain('"id"');
    expect(q.params).toEqual([3751]);
  });

  it("resolves by slugified DOI for -doi-<slug>, computed from the doi column", async () => {
    state.results = [[], [{ id: 4, slug: "x-doi-10-1159-000321946" }]];
    const row = await studyService.getStudyBySlug("y-doi-10-1159-000321946");
    expect(row?.id).toBe(4);
    const q = rendered(1);
    expect(q.sql).toContain('"doi"');
    expect(q.params).toEqual(["10-1159-000321946"]);
  });

  it("a legacy epoch slug that misses runs no second query", async () => {
    state.results = [[]];
    const row = await studyService.getStudyBySlug("a-study-1777577956377");
    expect(row).toBeUndefined();
    expect(state.wheres).toHaveLength(1);
  });

  it("still normalizes unicode dashes before matching", async () => {
    state.results = [[{ id: 5, slug: "a-study-pmid-123" }]];
    await studyService.getStudyBySlug("a‑study‑pmid‑123");
    expect(rendered(0).params).toEqual(["a-study-pmid-123"]);
  });
});
