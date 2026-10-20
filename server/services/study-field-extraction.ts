/**
 * Structured-field extraction for studies (MCP plan Phase 0).
 *
 * One Haiku call per study extracts design, subject, sample size, duration,
 * outcome and H2 protocol fields from title + abstract + conclusion. The write
 * policy is conservative:
 *   - study_design / fields_extracted_at (new columns) are always written;
 *   - every other field is written ONLY when the stored value is empty;
 *   - disagreements with stored values (is_human_trial, the "clinical"
 *     study_type bucket), off-topic papers and retraction/concern notices
 *     are returned as `corrections`
 *     for a human-reviewed report — never written here.
 */
import { ai, MODELS } from "./ai-provider";
import {
  STUDY_DESIGNS,
  DELIVERY_METHODS,
  isStudyDesign,
  normalizeOutcome,
  normalizeDeliveryMethod,
  type StudyDesign,
  type Outcome,
  type DeliveryMethod,
} from "@shared/research-vocab";

export interface ExtractionInput {
  id: number;
  title: string | null;
  abstract: string | null;
  conclusion: string | null;
  studyType: string | null;
  isHumanTrial: boolean | null;
  outcome: string | null;
  sampleSize: number | null;
  duration: number | null;
  h2DeliveryMethod: string | null;
  h2Concentration: string | null;
  dosageProtocol: string | null;
}

export interface ExtractedFields {
  studyDesign: StudyDesign;
  species: string | null;
  sampleSize: number | null;
  durationDays: number | null;
  outcome: Outcome | null;
  deliveryMethod: DeliveryMethod | null;
  h2Concentration: string | null;
  dosageProtocol: string | null;
  isHumanTrial: boolean;
  onTopic: boolean;
  /** Retraction notices, expressions of concern and errata are not studies. */
  notice: "retraction_notice" | "expression_of_concern" | "erratum" | null;
}

export interface Correction {
  id: number;
  field: "is_human_trial" | "study_type" | "is_excluded";
  current: string;
  proposed: string;
  title: string;
}

export interface ExtractionPlan {
  updates: Record<string, unknown>; // drizzle-style camelCase column -> value
  corrections: Correction[];
}

export const EXTRACTION_SYSTEM_PROMPT = `You are a research analyst classifying molecular hydrogen (H2) studies. Extract facts from the title, abstract and conclusion only — never guess. Use null when the text does not state a value.

Return JSON:
{
  "study_design": one of ${STUDY_DESIGNS.map((d) => `"${d}"`).join(", ")}
     (rct = randomized controlled human trial; controlled_trial = non-randomized controlled human trial; uncontrolled_trial = open-label/single-arm/pilot human study; observational = human cohort/cross-sectional/case-control; case_report = human case report/series; meta_analysis = systematic review or meta-analysis; review = narrative review/commentary/editorial/hypothesis; animal = in vivo animal experiment; in_vitro = cells/tissue/molecular assay),
  "species": string or null (e.g. "Human", "Rat", "Mouse", "Cell Culture"; null for reviews),
  "sample_size": integer or null (total human participants or animals actually studied; null for reviews and in vitro),
  "duration_days": integer or null (intervention/follow-up length converted to days; null if not stated),
  "outcome": "positive" | "neutral" | "negative" | "mixed" | null (direction of the H2 effect on the primary outcomes; null for reviews without a clear conclusion),
  "h2_delivery_method": one of ${DELIVERY_METHODS.map((d) => `"${d}"`).join(", ")} or null,
  "h2_concentration": string or null (e.g. "1.6 ppm", "2% H2 gas", "0.8 mM"),
  "dosage_protocol": string or null (e.g. "1.5 L/day H2-rich water for 8 weeks"),
  "is_human_trial": boolean (true only if human participants received H2 in this study),
  "on_topic": boolean (false if the paper is not about biological/medical effects of molecular hydrogen, e.g. hydrogen energy, fuel cells, materials),
  "publication_type": "article" | "retraction_notice" | "expression_of_concern" | "erratum"
}`;

export function buildExtractionPrompt(s: ExtractionInput): string {
  return `Title: ${s.title || "Not available"}
Abstract: ${s.abstract || "Not available"}
Conclusion: ${s.conclusion || "Not available"}`;
}

// Sub-day values (e.g. a 4-hour exposure) round up to 1 day rather than 0.
const posInt = (v: unknown, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max ? Math.max(1, Math.round(v)) : null;
const NOTICES = ["retraction_notice", "expression_of_concern", "erratum"] as const;
const shortStr = (v: unknown, max = 200): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

/** Validate the model's JSON; anything off-vocabulary becomes null. */
export function parseExtraction(raw: Record<string, unknown>): ExtractedFields | null {
  if (!isStudyDesign(raw.study_design)) return null;
  const delivery = typeof raw.h2_delivery_method === "string" ? normalizeDeliveryMethod(raw.h2_delivery_method) : null;
  return {
    studyDesign: raw.study_design,
    species: shortStr(raw.species, 80),
    sampleSize: posInt(raw.sample_size, 1_000_000),
    durationDays: posInt(raw.duration_days, 36_500),
    outcome: typeof raw.outcome === "string" ? normalizeOutcome(raw.outcome) : null,
    deliveryMethod: delivery,
    h2Concentration: shortStr(raw.h2_concentration),
    dosageProtocol: shortStr(raw.dosage_protocol, 500),
    isHumanTrial: raw.is_human_trial === true,
    onTopic: raw.on_topic !== false,
    notice: (NOTICES as readonly unknown[]).includes(raw.publication_type)
      ? (raw.publication_type as ExtractedFields["notice"])
      : null,
  };
}

const empty = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

export function planUpdates(s: ExtractionInput, x: ExtractedFields, now = new Date()): ExtractionPlan {
  const updates: Record<string, unknown> = { studyDesign: x.studyDesign, fieldsExtractedAt: now };
  const fill = (key: keyof ExtractionInput, column: string, value: unknown) => {
    if (value !== null && value !== undefined && empty(s[key])) updates[column] = value;
  };
  fill("sampleSize", "sampleSize", x.sampleSize);
  fill("duration", "duration", x.durationDays);
  fill("outcome", "outcome", x.outcome);
  fill("h2DeliveryMethod", "h2DeliveryMethod", x.deliveryMethod);
  fill("h2Concentration", "h2Concentration", x.h2Concentration);
  fill("dosageProtocol", "dosageProtocol", x.dosageProtocol);
  if (s.isHumanTrial === null || s.isHumanTrial === undefined) updates.isHumanTrial = x.isHumanTrial;

  const title = (s.title ?? "").slice(0, 140);
  const corrections: Correction[] = [];
  if (s.isHumanTrial !== null && s.isHumanTrial !== undefined && s.isHumanTrial !== x.isHumanTrial) {
    corrections.push({ id: s.id, field: "is_human_trial", current: String(s.isHumanTrial), proposed: String(x.isHumanTrial), title });
  }
  // The legacy "clinical" bucket carries no species; propose the extracted one.
  if (/^clinical$/i.test(s.studyType?.trim() ?? "") && x.species && !/^clinical$/i.test(x.species)) {
    corrections.push({ id: s.id, field: "study_type", current: s.studyType ?? "", proposed: x.species, title });
  }
  if (!x.onTopic) {
    corrections.push({ id: s.id, field: "is_excluded", current: "false", proposed: "true (off-topic)", title });
  }
  if (x.notice) {
    corrections.push({ id: s.id, field: "is_excluded", current: "false", proposed: `true (${x.notice})`, title });
  }
  return { updates, corrections };
}

export async function extractStudyFields(s: ExtractionInput): Promise<ExtractedFields | null> {
  const raw = await ai.generateJSON<Record<string, unknown>>(EXTRACTION_SYSTEM_PROMPT, buildExtractionPrompt(s), {
    model: MODELS.HAIKU,
    maxTokens: 600,
    temperature: 0,
    caller: "study-field-extraction",
  });
  return parseExtraction(raw);
}
