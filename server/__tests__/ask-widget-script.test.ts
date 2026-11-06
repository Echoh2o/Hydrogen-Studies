/** TRUST-BADGE-PLAN 3.8: the Ask widget never injects HTML and tags links. */
import { describe, it, expect } from "vitest";
import { buildAskWidgetScript } from "../services/ask-widget-script";
const js = buildAskWidgetScript("https://hydrogenstudies.com");
describe("ask widget script", () => {
  it("is valid JavaScript and text-only", () => {
    expect(() => new Function(js)).not.toThrow();
    expect(js).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  });
  it("mounts on [data-hs-ask], posts to /api/ask without cookies, shows the funding note", () => {
    expect(js).toContain('querySelectorAll("[data-hs-ask]")');
    expect(js).toContain('"/api/ask"');
    expect(js).toContain('credentials: "omit"');
    expect(js).toContain("which Echo Water funds. Not medical advice.");
    expect(js).toContain("utm_medium=ask");
  });
});
