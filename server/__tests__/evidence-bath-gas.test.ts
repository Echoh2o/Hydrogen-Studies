import { describe, expect, it } from "vitest";
import { doseMatch, doseMatchRuleText, topicMatch, type EvidenceStudyRow } from "../../shared/evidence-match";
import { BADGE, FORBIDDEN_COPY, PROFILE, ROUTE_COPY, measureLabel } from "../../shared/evidence-badge-copy";
import { validateGasDose } from "../../shared/gas-dose";

const row = (o: Partial<EvidenceStudyRow>): EvidenceStudyRow => ({
  id: 1, slug: "s", title: "t", publishYear: 2020, pmid: null, doi: null, studyDesign: "rct", sampleSize: 20, durationDays: 7,
  deliveryRoute: "drinking_water", concentrationPpm: null, concentrationKind: null, h2FlowMlMin: null, hyperbaric: false,
  populationKind: "healthy", effectDirection: "improved", fundingCategory: "academic", fundedByEcho: false, usedEchoDevice: false,
  healthConditions: [], ...o,
});

const revive = { slug: "echo-revive", name: "Echo Revive", deliveryRoute: "bath", certifiedConcentrationPpm: 2.22 };
const refresh = { slug: "echo-refresh", name: "Echo Refresh", deliveryRoute: "inhaled_gas", certifiedConcentrationPpm: null, certifiedH2FlowMlMin: 1280 };
const flask = { slug: "echo-flask", name: "Echo Flask", deliveryRoute: "drinking_water", certifiedConcentrationPpm: 8.25 };

const rows = [
  row({ id: 1, deliveryRoute: "bath", concentrationPpm: 0.55 }),
  row({ id: 2, deliveryRoute: "bath", concentrationPpm: 8 }),
  row({ id: 3, deliveryRoute: "bath", concentrationPpm: null }),
  row({ id: 4, deliveryRoute: "inhaled_gas", h2FlowMlMin: 300 }),
  row({ id: 5, deliveryRoute: "inhaled_gas", h2FlowMlMin: 2000 }),
  row({ id: 6, deliveryRoute: "inhaled_gas", h2FlowMlMin: 300, hyperbaric: true }),
  row({ id: 7, deliveryRoute: "inhaled_gas", h2FlowMlMin: null }),
  row({ id: 8, deliveryRoute: "drinking_water", concentrationPpm: 1.6 }),
];

describe("dose match by route", () => {
  it("bath: tub-water mg/L against the Revive's 2.22", () => {
    const d = doseMatch(rows, revive);
    expect(d.route).toBe("bath");
    expect([d.routeStudies, d.withDose, d.notReported]).toEqual([3, 2, 1]);
    expect(d.matched.map((r) => r.id)).toEqual([1]);
  });
  it("gas: H2 flow against the Refresh's 1,280 mL/min; hyperbaric never matches", () => {
    const d = doseMatch(rows, refresh);
    expect(d.route).toBe("inhaled_gas");
    expect([d.routeStudies, d.withDose, d.notReported]).toEqual([4, 2, 2]);
    expect(d.matched.map((r) => r.id)).toEqual([4]);
  });
  it("drinking is unchanged and keeps the legacy field names", () => {
    const d = doseMatch(rows, flask);
    expect(d.matched.map((r) => r.id)).toEqual([8]);
    expect([d.drinkingStudies, d.withConcentration]).toEqual([1, 1]);
  });
  it("a product's topic widget counts only its own route", () => {
    const r = [row({ id: 1, deliveryRoute: "bath", healthConditions: ["Skin Aging"] }), row({ id: 2, healthConditions: ["Skin Aging"] })];
    expect(topicMatch(r, "skin-appearance", "bath").studies.map((s) => s.id)).toEqual([1]);
    expect(topicMatch(r, "skin-appearance").studies).toHaveLength(2);
  });
});

describe("copy", () => {
  it("labels and badge lines per route", () => {
    expect(measureLabel(revive)).toBe("2.22 ppm");
    expect(measureLabel(refresh)).toBe("1,280 mL/min");
    expect(BADGE.line2(doseMatch(rows, revive), "2.22 ppm")).toBe("1 used bath water at ≤2.22 ppm");
    expect(BADGE.line2(doseMatch(rows, refresh), "1,280 mL/min")).toBe("1 used a hydrogen flow of ≤1,280 mL/min");
  });
  it("drinking summary is word-for-word the approved v1 text", () => {
    const d = doseMatch(rows, flask);
    expect(PROFILE.summary(d, "Echo Flask", "8.25 ppm")).toBe(
      "Of 1 human studies of drinking hydrogen water, 1 report the concentration they used, and 1 of those used 8.25 ppm or less, a level the Echo Flask reaches. Of those 1, 1 improved their main outcome. 0 studies did not report a concentration and are not counted.",
    );
  });
  it("no forbidden words in any bath/gas string", () => {
    const texts = [
      ...Object.values(ROUTE_COPY).flatMap((c) => [c.studiesOf, c.doseReported, c.levelNote("Echo Revive"), c.notReported, c.studied, c.measuredBy, c.notAdvice, c.line2("3", "x")]),
      doseMatchRuleText(revive), doseMatchRuleText(refresh),
      PROFILE.summary(doseMatch(rows, revive), "Echo Revive", "2.22 ppm"), PROFILE.summary(doseMatch(rows, refresh), "Echo Refresh", "1,280 mL/min"),
    ];
    for (const t of texts) for (const re of FORBIDDEN_COPY) expect(re.test(t), `${re} in: ${t}`).toBe(false);
  });
});

describe("validateGasDose", () => {
  const src = "Participants inhaled 6.5 (0.1) vol% hydrogen gas in 2 L/min of mixed air twice a day. We previously used hyperbaric oxygen.";
  it("computes flow from a stated % and total flow found verbatim", () => {
    const g = validateGasDose({ h2_gas_percent: 6.5, gas_total_flow_l_min: 2, h2_gas_raw: "inhaled 6.5 (0.1) vol% hydrogen gas in 2 L/min of mixed air" }, src);
    expect([g.h2_flow_ml_min, g.h2_flow_kind, g.hyperbaric]).toEqual([130, "computed", false]);
  });
  it("drops numbers whose quote is not in the paper", () => {
    const g = validateGasDose({ h2_flow_ml_min: 300, h2_gas_raw: "H2 at 300 mL/min via cannula" }, src);
    expect(g.h2_flow_ml_min).toBeNull();
  });
  it("a percentage alone gives no flow; diving is hyperbaric", () => {
    const g = validateGasDose({ h2_gas_percent: 49, h2_gas_raw: "a hydrogen-helium-oxygen mixture containing 49% hydrogen" }, "an open sea dive to 500 m with a hydrogen-helium-oxygen mixture containing 49% hydrogen");
    expect([g.h2_flow_ml_min, g.h2_gas_percent, g.hyperbaric]).toEqual([null, 49, true]);
  });
});

describe("store list (echowater.com modal)", () => {
  it("names only healthy-population studies whose paper title names no condition", async () => {
    const { storeList } = await import("../../shared/evidence-match");
    const r = storeList([
      row({ id: 1, populationKind: "healthy", paperTitle: "Hydrogen-rich water and exercise recovery in trained men" }),
      row({ id: 2, populationKind: "patients", paperTitle: "Hydrogen water in Parkinson's disease" }),
      row({ id: 3, populationKind: "healthy", paperTitle: "Hydrogen inhalation for stroke prevention: a safety study in healthy adults", title: "Safe in healthy adults" }),
      row({ id: 4, populationKind: null, paperTitle: "Hydrogen baths" }),
      row({ id: 5, populationKind: "athletes", paperTitle: "Effects of hydrogen water on swimming performance" }),
    ]);
    expect(r.listed.map((s) => s.id)).toEqual([1, 5]);
    expect(r.notListed).toBe(3);
  });
});

describe("drink mix (sealed-vial figure)", () => {
  const sticks = { slug: "echo-prebiotic-sticks", name: "Echo Hydrogen Prebiotic Stick Packs", deliveryRoute: "drinking_water", certifiedConcentrationPpm: 16.15, sealedVial: true };
  const r = [row({ id: 1, concentrationPpm: 1.5 }), row({ id: 2, concentrationPpm: 1.6 }), row({ id: 3, concentrationPpm: 5 })];
  it("is capped at the open-glass limit, never matched at 16.15", () => {
    const d = doseMatch(r, sticks);
    expect(d.ceilingBasis).toBe("open_glass_limit");
    expect(d.matched.map((s) => s.id)).toEqual([1, 2]);
    expect(measureLabel(sticks)).toBe("1.6 ppm");
  });
  it("says why, in the rule and the summary, with no forbidden words", () => {
    const rule = doseMatchRuleText(sticks);
    const sum = PROFILE.summary(doseMatch(r, sticks), sticks.name, "1.6 ppm");
    expect(rule).toMatch(/sealed lab vial/);
    expect(sum).toMatch(/open glass of water holds/);
    for (const t of [rule, sum, PROFILE.echoDevice(doseMatch(r, sticks))]) for (const re of FORBIDDEN_COPY) expect(re.test(t)).toBe(false);
  });
  it("an open-glass figure (no sealed flag) is used as measured; the Flask is unaffected", () => {
    expect(doseMatch(r, { ...sticks, sealedVial: false, certifiedConcentrationPpm: 3 }).matched).toHaveLength(2);
    expect(doseMatch(r, { ...sticks, sealedVial: false, certifiedConcentrationPpm: 3 }).ceilingBasis).toBe("measured");
    expect(doseMatch(r, flask).ceilingBasis).toBe("measured");
    expect(doseMatch(r, flask).matched).toHaveLength(3);
  });
});
