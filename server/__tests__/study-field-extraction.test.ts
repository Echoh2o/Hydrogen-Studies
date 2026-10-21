import { describe, it, expect, vi } from "vitest";

vi.mock("../services/ai-provider", () => ({ ai: { generateJSON: vi.fn() }, MODELS: { HAIKU: "claude-haiku-4-5" } }));

const { parseExtraction, planUpdates } = await import("../services/study-field-extraction");
const { normalizeDeliveryMethod, normalizeOutcome, classifySubject } = await import("@shared/research-vocab");

const base = {
  id: 7,
  title: "Hydrogen water and fatigue",
  abstract: "…",
  conclusion: "…",
  studyType: "Human",
  isHumanTrial: true,
  outcome: null,
  sampleSize: null,
  duration: null,
  h2DeliveryMethod: null,
  h2Concentration: null,
  dosageProtocol: null,
};

const extracted = parseExtraction({
  study_design: "rct",
  species: "Human",
  sample_size: 40,
  duration_days: 56,
  outcome: "Positive",
  h2_delivery_method: "drinking_water",
  h2_concentration: "1.6 ppm",
  dosage_protocol: "1.5 L/day for 8 weeks",
  is_human_trial: true,
  on_topic: true,
})!;

describe("research-vocab", () => {
  it("normalizes legacy delivery values", () => {
    expect(normalizeDeliveryMethod("Gas (Sustained Release)")).toBe("inhalation");
    expect(normalizeDeliveryMethod("Water, Commercial (Nordenau)")).toBe("drinking_water");
    expect(normalizeDeliveryMethod("Saline (Dissolved)")).toBe("hydrogen_saline");
    expect(normalizeDeliveryMethod("Medium (Dissolved)")).toBe("culture_medium");
    expect(normalizeDeliveryMethod("Gas/Saline (Dissolved)")).toBe("mixed");
    expect(normalizeDeliveryMethod("drinking")).toBe("drinking_water");
    expect(normalizeDeliveryMethod("")).toBeNull();
    expect(normalizeDeliveryMethod("Glycerin")).toBe("other");
    expect(normalizeDeliveryMethod("Water (Mg-Chemico)")).toBe("tablet");
    expect(normalizeDeliveryMethod("Saline, Commercial (Dr. Hayashi Hydrogen Rich Water Stick)")).toBe("tablet");
  });

  it("normalizes outcomes case-insensitively and rejects junk", () => {
    expect(normalizeOutcome("Positive")).toBe("positive");
    expect(normalizeOutcome("great")).toBeNull();
  });

  it("classifies subject from design, then legacy species", () => {
    expect(classifySubject({ studyDesign: "rct" })).toBe("human");
    expect(classifySubject({ studyDesign: "meta_analysis", studyType: "Human" })).toBe("review");
    expect(classifySubject({ studyType: "Rat" })).toBe("animal");
    expect(classifySubject({ studyType: "Cell Culture" })).toBe("in_vitro");
    expect(classifySubject({ studyType: "clinical", isHumanTrial: true })).toBe("unknown");
  });
});

describe("parseExtraction", () => {
  it("validates and normalizes model output", () => {
    expect(extracted).toMatchObject({ studyDesign: "rct", sampleSize: 40, durationDays: 56, outcome: "positive", deliveryMethod: "drinking_water" });
  });

  it("rejects an off-vocabulary design and nulls implausible numbers", () => {
    expect(parseExtraction({ study_design: "anecdote" })).toBeNull();
    expect(parseExtraction({ study_design: "Systematic Review" })!.studyDesign).toBe("meta_analysis");
    expect(parseExtraction({ study_design: "randomized-controlled-trial" })!.studyDesign).toBe("rct");
    expect(parseExtraction({ study_design: "in vivo" })!.studyDesign).toBe("animal");
    expect(parseExtraction({ study_design: "in_vitro, animal" })!.studyDesign).toBe("animal");
    expect(parseExtraction({ study_design: "animal and rct" })!.studyDesign).toBe("rct");
    expect(parseExtraction({ study_design: "mixed" })!.studyDesign).toBe("other");
    expect(parseExtraction({ study_design: "erratum" })).toMatchObject({ studyDesign: "other", notice: "erratum" });
    expect(parseExtraction({ study_design: "Expression of concern" })!.notice).toBe("expression_of_concern");
    expect(parseExtraction({ study_design: "corrigendum" })!.notice).toBe("erratum");
    expect(parseExtraction({ study_design: "rct", h2_concentration: "x".repeat(150) })!.h2Concentration).toHaveLength(100);
    const x = parseExtraction({ study_design: "animal", sample_size: -3, duration_days: "8 weeks" })!;
    expect(x.sampleSize).toBeNull();
    expect(x.durationDays).toBeNull();
    expect(x.onTopic).toBe(true);
    expect(x.notice).toBeNull();
    expect(parseExtraction({ study_design: "animal", duration_days: 0.2 })!.durationDays).toBe(1);
  });
});

describe("planUpdates", () => {
  const now = new Date("2026-10-20T00:00:00Z");

  it("always writes the new columns and fills empty fields", () => {
    const { updates, corrections } = planUpdates(base, extracted, now);
    expect(updates).toEqual({
      studyDesign: "rct",
      fieldsExtractedAt: now,
      sampleSize: 40,
      duration: 56,
      outcome: "positive",
      h2DeliveryMethod: "drinking_water",
      h2Concentration: "1.6 ppm",
      dosageProtocol: "1.5 L/day for 8 weeks",
    });
    expect(corrections).toEqual([]);
  });

  it("never overwrites an existing value", () => {
    const { updates } = planUpdates({ ...base, outcome: "Neutral", h2DeliveryMethod: "Water (Electrolysis)", sampleSize: 12 }, extracted, now);
    expect(updates).not.toHaveProperty("outcome");
    expect(updates).not.toHaveProperty("h2DeliveryMethod");
    expect(updates).not.toHaveProperty("sampleSize");
  });

  it("reports disagreements and off-topic papers instead of writing them", () => {
    const offTopic = { ...extracted, isHumanTrial: false, species: null, onTopic: false };
    const { updates, corrections } = planUpdates({ ...base, studyType: "clinical" }, offTopic, now);
    expect(updates).not.toHaveProperty("isHumanTrial");
    expect(updates).not.toHaveProperty("isExcluded");
    expect(corrections.map((c) => c.field)).toEqual(["is_human_trial", "is_excluded"]);
  });

  it("reports retraction / concern notices for exclusion review", () => {
    const notice = { ...extracted, notice: "retraction_notice" as const };
    const { updates, corrections } = planUpdates(base, notice, now);
    expect(updates).not.toHaveProperty("isExcluded");
    expect(corrections).toEqual([expect.objectContaining({ field: "is_excluded", proposed: "true (retraction_notice)" })]);
  });

  it("proposes a species for the legacy clinical bucket and fills a null human flag", () => {
    const { updates, corrections } = planUpdates({ ...base, studyType: "clinical", isHumanTrial: null }, extracted, now);
    expect(updates.isHumanTrial).toBe(true);
    expect(corrections).toEqual([expect.objectContaining({ field: "study_type", proposed: "Human" })]);
  });
});
