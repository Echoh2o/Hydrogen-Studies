import { hasAnalyticsConsent } from "@/components/ui/cookie-consent";

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

let gaInitialized = false;
let ahrefsInitialized = false;

// The Ahrefs Web Analytics site key. Public by design (it ships in the
// client bundle either way); kept here so the script is only ever attached
// after consent rather than statically in index.html.
const AHREFS_DATA_KEY = "rjIt9UY/qFbTPzCzRK8BRg";

// Initialize Ahrefs analytics — only if the user has given consent.
// Mirrors initGA: previously this loaded unconditionally from index.html,
// firing before the cookie banner. Now it is attached at runtime and gated.
export const initAhrefs = () => {
  if (!hasAnalyticsConsent() || ahrefsInitialized) return;
  if (typeof document === "undefined") return;

  const script = document.createElement("script");
  script.src = "https://analytics.ahrefs.com/analytics.js";
  script.dataset.key = AHREFS_DATA_KEY;
  script.async = true;
  document.head.appendChild(script);
  ahrefsInitialized = true;
};

// Initialize Google Analytics — only if user has given consent
export const initGA = () => {
  if (!hasAnalyticsConsent()) return;

  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!measurementId || gaInitialized) return;

  const script1 = document.createElement("script");
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script1);

  const script2 = document.createElement("script");
  script2.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${measurementId}', { anonymize_ip: true });
  `;
  document.head.appendChild(script2);
  gaInitialized = true;
};

// Re-check consent when cookie preferences change
if (typeof window !== "undefined") {
  window.addEventListener("cookie-consent-updated", () => {
    if (hasAnalyticsConsent()) {
      if (!gaInitialized) initGA();
      if (!ahrefsInitialized) initAhrefs();
    }
  });
}

// Track page views — respects consent
export const trackPageView = (url: string) => {
  if (!hasAnalyticsConsent() || typeof window === "undefined" || !window.gtag) return;

  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!measurementId) return;

  window.gtag("config", measurementId, {
    page_path: url,
    anonymize_ip: true,
  });
};

// Track events — respects consent
export const trackEvent = (
  action: string,
  category?: string,
  label?: string,
  value?: number,
) => {
  if (!hasAnalyticsConsent() || typeof window === "undefined" || !window.gtag) return;

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
