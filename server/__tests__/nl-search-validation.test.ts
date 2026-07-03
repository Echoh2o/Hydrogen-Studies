import { describe, it, expect } from "vitest";
import {
  MAX_BATCH_QUERIES,
  MAX_QUERY_LENGTH,
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
