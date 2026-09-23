/**
 * Analytics consent state — Google Consent Mode v2 with regional defaults.
 *
 * Model (see PR "analytics consent mode"):
 *  - EEA/UK/CH: analytics_storage defaults to DENIED; the banner asks first.
 *  - Everywhere else: analytics_storage defaults to GRANTED; opt out any time
 *    via "Privacy choices" in the footer.
 *  - ad_storage / ad_user_data / ad_personalization are ALWAYS denied (no ads).
 *  - Global Privacy Control (GPC) → analytics_storage denied, Ahrefs not
 *    loaded, banner not shown. GPC wins over an earlier "Accept".
 *  - An explicit choice (Accept / Reject / saved preferences) overrides the
 *    regional default.
 *
 * With analytics_storage denied, gtag sends cookieless pings (no cookies read
 * or written); Google uses them for modeled, aggregate reporting.
 *
 * Everything here is pure or takes its browser dependency as an argument, so
 * the decision logic is unit-testable without a DOM.
 */
import { CONSENT_REQUIRED_REGIONS, isConsentRequiredCountry, normalizeCountry } from "@shared/consent-regions";

export const CONSENT_KEY = "hs_cookie_consent";
export const PREFERENCES_KEY = "hs_cookie_preferences";
/** Fired on window after the visitor saves a choice. */
export const CONSENT_UPDATED_EVENT = "cookie-consent-updated";
/** Fired on window to open the privacy-choices panel (footer link, /cookies). */
export const OPEN_PRIVACY_CHOICES_EVENT = "showCookieSettings";

export type StoredChoice = "accepted" | "declined" | "customized";
/** The visitor's explicit analytics decision; null = none (regional default applies). */
export type AnalyticsChoice = "granted" | "denied" | null;
export type ConsentValue = "granted" | "denied";

export type CookiePreferences = {
  necessary: boolean;
  analytics: boolean;
  functional?: boolean;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** localStorage, or null when unavailable (SSR, privacy mode, blocked). */
export function browserStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function safeGet(storage: StorageLike | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function readStoredChoice(storage: StorageLike | null = browserStorage()): StoredChoice | null {
  const v = safeGet(storage, CONSENT_KEY);
  return v === "accepted" || v === "declined" || v === "customized" ? v : null;
}

export function readPreferences(storage: StorageLike | null = browserStorage()): CookiePreferences {
  const raw = safeGet(storage, PREFERENCES_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return { necessary: true, analytics: parsed.analytics === true, functional: parsed.functional === true };
      }
    } catch {
      /* fall through to the safe default */
    }
  }
  return { necessary: true, analytics: false, functional: false };
}

/** The visitor's explicit analytics choice, or null if they never made one. */
export function getAnalyticsChoice(storage: StorageLike | null = browserStorage()): AnalyticsChoice {
  const choice = readStoredChoice(storage);
  if (choice === "accepted") return "granted";
  if (choice === "declined") return "denied";
  if (choice === "customized") return readPreferences(storage).analytics ? "granted" : "denied";
  return null;
}

/** Persist a choice and notify listeners (analytics.ts applies it to gtag). */
export function saveAnalyticsChoice(
  analytics: boolean,
  storage: StorageLike | null = browserStorage(),
): void {
  try {
    storage?.setItem(CONSENT_KEY, analytics ? "accepted" : "declined");
    storage?.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ necessary: true, analytics, functional: false }),
    );
  } catch {
    /* storage blocked — the in-memory gtag update below still applies */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CONSENT_UPDATED_EVENT));
  }
}

/** Open the privacy-choices panel from anywhere (footer, cookie policy page). */
export function openPrivacyChoices(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_PRIVACY_CHOICES_EVENT));
  }
}

/** Global Privacy Control signal (Sec-GPC / navigator.globalPrivacyControl). */
export function isGpcEnabled(
  nav: { globalPrivacyControl?: unknown } | undefined = typeof navigator !== "undefined"
    ? (navigator as { globalPrivacyControl?: unknown })
    : undefined,
): boolean {
  return nav?.globalPrivacyControl === true;
}

const NO_ADS = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
} as const;

/**
 * The two `gtag('consent','default', …)` commands, in order. The
 * region-scoped default wins for visitors Google geolocates in those regions;
 * the unscoped one applies everywhere else.
 */
export function consentDefaultCommands(): Array<["consent", "default", Record<string, unknown>]> {
  return [
    ["consent", "default", { ...NO_ADS, analytics_storage: "denied", region: [...CONSENT_REQUIRED_REGIONS] }],
    ["consent", "default", { ...NO_ADS, analytics_storage: "granted" }],
  ];
}

/**
 * The `analytics_storage` value to send as a `gtag('consent','update', …)`,
 * or null to leave the regional default in place.
 */
export function resolveAnalyticsUpdate(input: { gpc: boolean; choice: AnalyticsChoice }): ConsentValue | null {
  if (input.gpc) return "denied";
  return input.choice;
}

/** Ahrefs Web Analytics is cookieless: load unless GPC or an explicit opt-out. */
export function shouldLoadAhrefs(input: { gpc: boolean; choice: AnalyticsChoice }): boolean {
  return !input.gpc && input.choice !== "denied";
}

/** Show the banner only where consent is required and no decision exists yet. */
export function shouldShowBanner(input: {
  consentRequired: boolean;
  choice: AnalyticsChoice;
  gpc: boolean;
}): boolean {
  return input.consentRequired && input.choice === null && !input.gpc;
}

/**
 * `?__geo=DE` test override for post-deploy verification. It can only FORCE
 * the banner on (with a consent-required code); it can never suppress it, so
 * a crafted link cannot hide the banner from an EEA visitor.
 */
export function parseGeoOverride(search: string): string | null {
  try {
    return normalizeCountry(new URLSearchParams(search).get("__geo"));
  } catch {
    return null;
  }
}

export function resolveConsentRequired(
  geo: { consentRequired?: unknown } | null,
  override: string | null,
): boolean {
  const fromServer = geo?.consentRequired === true;
  return fromServer || isConsentRequiredCountry(override);
}

/** Initial state of the Analytics toggle in the privacy-choices panel. */
export function defaultAnalyticsToggle(input: {
  consentRequired: boolean;
  choice: AnalyticsChoice;
  gpc: boolean;
}): boolean {
  if (input.gpc) return false;
  if (input.choice !== null) return input.choice === "granted";
  // No pre-ticked boxes where opt-in is required; opt-out model elsewhere.
  return !input.consentRequired;
}
