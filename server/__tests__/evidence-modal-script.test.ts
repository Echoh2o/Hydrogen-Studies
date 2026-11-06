/**
 * TRUST-BADGE-PLAN 2.4: the echowater.com modal script never injects HTML from
 * data, binds to [data-hs-evidence], and tags outbound links.
 */
import { describe, it, expect } from "vitest";
import { buildEvidenceModalScript } from "../services/evidence-modal-script";

const js = buildEvidenceModalScript("https://hydrogenstudies.com");

describe("evidence modal script", () => {
  it("is valid JavaScript", () => {
    expect(() => new Function(js)).not.toThrow();
  });
  it("writes data only as text (no innerHTML/outerHTML/insertAdjacentHTML/document.write)", () => {
    expect(js).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
    expect(js).toMatch(/textContent/);
  });
  it("binds to data-hs-evidence and loads data from the public API without cookies", () => {
    expect(js).toContain('closest("[data-hs-evidence]")');
    expect(js).toContain("/api/evidence/");
    expect(js).toContain('credentials: "omit"');
  });
  it("tags links back to hydrogenstudies.com and falls back to the evidence page", () => {
    expect(js).toContain("utm_source=echowater&utm_medium=badge&utm_campaign=evidence_profile");
    expect(js).toContain('"/evidence/"');
  });
});
