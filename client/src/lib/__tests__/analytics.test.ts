// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CONSENT_KEY, CONSENT_UPDATED_EVENT } from "../consent";

type Analytics = typeof import("../analytics");

/** dataLayer entries are Arguments objects; normalize to plain arrays. */
function commands(): unknown[][] {
  return (window.dataLayer ?? []).map((a) => Array.from(a as ArrayLike<unknown>));
}

function setGpc(value: boolean | undefined) {
  Object.defineProperty(window.navigator, "globalPrivacyControl", {
    value,
    configurable: true,
  });
}

async function load(): Promise<Analytics> {
  vi.resetModules();
  const mod = await import("../analytics");
  mod.__resetAnalyticsForTests();
  return mod;
}

beforeEach(() => {
  vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-TEST123");
  localStorage.clear();
  document.head.innerHTML = "";
  // @ts-expect-error — reset globals between tests
  delete window.dataLayer;
  // @ts-expect-error — reset globals between tests
  delete window.gtag;
  setGpc(undefined);
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("initGA", () => {
  it("loads gtag.js for every visitor, with no stored consent", async () => {
    const { initGA } = await load();
    initGA();
    const script = document.head.querySelector<HTMLScriptElement>(
      'script[src^="https://www.googletagmanager.com/gtag/js"]',
    );
    expect(script).not.toBeNull();
    expect(script!.src).toContain("id=G-TEST123");
    // No inline script — the CSP has no 'unsafe-inline'.
    expect(document.head.querySelector("script:not([src])")).toBeNull();
  });

  it("queues both consent defaults before config", async () => {
    const { initGA } = await load();
    initGA();
    const cmds = commands();
    const firstDefault = cmds.findIndex((c) => c[0] === "consent" && c[1] === "default");
    const config = cmds.findIndex((c) => c[0] === "config");
    expect(firstDefault).toBe(0);
    expect(cmds[1][0]).toBe("consent");
    expect(cmds[1][1]).toBe("default");
    expect(config).toBeGreaterThan(1);
    expect(cmds[config]).toEqual([
      "config",
      "G-TEST123",
      { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false },
    ]);
    // No stored choice, no GPC → no update; the regional default applies.
    expect(cmds.some((c) => c[0] === "consent" && c[1] === "update")).toBe(false);
  });

  it("GPC → consent update denied, before config", async () => {
    setGpc(true);
    const { initGA } = await load();
    initGA();
    const cmds = commands();
    const update = cmds.findIndex((c) => c[0] === "consent" && c[1] === "update");
    expect(cmds[update][2]).toEqual({ analytics_storage: "denied" });
    expect(update).toBeLessThan(cmds.findIndex((c) => c[0] === "config"));
  });

  it("earlier accept → consent update granted", async () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    const { initGA } = await load();
    initGA();
    const update = commands().find((c) => c[0] === "consent" && c[1] === "update");
    expect(update?.[2]).toEqual({ analytics_storage: "granted" });
  });

  it("earlier decline → consent update denied", async () => {
    localStorage.setItem(CONSENT_KEY, "declined");
    const { initGA } = await load();
    initGA();
    const update = commands().find((c) => c[0] === "consent" && c[1] === "update");
    expect(update?.[2]).toEqual({ analytics_storage: "denied" });
  });

  it("is idempotent", async () => {
    const { initGA } = await load();
    initGA();
    initGA();
    expect(document.head.querySelectorAll('script[src*="gtag/js"]')).toHaveLength(1);
  });

  it("does nothing without a measurement ID", async () => {
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "");
    const { initGA } = await load();
    initGA();
    expect(window.gtag).toBeUndefined();
    expect(document.head.querySelector("script")).toBeNull();
  });

  it("skips /admin", async () => {
    window.history.replaceState(null, "", "/admin/pipeline");
    const { initGA } = await load();
    initGA();
    expect(window.gtag).toBeUndefined();
  });
});

describe("tracking without a consent gate", () => {
  it("initial page_view comes from config for every visitor (no consent gate)", async () => {
    const { initGA } = await load();
    initGA();
    // gtag's config sends page_view unless send_page_view:false — must not be set.
    const config = commands().find((c) => c[0] === "config");
    expect(config?.[2]).not.toHaveProperty("send_page_view");
  });

  it("SPA route changes rely on GA4 history page views — no manual duplicate", async () => {
    const { initGA, trackPageView, MANUAL_SPA_PAGE_VIEWS } = await load();
    expect(MANUAL_SPA_PAGE_VIEWS).toBe(false);
    initGA();
    window.history.pushState(null, "", "/studies?page=2");
    trackPageView("/studies");
    expect(commands().some((c) => c[0] === "event" && c[1] === "page_view")).toBe(false);
  });

  it("trackOutboundClick sends an event with no stored consent", async () => {
    const { initGA, trackOutboundClick } = await load();
    initGA();
    trackOutboundClick("https://echowater.com/?utm_source=hydrogenstudies", "footer");
    const ev = commands().find((c) => c[0] === "event" && c[1] === "outbound_click");
    expect(ev?.[2]).toMatchObject({ event_category: "footer" });
  });

  it("track* are no-ops before init", async () => {
    const { trackEvent } = await load();
    expect(() => trackEvent("x")).not.toThrow();
    expect(window.dataLayer).toBeUndefined();
  });

  it("track* are no-ops once gtag.js failed to load", async () => {
    const { initGA, trackEvent } = await load();
    initGA();
    const script = document.head.querySelector<HTMLScriptElement>('script[src*="gtag/js"]')!;
    script.dispatchEvent(new Event("error"));
    const before = commands().length;
    trackEvent("search", "search_query", "hydrogen");
    expect(commands().length).toBe(before);
  });
});

describe("initAhrefs (cookieless)", () => {
  const ahrefs = () => document.head.querySelector('script[src="https://analytics.ahrefs.com/analytics.js"]');

  it("loads for everyone by default", async () => {
    const { initAhrefs } = await load();
    initAhrefs();
    expect(ahrefs()).not.toBeNull();
  });

  it("does not load with GPC", async () => {
    setGpc(true);
    const { initAhrefs } = await load();
    initAhrefs();
    expect(ahrefs()).toBeNull();
  });

  it("does not load after an explicit decline", async () => {
    localStorage.setItem(CONSENT_KEY, "declined");
    const { initAhrefs } = await load();
    initAhrefs();
    expect(ahrefs()).toBeNull();
  });
});

describe("choice made after load", () => {
  it("decline → consent update denied and GA cookies cleared", async () => {
    const { initGA } = await load();
    initGA();
    document.cookie = "_ga=GA1.1.123; path=/";
    document.cookie = "_ga_TEST123=GS1.1.456; path=/";
    document.cookie = "keep=1; path=/";

    localStorage.setItem(CONSENT_KEY, "declined");
    window.dispatchEvent(new Event(CONSENT_UPDATED_EVENT));

    const updates = commands().filter((c) => c[0] === "consent" && c[1] === "update");
    expect(updates.at(-1)?.[2]).toEqual({ analytics_storage: "denied" });
    expect(document.cookie).not.toMatch(/_ga/);
    expect(document.cookie).toContain("keep=1");
  });

  it("accept → consent update granted", async () => {
    const { initGA } = await load();
    initGA();
    localStorage.setItem(CONSENT_KEY, "accepted");
    window.dispatchEvent(new Event(CONSENT_UPDATED_EVENT));
    const updates = commands().filter((c) => c[0] === "consent" && c[1] === "update");
    expect(updates.at(-1)?.[2]).toEqual({ analytics_storage: "granted" });
  });
});
