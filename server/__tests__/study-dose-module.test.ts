import { describe, it, expect } from "vitest";
import {
  buildStudyDoseModule,
  isConcentrationText,
  renderStudyDoseModuleHtml,
  studyBridgeTopic,
  studyDoseLine,
  type DoseDevice,
  type StudyDoseFields,
} from "../../shared/study-dose-module";
import { FORBIDDEN_COPY } from "../../shared/evidence-badge-copy";

const device = (o: Partial<DoseDevice>): DoseDevice => ({
  slug: "echo-flask", name: "Echo Flask", shopifyHandle: "echo-flask", deliveryRoute: "drinking_water",
  certifiedConcentrationPpm: 8.25, lab: "H2 Analytics (Las Vegas)", reportId: "H2AR-250116-1",
  reportUrl: "https://support.echowater.com/hc/en-us/articles/34011584300180", badgeEnabled: true, measurementNote: null, ...o,
});
const DEVICES: DoseDevice[] = [
  device({}),
  device({ slug: "echo-h2-machine", name: "Echo H2 Machine", shopifyHandle: "echo-h2-hydrogen-water-machine", certifiedConcentrationPpm: 1.43, reportId: "H2A-240603-3" }),
  device({ slug: "echo-pitcher", name: "Echo Pitcher", certifiedConcentrationPpm: 1.4, badgeEnabled: false, reportId: "H2A-240603-6" }),
  device({ slug: "echo-prebiotic-sticks", name: "Sticks", certifiedConcentrationPpm: 16.15, badgeEnabled: true, measurementNote: "Measured in a sealed lab vial" }),
  device({ slug: "echo-revive", name: "Echo Revive", deliveryRoute: "bath", certifiedConcentrationPpm: null }),
];

const athletes = (o: Partial<StudyDoseFields> = {}): StudyDoseFields => ({
  slug: "effects-of-8-days-intake-pmid-39434721", isHumanTrial: true, evidenceFieldsStatus: "auto_approved",
  deliveryRoute: "drinking_water", concentrationPpm: 1.6, concentrationKind: "stated",
  concentrationRaw: "1,600 ppb, according to the manufacturer's instructions", doseMlPerDay: 1500, dosesPerDay: null,
  durationDays: 28, populationKind: "athletes", populationCondition: null, usedEchoDevice: false,
  healthConditions: ["Exercise-Induced Fatigue", "Muscle Fatigue", "Oxidative Stress"], ...o,
});

describe("PLAN 5.1 studied-dose module — eligibility (Appendix E)", () => {
  it("an allowed-topic study in athletes gets its topic", () => {
    expect(studyBridgeTopic(athletes())).toBe("exercise-recovery");
  });
  it("a disease or gray-area tag anywhere → no bridge", () => {
    expect(studyBridgeTopic(athletes({ healthConditions: ["Oxidative Stress", "Metabolic Syndrome"] }))).toBeNull();
    expect(studyBridgeTopic(athletes({ healthConditions: ["Inflammation", "Oxidative Stress"] }))).toBeNull();
    expect(studyBridgeTopic(athletes({ healthConditions: ["Exercise Performance", "Cardiovascular Efficiency"] }))).toBeNull();
  });
  it("an unlisted tag that is not plainly exercise/fatigue → no bridge (allowlist, not blocklist)", () => {
    expect(studyBridgeTopic(athletes({ healthConditions: ["Oxidative Stress", "Obesity"] }))).toBeNull();
    expect(studyBridgeTopic(athletes({ healthConditions: ["Lactose Intolerance"] }))).toBeNull();
  });
  it("patients, a named population condition, unapproved fields or non-human → no bridge", () => {
    expect(studyBridgeTopic(athletes({ populationKind: "patients" }))).toBeNull();
    expect(studyBridgeTopic(athletes({ populationKind: "older_adults" }))).toBeNull();
    expect(studyBridgeTopic(athletes({ populationCondition: "rheumatoid arthritis" }))).toBeNull();
    expect(studyBridgeTopic(athletes({ evidenceFieldsStatus: "unapproved" }))).toBeNull();
    expect(studyBridgeTopic(athletes({ evidenceFieldsStatus: null }))).toBeNull();
    expect(studyBridgeTopic(athletes({ isHumanTrial: false }))).toBeNull();
  });
});

describe("PLAN 5.1 — the dose line uses only the study's own fields", () => {
  it("builds the full line", () => {
    expect(studyDoseLine(athletes())).toBe("This study used hydrogen-rich water at 1.6 ppm, 1.5 L a day for 4 weeks. Concentration as reported by the authors.");
  });
  it("omits missing amount/duration; says 'measured' when measured; 'up to' for a range", () => {
    expect(studyDoseLine(athletes({ doseMlPerDay: null, durationDays: null, concentrationKind: "measured", concentrationRaw: "5.14 ± 0.03 ppm" })))
      .toBe("This study used hydrogen-rich water at 1.6 ppm. Concentration as measured by the authors.");
    expect(studyDoseLine(athletes({ concentrationPpm: 1.5, concentrationRaw: "1.2-1.5 ppm", doseMlPerDay: 500, durationDays: 1 })))
      .toBe("This study used hydrogen-rich water at up to 1.5 ppm, 500 mL on a single day. Concentration as reported by the authors.");
    expect(studyDoseLine(athletes({ concentrationPpm: 1.9, concentrationRaw: "1.9 ppm", doseMlPerDay: null, durationDays: 7 })))
      .toBe("This study used hydrogen-rich water at 1.9 ppm for 7 days. Concentration as reported by the authors.");
  });
  it("an amount ('0.36 mg of hydrogen') is not a concentration → nothing", () => {
    expect(isConcentrationText("0.36 mg of hydrogen")).toBe(false);
    expect(isConcentrationText("5 mg of H2")).toBe(false);
    expect(isConcentrationText("DH decreased from 960 to 870 μg/L")).toBe(true);
    expect(studyDoseLine(athletes({ concentrationRaw: "0.36 mg of hydrogen" }))).toBeNull();
  });
  it("missing concentration → no module", () => {
    expect(buildStudyDoseModule(athletes({ concentrationPpm: null }), DEVICES)).toBeNull();
    expect(buildStudyDoseModule(athletes({ concentrationRaw: null }), DEVICES)).toBeNull();
  });
});

describe("PLAN 5.1 — device matching and sponsor card", () => {
  it("lists badge-enabled drinking-water devices measured at or above the studied ppm, highest first", () => {
    const m = buildStudyDoseModule(athletes({ concentrationPpm: 1.43 }), DEVICES)!;
    expect(m.devices.map((d) => d.name)).toEqual(["Echo Flask", "Echo H2 Machine"]); // pitcher off, sticks sealed vial, revive bath
    expect(m.devices[0].ppm).toBe("8.25 ppm");
    expect(buildStudyDoseModule(athletes({ concentrationPpm: 1.6 }), DEVICES)!.devices.map((d) => d.name)).toEqual(["Echo Flask"]);
  });
  it("no device reaches the studied concentration → no module", () => {
    expect(buildStudyDoseModule(athletes({ concentrationPpm: 9 }), DEVICES)).toBeNull();
  });
  it("a disease study gets nothing even with a matching concentration", () => {
    expect(buildStudyDoseModule(athletes({ populationKind: "patients", populationCondition: "Parkinson disease", healthConditions: ["Parkinson's Disease"] }), DEVICES)).toBeNull();
  });
  it("store links carry the CLAUDE.md UTM set and rel=sponsored; copy has no forbidden words", () => {
    const m = buildStudyDoseModule(athletes(), DEVICES)!;
    const html = renderStudyDoseModuleHtml(m);
    expect(m.devices[0].href).toBe(
      "https://echowater.com/products/echo-flask?utm_source=hydrogenstudies&utm_medium=referral&utm_campaign=study&utm_content=effects-of-8-days-intake-pmid-39434721",
    );
    expect(html).toContain('rel="sponsored noopener"');
    expect(html).toContain("From our sponsor, Echo Water");
    expect(html).toContain("H2 Analytics (Las Vegas) report H2AR-250116-1");
    expect(html).toContain("This study did not use an Echo device.");
    expect(html).not.toMatch(/__no_content__|undefined|null/);
    for (const re of FORBIDDEN_COPY) expect(html).not.toMatch(re);
  });
  it("usedEchoDevice unknown → claims neither way", () => {
    const html = renderStudyDoseModuleHtml(buildStudyDoseModule(athletes({ usedEchoDevice: null }), DEVICES)!);
    expect(html).not.toContain("did not use an Echo device");
    expect(html).not.toContain("used an Echo device");
  });
});
