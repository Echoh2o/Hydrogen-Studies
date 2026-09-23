import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  OPEN_PRIVACY_CHOICES_EVENT,
  defaultAnalyticsToggle,
  getAnalyticsChoice,
  isGpcEnabled,
  parseGeoOverride,
  resolveConsentRequired,
  saveAnalyticsChoice,
  shouldShowBanner,
} from "@/lib/consent";

type Mode = "hidden" | "banner" | "preferences";

/** GET /api/geo (uncached, per visitor). Any failure → null (no banner). */
async function fetchGeo(): Promise<{ consentRequired?: unknown } | null> {
  try {
    const res = await fetch("/api/geo", { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Accept and Reject get identical styling on purpose: equal prominence.
// teal-700 (not 600) keeps white 12px text above WCAG AA contrast.
const choiceButton =
  "inline-flex h-8 items-center justify-center rounded-md bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 sm:text-sm";
const quietButton =
  "inline-flex h-8 items-center justify-center rounded-md px-2 text-xs font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:text-gray-200 sm:text-sm";

/**
 * Consent banner + privacy-choices panel.
 *
 * - Banner: only where consent is required (EEA/UK/CH via /api/geo), no
 *   stored choice, and no GPC signal. Compact on mobile (~88px at 390px).
 * - Panel: opened from the banner's "Settings", the footer's "Privacy
 *   choices", or the /cookies page (OPEN_PRIVACY_CHOICES_EVENT). Lets any
 *   visitor, anywhere, turn analytics off (or back on).
 */
export default function CookieConsent() {
  const [mode, setMode] = useState<Mode>("hidden");
  // null = region not known yet (fetch pending or skipped).
  const [consentRequired, setConsentRequired] = useState<boolean | null>(null);
  const [analyticsOn, setAnalyticsOn] = useState(false);
  const [returnTo, setReturnTo] = useState<Mode>("hidden");
  const panelHeadingRef = useRef<HTMLHeadingElement>(null);
  const openerRef = useRef<Element | null>(null);
  const gpc = isGpcEnabled();

  // Region check → banner decision. Skipped entirely once a choice exists.
  useEffect(() => {
    let cancelled = false;
    if (getAnalyticsChoice() !== null || gpc) return;

    const override = parseGeoOverride(window.location.search);
    void fetchGeo().then((geo) => {
      if (cancelled) return;
      const required = resolveConsentRequired(geo, override);
      setConsentRequired(required);
      if (shouldShowBanner({ consentRequired: required, choice: getAnalyticsChoice(), gpc })) {
        setMode((m) => (m === "hidden" ? "banner" : m));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [gpc]);

  const openPreferences = useCallback(
    (from: Mode) => {
      openerRef.current = document.activeElement;
      // Region unknown → treat as consent-required: never pre-tick analytics.
      setAnalyticsOn(
        defaultAnalyticsToggle({ consentRequired: consentRequired !== false, choice: getAnalyticsChoice(), gpc }),
      );
      setReturnTo(from === "banner" ? "banner" : "hidden");
      setMode("preferences");
    },
    [consentRequired, gpc],
  );

  const closePreferences = useCallback(() => {
    setMode(returnTo);
    // Give keyboard users their place back (e.g. the footer link).
    const opener = openerRef.current;
    if (returnTo === "hidden" && opener instanceof HTMLElement) opener.focus();
  }, [returnTo]);

  // Footer "Privacy choices" link and the /cookies page button.
  useEffect(() => {
    const onOpen = () => openPreferences("hidden");
    window.addEventListener(OPEN_PRIVACY_CHOICES_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_PRIVACY_CHOICES_EVENT, onOpen);
  }, [openPreferences]);

  // Move focus into the panel when it opens; Escape closes it.
  useEffect(() => {
    if (mode !== "preferences") return;
    panelHeadingRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePreferences();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, closePreferences]);

  const choose = (analytics: boolean) => {
    saveAnalyticsChoice(analytics);
    setMode("hidden");
  };

  if (mode === "hidden") return null;

  if (mode === "preferences") {
    return (
      <div
        className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto border-t border-gray-200 bg-white px-4 py-4 shadow-lg dark:border-gray-700 dark:bg-gray-900"
        role="dialog"
        aria-modal="false"
        aria-labelledby="privacy-choices-title"
      >
        <div className="mx-auto max-w-2xl space-y-3 text-sm text-gray-700 dark:text-gray-200">
          <div className="flex items-start justify-between gap-3">
            <h2
              id="privacy-choices-title"
              ref={panelHeadingRef}
              tabIndex={-1}
              className="text-base font-semibold text-gray-900 outline-none dark:text-white"
            >
              Privacy choices
            </h2>
            <button
              type="button"
              onClick={closePreferences}
              className="rounded p-1 text-gray-500 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:hover:text-white"
              aria-label="Close privacy choices"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <label className="flex items-start gap-3">
            <input type="checkbox" checked disabled className="mt-1 accent-teal-700" />
            <span>
              <strong>Necessary</strong> — keeps the site working and secure, and remembers this choice. Always on.
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={analyticsOn}
              disabled={gpc}
              onChange={(e) => setAnalyticsOn(e.target.checked)}
              className="mt-1 accent-teal-700"
            />
            <span>
              <strong>Analytics</strong> — Google Analytics cookies that show us which pages are useful. When off,
              Google Analytics runs without cookies and our cookieless Ahrefs analytics stops. We run no ads.
            </span>
          </label>

          {gpc && (
            <p className="rounded-md bg-gray-100 p-2 text-xs dark:bg-gray-800">
              Your browser is sending a Global Privacy Control signal, so analytics stays off.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs">
              <a href="/cookies" className="text-teal-700 underline hover:text-teal-800 dark:text-teal-400">
                Cookie policy
              </a>{" "}
              ·{" "}
              <a href="/privacy" className="text-teal-700 underline hover:text-teal-800 dark:text-teal-400">
                Privacy policy
              </a>
            </p>
            <button type="button" className={choiceButton} onClick={() => choose(gpc ? false : analyticsOn)}>
              Save choices
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white px-3 py-2 shadow-lg dark:border-gray-700 dark:bg-gray-900 sm:px-4 sm:py-3"
      role="region"
      aria-label="Cookie consent"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1 basis-full text-xs leading-4 text-gray-700 dark:text-gray-200 sm:basis-0 sm:text-sm sm:leading-5">
          We use analytics cookies only if you allow them.{" "}
          <a href="/cookies" className="text-teal-700 underline hover:text-teal-800 dark:text-teal-400">
            Cookie policy
          </a>
        </p>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <button type="button" className={quietButton} onClick={() => openPreferences("banner")}>
            Settings
          </button>
          <button type="button" className={choiceButton} onClick={() => choose(false)}>
            Reject
          </button>
          <button type="button" className={choiceButton} onClick={() => choose(true)}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
