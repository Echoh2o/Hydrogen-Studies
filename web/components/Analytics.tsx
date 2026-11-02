"use client";

import { useEffect } from "react";
import { scheduleAnalytics } from "@/lib/analytics";
import CookieConsent from "@/components/ui/cookie-consent";

/**
 * Same analytics + consent as the SPA (client/src/main.tsx, App.tsx): GA4 with
 * Consent Mode v2 and cookieless Ahrefs, scheduled after first interaction or
 * 3.5 s so they don't compete with LCP; the consent banner shows only where
 * consent is required (/api/geo). Each Next page is a full load, so GA4's
 * automatic page_view covers navigation.
 */
export function Analytics() {
  useEffect(() => {
    scheduleAnalytics();
  }, []);
  return <CookieConsent />;
}
