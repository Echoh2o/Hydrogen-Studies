import { describe, it, expect } from "vitest";
import {
  breakpoints,
  responsiveClasses,
  getResponsivePadding,
  getResponsiveFontSize,
} from "../../../client/src/lib/responsive";

describe("breakpoints", () => {
  it("should have correct breakpoint values", () => {
    expect(breakpoints.xs).toBe(0);
    expect(breakpoints.sm).toBe(640);
    expect(breakpoints.md).toBe(768);
    expect(breakpoints.lg).toBe(1024);
    expect(breakpoints.xl).toBe(1280);
    expect(breakpoints["2xl"]).toBe(1536);
  });
});

describe("responsiveClasses", () => {
  it("should combine base and responsive classes", () => {
    const result = responsiveClasses("flex", { sm: "flex-row", lg: "gap-4" });
    expect(result).toContain("flex");
    expect(result).toContain("sm:flex-row");
    expect(result).toContain("lg:gap-4");
  });

  it("should handle xs breakpoint without prefix", () => {
    const result = responsiveClasses("base", { xs: "hidden" });
    expect(result).toContain("hidden");
    expect(result).not.toContain("xs:");
  });

  it("should return only base classes when no responsive classes given", () => {
    const result = responsiveClasses("flex items-center", {});
    expect(result).toBe("flex items-center");
  });
});

describe("getResponsivePadding", () => {
  it("should return small padding classes", () => {
    const result = getResponsivePadding("small");
    expect(result).toContain("px-4");
    expect(result).toContain("py-2");
  });

  it("should return medium padding classes by default", () => {
    const result = getResponsivePadding();
    expect(result).toContain("px-4");
    expect(result).toContain("py-4");
    expect(result).toContain("sm:px-6");
  });

  it("should return large padding classes", () => {
    const result = getResponsivePadding("large");
    expect(result).toContain("lg:px-12");
  });
});

describe("getResponsiveFontSize", () => {
  it("should return heading1 classes", () => {
    const result = getResponsiveFontSize("heading1");
    expect(result).toContain("text-2xl");
    expect(result).toContain("lg:text-4xl");
    expect(result).toContain("font-bold");
  });

  it("should return heading2 classes", () => {
    const result = getResponsiveFontSize("heading2");
    expect(result).toContain("font-semibold");
  });

  it("should return heading3 classes", () => {
    const result = getResponsiveFontSize("heading3");
    expect(result).toContain("font-medium");
  });

  it("should return body classes", () => {
    const result = getResponsiveFontSize("body");
    expect(result).toContain("text-base");
  });

  it("should return small classes", () => {
    const result = getResponsiveFontSize("small");
    expect(result).toContain("text-xs");
  });
});
