/**
 * PLAN 4.4 — citation counts from OpenAlex: batched OR-filter lookups (≤50 per
 * request), parsed into maps by DOI and PMID; the visible "Cited by" line only
 * appears for counts with a known source and refresh date.
 */
import { describe, it, expect, vi } from "vitest";
import { OPENALEX_BATCH, fetchOpenAlexWorks, openAlexId, parseWork, pmidFromUrl } from "../services/openalex";
import { citationLine } from "../../shared/study-page";

const work = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `https://openalex.org/W${n}`,
  doi: `https://doi.org/10.1000/x${n}`,
  cited_by_count: n,
  ids: { pmid: `https://pubmed.ncbi.nlm.nih.gov/${10000 + n}`, doi: `https://doi.org/10.1000/x${n}` },
  ...extra,
});

describe("parsing", () => {
  it("strips OpenAlex and PubMed URLs down to ids and normalizes the DOI", () => {
    expect(openAlexId("https://openalex.org/W2401015570")).toBe("W2401015570");
    expect(openAlexId("W1")).toBe("W1");
    expect(openAlexId(null)).toBeNull();
    expect(pmidFromUrl("https://pubmed.ncbi.nlm.nih.gov/27826423")).toBe("27826423");
    expect(pmidFromUrl(null)).toBeNull();
    expect(parseWork(work(27))).toEqual({ id: "W27", doi: "10.1000/x27", pmid: "10027", citedByCount: 27 });
    expect(parseWork({ id: "https://openalex.org/W1" })).toBeNull(); // no count
  });
});

describe("fetchOpenAlexWorks", () => {
  it("batches 50 ids per request, keys results by lowercase DOI and by PMID", async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      urls.push(url);
      const filter = decodeURIComponent(new URL(url).searchParams.get("filter")!);
      const values = filter.replace(/^(doi|pmid):/, "").split("|");
      const results = values.map((v) => work(Number(v.replace(/\D/g, "").slice(-2) || "0")));
      return new Response(JSON.stringify({ results }), { status: 200 });
    }) as unknown as typeof fetch;

    const dois = Array.from({ length: 120 }, (_, i) => `10.1000/X${i}`);
    const { byDoi, byPmid, requests } = await fetchOpenAlexWorks({ dois, pmids: ["27826423"] }, { fetchImpl, delayMs: 0 });
    expect(requests).toBe(Math.ceil(120 / OPENALEX_BATCH) + 1);
    expect(urls[0]).toContain("filter=doi%3A");
    expect(urls.at(-1)).toContain("filter=pmid%3A27826423");
    expect(urls[0]).toContain("mailto=");
    expect(byDoi.get("10.1000/x27")?.citedByCount).toBe(27);
    expect(byPmid.get("10027")?.id).toBe("W27");
    // DOIs are deduplicated and lowercased before the request.
    const firstFilter = decodeURIComponent(new URL(urls[0]).searchParams.get("filter")!);
    expect(firstFilter.split("|")).toHaveLength(OPENALEX_BATCH);
    expect(firstFilter).toContain("10.1000/x0");
  });

  it("retries 429/5xx and throws after the last attempt so the caller can mark the batch as an error", async () => {
    const fetchImpl = vi.fn(async () => new Response("rate limited", { status: 429 })) as unknown as typeof fetch;
    await expect(fetchOpenAlexWorks({ dois: ["10.1/a"] }, { fetchImpl, delayMs: 0, retries: 1 })).rejects.toThrow("OpenAlex 429");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("skips malformed PMIDs and makes no request for an empty input", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const r = await fetchOpenAlexWorks({ pmids: ["n/a", "PMC123", ""] }, { fetchImpl, delayMs: 0 });
    expect(r.requests).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("citationLine (what the study page shows)", () => {
  it("shows the count with its source, 'as of' month and OpenAlex link", () => {
    expect(
      citationLine({ citationCount: 27, citationSource: "openalex", citationCountUpdatedAt: "2026-11-03T20:00:00Z", openalexId: "W2401015570" }),
    ).toEqual({ count: 27, sourceLabel: "OpenAlex", asOf: "November 2026", href: "https://openalex.org/W2401015570" });
  });

  it("shows zero (a real, dated count) but never a legacy count of unknown origin", () => {
    expect(citationLine({ citationCount: 0, citationSource: "openalex", citationCountUpdatedAt: new Date("2026-11-03") })?.count).toBe(0);
    expect(citationLine({ citationCount: 812, citationSource: null })).toBeNull();
    expect(citationLine({ citationCount: 812, citationSource: "openalex", citationCountUpdatedAt: null })).toBeNull();
    expect(citationLine({ citationCount: null, citationSource: "openalex", citationCountUpdatedAt: new Date() })).toBeNull();
  });

  it("omits the link when the OpenAlex id is missing or malformed", () => {
    expect(citationLine({ citationCount: 3, citationSource: "openalex", citationCountUpdatedAt: new Date(), openalexId: "https://evil" })?.href).toBeNull();
  });
});
