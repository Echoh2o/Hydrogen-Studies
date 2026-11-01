import { describe, it, expect, vi } from "vitest";

vi.mock("../utils/http", () => ({ externalApi: { get: vi.fn(), post: vi.fn() } }));

const { normalizeDoi, isLookupableDoi, summaryDois, classifyCandidates } = await import("../services/pmid-lookup");

const rec = (doi: string | null, eloc = "") => ({
  articleids: [{ idtype: "pubmed", value: "1" }, ...(doi ? [{ idtype: "doi", value: doi }] : [])],
  elocationid: eloc,
});

describe("normalizeDoi", () => {
  it("strips resolver prefixes and lowercases", () => {
    expect(normalizeDoi(" https://doi.org/10.1519/JSC.0000000000003979 ")).toBe("10.1519/jsc.0000000000003979");
    expect(normalizeDoi("http://dx.doi.org/10.1/ABC")).toBe("10.1/abc");
    expect(normalizeDoi("doi: 10.1/x")).toBe("10.1/x");
    expect(normalizeDoi(null)).toBe("");
  });
  it("only real-looking DOIs are looked up", () => {
    expect(isLookupableDoi("10.3390/nu13020459")).toBe(true);
    expect(isLookupableDoi("not-a-doi")).toBe(false);
    expect(isLookupableDoi('10.1000/a"b')).toBe(false);
  });
});

describe("summaryDois", () => {
  it("reads articleids and elocationid", () => {
    expect(summaryDois(rec("10.1/A", "doi: 10.1/B"))).toEqual(["10.1/a", "10.1/b"]);
    expect(summaryDois(undefined)).toEqual([]);
  });
});

describe("classifyCandidates", () => {
  it("no candidates → no_hit", () => {
    expect(classifyCandidates("10.1/a", [], {}).status).toBe("no_hit");
  });
  it("one candidate with our DOI (case-insensitive) → matched", () => {
    const r = classifyCandidates("10.1/ABC", ["123"], { "123": rec("10.1/abc") });
    expect(r).toMatchObject({ status: "matched", pmid: "123" });
  });
  it("picks the single verified PMID among several candidates", () => {
    const r = classifyCandidates("10.1/abc", ["1", "2"], { "1": rec("10.1/other"), "2": rec("10.1/abc") });
    expect(r).toMatchObject({ status: "matched", pmid: "2" });
  });
  it("candidates without our DOI → mismatch (never filled)", () => {
    const r = classifyCandidates("10.1/abc", ["9"], { "9": rec("10.1/abcd") });
    expect(r.status).toBe("mismatch");
    expect(r.pubmedDois).toContain("10.1/abcd");
  });
  it("prefix-similar DOIs do not match", () => {
    expect(classifyCandidates("10.1/abc", ["9"], { "9": rec("10.1/abc.1") }).status).toBe("mismatch");
  });
  it("two PMIDs carrying our DOI → multiple (never filled)", () => {
    const r = classifyCandidates("10.1/abc", ["1", "2"], { "1": rec("10.1/abc"), "2": rec(null, "doi: 10.1/ABC") });
    expect(r).toMatchObject({ status: "multiple", pmid: "1;2" });
  });
});
