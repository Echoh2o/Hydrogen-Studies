import { describe, it, expect } from "vitest";
import { cn, formatDate, truncateText } from "../../../client/src/lib/utils";

describe("cn (className utility)", () => {
  it("should merge class names", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("should handle conditional classes", () => {
    const isActive = true;
    expect(cn("base", isActive && "active")).toContain("active");
  });

  it("should handle false/null/undefined values", () => {
    expect(cn("base", false, null, undefined)).toBe("base");
  });

  it("should merge tailwind classes correctly", () => {
    // twMerge should resolve conflicts
    expect(cn("px-4", "px-8")).toBe("px-8");
  });

  it("should handle empty input", () => {
    expect(cn()).toBe("");
  });
});

describe("formatDate", () => {
  it("should format a date string to month and year", () => {
    const result = formatDate("2024-03-15");
    expect(result).toContain("March");
    expect(result).toContain("2024");
  });

  it("should format ISO date strings", () => {
    const result = formatDate("2023-12-01T00:00:00Z");
    expect(result).toContain("2023");
  });

  it("should handle different months", () => {
    expect(formatDate("2024-01-01")).toContain("January");
    expect(formatDate("2024-06-15")).toContain("June");
    expect(formatDate("2024-12-31")).toContain("December");
  });
});

describe("truncateText", () => {
  it("should not truncate text shorter than maxLength", () => {
    expect(truncateText("Hello", 10)).toBe("Hello");
  });

  it("should not truncate text equal to maxLength", () => {
    expect(truncateText("Hello", 5)).toBe("Hello");
  });

  it("should truncate text longer than maxLength and add ellipsis", () => {
    expect(truncateText("Hello World", 5)).toBe("Hello...");
  });

  it("should handle empty string", () => {
    expect(truncateText("", 10)).toBe("");
  });

  it("should handle maxLength of 0", () => {
    expect(truncateText("Hello", 0)).toBe("...");
  });
});
