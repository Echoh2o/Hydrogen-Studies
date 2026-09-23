/**
 * Regions where analytics cookies need opt-in consent before they are set.
 *
 * Used in two places that must agree:
 *  - client: the `region` list on the Google Consent Mode v2 "denied" default
 *    (Google applies it using its own IP geolocation), and
 *  - server: GET /api/geo, which uses Cloudflare's CF-IPCountry header to
 *    decide whether the consent banner is shown at all.
 *
 * ISO 3166-1 alpha-2 codes. Note Greece is "GR" (ISO), not "EL" (Eurostat).
 */

/** EU member states (27). */
export const EU_COUNTRIES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
] as const;

/** EEA members outside the EU. */
export const EEA_NON_EU_COUNTRIES = ["IS", "LI", "NO"] as const;

/**
 * Territories with their own ISO code where the GDPR (EU outermost regions,
 * Åland) or a GDPR-equivalent law (UK Crown Dependencies, Gibraltar) applies.
 * Cheap to include and avoids a gap if a geolocation provider reports the
 * territory code instead of the parent country.
 */
export const GDPR_TERRITORIES = [
  "AX", // Åland Islands (FI)
  "GF", "GP", "MQ", "RE", "YT", "MF", // French outermost regions
  "GI", "GG", "JE", "IM", // Gibraltar, Guernsey, Jersey, Isle of Man
] as const;

/** EEA + UK + Switzerland (+ territories above): opt-in consent required. */
export const CONSENT_REQUIRED_REGIONS: readonly string[] = [
  ...EU_COUNTRIES,
  ...EEA_NON_EU_COUNTRIES,
  "GB",
  "CH",
  ...GDPR_TERRITORIES,
];

const CONSENT_REQUIRED_SET = new Set(CONSENT_REQUIRED_REGIONS);

/**
 * Cloudflare pseudo-codes: "XX" = country unknown, "T1" = Tor exit node.
 * The visitor could be anywhere, so treat as consent-required (conservative).
 */
const UNKNOWN_ORIGIN_CODES = new Set(["XX", "T1"]);

/** Uppercase a 2-letter country code; anything else becomes null. */
export function normalizeCountry(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z][A-Z0-9]$/.test(code) ? code : null;
}

/**
 * Whether the consent banner must be shown for this country.
 * A missing/invalid code (no Cloudflare in front, e.g. local dev) → false.
 */
export function isConsentRequiredCountry(raw: string | null | undefined): boolean {
  const code = normalizeCountry(raw);
  if (!code) return false;
  return CONSENT_REQUIRED_SET.has(code) || UNKNOWN_ORIGIN_CODES.has(code);
}
