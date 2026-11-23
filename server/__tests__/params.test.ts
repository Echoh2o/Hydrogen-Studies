import { describe, it, expect } from "vitest";
import { parseIntParam, parseOptionalIntParam, clampPageSize, PG_INT_MAX } from "../utils/params";

describe("parseIntParam", () => {
  it("accepts plain integer strings", () => {
    expect(parseIntParam("42")).toBe(42);
    expect(parseIntParam(" 7 ")).toBe(7);
    expect(parseIntParam("-3")).toBe(-3);
    expect(parseIntParam(5)).toBe(5);
  });

  it("rejects malformed input", () => {
    for (const bad of ["abc", "12abc", "1.5", "", " ", "1e3", "0x10", undefined, null, {}, ["1"], NaN, 1.5]) {
      expect(parseIntParam(bad as unknown), String(bad)).toBeNull();
    }
  });

  it("enforces bounds", () => {
    expect(parseIntParam("0", { min: 1 })).toBeNull();
    expect(parseIntParam("1", { min: 1 })).toBe(1);
    expect(parseIntParam(String(PG_INT_MAX), { max: PG_INT_MAX })).toBe(PG_INT_MAX);
    expect(parseIntParam(String(PG_INT_MAX + 1), { max: PG_INT_MAX })).toBeNull();
    expect(parseIntParam("99999999999999999999")).toBeNull();
  });
});

describe("parseOptionalIntParam", () => {
  it("falls back when absent, rejects when malformed", () => {
    expect(parseOptionalIntParam(undefined, 30)).toBe(30);
    expect(parseOptionalIntParam("", 30)).toBe(30);
    expect(parseOptionalIntParam("7", 30, { min: 1 })).toBe(7);
    expect(parseOptionalIntParam("abc", 30)).toBeNull();
    expect(parseOptionalIntParam("0", 30, { min: 1 })).toBeNull();
  });
});

describe("clampPageSize", () => {
  it("clamps to [1, max] and falls back on garbage", () => {
    expect(clampPageSize("10")).toBe(10);
    expect(clampPageSize("100000")).toBe(100);
    expect(clampPageSize("0")).toBe(1);
    expect(clampPageSize("-5")).toBe(1);
    expect(clampPageSize("abc")).toBe(10);
    expect(clampPageSize(undefined, 25)).toBe(25);
    expect(clampPageSize("500", 10, 50)).toBe(50);
  });
});
