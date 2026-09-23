/**
 * Site analytics: GA4 with Google Consent Mode v2, plus cookieless Ahrefs Web
 * Analytics. Consent policy (regional defaults, GPC, stored choice) lives in
 * ./consent.ts; this module applies it.
 *
 * GA4 loads for every visitor. Consent Mode decides whether gtag may use
 * cookies: where analytics_storage is denied it sends cookieless pings, which
 * is how measurement continues in consent-required regions without a "yes".
 *
 * CSP: the gtag bootstrap below runs from the bundle, not an inline <script>.
 * The site's CSP has no 'unsafe-inline', so the previous inline
 * `gtag('config', …)` was blocked and GA4 received nothing even from visitors
 * who accepted cookies.
 */
import {
  CONSENT_UPDATED_EVENT,
  consentDefaultCommands,
  getAnalyticsChoice,
  isGpcEnabled,
  resolveAnalyticsUpdate,
  shouldLoadAhrefs,
} from "./consent";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

// The Ahrefs Web Analytics site key. Public by design (it ships in the
// client bundle either way).
const AHREFS_DATA_KEY = "rjIt9UY/qFbTPzCzRK8BRg";

/**
 * Google signals / ad personalization off: the site runs no ads. Note: while
 * Google signals is ON in the GA4 property, gtag still attempts an extra
 * www.google.com/g/collect beacon; the CSP deliberately does not allow
 * www.google.com, so it is blocked (console CSP warning, no data loss — the
 * main hit goes to *.google-analytics.com). Turning Google signals off in GA4
 * Admin stops the attempt.
 */
export const GA_CONFIG = {
  anonymize_ip: true,
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
} as const;

type GaState = "idle" | "loading" | "ready" | "failed";
let gaState: GaState = "idle";
let ahrefsInitialized = false;

/** /admin is internal tooling — never measured. */
function isAdminPath(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

function currentPath(): string {
  return typeof window !== "undefined" ? window.location.pathname : "/";
}

/** True once gtag is defined and gtag.js has not failed to load. */
function canSend(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.gtag === "function" &&
    (gaState === "loading" || gaState === "ready")
  );
}

/**
 * Load GA4 for every visitor. Order matters: consent defaults (and any stored
 * choice / GPC update) are queued in dataLayer BEFORE `config`, so the first
 * hit already carries the right consent state. Idempotent.
 */
export const initGA = () => {
  if (gaState !== "idle" || typeof window === "undefined" || typeof document === "undefined") return;

  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!measurementId || isAdminPath(currentPath())) return;

  window.dataLayer = window.dataLayer || [];
  // gtag.js expects the Arguments object itself, not an array copy.
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  for (const command of consentDefaultCommands()) {
    window.gtag(...command);
  }
  const update = resolveAnalyticsUpdate({ gpc: isGpcEnabled(), choice: getAnalyticsChoice() });
  if (update) {
    window.gtag("consent", "update", { analytics_storage: update });
  }

  window.gtag("js", new Date());
  // Sends the initial page_view; SPA route changes: see MANUAL_SPA_PAGE_VIEWS.
  window.gtag("config", measurementId, GA_CONFIG);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.onload = () => {
    if (gaState === "loading") gaState = "ready";
  };
  script.onerror = () => {
    // Blocked (ad blocker, network) — make track* calls no-ops.
    gaState = "failed";
  };
  document.head.appendChild(script);
  gaState = "loading";
};

/**
 * Ahrefs Web Analytics is cookieless, so it loads for everyone unless the
 * visitor sends GPC or explicitly declined analytics. Idempotent.
 */
export const initAhrefs = () => {
  if (ahrefsInitialized || typeof document === "undefined") return;
  if (isAdminPath(currentPath())) return;
  if (!shouldLoadAhrefs({ gpc: isGpcEnabled(), choice: getAnalyticsChoice() })) return;

  const script = document.createElement("script");
  script.src = "https://analytics.ahrefs.com/analytics.js";
  script.dataset.key = AHREFS_DATA_KEY;
  script.async = true;
  document.head.appendChild(script);
  ahrefsInitialized = true;
};

/** Start both analytics tools. Called once from main.tsx, before render. */
export const initAnalytics = () => {
  initGA();
  initAhrefs();
};

/**
 * Remove GA cookies after an opt-out (best effort). gtag stops writing them
 * once analytics_storage is denied, but existing ones would otherwise linger.
 * GA sets them on the registrable domain (e.g. .hydrogenstudies.com).
 */
export function clearGaCookies(doc: Document = document): void {
  try {
    const names = doc.cookie
      .split(";")
      .map((c) => c.split("=")[0].trim())
      .filter((n) => /^_ga(_|$)/.test(n) || n === "_gid" || n === "_gat");
    if (names.length === 0) return;

    const labels = doc.location.hostname.split(".");
    const domains: string[] = [""];
    for (let i = 0; i < labels.length - 1; i++) {
      domains.push(`.${labels.slice(i).join(".")}`);
    }
    for (const name of names) {
      for (const domain of domains) {
        doc.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
      }
    }
  } catch {
    /* cookies unavailable — nothing to clear */
  }
}

// Apply a choice made after page load (banner or privacy-choices panel).
if (typeof window !== "undefined") {
  window.addEventListener(CONSENT_UPDATED_EVENT, () => {
    const update = resolveAnalyticsUpdate({ gpc: isGpcEnabled(), choice: getAnalyticsChoice() });
    if (update && gaState !== "idle" && typeof window.gtag === "function") {
      window.gtag("consent", "update", { analytics_storage: update });
    }
    if (update === "denied") clearGaCookies();
    // Re-enabling analytics after an earlier opt-out: Ahrefs can start now.
    // (An opt-out cannot unload an already-running Ahrefs script; it stops
    // loading from the next page load.)
    initAhrefs();
  });
}

/**
 * SPA route-change page views come from GA4 itself: the web stream has
 * Enhanced measurement → "Page changes based on browser history events" ON,
 * so gtag sends a page_view on every pushState/popstate under the current
 * consent state (no consent gate needed). Verified 2026-09-23 against the live
 * container: sending our own page_view as well counted every navigation twice.
 * If that stream setting is ever turned off, set this to true.
 */
export const MANUAL_SPA_PAGE_VIEWS = false;

/** Manual SPA page_view — only when MANUAL_SPA_PAGE_VIEWS (see above). */
export const trackPageView = (url: string) => {
  if (!MANUAL_SPA_PAGE_VIEWS || !canSend() || isAdminPath(url)) return;
  window.gtag("event", "page_view", {
    page_location: window.location.href,
    page_path: url,
  });
};

/** Custom event. No-op if GA4 is not configured or gtag.js failed to load. */
export const trackEvent = (
  action: string,
  category?: string,
  label?: string,
  value?: number,
) => {
  if (!canSend()) return;

  window.gtag("event", action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};

// Track clicks on outbound store links (echowater.com). `placement`
// identifies where on the site the link lives (e.g. "footer", "chat",
// "products-page") and doubles as the event category so GA4 reports can
// segment by placement; the full href is kept as the label.
export const trackOutboundClick = (href: string, placement: string) => {
  trackEvent("outbound_click", placement, href);
};

/** Test-only: reset module state between tests. */
export function __resetAnalyticsForTests(): void {
  gaState = "idle";
  ahrefsInitialized = false;
}
