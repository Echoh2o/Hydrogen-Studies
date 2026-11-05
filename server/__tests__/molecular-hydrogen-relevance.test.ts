/**
 * Josh 2026-11-05: auto-reject off-topic queue papers (hydrogen energy, etc.).
 * Off-topic only when nothing hydrogen-related remains once unrelated senses
 * (peroxide, sulfide, bonds, ions, H2O, H2S, H2-receptor drugs) are stripped;
 * borderline papers stay "ambiguous" for the reviewer/AI check. Measured on
 * the live database: 19 of 2,257 studies would have been called off_topic.
 */
import { describe, it, expect } from "vitest";
import { molecularHydrogenRelevance as rel } from "../../shared/molecular-hydrogen-relevance";

describe("molecularHydrogenRelevance", () => {
  it.each([
    ["Hydrogen-Rich Water Prevents Dehydration-Induced Oxidative Stress in Human Skin Keratinocytes", ""],
    ["Molecular Hydrogen Affected Post-Exercise Recovery in Judo Athletes", ""],
    ["Protection of the endothelium by hydrogen against ischaemia-reperfusion injury in a porcine model", ""],
    ["Electrochemically reduced water protects neural cells from oxidative damage", ""],
    ["In-joint photocatalytic hydrogen production prevents RA in mice", ""],
  ])("on topic: %s", (title, abstract) => {
    expect(rel({ title, abstract }).verdict).toBe("on_topic");
  });

  it.each([
    "Hydrogen Peroxide Toxicity.",
    "Exogenous hydrogen sulphide alleviates diabetes-associated cognitive decline",
    "Regio- and Stereoselective Synthesis Assisted by Hydrogen Bonding.",
    "Exogenous H(2)S suppresses traumatic stress-induced changes in rat liver",
    "Identification of Entacapone as a Novel β-Arrestin 1 Biased Antagonist of CXCR7.",
    "Correction: Inhibition of retinal injury by inhalation of hydrogen",
  ])("off topic: %s", (title) => {
    expect(rel({ title, abstract: "" }).verdict).toBe("off_topic");
  });

  it("keeps hydrogen-energy papers off topic (existing filter)", () => {
    expect(rel({ title: "Biohydrogen production by dark fermentation in a fuel cell", abstract: "" }).verdict).toBe("off_topic");
  });

  it("sends physics and borderline papers to review, not straight to rejection", () => {
    expect(rel({ title: "Insertion vs. abstraction in the atomic hydrogen + molecular hydrogen reaction", abstract: "" }).verdict).not.toBe("on_topic");
    expect(rel({ title: "Hydrogen Gas and Its Biological Effects", abstract: "" }).verdict).not.toBe("off_topic");
  });
});
