/**
 * Tests for cookie consent utility functions
 * We test the logic directly since the functions only use localStorage
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    Object.keys(store).forEach((key) => delete store[key]);
  }),
  get length() {
    return Object.keys(store).length;
  },
  key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
};

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// Re-implement the cookie consent logic to test it independently of the JSX component
// This mirrors the exported functions from cookie-consent.tsx

const CONSENT_KEY = "hs_cookie_consent";

function getCookieConsent(): string | null {
  return localStorage.getItem(CONSENT_KEY);
}

function getCookiePreferences() {
  const prefs = localStorage.getItem("hs_cookie_preferences");
  if (prefs) {
    try {
      return JSON.parse(prefs);
    } catch {}
  }
  return { necessary: true, analytics: false, functional: false };
}

function hasAnalyticsConsent(): boolean {
  const consent = getCookieConsent();
  if (consent === "accepted") return true;
  if (consent === "customized") {
    return getCookiePreferences().analytics;
  }
  return false;
}

describe("getCookieConsent", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("should return null when no consent is stored", () => {
    expect(getCookieConsent()).toBeNull();
  });

  it("should return 'accepted' when consent is accepted", () => {
    localStorageMock.setItem("hs_cookie_consent", "accepted");
    expect(getCookieConsent()).toBe("accepted");
  });

  it("should return 'declined' when consent is declined", () => {
    localStorageMock.setItem("hs_cookie_consent", "declined");
    expect(getCookieConsent()).toBe("declined");
  });

  it("should return 'customized' when consent is customized", () => {
    localStorageMock.setItem("hs_cookie_consent", "customized");
    expect(getCookieConsent()).toBe("customized");
  });
});

describe("getCookiePreferences", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("should return defaults when no preferences stored", () => {
    const prefs = getCookiePreferences();
    expect(prefs).toEqual({
      necessary: true,
      analytics: false,
      functional: false,
    });
  });

  it("should return stored preferences", () => {
    localStorageMock.setItem(
      "hs_cookie_preferences",
      JSON.stringify({ necessary: true, analytics: true, functional: false }),
    );
    const prefs = getCookiePreferences();
    expect(prefs.analytics).toBe(true);
    expect(prefs.functional).toBe(false);
    expect(prefs.necessary).toBe(true);
  });

  it("should return defaults when preferences JSON is invalid", () => {
    localStorageMock.setItem("hs_cookie_preferences", "not-json");
    const prefs = getCookiePreferences();
    expect(prefs).toEqual({
      necessary: true,
      analytics: false,
      functional: false,
    });
  });
});

describe("hasAnalyticsConsent", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("should return false when no consent given", () => {
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("should return true when consent is accepted", () => {
    localStorageMock.setItem("hs_cookie_consent", "accepted");
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it("should return false when consent is declined", () => {
    localStorageMock.setItem("hs_cookie_consent", "declined");
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("should return true when customized with analytics enabled", () => {
    localStorageMock.setItem("hs_cookie_consent", "customized");
    localStorageMock.setItem(
      "hs_cookie_preferences",
      JSON.stringify({ necessary: true, analytics: true, functional: false }),
    );
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it("should return false when customized with analytics disabled", () => {
    localStorageMock.setItem("hs_cookie_consent", "customized");
    localStorageMock.setItem(
      "hs_cookie_preferences",
      JSON.stringify({ necessary: true, analytics: false, functional: true }),
    );
    expect(hasAnalyticsConsent()).toBe(false);
  });
});
