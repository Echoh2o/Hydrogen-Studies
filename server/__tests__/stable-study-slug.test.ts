/**
 * PLAN 3.3 — stable study URLs. A study's slug keeps its title portion and
 * ends in its permanent identifier (PMID, else DOI, else our row id) instead
 * of the 13-digit import-batch epoch every slug carries today.
 */
import { describe, it, expect } from "vitest";
import { parseStableSuffix, stableStudySlug, titlePortion } from "../../shared/study-slug";

describe("titlePortion", () => {
  it("strips the 13-digit import-batch epoch", () => {
    expect(titlePortion("hydrogen-therapy-from-mechanism-to-cerebral-diseases-1777577956377")).toBe(
      "hydrogen-therapy-from-mechanism-to-cerebral-diseases",
    );
  });
  it("strips an existing stable suffix (re-running the plan is a no-op)", () => {
    expect(titlePortion("a-study-pmid-27826423")).toBe("a-study");
    expect(titlePortion("a-study-doi-10-1159-000321946")).toBe("a-study");
    expect(titlePortion("a-study-hs-3751")).toBe("a-study");
  });
  it("leaves a slug with no suffix alone", () => {
    expect(titlePortion("hydrogen-and-medical-application")).toBe("hydrogen-and-medical-application");
  });
  it("never leaves a trailing dash or an empty title", () => {
    expect(titlePortion("1777577956377")).toBe("");
  });
});

describe("stableStudySlug", () => {
  const base = { id: 3844, slug: "hydrogen-therapy-from-mechanism-to-cerebral-diseases-1777577956377" };

  it("prefers the PMID", () => {
    expect(stableStudySlug({ ...base, pmid: "27826423", doi: "10.4103/2045-9912.179346" })).toEqual({
      slug: "hydrogen-therapy-from-mechanism-to-cerebral-diseases-pmid-27826423",
      kind: "pmid",
    });
  });

  it("falls back to a slugified DOI (normalized, lowercase, punctuation → dashes)", () => {
    expect(stableStudySlug({ ...base, pmid: null, doi: "https://doi.org/10.3760/cma.j.issn.0412-4081.2018.08.010" })).toEqual({
      slug: "hydrogen-therapy-from-mechanism-to-cerebral-diseases-doi-10-3760-cma-j-issn-0412-4081-2018-08-010",
      kind: "doi",
    });
  });

  it("falls back to the row id when there is neither", () => {
    expect(stableStudySlug({ ...base, pmid: "", doi: "   " })).toEqual({
      slug: "hydrogen-therapy-from-mechanism-to-cerebral-diseases-hs-3844",
      kind: "id",
    });
  });

  it("ignores a malformed PMID and uses the DOI instead", () => {
    expect(stableStudySlug({ ...base, pmid: "n/a", doi: "10.1159/000321946" }).kind).toBe("doi");
  });

  it("is idempotent", () => {
    const once = stableStudySlug({ ...base, pmid: "27826423" });
    expect(stableStudySlug({ ...base, slug: once.slug, pmid: "27826423" })).toEqual(once);
  });

  it("uses 'study' as the title portion when the slug was only an epoch", () => {
    expect(stableStudySlug({ id: 9, slug: "1777577956377", pmid: "12345" }).slug).toBe("study-pmid-12345");
  });
});

describe("parseStableSuffix", () => {
  it("reads each kind", () => {
    expect(parseStableSuffix("a-study-pmid-27826423")).toEqual({ kind: "pmid", pmid: "27826423" });
    expect(parseStableSuffix("a-study-doi-10-1159-000321946")).toEqual({ kind: "doi", doiSlug: "10-1159-000321946" });
    expect(parseStableSuffix("a-study-hs-3751")).toEqual({ kind: "id", id: 3751 });
  });
  it("returns null for legacy epoch slugs and plain slugs", () => {
    expect(parseStableSuffix("a-study-1777577956377")).toBeNull();
    expect(parseStableSuffix("a-study")).toBeNull();
    expect(parseStableSuffix("")).toBeNull();
  });
  it("a DOI whose last segment looks like -hs-<n> is still a DOI", () => {
    expect(parseStableSuffix("x-doi-10-1000-abc-hs-123")).toEqual({ kind: "doi", doiSlug: "10-1000-abc-hs-123" });
  });
  it("a title containing the word doi is not a DOI suffix", () => {
    expect(parseStableSuffix("the-doi-of-x-hs-5")).toEqual({ kind: "id", id: 5 });
  });
});
