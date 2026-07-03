import { describe, it, expect } from "vitest";
import {
  MAX_BATCH_QUERIES,
  MAX_QUERY_LENGTH,
  MAX_CONTEXT_PREVIOUS_QUERIES,
  MAX_CONTEXT_INTERESTS,
  MAX_CONTEXT_STUDY_TYPES,
  MAX_CONTEXT_VIEWED_STUDIES,
  MAX_CONTEXT_ITEM_LENGTH,
  sanitizeContext,
  validateBatchQueries,
  validateQueryInput,
} from "../utils/nl-search-validation";

describe("validateQueryInput", () => {
  it("accepts a normal query and trims it", () => {
    const result = validateQueryInput("  hydrogen water benefits  ");
    expect(result).toEqual({ ok: true, query: "hydrogen water benefits" });
  });

  it("rejects missing, non-string, and empty values", () => {
    expect(validateQueryInput(undefined).ok).toBe(false);
    expect(validateQueryInput(null).ok).toBe(false);
    expect(validateQueryInput(42).ok).toBe(false);
    expect(validateQueryInput({ q: "x" }).ok).toBe(false);
    expect(validateQueryInput("").ok).toBe(false);
    expect(validateQueryInput("   ").ok).toBe(false);
  });

  it("rejects queries longer than the cap", () => {
    const long = "a".repeat(MAX_QUERY_LENGTH + 1);
    const result = validateQueryInput(long);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(String(MAX_QUERY_LENGTH));
    }
  });

  it("accepts a query exactly at the cap", () => {
    const atCap = "a".repeat(MAX_QUERY_LENGTH);
    expect(validateQueryInput(atCap).ok).toBe(true);
  });

  it("trims before length-checking: padded but under-cap queries pass", () => {
    // Raw length exceeds the cap only because of surrounding whitespace.
    const padded = "  " + "a".repeat(MAX_QUERY_LENGTH) + "  ";
    const result = validateQueryInput(padded);
    expect(result).toEqual({ ok: true, query: "a".repeat(MAX_QUERY_LENGTH) });
  });
});

describe("validateBatchQueries", () => {
  it("accepts a valid batch and trims each query", () => {
    const result = validateBatchQueries([" one ", "two"]);
    expect(result).toEqual({ ok: true, queries: ["one", "two"] });
  });

  it("rejects non-array and empty-array input", () => {
    expect(validateBatchQueries(undefined).ok).toBe(false);
    expect(validateBatchQueries("not an array").ok).toBe(false);
    expect(validateBatchQueries([]).ok).toBe(false);
  });

  it("rejects batches larger than the cap", () => {
    const oversized = Array.from(
      { length: MAX_BATCH_QUERIES + 1 },
      (_, i) => `query ${i}`,
    );
    const result = validateBatchQueries(oversized);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(String(MAX_BATCH_QUERIES));
    }
  });

  it("accepts a batch exactly at the cap", () => {
    const atCap = Array.from(
      { length: MAX_BATCH_QUERIES },
      (_, i) => `query ${i}`,
    );
    expect(validateBatchQueries(atCap).ok).toBe(true);
  });

  it("rejects a batch containing an oversized or non-string item", () => {
    expect(
      validateBatchQueries(["ok", "a".repeat(MAX_QUERY_LENGTH + 1)]).ok,
    ).toBe(false);
    expect(validateBatchQueries(["ok", 123]).ok).toBe(false);
    expect(validateBatchQueries(["ok", ""]).ok).toBe(false);
  });
});

describe("sanitizeContext", () => {
  it("returns undefined for missing or non-object context", () => {
    expect(sanitizeContext(undefined)).toBeUndefined();
    expect(sanitizeContext(null)).toBeUndefined();
    expect(sanitizeContext("a string")).toBeUndefined();
    expect(sanitizeContext(42)).toBeUndefined();
    expect(sanitizeContext(["array"])).toBeUndefined();
  });

  it("passes through a well-formed context, trimming items", () => {
    const result = sanitizeContext({
      previousQueries: [" hydrogen water ", "inflammation"],
      userPreferences: {
        interests: ["longevity"],
        preferredStudyTypes: ["clinical trial"],
      },
      sessionContext: { viewedStudies: [1, 2, 3], appliedFilters: { a: 1 } },
    });
    expect(result).toEqual({
      previousQueries: ["hydrogen water", "inflammation"],
      userPreferences: {
        interests: ["longevity"],
        preferredStudyTypes: ["clinical trial"],
      },
      sessionContext: { viewedStudies: [1, 2, 3], appliedFilters: {} },
    });
  });

  it("returns a fully-formed context for a partial/empty object", () => {
    const result = sanitizeContext({});
    expect(result).toEqual({
      previousQueries: [],
      userPreferences: { interests: [], preferredStudyTypes: [] },
      sessionContext: { viewedStudies: [], appliedFilters: {} },
    });
  });

  it("caps array lengths", () => {
    const result = sanitizeContext({
      previousQueries: Array.from({ length: 100 }, (_, i) => `q${i}`),
      userPreferences: {
        interests: Array.from({ length: 100 }, (_, i) => `i${i}`),
        preferredStudyTypes: Array.from({ length: 100 }, (_, i) => `t${i}`),
      },
      sessionContext: {
        viewedStudies: Array.from({ length: 500 }, (_, i) => i),
      },
    });
    expect(result?.previousQueries).toHaveLength(MAX_CONTEXT_PREVIOUS_QUERIES);
    expect(result?.userPreferences.interests).toHaveLength(
      MAX_CONTEXT_INTERESTS,
    );
    expect(result?.userPreferences.preferredStudyTypes).toHaveLength(
      MAX_CONTEXT_STUDY_TYPES,
    );
    expect(result?.sessionContext.viewedStudies).toHaveLength(
      MAX_CONTEXT_VIEWED_STUDIES,
    );
  });

  it("drops oversized, empty, and non-string items", () => {
    const result = sanitizeContext({
      previousQueries: [
        "ok",
        "a".repeat(MAX_CONTEXT_ITEM_LENGTH + 1), // oversized — dropped
        "", // empty — dropped
        "   ", // whitespace-only — dropped
        123, // non-string — dropped
        { nested: true }, // non-string — dropped
      ],
      userPreferences: {
        interests: ["fine", "b".repeat(MAX_CONTEXT_ITEM_LENGTH + 1)],
      },
    });
    expect(result?.previousQueries).toEqual(["ok"]);
    expect(result?.userPreferences.interests).toEqual(["fine"]);
  });

  it("keeps items exactly at the per-item cap", () => {
    const atCap = "a".repeat(MAX_CONTEXT_ITEM_LENGTH);
    const result = sanitizeContext({ previousQueries: [atCap] });
    expect(result?.previousQueries).toEqual([atCap]);
  });

  it("drops non-numeric viewedStudies entries", () => {
    const result = sanitizeContext({
      sessionContext: { viewedStudies: [1, "2", NaN, Infinity, null, 3] },
    });
    expect(result?.sessionContext.viewedStudies).toEqual([1, 3]);
  });

  it("bounds prompt-bound content even for a huge (2mb-style) payload", () => {
    const huge = {
      previousQueries: Array.from({ length: 1000 }, () => "q".repeat(5000)),
      userPreferences: {
        interests: Array.from({ length: 1000 }, () => "i".repeat(5000)),
      },
    };
    const result = sanitizeContext(huge);
    // Every oversized item is dropped, so nothing survives to the prompt.
    expect(result?.previousQueries).toEqual([]);
    expect(result?.userPreferences.interests).toEqual([]);
  });
});
