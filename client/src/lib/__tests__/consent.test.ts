import { describe, it, expect } from "vitest";
import {
  CONSENT_REQUIRED_REGIONS,
  EU_COUNTRIES,
  isConsentRequiredCountry,
  normalizeCountry,
} from "@shared/consent-regions";
import {
  CONSENT_KEY,
  PREFERENCES_KEY,
  consentDefaultCommands,
  defaultAnalyticsToggle,
  getAnalyticsChoice,
  isGpcEnabled,
  parseGeoOverride,
  resolveAnalyticsUpdate,
  resolveConsentRequired,
  shouldLoadAhrefs,
  shouldShowBanner,
} from "../consent";

function memoryStorage(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init));
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe("consent regions", () => {
  it("covers all 27 EU states, the EEA extras, UK and Switzerland", () => {
    expect(EU_COUNTRIES).toHaveLength(27);
    for (const code of [...EU_COUNTRIES, "IS", "LI", "NO", "GB", "CH"]) {
      expect(CONSENT_REQUIRED_REGIONS).toContain(code);
    }
    // ISO code for Greece, not Eurostat's "EL".
    expect(CONSENT_REQUIRED_REGIONS).toContain("GR");
    expect(CONSENT_REQUIRED_REGIONS).not.toContain("EL");
  });

  it("does not include opt-out regions", () => {
    for (const code of ["US", "CA", "AU", "BR", "IN", "JP", "MX", "NZ"]) {
      expect(CONSENT_REQUIRED_REGIONS).not.toContain(code);
      expect(isConsentRequiredCountry(code)).toBe(false);
    }
  });

  it("has no duplicates and only 2-letter uppercase codes", () => {
    expect(new Set(CONSENT_REQUIRED_REGIONS).size).toBe(CONSENT_REQUIRED_REGIONS.length);
    for (const code of CONSENT_REQUIRED_REGIONS) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it("isConsentRequiredCountry normalizes case and whitespace", () => {
    expect(isConsentRequiredCountry("de")).toBe(true);
    expect(isConsentRequiredCountry(" GB ")).toBe(true);
    expect(isConsentRequiredCountry("ch")).toBe(true);
  });

  it("missing or invalid country → not required (local dev, no Cloudflare)", () => {
    expect(isConsentRequiredCountry(undefined)).toBe(false);
    expect(isConsentRequiredCountry(null)).toBe(false);
    expect(isConsentRequiredCountry("")).toBe(false);
    expect(isConsentRequiredCountry("Germany")).toBe(false);
    expect(normalizeCountry("<script>")).toBeNull();
  });

  it("Cloudflare unknown (XX) and Tor (T1) are treated conservatively", () => {
    expect(isConsentRequiredCountry("XX")).toBe(true);
    expect(isConsentRequiredCountry("T1")).toBe(true);
  });
});

describe("consentDefaultCommands", () => {
  const [regional, global] = consentDefaultCommands();

  it("denies analytics in consent-required regions", () => {
    expect(regional[0]).toBe("consent");
    expect(regional[1]).toBe("default");
    expect(regional[2].analytics_storage).toBe("denied");
    expect(regional[2].region).toEqual([...CONSENT_REQUIRED_REGIONS]);
  });

  it("grants analytics everywhere else (no region key)", () => {
    expect(global[1]).toBe("default");
    expect(global[2].analytics_storage).toBe("granted");
    expect(global[2]).not.toHaveProperty("region");
  });

  it("keeps every ad signal denied in both defaults (no ads on this site)", () => {
    for (const [, , params] of [regional, global]) {
      expect(params.ad_storage).toBe("denied");
      expect(params.ad_user_data).toBe("denied");
      expect(params.ad_personalization).toBe("denied");
    }
  });
});

describe("stored choice → analytics update", () => {
  it("no stored choice → null (regional default applies)", () => {
    const choice = getAnalyticsChoice(memoryStorage());
    expect(choice).toBeNull();
    expect(resolveAnalyticsUpdate({ gpc: false, choice })).toBeNull();
  });

  it("accepted → granted", () => {
    const choice = getAnalyticsChoice(memoryStorage({ [CONSENT_KEY]: "accepted" }));
    expect(resolveAnalyticsUpdate({ gpc: false, choice })).toBe("granted");
  });

  it("declined → denied", () => {
    const choice = getAnalyticsChoice(memoryStorage({ [CONSENT_KEY]: "declined" }));
    expect(resolveAnalyticsUpdate({ gpc: false, choice })).toBe("denied");
  });

  it("customized with analytics off → denied; on → granted", () => {
    const off = memoryStorage({
      [CONSENT_KEY]: "customized",
      [PREFERENCES_KEY]: JSON.stringify({ necessary: true, analytics: false }),
    });
    const on = memoryStorage({
      [CONSENT_KEY]: "customized",
      [PREFERENCES_KEY]: JSON.stringify({ necessary: true, analytics: true }),
    });
    expect(getAnalyticsChoice(off)).toBe("denied");
    expect(getAnalyticsChoice(on)).toBe("granted");
  });

  it("customized with corrupt preferences → denied (safe default)", () => {
    const s = memoryStorage({ [CONSENT_KEY]: "customized", [PREFERENCES_KEY]: "{not json" });
    expect(getAnalyticsChoice(s)).toBe("denied");
  });

  it("unknown stored value → treated as no choice", () => {
    expect(getAnalyticsChoice(memoryStorage({ [CONSENT_KEY]: "maybe" }))).toBeNull();
  });

  it("storage that throws → no choice, no crash", () => {
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(getAnalyticsChoice(throwing)).toBeNull();
  });

  it("GPC → denied, even over an earlier accept", () => {
    expect(resolveAnalyticsUpdate({ gpc: true, choice: null })).toBe("denied");
    expect(resolveAnalyticsUpdate({ gpc: true, choice: "granted" })).toBe("denied");
  });
});

describe("isGpcEnabled", () => {
  it("only a strict true counts", () => {
    expect(isGpcEnabled({ globalPrivacyControl: true })).toBe(true);
    expect(isGpcEnabled({ globalPrivacyControl: false })).toBe(false);
    expect(isGpcEnabled({ globalPrivacyControl: "1" })).toBe(false);
    expect(isGpcEnabled({})).toBe(false);
    expect(isGpcEnabled(undefined)).toBe(false);
  });
});

describe("shouldLoadAhrefs (cookieless)", () => {
  it("loads by default, including in consent-required regions", () => {
    expect(shouldLoadAhrefs({ gpc: false, choice: null })).toBe(true);
    expect(shouldLoadAhrefs({ gpc: false, choice: "granted" })).toBe(true);
  });
  it("does not load with GPC or an explicit opt-out", () => {
    expect(shouldLoadAhrefs({ gpc: true, choice: null })).toBe(false);
    expect(shouldLoadAhrefs({ gpc: true, choice: "granted" })).toBe(false);
    expect(shouldLoadAhrefs({ gpc: false, choice: "denied" })).toBe(false);
  });
});

describe("banner visibility", () => {
  it("shows only where consent is required and no choice exists", () => {
    expect(shouldShowBanner({ consentRequired: true, choice: null, gpc: false })).toBe(true);
  });
  it("hidden outside consent-required regions", () => {
    expect(shouldShowBanner({ consentRequired: false, choice: null, gpc: false })).toBe(false);
  });
  it("hidden once a choice is stored", () => {
    expect(shouldShowBanner({ consentRequired: true, choice: "granted", gpc: false })).toBe(false);
    expect(shouldShowBanner({ consentRequired: true, choice: "denied", gpc: false })).toBe(false);
  });
  it("hidden with GPC (already treated as a no)", () => {
    expect(shouldShowBanner({ consentRequired: true, choice: null, gpc: true })).toBe(false);
  });
});

describe("geo resolution and ?__geo override", () => {
  it("uses the server answer", () => {
    expect(resolveConsentRequired({ consentRequired: true }, null)).toBe(true);
    expect(resolveConsentRequired({ consentRequired: false }, null)).toBe(false);
  });
  it("failed geo lookup → not required", () => {
    expect(resolveConsentRequired(null, null)).toBe(false);
    expect(resolveConsentRequired({ consentRequired: "yes" }, null)).toBe(false);
  });
  it("override can force the banner on", () => {
    expect(resolveConsentRequired({ consentRequired: false }, parseGeoOverride("?__geo=DE"))).toBe(true);
    expect(resolveConsentRequired(null, parseGeoOverride("?__geo=gb"))).toBe(true);
  });
  it("override can never suppress the banner", () => {
    expect(resolveConsentRequired({ consentRequired: true }, parseGeoOverride("?__geo=US"))).toBe(true);
  });
  it("ignores missing or malformed overrides", () => {
    expect(parseGeoOverride("")).toBeNull();
    expect(parseGeoOverride("?utm_source=x")).toBeNull();
    expect(parseGeoOverride("?__geo=Germany")).toBeNull();
  });
});

describe("defaultAnalyticsToggle (privacy-choices panel)", () => {
  it("never pre-ticks analytics where consent is required", () => {
    expect(defaultAnalyticsToggle({ consentRequired: true, choice: null, gpc: false })).toBe(false);
  });
  it("on by default elsewhere (opt-out model)", () => {
    expect(defaultAnalyticsToggle({ consentRequired: false, choice: null, gpc: false })).toBe(true);
  });
  it("reflects a stored choice", () => {
    expect(defaultAnalyticsToggle({ consentRequired: false, choice: "denied", gpc: false })).toBe(false);
    expect(defaultAnalyticsToggle({ consentRequired: true, choice: "granted", gpc: false })).toBe(true);
  });
  it("off with GPC", () => {
    expect(defaultAnalyticsToggle({ consentRequired: false, choice: "granted", gpc: true })).toBe(false);
  });
});
