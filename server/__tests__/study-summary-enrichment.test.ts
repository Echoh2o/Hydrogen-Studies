import { describe, it, expect, vi, beforeEach } from "vitest";

// One candidate study; record every UPDATE ... SET written for it.
const sets: Record<string, unknown>[] = [];
vi.mock("../db", () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: async () => [{ id: 4325, title: "Enhanced inhalation delivery", abstract: "An abstract." }],
  };
  return {
    db: {
      select: () => chain,
      update: () => ({
        set: (v: Record<string, unknown>) => {
          sets.push(v);
          return { where: async () => undefined };
        },
      }),
    },
  };
});

const generateJSON = vi.fn();
vi.mock("../services/ai-provider", () => ({ ai: { generateJSON: (...a: unknown[]) => generateJSON(...a) } }));
vi.mock("../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { enrichStudySummaries } = await import("../services/study-summary-enrichment");

describe("enrichStudySummaries failure handling", () => {
  beforeEach(() => {
    sets.length = 0;
    generateJSON.mockReset();
  });

  it("marks a study the model refuses as processed, so it is not retried every cycle", async () => {
    generateJSON.mockRejectedValue(
      new Error("Anthropic response from claude-sonnet-4-6 contained no text block (blocks: [none], stop_reason: refusal)"),
    );
    const stats = await enrichStudySummaries(1);
    expect(stats.errors).toBe(1);
    expect(sets).toEqual([{ keyFinding: "__no_content__" }]);
  });

  it("leaves a study for retry after a transient provider error", async () => {
    generateJSON.mockRejectedValue(new Error("529 Overloaded"));
    await enrichStudySummaries(1);
    expect(sets).toEqual([]);
  });
});
