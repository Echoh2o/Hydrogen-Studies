import { hasAnalyticsConsent } from "@/components/ui/cookie-consent";

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

let gaInitialized = false;

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
    if (hasAnalyticsConsent() && !gaInitialized) {
      initGA();
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
