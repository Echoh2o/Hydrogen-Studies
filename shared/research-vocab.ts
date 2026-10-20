/**
 * Controlled vocabularies for the structured study fields the MCP server
 * filters, compares and aggregates on.
 *
 * Normalization happens at READ time: the stored columns keep their raw,
 * richer values (study_type holds the species — "Rat", "Mouse", "Human";
 * h2_delivery_method holds e.g. "Water (Electrolysis)" or a brand name), and
 * every consumer maps them through these functions. Nothing here rewrites data.
 * Field coverage snapshot: reports/research/field-coverage-2026-10-20.md.
 */

export const STUDY_DESIGNS = [
  "rct", // randomized controlled trial (human)
  "controlled_trial", // non-randomized controlled / crossover without randomization (human)
  "uncontrolled_trial", // open-label, single-arm, pilot (human)
  "observational", // cohort, cross-sectional, case-control (human)
  "case_report", // case report / case series (human)
  "meta_analysis", // systematic review with or without meta-analysis
  "review", // narrative review, commentary, editorial, hypothesis
  "animal", // in vivo animal experiment
  "in_vitro", // cell culture, tissue, molecular assay
  "other",
] as const;
export type StudyDesign = (typeof STUDY_DESIGNS)[number];

export const SUBJECTS = ["human", "animal", "in_vitro", "review", "unknown"] as const;
export type Subject = (typeof SUBJECTS)[number];

export const OUTCOMES = ["positive", "neutral", "negative", "mixed"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const DELIVERY_METHODS = [
  "inhalation",
  "drinking_water",
  "hydrogen_saline", // H2-dissolved saline, usually injected (i.p./i.v.) or perfused
  "culture_medium", // H2-dissolved medium/solution in vitro
  "bathing",
  "topical",
  "tablet", // magnesium tablets / supplements dissolved to produce H2
  "mixed",
  "other",
] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

const HUMAN_DESIGNS = new Set<StudyDesign>(["rct", "controlled_trial", "uncontrolled_trial", "observational", "case_report"]);

export function isStudyDesign(v: unknown): v is StudyDesign {
  return typeof v === "string" && (STUDY_DESIGNS as readonly string[]).includes(v);
}

export function normalizeOutcome(raw: string | null | undefined): Outcome | null {
  const v = raw?.trim().toLowerCase();
  if (!v) return null;
  return (OUTCOMES as readonly string[]).includes(v) ? (v as Outcome) : null;
}

/**
 * Map a raw h2_delivery_method value ("Gas", "Water (Electrolysis)",
 * "Saline (Dissolved)", "inhalation", brand names…) onto DELIVERY_METHODS.
 */
export function normalizeDeliveryMethod(raw: string | null | undefined): DeliveryMethod | null {
  const v = raw?.trim().toLowerCase();
  if (!v) return null;
  if ((DELIVERY_METHODS as readonly string[]).includes(v)) return v as DeliveryMethod;
  if (v === "drinking") return "drinking_water";
  if (v === "saline" || v === "injection") return "hydrogen_saline";
  if (v.includes("/") || v === "mixed") return "mixed";
  if (v.startsWith("gas") || v.includes("inhal")) return "inhalation";
  if (v.includes("tablet") || v.includes("supplement")) return "tablet";
  if (v.startsWith("water") || v.includes("drink")) return "drinking_water";
  if (v.startsWith("saline") || v.startsWith("perfusion") || v.includes("inject") || v.includes("infusion")) {
    return "hydrogen_saline";
  }
  if (v.startsWith("medium") || v.startsWith("solution")) return "culture_medium";
  if (v.includes("bath")) return "bathing";
  if (v.includes("topical") || v.includes("cream") || v.includes("eye drop")) return "topical";
  return "other";
}

const IN_VITRO_TYPES = /^(cell culture|molecular assay|in vitro|tissue)/i;

/**
 * Who/what was studied. Prefers the extracted study_design; falls back to
 * the legacy study_type (species) + is_human_trial when design is unknown.
 * Legacy study_type "clinical" is an unclassified import bucket (mostly
 * reviews) — without a design it is "unknown", never assumed human.
 */
export function classifySubject(row: {
  studyDesign?: string | null;
  studyType?: string | null;
  isHumanTrial?: boolean | null;
}): Subject {
  const design = isStudyDesign(row.studyDesign) ? row.studyDesign : null;
  if (design) {
    if (HUMAN_DESIGNS.has(design)) return "human";
    if (design === "meta_analysis" || design === "review") return "review";
    if (design === "animal") return "animal";
    if (design === "in_vitro") return "in_vitro";
    return "unknown";
  }
  const type = row.studyType?.trim() ?? "";
  if (/^human$/i.test(type)) return "human";
  if (/^clinical$/i.test(type) || !type) return "unknown";
  if (IN_VITRO_TYPES.test(type)) return "in_vitro";
  return "animal"; // every other legacy value is a species (Rat, Mouse, Pig…)
}
