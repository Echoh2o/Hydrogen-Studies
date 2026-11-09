/**
 * The store trust badge's "About Hydrogen Studies" modal: text-only DOM
 * writes, binds to [data-hs-trust], keeps the badge's link (and its UTM tags)
 * as the visit button, discloses the funding and never uses forbidden copy.
 */
import { describe, it, expect } from "vitest";
import { Script } from "node:vm";
import { buildTrustModalScript } from "../services/trust-modal-script";
import { FORBIDDEN_COPY, TRUST_MODAL } from "../../shared/evidence-badge-copy";

const js = buildTrustModalScript("https://hydrogenstudies.com");

describe("trust modal script", () => {
  it("is valid JavaScript", () => {
    // Compiles only; nothing runs.
    expect(() => new Script(js)).not.toThrow();
  });
  it("writes data only as text (no innerHTML/outerHTML/insertAdjacentHTML/document.write)", () => {
    expect(js).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
    expect(js).toMatch(/textContent/);
  });
  it("binds to data-hs-trust and loads counts from the public stats without cookies", () => {
    expect(js).toContain('closest("[data-hs-trust]")');
    expect(js).toContain("/embed/stats.json");
    expect(js).toContain('credentials: "omit"');
  });
  it("uses the badge's own Hydrogen Studies link for the visit button, with a tagged fallback", () => {
    expect(js).toContain('trigger.getAttribute("href")');
    expect(js).toContain("u.origin === ORIGIN");
    expect(js).toContain("utm_source=echowater&utm_medium=referral&utm_campaign=trust_modal");
    expect(js).toContain(JSON.stringify(TRUST_MODAL.visit));
  });
  it("names the funder and the reviewer's relationship", () => {
    expect(TRUST_MODAL.disclosure).toMatch(/Echo Technologies LLC\) owns and funds Hydrogen Studies/);
    expect(js).toContain("Research Director at Echo Water (contractor)");
  });
  it("keeps to the badge copy rules", () => {
    const text = Object.values(TRUST_MODAL).flat().join(" ");
    for (const re of FORBIDDEN_COPY) expect(text).not.toMatch(re);
  });
});
