/**
 * toAbsoluteUrl — social crawlers (Facebook/Twitter/LinkedIn/Slack) and
 * Google image sitemaps silently drop relative URLs, so every og:image /
 * twitter:image / <image:loc> must be emitted absolute. This util is the
 * single place that guarantees it.
 */
import { describe, it, expect } from "vitest";
import { toAbsoluteUrl } from "../utils/absolute-url";

const BASE = "https://hydrogenstudies.com";

describe("toAbsoluteUrl", () => {
  it("prefixes a root-relative path with the base origin", () => {
    expect(toAbsoluteUrl("/uploads/study-images/x.png", BASE)).toBe(
      "https://hydrogenstudies.com/uploads/study-images/x.png"
    );
  });

  it("leaves https URLs untouched", () => {
    expect(toAbsoluteUrl("https://cdn.example.com/a.png", BASE)).toBe(
      "https://cdn.example.com/a.png"
    );
  });

  it("leaves http URLs untouched", () => {
    expect(toAbsoluteUrl("http://cdn.example.com/a.png", BASE)).toBe(
      "http://cdn.example.com/a.png"
    );
  });

  it("upgrades protocol-relative URLs to https", () => {
    expect(toAbsoluteUrl("//cdn.example.com/a.png", BASE)).toBe(
      "https://cdn.example.com/a.png"
    );
  });

  it("inserts a slash when the path has no leading slash", () => {
    expect(toAbsoluteUrl("uploads/a.png", BASE)).toBe(
      "https://hydrogenstudies.com/uploads/a.png"
    );
  });

  it("normalizes a trailing slash on the base", () => {
    expect(toAbsoluteUrl("/uploads/a.png", `${BASE}/`)).toBe(
      "https://hydrogenstudies.com/uploads/a.png"
    );
  });
});
