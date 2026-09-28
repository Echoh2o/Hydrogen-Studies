/**
 * shared/study-topic-filter.ts — hydrogen-ENERGY vs hydrogen-HEALTH classifier.
 *
 * Positives/negatives marked "(prod #id)" are verbatim titles (+ keywords where
 * the verdict depends on them) from the production studies table, 2026-09-28;
 * "(queue #id)" are title-only items the discovery engine queued (PubMed
 * summaries carry no abstract). The rest are realistic titles from the
 * hydrogen-energy literature.
 */
import { describe, it, expect } from "vitest";
import { isHydrogenEnergyStudy, partitionByEnergyTopic } from "@shared/study-topic-filter";

type Case = { title: string; keywords?: string[]; abstract?: string; journal?: string };

const ENERGY: Case[] = [
  // (prod #3592)
  {
    title: "Rational comparison of biohydrogen production using Clostridium species through dark fermentation during anaerobic batch processes",
    keywords: ["biohydrogen production", "Clostridium pasteurianum", "dark fermentation", "anaerobic batch processes", "hydrogen yield", "biofuel production"],
  },
  // (prod #4298) — the example called out in the 2026-09-23 audit
  {
    title: "Hydrogen-producing facultative anaerobic bacteria isolated from kitchen wastewater for sustainable bioenergy applications",
    keywords: ["hydrogen production", "dark fermentation", "bioenergy", "wastewater treatment", "microbial fuel cell", "biohydrogen"],
  },
  // (prod #4297)
  {
    title: "Existing and emerging technologies in biohydrogen production: mechanisms and influential factors for sustainable energy transition",
    keywords: ["biohydrogen production", "dark fermentation", "biophotolysis", "sustainable energy", "microbial electrolysis"],
  },
  // (prod #4120) — title alone is ambiguous; keywords make it energy
  {
    title: "Functional microorganisms in hydrogen production: Mechanisms and applications",
    keywords: ["biohydrogen production", "functional microorganisms", "sustainable energy", "dark fermentation", "photo fermentation", "renewable energy sources"],
    journal: "Bioresource Technology",
  },
  // (prod #3720)
  {
    title: "Microbial Production of Hydrogen: An Overview",
    keywords: ["hydrogen production", "anaerobic bacteria", "biohydrogen", "microbial fermentation", "renewable energy"],
  },
  // (prod #4223) — hydrogen economy / climate, abstract carries the signal
  {
    title: "The global hydrogen budget",
    keywords: ["hydrogen budget", "atmospheric chemistry", "climate change", "environmental health", "global warming potential"],
    abstract:
      "Hydrogen (H2) will play a part in decarbonizing the global energy system1. This raises concerns about the climate consequences of increasing H2 use under future hydrogen economies3,5.",
    journal: "Nature",
  },
  { title: "Techno-economic assessment of green hydrogen production via PEM electrolysis coupled with offshore wind" },
  { title: "Hydrogen embrittlement of X70 pipeline steel in high-pressure gaseous hydrogen environments" },
  { title: "Performance and durability of proton exchange membrane fuel cells under dynamic load cycling" },
  { title: "NiFe layered double hydroxide nanosheets as efficient electrocatalysts for the hydrogen evolution reaction in alkaline media" },
  { title: "Liquid organic hydrogen carriers for large-scale hydrogen storage: a review" },
  { title: "Combustion characteristics and NOx emissions of a hydrogen-fueled spark-ignition internal combustion engine" },
  { title: "Biohydrogen production from food waste by thermophilic dark fermentation in a continuous stirred tank reactor" },
  { title: "Photofermentative hydrogen production by Rhodobacter sphaeroides using brewery wastewater" },
  { title: "The hydrogen economy: policy pathways for decarbonizing heavy industry" },
  { title: "Blending hydrogen into natural gas pipelines: effects on residential end-use appliances" },
  { title: "Solid oxide electrolysis cells for high-temperature steam electrolysis: degradation mechanisms" },
  { title: "Hydrogen storage capacity of Mg-based alloys prepared by high-energy ball milling" },
  { title: "Life-cycle assessment of hydrogen refuelling stations for fuel cell electric vehicles" },
  { title: "Solar-to-hydrogen efficiency of tandem photoelectrochemical water splitting devices" },
  { title: "Anion exchange membrane water electrolysis: stability of non-precious metal catalysts", journal: "International Journal of Hydrogen Energy" },
  // (queue #1057, #1083, #1391, #1456, #1738, #2997, #1461) — title only
  { title: "Liquid Alkaline Water Electrolyzers: Comparing Performance across Design, Operation, and End-of-Life Scenarios." },
  { title: "Recovery and quality of water produced by commercial fuel cells" },
  { title: "H2 in an Exisiting Natural Gas Pipeline" },
  { title: "Water-Soluble Defect-Rich MoS2 Ultrathin Nanosheets for Enhanced Hydrogen Evolution" },
  { title: "Surface and Interfacial Engineering of Electrocatalysts for Seawater Electrolysis." },
  { title: "Buffering the Active State for Proton Exchange Membrane Water Electrolysis." },
  { title: "Copper-Based Water Gas Shift Catalysts for Hydrogen Rich Syngas Production from Biomass Steam Gasification" },
];

const HEALTH: Case[] = [
  // (prod #3138) — "microbial hydrogen economy" is gut biology
  { title: "Microbial hydrogen economy alleviates colitis by reprogramming colonocyte metabolism and reinforcing intestinal barrier" },
  // (prod #4063) — mentions renewable energy, but is a therapy review
  { title: "More Than Clean, Sustainable, and Renewable Energy Source: New Therapeutic Role for Hydrogen?" },
  // (prod #3062) — water splitting used as nanomedicine
  { title: "NIR-Driven Water Splitting H<sub>2</sub> Production Nanoplatform for H<sub>2</sub>-Mediated Cascade-Amplifying Synergetic Cancer Therapy" },
  // (prod #4242)
  { title: "Hydrogen evolution and dynamics in hydrogel electrochemical cells for ischemia-reperfusion therapy" },
  // (prod #2780)
  { title: "Influence of Hydrogen Discharged from Palladium Base Hydrogen Storage Alloys on Cancer Cells" },
  // (prod #2477) — water electrolysis as the H2 source for inhalation
  { title: "Inhalation of water electrolysis-derived hydrogen ameliorates cerebral ischemia–reperfusion injury in rats – A possible new hydrogen resource for clinical use" },
  // (prod #2914)
  { title: "A novel bioactive haemodialysis system using dissolved dihydrogen (H2) produced by water electrolysis: a clinical trial" },
  // (prod #4251) — breath-test H2 production
  { title: "Hydrogen Production Dynamics During Lactulose Breath Testing in Patients with Suspected SIBO" },
  // (prod #2343) — gut-microbial H2 production
  { title: "Quantification of hydrogen production by intestinal bacteria that are specifically dysregulated in Parkinson's disease" },
  // (prod #3081)
  { title: "Hydrogen‐Powered Microswimmers for Precise and Active Hydrogen Therapy Towards Acute Ischemic Stroke" },
  // (prod #3085) — photocatalytic H2 material whose keywords are therapy
  {
    title: "Homogeneous Carbon/Potassium‐Incorporation Strategy for Synthesizing Red Polymeric Carbon Nitride Capable of Near‐Infrared Photocatalytic H<sub>2</sub> Production",
    keywords: ["hydrogen therapy", "photocatalytic hydrogen generation", "cancer therapy", "tumor treatment", "solar hydrogen energy"],
  },
  // (prod #3436)
  { title: "Modulating the Electronic Structure of MnNi<sub>2</sub>S<sub>3</sub> Nanoelectrodes to Activate Pyroptosis for Electrocatalytic Hydrogen‐Immunotherapy" },
  // (prod #2077)
  { title: "Effects of electrolyzed hydrogen water ingestion during endurance exercise in a heated environment on body fluid balance and exercise performance" },
  // (prod #2861)
  { title: "Saturated hydrogen saline protects against noise–induced hearing loss" },
  // (prod #4205)
  { title: "Hydrogen and Methane Breath Test: The Asian Neurogastroenterology and Motility Association Monograph" },
  // (prod #3902)
  { title: "Clinical Applications of Magnesium Hydride" },
  // (prod #4008)
  { title: "Oxy-hydrogen Gas: The Rationale Behind Its Use as a Novel and Sustainable Treatment for COVID-19 and Other Respiratory Diseases" },
  // (prod #3379)
  { title: "Magnesium implantation as a continuous hydrogen production generator for the treatment of myocardial infarction in rats" },
  // (prod #3973) — no abstract; ambiguous title stays in
  { title: "Polymers producing hydrogen" },
  // (prod #3007)
  { title: "On the Physiology of Hydrogen Diving and Its Implication for Hydrogen Biochemical Decompression" },
  { title: "Hydrogen peroxide-induced oxidative stress in human keratinocytes" },
  { title: "Hydrogen sulfide as a gasotransmitter in cardiovascular physiology" },
  { title: "Deuterium-depleted water in cancer patients: a pilot study" },
  { title: "Hydrogen bonding networks stabilize the binding of ibuprofen to human serum albumin" },
  { title: "Effects of hydrogen bathing on skin moisture and blood flow in healthy adults" },
  { title: "Molecular hydrogen inhalation improves exercise capacity in patients with COPD: a randomized controlled trial" },
  // (queue #2741, #3447, #2230, #1431) — H2 devices/nanomedicine framed as health
  { title: "Bandage-Type Autocatalytic PdCl(2)‑Containing Film as Visual Hydrogen Sensor for Noninvasive Monitoring of Mg-Alloy Biodegradation" },
  { title: "Integrated O(2) and H(2) Gas Therapy via Microneedle-Assisted Photocatalytic Water Splitting for Accelerating Diabetic Full-Thickness Wound Healing" },
  { title: "Microbial-Semiconductor Hybrids Enable Near Infrared-Driven Photosynthetic Hydrogen Production for Tumor-Targeted Immunotherapy." },
  { title: "Hydrogen-Nano-Bubble-Rich Water in Bucket/Bathtub Improves Intractable Skin Roughness" },
];

describe("isHydrogenEnergyStudy — energy research is flagged", () => {
  it.each(ENERGY.map((c) => [c.title, c] as const))("%s", (_title, c) => {
    const v = isHydrogenEnergyStudy(c);
    expect(v.excluded).toBe(true);
    expect(v.confidence === "high" || v.confidence === "medium").toBe(true);
    expect(v.reason).toMatch(/hydrogen energy/);
    expect(v.energySignals.length).toBeGreaterThan(0);
  });

  it("has enough positive fixtures", () => expect(ENERGY.length).toBeGreaterThanOrEqual(15));
});

describe("isHydrogenEnergyStudy — health research is never flagged", () => {
  it.each(HEALTH.map((c) => [c.title, c] as const))("%s", (_title, c) => {
    const v = isHydrogenEnergyStudy(c);
    expect(v.excluded).toBe(false);
    expect(v.confidence).toBeNull();
    expect(v.reason).toBeNull();
  });

  it("has enough negative fixtures", () => expect(HEALTH.length).toBeGreaterThanOrEqual(15));
});

describe("isHydrogenEnergyStudy — confidence and edge cases", () => {
  it("rates a title that names ≥2 energy signals as high confidence", () => {
    const v = isHydrogenEnergyStudy({ title: "Biohydrogen production from food waste by thermophilic dark fermentation" });
    expect(v).toMatchObject({ excluded: true, confidence: "high" });
  });

  it("rates an abstract/keyword-only signal as medium (reviewable) confidence", () => {
    const v = isHydrogenEnergyStudy(ENERGY.find((c) => c.title === "The global hydrogen budget")!);
    expect(v).toMatchObject({ excluded: true, confidence: "medium" });
  });

  it("any health term in the keywords vetoes an energy-sounding title", () => {
    const v = isHydrogenEnergyStudy({
      title: "Biohydrogen production by gut bacteria",
      keywords: ["gut microbiota", "colitis"],
    });
    expect(v.excluded).toBe(false);
    expect(v.healthSignals).toContain("gut");
  });

  it("a medical abstract blocks a medium-confidence flag", () => {
    const v = isHydrogenEnergyStudy({
      title: "Hydrogen fuel for portable devices",
      abstract: "We evaluated the device in patients receiving therapy for chronic disease.",
    });
    expect(v.excluded).toBe(false);
  });

  it("wastewater 'treatment' and 'pretreatment' are not health vocabulary", () => {
    const v = isHydrogenEnergyStudy({
      title: "Biohydrogen from dark fermentation of pretreated sludge",
      abstract: "Acid pretreatment and heat treatment of wastewater treatment sludge improved hydrogen yield.",
    });
    expect(v).toMatchObject({ excluded: true, confidence: "high" });
    expect(v.healthSignals).toEqual([]);
  });

  it("handles empty / missing input without flagging", () => {
    expect(isHydrogenEnergyStudy({}).excluded).toBe(false);
    expect(isHydrogenEnergyStudy({ title: null, abstract: null, keywords: null }).excluded).toBe(false);
  });

  it("accepts keywords as a single string", () => {
    const v = isHydrogenEnergyStudy({ title: "Microbial production of hydrogen", keywords: "biohydrogen; renewable energy" });
    expect(v.excluded).toBe(true);
  });

  it("partitionByEnergyTopic splits a result list and keeps the verdict", () => {
    const items = [
      { t: "Hydrogen-rich water improves sleep quality in adults" },
      { t: "Biohydrogen production from food waste by dark fermentation" },
    ];
    const { kept, excluded } = partitionByEnergyTopic(items, (i) => ({ title: i.t }));
    expect(kept.map((i) => i.t)).toEqual(["Hydrogen-rich water improves sleep quality in adults"]);
    expect(excluded).toHaveLength(1);
    expect(excluded[0].verdict.confidence).toBe("high");
  });
});
