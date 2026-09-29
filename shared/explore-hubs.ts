/**
 * Canonical explore-hub definitions — ONE source of truth for the hub URLs
 * that sitemap-explore.xml advertises, the handlers that must resolve them,
 * and every template that links to them (crawler renderer AND SPA).
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
 *
 * Link rule (2026-09-28 re-audit): templates link a condition / body-system
 * VALUE only when a real hub exists for it — conditionHubForValue() and
 * bodySystemHubForValue() below. Study pages used to link every stored value
 * to /explore-by-condition/<slugified value>, which 404s for ~200 long-tail
 * values that have no health_conditions row.
 *
 * Dependency-free: this module ships in the browser bundle.
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

/**
 * Life-stage hubs advertised in sitemap-explore.xml. infants-children and
 * elderly-aging were removed 2026-09-28 (0 studies; owner approved 404 +
 * sitemap removal — reports/hub-404-impact-2026-09-28.csv).
 */
export const LIFE_STAGE_HUB_SLUGS: readonly string[] = [
  "pregnancy", "adults", "athletes",
];

/**
 * Demographic hubs the /explore-by-demographic index links (crawler body AND
 * SPA). Their pages list studies with the shared explore-detail text query
 * (seo-body-renderer getExploreDetailStudies), so a slug is only a useful hub
 * when that phrase names a population in study titles. Only hubs whose page
 * lists ≥1 study are linked — listedExploreHubs() below.
 *
 * Before 2026-09-28 the SPA index linked rows of the `demographics` table
 * (empty in production) to the unrouted /demographics/<slug>, and the
 * crawler index linked nothing.
 */
export const DEMOGRAPHIC_HUB_SLUGS: readonly string[] = [
  "athletes", "healthy-adults", "older-adults", "elderly", "women", "children",
];

/**
 * Delivery-method hubs the /explore-by-delivery-method index links (crawler
 * body AND SPA). Slugs are the ones the SPA index has always grouped
 * (drinking water / inhalation / other methods); same ≥1-study rule as above.
 */
export const DELIVERY_METHOD_HUB_SLUGS: readonly string[] = [
  "drinking-water", "inhalation", "bathing", "saline-injection", "tablets",
];

/**
 * Benefit hubs the /explore-by-benefit index links (crawler body AND SPA),
 * 2026-09-28. Same ≥1-study rule as above. A slug is only a useful hub when
 * its phrase (hyphens → spaces) names the benefit in study titles, because the
 * page lists studies with the shared explore-detail text query — so
 * "anti-inflammatory" can't be a hub ("anti inflammatory" matches nothing),
 * and slugs that duplicate a condition hub (athletic-performance,
 * cognitive-function, chronic fatigue) are left to that hub.
 * Studies each listed in production on 2026-09-28: antioxidant 80,
 * neuroprotective 37, cardioprotective 5, radioprotective 7,
 * exercise-performance 12, endurance 11, sleep 24, wound-healing 29,
 * longevity 3.
 */
// "sleep" moved to the /explore-by-condition/sleep-quality hub (wave 4,
// 2026-10-05; /explore-by-benefit/sleep 301s there — owner approved).
export const BENEFIT_HUB_SLUGS: readonly string[] = [
  "antioxidant", "neuroprotective", "cardioprotective", "radioprotective",
  "exercise-performance", "endurance", "wound-healing", "longevity",
];

/**
 * Hub types whose detail page lists studies with the shared explore-detail
 * query and whose index links a fixed slug set (see the arrays above). The
 * index links a slug only when its page lists ≥1 study — listedExploreHubs()
 * below. Any slug outside the set is a 404 for bots and browsers alike; for
 * demographic / delivery-method / benefit a listed slug without studies is a
 * 404 too (an empty page is a soft 404). The mechanism / life-stage sets are
 * the sitemap-explore hubs and stay valid while advertised (server
 * exploreHubExists).
 */
export type ListedExploreHubType = "demographic" | "delivery-method" | "benefit" | "life-stage" | "mechanism";

export const LISTED_EXPLORE_HUB_SLUGS: Readonly<Record<ListedExploreHubType, readonly string[]>> = {
  demographic: DEMOGRAPHIC_HUB_SLUGS,
  "delivery-method": DELIVERY_METHOD_HUB_SLUGS,
  benefit: BENEFIT_HUB_SLUGS,
  "life-stage": LIFE_STAGE_HUB_SLUGS,
  mechanism: MECHANISM_HUB_SLUGS,
};

export function isListedExploreHubType(type: string): type is ListedExploreHubType {
  return Object.prototype.hasOwnProperty.call(LISTED_EXPLORE_HUB_SLUGS, type);
}

export type ExploreHubType =
  | "condition"
  | "body-system"
  | "mechanism"
  | "delivery-method"
  | "life-stage"
  | "benefit"
  | "demographic";

/**
 * Site path of an explore hub: `/explore-by-<type>/<slug>`. The sitemap, the
 * crawler canonical and the SPA canonical all build from this, so they can't
 * drift apart again (life-stage pages once canonicalized to /life-stage/…,
 * a URL that 404s).
 */
export function exploreHubPath(type: ExploreHubType, slug: string): string {
  return `/explore-by-${type}/${slug}`;
}

/** Every /explore-by-<type>/<slug> detail-hub type. */
export const EXPLORE_HUB_TYPES: readonly ExploreHubType[] = [
  "condition", "body-system", "mechanism", "delivery-method", "life-stage", "benefit", "demographic",
];

export function isExploreHubType(type: string): type is ExploreHubType {
  return (EXPLORE_HUB_TYPES as readonly string[]).includes(type);
}

const EXPLORE_HUB_PATH_RE =
  /^\/explore-by-(condition|body-system|mechanism|delivery-method|life-stage|benefit|demographic)\/([^/]+)$/;

/**
 * `{ type, slug }` when `pathname` is an explore detail-hub URL, else null.
 * The slug is returned as it appears in the path (URL-hygiene 301s case and
 * trailing-slash variants before any renderer sees them).
 */
export function parseExploreHubPath(pathname: string): { type: ExploreHubType; slug: string } | null {
  const m = EXPLORE_HUB_PATH_RE.exec(pathname);
  return m ? { type: m[1] as ExploreHubType, slug: m[2] } : null;
}

/** Shape every hub slug has: lowercase letters, digits and hyphens. */
export function isHubSlugShape(slug: string): boolean {
  return /^[a-z0-9-]{1,120}$/.test(slug);
}

/** Slug for a stored value — same rule the crawler renderer has always used. */
export function hubSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** "hydrogen-rich-saline" → "Hydrogen Rich Saline". */
export function titleCaseSlug(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Body systems ────────────────────────────────────────────────

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

/**
 * The canonical hub a stored `body_systems` value belongs to, or undefined
 * when none does (→ render the value as plain text, never a link).
 *
 * Mirrors the hub page's own query: a hub lists every study whose joined
 * body_systems contain one of its terms, so a value containing a term is
 * guaranteed to appear on (and keep alive) that hub. "Central Nervous
 * System" → brain-nervous-system, "Cardiovascular System" → cardiovascular;
 * "Acid-Base Balance" → undefined.
 */
export function bodySystemHubForValue(value: string | null | undefined): BodySystemHub | undefined {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return undefined;
  return BODY_SYSTEM_HUBS.find((h) => h.terms.some((t) => v.includes(t.toLowerCase())));
}

/** Hub path for a stored body-system value, or null when no hub exists. */
export function bodySystemHubPathForValue(value: string | null | undefined): string | null {
  const hub = bodySystemHubForValue(value);
  return hub ? exploreHubPath("body-system", hub.slug) : null;
}

/**
 * Display name of a body-system hub page, always ending in "System" exactly
 * once: "Immune System" (not "Immune System System"), "Brain & Nervous
 * System", "Cardiovascular System".
 */
export function bodySystemHubName(slug: string): string {
  const base = findBodySystemHub(slug)?.label ?? titleCaseSlug(slug.toLowerCase());
  return /\bsystems?$/i.test(base) ? base : `${base} System`;
}

// ── Conditions ──────────────────────────────────────────────────

/** A row of health_conditions — the table every condition hub resolves from. */
export interface ConditionHubRef {
  slug: string;
  name: string;
}

/**
 * The condition hub for a stored `health_conditions` value, or undefined when
 * the value has no hub (no health_conditions row) — render it as plain text.
 * Matches on slug ("Type 2 Diabetes" → type-2-diabetes) or on the hub's name.
 */
export function conditionHubForValue(
  value: string | null | undefined,
  hubs: readonly ConditionHubRef[],
): ConditionHubRef | undefined {
  const v = (value ?? "").trim();
  if (!v) return undefined;
  const slug = hubSlug(v);
  const lower = v.toLowerCase();
  return hubs.find((h) => h.slug === slug || (h.name ?? "").trim().toLowerCase() === lower);
}

// ── Mechanism / generic detail hubs ─────────────────────────────

/**
 * Copy for an /explore-by-<type>/<slug> detail hub (mechanism, delivery
 * method, life stage, benefit, demographic) as the crawler renderer emits it.
 * The SPA mechanism, demographic, delivery-method and benefit pages render the same
 * strings so browsers and crawlers get the same H1 and intro.
 */
export function exploreDetailCopy(slug: string): { name: string; h1: string; intro: string } {
  const name = titleCaseSlug(slug);
  return {
    name,
    h1: `${name} — Hydrogen Therapy Research`,
    intro: `Research studies related to ${name.toLowerCase()} in hydrogen therapy.`,
  };
}

/** <title> + meta description of an /explore-by-mechanism/<slug> hub. */
export function mechanismHubMeta(slug: string): { title: string; description: string; path: string } {
  const { name } = exploreDetailCopy(slug);
  return {
    title: `${name} Hydrogen Therapy Research | Hydrogen Studies`,
    description: `Research on ${name.toLowerCase()} as a hydrogen delivery mechanism. Studies, protocols, and clinical outcomes.`,
    path: exploreHubPath("mechanism", slug),
  };
}

/**
 * <title> + meta description + path of an /explore-by-{delivery-method,
 * benefit,demographic}/<slug> hub. The crawler meta (seo-bot-middleware) and
 * the SPA hub pages both build from this, so browsers and bots get the same
 * title and canonical. The slug is lowercased: the studies API only accepts
 * lowercase slugs, so the SPA always renders the lowercase hub.
 */
export function exploreDetailMeta(
  type: "delivery-method" | "benefit" | "demographic",
  slug: string,
): { title: string; description: string; path: string } {
  const s = slug.toLowerCase();
  const { name } = exploreDetailCopy(s);
  return {
    title: `${name}: Hydrogen Research | Hydrogen Studies`,
    description: `Peer-reviewed molecular hydrogen studies related to ${name.toLowerCase()}, with study types, publication years and links to each study summary and its source.`,
    path: exploreHubPath(type, s),
  };
}

/** One linked hub on an /explore-by-<type> index. */
export interface ExploreHubSummary {
  slug: string;
  name: string;
  path: string;
  /** Studies the hub page lists (the shared detail query, LIMIT 100). */
  studyCount: number;
}

/**
 * "Hub exists" predicate for the curated demographic / delivery-method hubs:
 * a listed slug is linked only when its page lists at least one study (a hub
 * without studies is an empty page). `studyCounts` maps slug → number of
 * studies the hub page lists. Order follows the curated array.
 */
export function listedExploreHubs(
  type: ListedExploreHubType,
  studyCounts: Readonly<Record<string, number>>,
): ExploreHubSummary[] {
  return LISTED_EXPLORE_HUB_SLUGS[type]
    .filter((slug) => (studyCounts[slug] ?? 0) > 0)
    .map((slug) => ({
      slug,
      name: exploreDetailCopy(slug).name,
      path: exploreHubPath(type, slug),
      studyCount: studyCounts[slug],
    }));
}

/** "1 study" / "12 studies" — hub counts on the crawler and SPA indexes. */
export function studyCountLabel(n: number): string {
  return `${n} ${n === 1 ? "study" : "studies"}`;
}

/**
 * Title / meta description / H1 / intro of the /explore-by-<type> index pages
 * of the listed hub types — the crawler (meta + body) renders these; the SPA
 * demographic, delivery-method and benefit indexes render the same strings.
 * (The SPA mechanism and life-stage indexes keep their own copy but link the
 * same hubs.)
 */
export function exploreIndexCopy(type: ListedExploreHubType): {
  title: string;
  description: string;
  h1: string;
  intro: string;
} {
  switch (type) {
    case "demographic":
      return {
        title: "Hydrogen Research by Demographics | Hydrogen Studies",
        description: "Explore hydrogen therapy research filtered by demographic groups and population types.",
        h1: "Hydrogen Research by Demographics",
        intro: "Explore hydrogen therapy research organized by demographic.",
      };
    case "benefit":
      return {
        title: "Hydrogen Research by Health Benefit | Hydrogen Studies",
        description: "Browse hydrogen therapy research organized by health benefit — antioxidant, neuroprotective, cardioprotective, exercise performance, sleep and more.",
        h1: "Hydrogen Research by Health Benefit",
        intro: "Explore hydrogen therapy research organized by health benefit.",
      };
    case "life-stage":
      return {
        title: "Hydrogen Research by Life Stage | Hydrogen Studies",
        description: "Find hydrogen therapy research relevant to your life stage — pregnancy, childhood, adults, elderly, and athletes.",
        h1: "Hydrogen Research by Life Stage",
        intro: "Explore hydrogen therapy research organized by life stage.",
      };
    case "mechanism":
      return {
        title: "Hydrogen Delivery Mechanisms Research | Hydrogen Studies",
        description: "Explore research on different hydrogen delivery methods — hydrogen water, inhalation therapy, hydrogen-rich saline, and more.",
        h1: "Hydrogen Research by Mechanism",
        intro: "Explore hydrogen therapy research organized by mechanism.",
      };
    case "delivery-method":
    default:
      return {
        title: "Hydrogen Delivery Methods Research | Hydrogen Studies",
        description: "Compare research on hydrogen water, hydrogen gas inhalation, hydrogen-rich saline, hydrogen baths, and other delivery methods.",
        h1: "Hydrogen Research by Delivery Method",
        intro: "Explore hydrogen therapy research organized by delivery method.",
      };
  }
}
