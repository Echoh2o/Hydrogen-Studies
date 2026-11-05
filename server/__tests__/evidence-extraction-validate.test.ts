/**
 * TRUST-BADGE-PLAN Phase 0.7: model output is never trusted as-is. These are
 * the validation rules applied before anything is stored.
 */
import { describe, it, expect, vi } from "vitest";
vi.mock("../db", () => ({ db: {}, pool: {} }));
import { validate } from "../../scripts/research/extract-evidence-fields";

const ABSTRACT = "Twelve healthy men drank 1.5 L/day of hydrogen-rich water (1.6 ppm) for 4 weeks. Blood lactate after exercise was significantly lower than placebo (p<0.05). Funded by a university grant.";

describe("extraction validation", () => {
  it("keeps a verbatim quote despite quote/dash/spacing differences, drops a paraphrase", () => {
    expect(validate({ effect_direction: "improved", effect_direction_evidence: "Blood lactate after exercise was significantly  lower than placebo (p<0.05)." }, ABSTRACT).effect_direction_evidence).toBeTruthy();
    expect(validate({ effect_direction: "improved", effect_direction_evidence: "Lactate fell a lot compared with placebo." }, ABSTRACT).effect_direction_evidence).toBeNull();
  });

  it("rejects out-of-range numbers and unknown enum values", () => {
    const v = validate({ h2_concentration_ppm: 2.544e-6, delivery_route: "teleportation", duration_days: -3, effect_direction: "amazing" }, ABSTRACT);
    expect(v.h2_concentration_ppm).toBeNull();
    expect(v.delivery_route).toBeNull();
    expect(v.duration_days).toBeNull();
    expect(v.effect_direction).toBe("not_reported");
  });

  it("only trusts Echo flags when the abstract names Echo", () => {
    const v = validate({ funded_by_echo: true, used_echo_device: true }, ABSTRACT);
    expect(v.funded_by_echo).toBe(false);
    expect(v.used_echo_device).toBe(false);
    const w = validate({ used_echo_device: true }, ABSTRACT + " Water was produced with an Echo Flask.");
    expect(w.used_echo_device).toBe(true);
  });

  it("population_condition only for patients; defaults for unstated funding/COI", () => {
    const v = validate({ population_kind: "healthy", population_condition: "diabetes" }, ABSTRACT);
    expect(v.population_condition).toBeNull();
    expect(v.funding_category).toBe("not_stated");
    expect(v.coi_declared).toBe("not_stated");
  });
});
