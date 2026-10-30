import { describe, it, expect } from "vitest";
import { formatAuthors, formatDate, imageSrc } from "../utils";

describe("formatAuthors", () => {
  it("handles string authors", () => {
    expect(formatAuthors("Smith J, Jones K")).toBe("Smith J, Jones K");
  });

  it("handles array of objects with name field", () => {
    expect(formatAuthors([{ authorId: 1, name: "Smith J" }, { authorId: 2, name: "Jones K" }]))
      .toBe("Smith J, Jones K");
  });

  it("handles array of objects with authorName field", () => {
    expect(formatAuthors([{ authorName: "Smith J" }])).toBe("Smith J");
  });

  it("handles array of strings", () => {
    expect(formatAuthors(["Smith J", "Jones K"])).toBe("Smith J, Jones K");
  });

  it("handles single object with name", () => {
    expect(formatAuthors({ name: "Smith J" })).toBe("Smith J");
  });

  it("handles null", () => {
    expect(formatAuthors(null)).toBe("");
  });

  it("handles undefined", () => {
    expect(formatAuthors(undefined)).toBe("");
  });

  it("handles empty string", () => {
    expect(formatAuthors("")).toBe("");
  });

  it("handles empty array", () => {
    expect(formatAuthors([])).toBe("");
  });

  it("handles number (unexpected type)", () => {
    expect(formatAuthors(42)).toBe("42");
  });

  it("handles mixed array with nulls", () => {
    expect(formatAuthors([{ name: "Smith" }, null, { name: "Jones" }]))
      .toBe("Smith, Jones");
  });
});

describe("formatDate", () => {
  it("formats a valid date string", () => {
    const result = formatDate("2024-01-15");
    expect(result).toContain("2024");
    expect(result).toContain("January");
  });

  it("handles ISO date string", () => {
    const result = formatDate("2023-06-01T00:00:00Z");
    expect(result).toContain("2023");
  });
});

describe("imageSrc", () => {
  it("keeps a single leading slash on stored site paths", () => {
    expect(imageSrc("/uploads/study-images/a.png")).toBe("/uploads/study-images/a.png");
    expect(imageSrc("uploads/study-images/a.png")).toBe("/uploads/study-images/a.png");
    expect(imageSrc("//uploads/study-images/a.png")).toBe("/uploads/study-images/a.png");
  });

  it("passes absolute and inline URLs through", () => {
    expect(imageSrc("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
    expect(imageSrc("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });
});
