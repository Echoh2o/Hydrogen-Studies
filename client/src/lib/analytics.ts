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

/**
 * idle    → nothing set up
 * queued  → dataLayer + gtag stub + consent defaults exist; gtag.js not
 *           requested yet (config not queued, track* are no-ops)
 * loading → config queued, gtag.js requested
 * ready   → gtag.js loaded
 * failed  → gtag.js blocked / failed to load
 */
type GaState = "idle" | "queued" | "loading" | "ready" | "failed";
let gaState: GaState = "idle";
let gaMeasurementId = "";
let ahrefsInitialized = false;
let deferredLoadScheduled = false;
let deferredLoadDone = false;

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
 * Step 1 (cheap, no network): create dataLayer + the gtag stub and queue the
 * consent defaults plus any stored choice / GPC update. Runs at startup so a
 * choice the visitor makes BEFORE gtag.js loads is queued (by the
 * CONSENT_UPDATED_EVENT listener below) ahead of `config` — the first hit
 * then carries the right consent state, exactly as when gtag.js loaded
 * eagerly. Idempotent.
 */
export const queueGA = () => {
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
  gaMeasurementId = measurementId;
  gaState = "queued";
};

/**
 * Step 2: queue `config` (after every consent command so far) and request
 * gtag.js, which replays the whole dataLayer in order.
 */
function loadGtag(): void {
  if (gaState !== "queued") return;

  window.gtag("js", new Date());
  // Sends the initial page_view; SPA route changes: see MANUAL_SPA_PAGE_VIEWS.
  window.gtag("config", gaMeasurementId, GA_CONFIG);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`;
  script.onload = () => {
    if (gaState === "loading") gaState = "ready";
  };
  script.onerror = () => {
    // Blocked (ad blocker, network) — make track* calls no-ops.
    gaState = "failed";
  };
  document.head.appendChild(script);
  gaState = "loading";
}

/**
 * Load GA4 for every visitor, now. Order matters: consent defaults (and any
 * stored choice / GPC update) are queued in dataLayer BEFORE `config`, so the
 * first hit already carries the right consent state. Idempotent. Pages use
 * scheduleAnalytics() (deferred); this is the immediate path.
 */
export const initGA = () => {
  queueGA();
  loadGtag();
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

/** Start both analytics tools immediately. */
export const initAnalytics = () => {
  initGA();
  initAhrefs();
};

/**
 * After `load`, analytics waits for the visitor's first interaction or this
 * long, whichever comes first. `load` fires at ~0.2 s on this SPA, long before
 * the API-driven LCP, so load + idle alone still let gtag.js compete with LCP
 * (Lighthouse after #74: hub LCP 6.4–6.9 s vs 4.8 s with analytics blocked).
 * Trade-off: a visit that leaves within this window without interacting
 * records no page_view.
 */
export const ANALYTICS_START_DELAY_MS = 3500;
const INTERACTION_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
/** Fallback delay after `load` where requestIdleCallback is missing (Safari). */
export const ANALYTICS_IDLE_FALLBACK_MS = 1500;
/** Upper bound on waiting for an idle period once `load` has fired. */
export const ANALYTICS_IDLE_TIMEOUT_MS = 5000;

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
};

/**
 * Start analytics without competing with the page's LCP. gtag.js (~190 KB)
 * and the Ahrefs script used to load before first render; Lighthouse A/B
 * with analytics blocked: hub LCP 7.0 → 4.8 s, blog 8.0 → 6.7 s.
 *
 * Now:
 *  - consent defaults are queued immediately (queueGA — no network), so a
 *    choice made before the scripts load still applies ahead of `config`;
 *  - gtag.js + `config` (the initial page_view) and Ahrefs wait for the
 *    window `load` event, then the first interaction or
 *    ANALYTICS_START_DELAY_MS, then an idle period (requestIdleCallback, or
 *    setTimeout 1500 ms where it is unsupported).
 * /admin is never measured: nothing loads if the visitor is on /admin when
 * the deferred load runs. Idempotent. Called once from main.tsx.
 */
export const scheduleAnalytics = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  // Landing on /admin: never measured (same as the eager init was).
  if (deferredLoadScheduled || isAdminPath(currentPath())) return;
  queueGA();
  deferredLoadScheduled = true;

  const run = () => {
    deferredLoadDone = true;
    if (isAdminPath(currentPath())) return;
    loadGtag();
    initAhrefs();
  };
  const whenIdle = () => {
    const w = window as IdleWindow;
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(run, { timeout: ANALYTICS_IDLE_TIMEOUT_MS });
    } else {
      window.setTimeout(run, ANALYTICS_IDLE_FALLBACK_MS);
    }
  };
  const afterInteractionOrDelay = () => {
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      window.clearTimeout(timer);
      for (const type of INTERACTION_EVENTS) window.removeEventListener(type, start, true);
      whenIdle();
    };
    const timer = window.setTimeout(start, ANALYTICS_START_DELAY_MS);
    for (const type of INTERACTION_EVENTS) {
      window.addEventListener(type, start, { capture: true, passive: true });
    }
  };
  if (document.readyState === "complete") {
    afterInteractionOrDelay();
  } else {
    window.addEventListener("load", afterInteractionOrDelay, { once: true });
  }
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
    // loading from the next page load.) While a deferred load is still
    // pending, leave it to scheduleAnalytics — it reads the choice then.
    if (!deferredLoadScheduled || deferredLoadDone) initAhrefs();
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
  gaMeasurementId = "";
  ahrefsInitialized = false;
  deferredLoadScheduled = false;
  deferredLoadDone = false;
}
