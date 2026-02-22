import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Cookie, Settings } from "lucide-react";

const CONSENT_KEY = "hs_cookie_consent";

export type CookiePreferences = {
  necessary: boolean;
  analytics: boolean;
  functional: boolean;
};

export function getCookieConsent(): string | null {
  return localStorage.getItem(CONSENT_KEY);
}

export function getCookiePreferences(): CookiePreferences {
  const prefs = localStorage.getItem("hs_cookie_preferences");
  if (prefs) {
    try {
      return JSON.parse(prefs);
    } catch {}
  }
  return { necessary: true, analytics: false, functional: false };
}

export function hasAnalyticsConsent(): boolean {
  const consent = getCookieConsent();
  if (consent === "accepted") return true;
  if (consent === "customized") {
    return getCookiePreferences().analytics;
  }
  return false;
}

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    analytics: true,
    functional: true,
  });

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    localStorage.setItem(
      "hs_cookie_preferences",
      JSON.stringify({ necessary: true, analytics: true, functional: true }),
    );
    setIsVisible(false);
    window.dispatchEvent(new Event("cookie-consent-updated"));
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, "declined");
    localStorage.setItem(
      "hs_cookie_preferences",
      JSON.stringify({ necessary: true, analytics: false, functional: false }),
    );
    setIsVisible(false);
    window.dispatchEvent(new Event("cookie-consent-updated"));
  };

  const handleSavePreferences = () => {
    localStorage.setItem(CONSENT_KEY, "customized");
    localStorage.setItem("hs_cookie_preferences", JSON.stringify(preferences));
    setIsVisible(false);
    setShowPreferences(false);
    window.dispatchEvent(new Event("cookie-consent-updated"));
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white dark:bg-gray-900 border-t shadow-lg"
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="max-w-5xl mx-auto">
        {showPreferences ? (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Cookie Preferences</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked disabled className="accent-teal-600" />
                <span>
                  <strong>Necessary</strong> — Required for the site to function
                </span>
              </label>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={preferences.analytics}
                  onChange={(e) =>
                    setPreferences((p) => ({ ...p, analytics: e.target.checked }))
                  }
                  className="accent-teal-600"
                />
                <span>
                  <strong>Analytics</strong> — Help us understand how visitors use the site
                </span>
              </label>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={preferences.functional}
                  onChange={(e) =>
                    setPreferences((p) => ({ ...p, functional: e.target.checked }))
                  }
                  className="accent-teal-600"
                />
                <span>
                  <strong>Functional</strong> — Remember your preferences and settings
                </span>
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowPreferences(false)}>
                Back
              </Button>
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSavePreferences}>
                Save Preferences
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Cookie className="h-5 w-5 text-teal-500 shrink-0 hidden sm:block" aria-hidden="true" />
            <p className="text-sm text-muted-foreground flex-1 text-center sm:text-left">
              We use cookies to improve your experience and analyze site usage.
              See our{" "}
              <a href="/cookies" className="text-teal-600 underline hover:text-teal-500">
                Cookie Policy
              </a>{" "}
              and{" "}
              <a href="/privacy" className="text-teal-600 underline hover:text-teal-500">
                Privacy Policy
              </a>
              .
            </p>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreferences(true)}
                aria-label="Customize cookie preferences"
              >
                <Settings className="h-4 w-4 mr-1" aria-hidden="true" />
                Customize
              </Button>
              <Button variant="outline" size="sm" onClick={handleDecline}>
                Decline
              </Button>
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleAccept}>
                Accept All
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
