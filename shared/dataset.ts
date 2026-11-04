/**
 * PLAN.md 6.2 — the public dataset and the "State of hydrogen research"
 * report. Paths, H1s, the licence and the field dictionary, shared by the
 * export route, the renderers, page meta and the Next routes.
 *
 * The dataset is the database's structured metadata: the paper's identity
 * (title, authors, journal, year, DOI, PMID), the design classification and
 * extracted fields, and our page URL. It does NOT include abstracts (publisher
 * copyright) or our prose summaries. Licence: CC BY 4.0, as PLAN.md 6.2 sets.
 */
export const DATASET_PATH = "/dataset";
export const DATASET_H1 = "The Hydrogen Studies dataset";
export const DATASET_CSV_PATH = "/dataset/hydrogen-studies.csv";
export const DATASET_JSON_PATH = "/dataset/hydrogen-studies.json";
export const DATASET_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";
export const DATASET_LICENSE_NAME = "Creative Commons Attribution 4.0 International (CC BY 4.0)";
/** When the dataset page's prose (not the data) was last reviewed. */
export const DATASET_LAST_REVIEWED = "2026-11-03";

export const REPORT_PATH = "/state-of-hydrogen-research";
export const REPORT_H1 = "State of hydrogen research";
/** When the report's prose (not the numbers) was last reviewed. */
export const REPORT_LAST_REVIEWED = "2026-11-03";

export interface DatasetField {
  name: string;
  description: string;
}

/** Column order of the CSV and key order of the JSON. */
export const DATASET_FIELDS: readonly DatasetField[] = [
  { name: "id", description: "Our stable numeric id for the study." },
  { name: "url", description: "The study's page on hydrogenstudies.com." },
  { name: "title", description: "The paper's title as indexed." },
  { name: "authors", description: "Authors as indexed, comma-separated." },
  { name: "journal", description: "Journal name as indexed." },
  { name: "year", description: "Publication year." },
  { name: "doi", description: "Digital Object Identifier, when known." },
  { name: "pmid", description: "PubMed ID, when known." },
  { name: "study_design", description: "Our design classification: meta_analysis, rct, controlled_trial, uncontrolled_trial, observational, case_report, review, animal, in_vitro, other, or blank when not yet classified." },
  { name: "human", description: "true when the study involved human participants." },
  { name: "species_or_model", description: "The study population label as extracted (e.g. human, rat, mouse, cells)." },
  { name: "sample_size", description: "Number of participants or animals, when the paper reports it." },
  { name: "duration_days", description: "Intervention duration in days, when the paper reports it." },
  { name: "delivery_method", description: "How hydrogen was given, as extracted (e.g. water, inhaled gas, saline)." },
  { name: "h2_concentration", description: "Hydrogen concentration as stated in the paper, when extracted." },
  { name: "outcome_direction", description: "Direction of the main result as recorded by our pipeline: positive, neutral, negative or mixed." },
  { name: "health_conditions", description: "Condition tags, separated by '|'." },
  { name: "body_systems", description: "Body-system tags, separated by '|'." },
  { name: "country", description: "Country of the corresponding institution, as indexed." },
  { name: "funding_sources", description: "Funding statement as extracted, when recorded (human studies so far)." },
  { name: "conflict_of_interest", description: "Conflict-of-interest statement as extracted, when recorded." },
  { name: "citation_count", description: "Citations to the paper per OpenAlex, with the refresh date in citation_count_as_of." },
  { name: "citation_count_as_of", description: "Date the citation count was last refreshed (ISO 8601)." },
  { name: "openalex_id", description: "OpenAlex work id, when matched." },
  { name: "excluded", description: "Always false in this export: retracted and off-topic papers are not included." },
];

/** How to cite the dataset (shown on the page). */
export function datasetCitation(dateIso: string): string {
  return `Hydrogen Studies (${dateIso.slice(0, 4)}). The Hydrogen Studies dataset, version ${dateIso.slice(0, 10)}. Echo Technologies LLC. https://hydrogenstudies.com${DATASET_PATH}. Licensed CC BY 4.0.`;
}

/**
 * Group the free-text delivery-method field for the report. The raw values
 * ("Gas (Sustained Release)", "Water (Electrolysis)", "inhalation", …) stay in
 * the dataset untouched; this is only for the summary chart.
 */
export function deliveryGroup(raw: string | null | undefined): string {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return "Not recorded";
  if (/gas|inhal/.test(v)) return "Inhaled gas";
  if (/saline/.test(v)) return "Hydrogen-rich saline";
  if (/water|drink|oral|tablet/.test(v)) return "Hydrogen water";
  if (/bath/.test(v)) return "Bath or topical";
  if (/medium|solution|buffer|culture/.test(v)) return "Culture medium or solution (laboratory)";
  if (/mixed|multiple|combination/.test(v)) return "Mixed methods";
  return "Other";
}
