/**
 * 2026-11-05: 160 discovery-queue papers were already in the database (148 by
 * DOI that an exact, case-sensitive check missed; 8 retraction/correction
 * notices). The matching rules below are what discovery and the dedupe
 * script now use.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("../db", () => ({ db: {}, pool: {} }));
vi.mock("../utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { normalizeDoiForMatch, isPublicationNotice } from "../services/research-discovery-engine";
import { normDoi, normTitle, tokenJaccard } from "../../scripts/research/dedupe-discovery-queue";

describe("discovery duplicate rules", () => {
  it("normalises DOIs (case, URL and doi: prefixes, trailing dot)", () => {
    for (const d of ["10.1016/J.FREERADBIOMED.2020.01.001", "https://doi.org/10.1016/j.freeradbiomed.2020.01.001", "doi: 10.1016/j.freeradbiomed.2020.01.001.", "http://dx.doi.org/10.1016/j.freeradbiomed.2020.01.001"]) {
      expect(normalizeDoiForMatch(d)).toBe("10.1016/j.freeradbiomed.2020.01.001");
      expect(normDoi(d)).toBe("10.1016/j.freeradbiomed.2020.01.001");
    }
    expect(normalizeDoiForMatch(null)).toBe("");
  });

  it("skips correction, retraction and erratum notices", () => {
    for (const t of ["Correction: Inhibition of retinal injury", "[Retracted] Molecular hydrogen improves type 2 diabetes", "Retraction: Hydrogen-rich saline protects myocardium", "Erratum to: hydrogen water", "Expression of concern: H2 study"]) {
      expect(isPublicationNotice(t)).toBe(true);
    }
    expect(isPublicationNotice("Hydrogen-rich water and exercise recovery: a randomized trial")).toBe(false);
    expect(isPublicationNotice("Correcting oxidative stress with hydrogen")).toBe(false);
  });

  it("title matching ignores case and punctuation; near-title needs Jaccard ≥ 0.9", () => {
    expect(normTitle("28-Days Hydrogen-Rich Water Supplementation ")).toBe(normTitle("28-days hydrogen-rich water supplementation"));
    expect(tokenJaccard(normTitle("Hydrogen water improves recovery in athletes"), normTitle("Hydrogen water improves recovery in elite athletes"))).toBeGreaterThan(0.8);
    expect(tokenJaccard("a b c", "d e f")).toBe(0);
  });
});
