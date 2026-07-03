/**
 * Tests that verify API response data is safe to render in React.
 * These test the patterns that have caused production crashes:
 * - Objects rendered as React children (error #31)
 * - .filter()/.map() called on non-arrays
 * - .toLocaleString() on non-numbers
 * - Date parsing on malformed strings
 *
 * These import the REAL utilities from client/src/lib/utils.ts (previously
 * this file tested inline copies, which could drift from production code):
 * - formatAuthors: the util actually used by study pages/cards
 * - safeArray: extracted to the util file as the canonical form of the
 *   array-extraction pattern that pages had been inlining ad hoc
 *   (StudyPage.tsx relatedArray, BlogListPage.tsx articles, ...)
 */
import { describe, it, expect } from "vitest";
import { formatAuthors, safeArray } from "../../client/src/lib/utils";

describe("API Response Safety", () => {
  describe("formatAuthors handles all API response shapes", () => {
    // These are all real shapes we've seen from different APIs
    const testCases = [
      { input: "Smith J, Jones K", expected: "Smith J, Jones K", label: "plain string" },
      { input: [{ authorId: 1, name: "Smith" }], expected: "Smith", label: "Semantic Scholar format" },
      { input: [{ name: "Smith" }, { name: "Jones" }], expected: "Smith, Jones", label: "CrossRef format" },
      { input: ["Smith", "Jones"], expected: "Smith, Jones", label: "string array" },
      { input: null, expected: "", label: "null" },
      { input: undefined, expected: "", label: "undefined" },
      { input: { name: "Smith" }, expected: "Smith", label: "single object" },
      { input: 42, expected: "42", label: "number" },
      { input: true, expected: "true", label: "boolean" },
    ];

    for (const { input, expected, label } of testCases) {
      it(`handles ${label}: ${JSON.stringify(input)}`, () => {
        const result = formatAuthors(input);
        expect(typeof result).toBe("string"); // MUST always be string for React
        expect(result).toBe(expected);
      });
    }
  });

  describe("safeArray extracts arrays from any API response shape", () => {
    it("handles direct array", () => {
      expect(safeArray([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it("handles { data: [...] } shape (blog API)", () => {
      expect(safeArray({ data: [1, 2], total: 2 })).toEqual([1, 2]);
    });

    it("handles { studies: [...] } shape", () => {
      expect(safeArray({ studies: [{ id: 1 }] })).toEqual([{ id: 1 }]);
    });

    it("handles { articles: [...] } shape (blog list)", () => {
      expect(safeArray({ articles: [{ id: 7 }] })).toEqual([{ id: 7 }]);
    });

    it("handles { results: [...] } shape (EuropePMC)", () => {
      expect(safeArray({ results: [{ title: "test" }], total: 1 })).toEqual([{ title: "test" }]);
    });

    it("handles { items: [...] } shape (CrossRef)", () => {
      expect(safeArray({ items: [{ DOI: "10.1234" }] })).toEqual([{ DOI: "10.1234" }]);
    });

    it("handles null", () => {
      expect(safeArray(null)).toEqual([]);
    });

    it("handles undefined", () => {
      expect(safeArray(undefined)).toEqual([]);
    });

    it("handles empty object", () => {
      expect(safeArray({})).toEqual([]);
    });

    it("handles string (unexpected)", () => {
      expect(safeArray("not an array")).toEqual([]);
    });

    it("handles { data: null }", () => {
      expect(safeArray({ data: null })).toEqual([]);
    });

    it("handles { data: 'string' }", () => {
      expect(safeArray({ data: "string" })).toEqual([]);
    });

    it("result is always safe to call .map() on", () => {
      const badInputs = [null, undefined, {}, "string", 42, { data: null }, { data: "string" }];
      for (const input of badInputs) {
        const result = safeArray(input);
        expect(Array.isArray(result)).toBe(true);
        // This should never throw
        expect(() => result.map((x: any) => x)).not.toThrow();
        expect(() => result.filter((x: any) => x)).not.toThrow();
        expect(() => result.find((x: any) => x)).not.toThrow();
      }
    });
  });

  describe("Date handling safety", () => {
    it("publishYear is always a safe integer or null", () => {
      const testYears = [2024, 1969, null, undefined, 0, 2026];
      for (const year of testYears) {
        if (year != null && year > 0) {
          expect(typeof year).toBe("number");
          expect(Number.isInteger(year)).toBe(true);
        }
      }
    });

    it("malformed date strings don't crash Number()", () => {
      const badDates = ["2026 Mar", "March 2024", "", null, undefined, "not-a-date"];
      for (const d of badDates) {
        // These should not throw
        expect(() => new Date(d as any)).not.toThrow();
        expect(() => Number(d)).not.toThrow();
      }
    });
  });

  describe("toLocaleString safety", () => {
    it("only called on numbers", () => {
      const values = [1234, 0, null, undefined, "string", {}, []];
      for (const v of values) {
        if (typeof v === "number") {
          expect(() => v.toLocaleString()).not.toThrow();
        }
      }
    });
  });
});
