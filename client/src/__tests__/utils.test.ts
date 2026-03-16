import { describe, it, expect } from "vitest";
import { cn, formatDate, truncateText } from "../lib/utils";
import {
  responsiveClasses,
  getResponsivePadding,
  getResponsiveFontSize,
  breakpoints,
} from "../lib/responsive";

// ---------------------------------------------------------------------------
// cn (clsx + tailwind-merge)
// ---------------------------------------------------------------------------
describe("cn", () => {
  it("merges class strings", () => {
    const result = cn("px-4", "py-2");
    expect(result).toBe("px-4 py-2");
  });

  it("handles conditional classes", () => {
    const isActive = true;
    const result = cn("base", isActive && "active");
    expect(result).toContain("active");
  });

  it("deduplicates conflicting tailwind classes (last wins)", () => {
    const result = cn("px-4", "px-8");
    expect(result).toBe("px-8");
  });

  it("handles undefined / null / false values gracefully", () => {
    const result = cn("base", undefined, null, false, "end");
    expect(result).toBe("base end");
  });

  it("returns empty string when called with no arguments", () => {
    expect(cn()).toBe("");
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe("formatDate", () => {
  it("formats an ISO date string to 'Month Year'", () => {
    const result = formatDate("2024-03-15T00:00:00Z");
    expect(result).toBe("March 2024");
  });

  it("handles a date at the start of a year", () => {
    // Use full ISO timestamp to avoid UTC-midnight timezone shift issues
    const result = formatDate("2023-01-15T12:00:00Z");
    expect(result).toBe("January 2023");
  });

  it("handles a date at the end of a year", () => {
    const result = formatDate("2025-12-15T12:00:00Z");
    expect(result).toBe("December 2025");
  });
});

// ---------------------------------------------------------------------------
// truncateText
// ---------------------------------------------------------------------------
describe("truncateText", () => {
  it("returns the original text when it is shorter than maxLength", () => {
    expect(truncateText("hello", 10)).toBe("hello");
  });

  it("returns the original text when it equals maxLength", () => {
    expect(truncateText("hello", 5)).toBe("hello");
  });

  it("truncates and appends '...' when text exceeds maxLength", () => {
    const result = truncateText("hello world", 5);
    expect(result).toBe("hello...");
    expect(result.length).toBe(8); // 5 chars + "..."
  });

  it("handles an empty string", () => {
    expect(truncateText("", 10)).toBe("");
  });

  it("truncates to a single character plus ellipsis", () => {
    expect(truncateText("abcdef", 1)).toBe("a...");
  });
});

// ---------------------------------------------------------------------------
// responsiveClasses
// ---------------------------------------------------------------------------
describe("responsiveClasses", () => {
  it("combines base classes with breakpoint-prefixed classes", () => {
    const result = responsiveClasses("flex", { sm: "flex-row", lg: "gap-4" });
    expect(result).toContain("flex");
    expect(result).toContain("sm:flex-row");
    expect(result).toContain("lg:gap-4");
  });

  it("omits prefix for xs breakpoint", () => {
    const result = responsiveClasses("base", { xs: "hidden" });
    expect(result).toContain("hidden");
    expect(result).not.toContain("xs:");
  });
});

// ---------------------------------------------------------------------------
// getResponsivePadding
// ---------------------------------------------------------------------------
describe("getResponsivePadding", () => {
  it("returns small padding classes", () => {
    const result = getResponsivePadding("small");
    expect(result).toContain("px-4");
    expect(result).toContain("py-2");
  });

  it("returns medium padding classes by default", () => {
    const result = getResponsivePadding();
    expect(result).toContain("px-4");
    expect(result).toContain("py-4");
    expect(result).toContain("lg:px-8");
  });

  it("returns large padding classes", () => {
    const result = getResponsivePadding("large");
    expect(result).toContain("lg:px-12");
  });
});

// ---------------------------------------------------------------------------
// getResponsiveFontSize
// ---------------------------------------------------------------------------
describe("getResponsiveFontSize", () => {
  it("returns heading1 classes with bold weight", () => {
    const result = getResponsiveFontSize("heading1");
    expect(result).toContain("font-bold");
    expect(result).toContain("lg:text-4xl");
  });

  it("returns body classes", () => {
    const result = getResponsiveFontSize("body");
    expect(result).toContain("text-base");
  });

  it("returns small classes", () => {
    const result = getResponsiveFontSize("small");
    expect(result).toContain("text-xs");
  });
});

// ---------------------------------------------------------------------------
// breakpoints constant
// ---------------------------------------------------------------------------
describe("breakpoints", () => {
  it("defines expected breakpoint values", () => {
    expect(breakpoints.xs).toBe(0);
    expect(breakpoints.sm).toBe(640);
    expect(breakpoints.md).toBe(768);
    expect(breakpoints.lg).toBe(1024);
    expect(breakpoints.xl).toBe(1280);
  });
});
