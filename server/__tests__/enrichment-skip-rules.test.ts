/**
 * Skip rules for the scheduled TL;DR backfill and summary enrichment
 * (audit 2026-11-22): real abstracts only, never store a model refusal (mark
 * processed instead), never refill a `__no_content__` field. Mocked db.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const dialect = new PgDialect();
const state = vi.hoisted(() => ({ rows: [] as any[], where: [] as any[], sets: [] as Record<string, unknown>[] }));

vi.mock("../db", () => {
  const chain: any = {
    from: () => chain,
    where: (w: any) => {
      state.where.push(w);
      return chain;
    },
    limit: async () => state.rows,
  };
  return {
    db: {
      select: () => chain,
      update: () => ({
        set: (v: Record<string, unknown>) => {
          state.sets.push(v);
          return { where: async () => undefined };
        },
      }),
    },
  };
});

const generateJSON = vi.hoisted(() => vi.fn());
const generateStudyTldr = vi.hoisted(() => vi.fn());
vi.mock("../services/ai-provider", () => ({ ai: { generateJSON }, MODELS: { SONNET: "s" } }));
vi.mock("../services/tldr-generator", () => ({ generateStudyTldr }));
vi.mock("../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { runTldrBackfill } = await import("../services/tldr-backfill");
const { enrichStudySummaries } = await import("../services/study-summary-enrichment");
const { realAbstractSql } = await import("../utils/real-abstract");

const REFUSAL = "I'm sorry, but I can't write a meaningful TL;DR without an abstract.";
const real = { id: 1, title: "T", abstract: "Background: hydrogen water was given to rats." };

beforeEach(() => {
  state.rows = [];
  state.where = [];
  state.sets = [];
  generateJSON.mockReset();
  generateStudyTldr.mockReset();
});

describe("realAbstractSql", () => {
  it("excludes NULL, blank, filler and __token__ abstracts", () => {
    const { sql, params } = dialect.sqlToQuery(realAbstractSql());
    expect(sql).toMatch(/IS NOT NULL/);
    expect(sql).toMatch(/btrim\(.*\) <> ''/);
    expect(sql).toMatch(/NOT IN/);
    expect(params).toContain("no abstract available");
    expect(sql).toContain("^__[A-Za-z0-9_]+__$");
  });
});

describe("TL;DR backfill", () => {
  it("queries only tldr IS NULL + real abstracts", async () => {
    await runTldrBackfill(3);
    const { sql } = dialect.sqlToQuery(state.where[0]);
    expect(sql).toMatch(/"tldr" IS NULL/);
    expect(sql).toMatch(/NOT IN/);
  });

  it("skips a title-only row without calling the model", async () => {
    state.rows = [{ id: 2, title: "T", abstract: "No abstract available" }];
    const r = await runTldrBackfill(3);
    expect(generateStudyTldr).not.toHaveBeenCalled();
    expect(r.skipped).toBe(1);
    expect(state.sets).toEqual([]);
  });

  it("never stores a refusal; marks the study processed", async () => {
    state.rows = [real];
    generateStudyTldr.mockResolvedValue(REFUSAL);
    const r = await runTldrBackfill(3);
    expect(r.refused).toBe(1);
    expect(state.sets).toEqual([{ tldr: "__no_content__" }]);
  });

  it("stop_reason: refusal is marked processed; transient errors are retried", async () => {
    state.rows = [real];
    generateStudyTldr.mockRejectedValueOnce(new Error("no text block (stop_reason: refusal)"));
    await runTldrBackfill(3);
    expect(state.sets).toEqual([{ tldr: "__no_content__" }]);
    state.sets = [];
    generateStudyTldr.mockRejectedValueOnce(new Error("529 Overloaded"));
    await runTldrBackfill(3);
    expect(state.sets).toEqual([]);
  });

  it("stores a real TL;DR", async () => {
    state.rows = [real];
    generateStudyTldr.mockResolvedValue("Rats given hydrogen water had less liver damage.");
    expect((await runTldrBackfill(3)).generated).toBe(1);
    expect(state.sets).toEqual([{ tldr: "Rats given hydrogen water had less liver damage." }]);
  });
});

describe("summary enrichment", () => {
  it("queries real abstracts only", async () => {
    await enrichStudySummaries(1);
    const { sql } = dialect.sqlToQuery(state.where[0]);
    expect(sql).toMatch(/"key_finding" IS NULL/);
    expect(sql).toMatch(/NOT IN/);
  });

  it("a title-only row is marked processed without a model call", async () => {
    state.rows = [{ id: 3, title: "T", abstract: "  " }];
    await enrichStudySummaries(1);
    expect(generateJSON).not.toHaveBeenCalled();
    expect(state.sets).toEqual([{ keyFinding: "__no_content__" }]);
  });

  it("a refusal in any field stores nothing and marks processed", async () => {
    state.rows = [real];
    generateJSON.mockResolvedValue({ plain_summary: "Real text.", key_finding: REFUSAL, practical_takeaway: "x" });
    await enrichStudySummaries(1);
    expect(state.sets).toEqual([{ keyFinding: "__no_content__" }]);
  });

  it("never refills a __no_content__ or existing field", async () => {
    state.rows = [{ ...real, plainSummary: "__no_content__", practicalTakeaway: null }];
    generateJSON.mockResolvedValue({ plain_summary: "New summary.", key_finding: "Finding.", practical_takeaway: "Takeaway." });
    await enrichStudySummaries(1);
    expect(state.sets).toEqual([{ keyFinding: "Finding.", practicalTakeaway: "Takeaway." }]);
  });
});
