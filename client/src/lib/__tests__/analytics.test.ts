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

describe("scheduleAnalytics (deferred past load + interaction/delay + idle — LCP)", () => {
  const gtagScript = () => document.head.querySelector('script[src*="googletagmanager.com/gtag/js"]');
  const ahrefs = () => document.head.querySelector('script[src="https://analytics.ahrefs.com/analytics.js"]');
  let idleCallbacks: Array<() => void>;

  function setReadyState(state: DocumentReadyState) {
    Object.defineProperty(document, "readyState", { value: state, configurable: true });
  }

  beforeEach(() => {
    idleCallbacks = [];
    setReadyState("loading");
    (window as any).requestIdleCallback = vi.fn((cb: () => void) => {
      idleCallbacks.push(cb);
      return idleCallbacks.length;
    });
  });

  afterEach(() => {
    // Flush this test's pending once-`load` and first-interaction listeners so
    // they can't fire in a later test (each test loads a fresh module instance).
    window.dispatchEvent(new Event("load"));
    window.dispatchEvent(new Event("pointerdown"));
    idleCallbacks = [];
    delete (window as any).requestIdleCallback;
    setReadyState("complete");
    vi.useRealTimers();
  });

  function fireLoadThenIdle() {
    window.dispatchEvent(new Event("load"));
    window.dispatchEvent(new Event("pointerdown"));
    for (const cb of idleCallbacks.splice(0)) cb();
  }

  it("queues consent defaults immediately but requests no script and no config before load", async () => {
    const { scheduleAnalytics } = await load();
    scheduleAnalytics();
    const cmds = commands();
    expect(cmds[0].slice(0, 2)).toEqual(["consent", "default"]);
    expect(cmds[1].slice(0, 2)).toEqual(["consent", "default"]);
    expect(cmds.some((c) => c[0] === "config")).toBe(false);
    expect(gtagScript()).toBeNull();
    expect(ahrefs()).toBeNull();
  });

  it("does not load on `load` alone — waits for an interaction, then an idle period", async () => {
    const { scheduleAnalytics } = await load();
    scheduleAnalytics();
    window.dispatchEvent(new Event("load"));
    expect(gtagScript()).toBeNull();
    expect(idleCallbacks).toHaveLength(0);
    window.dispatchEvent(new Event("scroll"));
    expect(idleCallbacks).toHaveLength(1);
    window.dispatchEvent(new Event("keydown"));
    expect(idleCallbacks).toHaveLength(1);
    expect(gtagScript()).toBeNull();
  });

  it("without any interaction, starts after ANALYTICS_START_DELAY_MS (then idle)", async () => {
    vi.useFakeTimers();
    const { scheduleAnalytics, ANALYTICS_START_DELAY_MS } = await load();
    expect(ANALYTICS_START_DELAY_MS).toBe(3500);
    scheduleAnalytics();
    window.dispatchEvent(new Event("load"));
    vi.advanceTimersByTime(ANALYTICS_START_DELAY_MS - 1);
    expect(idleCallbacks).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(idleCallbacks).toHaveLength(1);
    idleCallbacks[0]();
    expect(gtagScript()).not.toBeNull();
  });

  it("after load + idle: loads gtag.js and Ahrefs, config queued after the consent defaults", async () => {
    const { scheduleAnalytics } = await load();
    scheduleAnalytics();
    fireLoadThenIdle();
    expect(gtagScript()).not.toBeNull();
    expect(ahrefs()).not.toBeNull();
    const cmds = commands();
    const config = cmds.findIndex((c) => c[0] === "config");
    expect(config).toBeGreaterThan(1);
    expect(cmds[config][2]).not.toHaveProperty("send_page_view");
    expect(cmds.filter((c) => c[0] === "config")).toHaveLength(1);
  });

  it("a decline made BEFORE the deferred load is applied ahead of config (no hit under the default)", async () => {
    const { scheduleAnalytics } = await load();
    scheduleAnalytics();
    localStorage.setItem(CONSENT_KEY, "declined");
    window.dispatchEvent(new Event(CONSENT_UPDATED_EVENT));
    // Ahrefs must neither load early nor load at all after a decline.
    expect(ahrefs()).toBeNull();
    fireLoadThenIdle();
    const cmds = commands();
    const update = cmds.findIndex((c) => c[0] === "consent" && c[1] === "update");
    expect(cmds[update][2]).toEqual({ analytics_storage: "denied" });
    expect(update).toBeLessThan(cmds.findIndex((c) => c[0] === "config"));
    expect(ahrefs()).toBeNull();
  });

  it("an accept made before the deferred load is queued ahead of config", async () => {
    const { scheduleAnalytics } = await load();
    scheduleAnalytics();
    localStorage.setItem(CONSENT_KEY, "accepted");
    window.dispatchEvent(new Event(CONSENT_UPDATED_EVENT));
    expect(gtagScript()).toBeNull();
    fireLoadThenIdle();
    const cmds = commands();
    const update = cmds.findIndex((c) => c[0] === "consent" && c[1] === "update");
    expect(cmds[update][2]).toEqual({ analytics_storage: "granted" });
    expect(update).toBeLessThan(cmds.findIndex((c) => c[0] === "config"));
  });

  it("GPC: denied update queued at startup, Ahrefs never loads", async () => {
    setGpc(true);
    const { scheduleAnalytics } = await load();
    scheduleAnalytics();
    const cmds = commands();
    expect(cmds.find((c) => c[0] === "consent" && c[1] === "update")?.[2]).toEqual({ analytics_storage: "denied" });
    fireLoadThenIdle();
    expect(gtagScript()).not.toBeNull();
    expect(ahrefs()).toBeNull();
  });

  it("falls back to setTimeout(1500) where requestIdleCallback is missing", async () => {
    delete (window as any).requestIdleCallback;
    vi.useFakeTimers();
    const { scheduleAnalytics, ANALYTICS_IDLE_FALLBACK_MS } = await load();
    expect(ANALYTICS_IDLE_FALLBACK_MS).toBe(1500);
    scheduleAnalytics();
    window.dispatchEvent(new Event("load"));
    window.dispatchEvent(new Event("pointerdown"));
    vi.advanceTimersByTime(1499);
    expect(gtagScript()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(gtagScript()).not.toBeNull();
  });

  it("skips the load wait when the page has already loaded", async () => {
    setReadyState("complete");
    const { scheduleAnalytics } = await load();
    scheduleAnalytics();
    expect(idleCallbacks).toHaveLength(0);
    window.dispatchEvent(new Event("touchstart"));
    expect(idleCallbacks).toHaveLength(1);
    idleCallbacks[0]();
    expect(gtagScript()).not.toBeNull();
  });

  it("is idempotent", async () => {
    const { scheduleAnalytics } = await load();
    scheduleAnalytics();
    scheduleAnalytics();
    fireLoadThenIdle();
    expect(document.head.querySelectorAll('script[src*="gtag/js"]')).toHaveLength(1);
    expect(commands().filter((c) => c[0] === "consent" && c[1] === "default")).toHaveLength(2);
  });

  it("landing on /admin: nothing is queued or loaded", async () => {
    window.history.replaceState(null, "", "/admin/pipeline");
    const { scheduleAnalytics } = await load();
    scheduleAnalytics();
    fireLoadThenIdle();
    expect(window.gtag).toBeUndefined();
    expect(gtagScript()).toBeNull();
    expect(ahrefs()).toBeNull();
  });

  it("on /admin when the deferred load runs: gtag.js and Ahrefs stay unloaded", async () => {
    const { scheduleAnalytics } = await load();
    scheduleAnalytics();
    window.history.pushState(null, "", "/admin/jobs");
    fireLoadThenIdle();
    expect(gtagScript()).toBeNull();
    expect(ahrefs()).toBeNull();
  });

  it("track* stay no-ops until gtag.js is requested (no events queued before config)", async () => {
    const { scheduleAnalytics, trackEvent } = await load();
    scheduleAnalytics();
    trackEvent("search", "search_query", "hydrogen");
    expect(commands().some((c) => c[0] === "event")).toBe(false);
    fireLoadThenIdle();
    trackEvent("search", "search_query", "hydrogen");
    expect(commands().some((c) => c[0] === "event" && c[1] === "search")).toBe(true);
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
