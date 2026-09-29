import { describe, it, expect } from "vitest";
import { headingId, decodeHtmlEntities } from "../../shared/heading-id";

describe("headingId — one anchor rule for crawler and SPA", () => {
  it.each([
    ["Is hydrogen flammable?", "is-hydrogen-flammable"],
    ["Can hydrogen water help with sleep, mood or stress?", "can-hydrogen-water-help-with-sleep-mood-or-stress"],
    ["What&#39;s in a tablet?", "what-s-in-a-tablet"],
    ["What's in a tablet?", "what-s-in-a-tablet"],
    ["Tablets vs. electrolysis bottles &amp; pouches", "tablets-vs-electrolysis-bottles-pouches"],
    ["  ", ""],
  ])("%s → %s", (text, id) => {
    expect(headingId(text)).toBe(id);
  });

  it("decodes numeric and named entities", () => {
    expect(decodeHtmlEntities("a &amp; b &#x27;c&#39; &quot;d&quot;")).toBe(`a & b 'c' "d"`);
  });
});
