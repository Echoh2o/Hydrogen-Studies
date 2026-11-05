/**
 * Evidence fields (migration 032, TRUST-BADGE-PLAN Phase 0): the allowed values,
 * shared by the extraction script, the admin review API/page and public stats.
 */
export const ENUMS = {
  h2_concentration_kind: ["measured", "stated", "nominal", "not_reported"],
  delivery_route: ["drinking_water", "inhaled_gas", "saline_infusion", "bath", "topical", "other", "not_applicable"],
  h2_source: ["electrolysis", "magnesium", "dissolved_gas", "commercial_pack", "gas_cylinder", "other", "not_reported"],
  population_kind: ["healthy", "athletes", "older_adults", "patients", "not_applicable"],
  species: ["human", "animal", "in_vitro", "plant", "mixed", "review"],
  effect_direction: ["improved", "no_clear_effect", "worsened", "mixed", "not_reported"],
  funding_category: ["public", "academic", "industry", "mixed", "not_stated"],
  coi_declared: ["none", "some", "not_stated"],
} as const;

export const FIELDS = [
  "h2_concentration_ppm", "h2_concentration_kind", "h2_concentration_raw", "delivery_route", "h2_source",
  "dose_ml_per_day", "doses_per_day", "duration_days", "population_kind", "population_condition", "species",
  "primary_outcome", "effect_direction", "effect_direction_evidence", "funding_category", "funded_by_echo",
  "used_echo_device", "device_maker", "coi_declared",
] as const;
export type Extracted = Partial<Record<(typeof FIELDS)[number], string | number | boolean | null>>;

export const EVIDENCE_STATUSES = ["auto_approved", "approved", "unapproved"] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

/** Fields a reviewer may correct from /admin (the rest stay as extracted). */
export const EDITABLE_EVIDENCE_FIELDS = {
  effect_direction: ENUMS.effect_direction,
  delivery_route: ENUMS.delivery_route,
  population_kind: ENUMS.population_kind,
  species: ENUMS.species,
  funding_category: ENUMS.funding_category,
} as const;
