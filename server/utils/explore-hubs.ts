/**
 * Canonical explore-hub slugs — ONE source of truth for the URLs that
 * sitemap-explore.xml advertises and the handlers that must resolve them.
 *
 * Before this module the sitemap hardcoded its own slug list while the bot
 * body renderer matched `studies.body_systems` with a naive
 * slug→"words" LIKE. Three sitemap hubs matched nothing and served a hard 404
 * to crawlers (2026-09-23 audit): `brain-nervous-system`, `skin-dermatology`
 * and `eyes-vision` — the DB stores those systems as "Nervous System",
 * "Integumentary", "Visual System", etc., never "brain nervous system".
 *
 * `terms` are lowercase substrings matched against the joined
 * `body_systems` array. Hubs that already resolved keep exactly their prior
 * behaviour (`[slug with spaces, slug]`); only the three broken hubs get
 * explicit synonym lists.
 */

export interface BodySystemHub {
  slug: string;
  label: string;
  terms: string[];
}

function legacyTerms(slug: string): string[] {
  return [slug.replace(/-/g, " "), slug];
}

export const BODY_SYSTEM_HUBS: readonly BodySystemHub[] = [
  { slug: "brain-nervous-system", label: "Brain & Nervous System", terms: ["nervous", "brain", "neurolog", "cerebr", "spinal cord"] },
  { slug: "cardiovascular", label: "Cardiovascular", terms: legacyTerms("cardiovascular") },
  { slug: "digestive", label: "Digestive", terms: legacyTerms("digestive") },
  { slug: "immune-system", label: "Immune System", terms: legacyTerms("immune-system") },
  { slug: "musculoskeletal", label: "Musculoskeletal", terms: legacyTerms("musculoskeletal") },
  { slug: "respiratory", label: "Respiratory", terms: legacyTerms("respiratory") },
  { slug: "endocrine", label: "Endocrine", terms: legacyTerms("endocrine") },
  { slug: "urinary-renal", label: "Urinary & Renal", terms: legacyTerms("urinary-renal") },
  { slug: "skin-dermatology", label: "Skin & Dermatology", terms: ["skin", "dermat", "integumentary"] },
  { slug: "reproductive", label: "Reproductive", terms: legacyTerms("reproductive") },
  { slug: "liver", label: "Liver", terms: legacyTerms("liver") },
  { slug: "eyes-vision", label: "Eyes & Vision", terms: ["visual", "vision", "ocular", "ophthalm", "retina", "eye"] },
];

/** Delivery-mechanism hubs advertised in sitemap-explore.xml. */
export const MECHANISM_HUB_SLUGS: readonly string[] = [
  "hydrogen-water", "hydrogen-inhalation", "hydrogen-rich-saline",
  "hydrogen-bath", "topical-hydrogen", "hydrogen-gas",
];

export function findBodySystemHub(slug: string): BodySystemHub | undefined {
  const s = slug.toLowerCase();
  return BODY_SYSTEM_HUBS.find((h) => h.slug === s);
}

/**
 * LIKE patterns for a body-system slug. Known hubs use their curated terms;
 * any other slug keeps the historical `[words, slug]` behaviour so existing
 * (non-sitemap) body-system URLs render exactly as before.
 */
export function bodySystemLikePatterns(slug: string): string[] {
  const hub = findBodySystemHub(slug);
  const terms = hub ? hub.terms : legacyTerms(slug.toLowerCase());
  return terms.map((t) => `%${t.toLowerCase()}%`);
}
