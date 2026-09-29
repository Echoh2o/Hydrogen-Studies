import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../utils/http", async () => {
  const actual = await vi.importActual<typeof import("../utils/http")>("../utils/http");
  return { ...actual, externalApi: { get } };
});

import { searchEuropePMC, __resetEuropePmcBreakerForTests, EUROPE_PMC_BREAKER_MS } from "../services/europepmc-api";
import { getCrossRefArticleByDOI } from "../services/crossref-api";

function httpError(status: number) {
  const err: any = new Error(`Request failed with status code ${status}`);
  err.isAxiosError = true;
  err.response = { status, data: {} };
  return err;
}

describe("Europe PMC outage breaker + concise logging", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    get.mockReset();
    __resetEuropePmcBreakerForTests();
    vi.spyOn(console, "log").mockImplementation(() => {});
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    error = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("a 503 opens the breaker: one concise warning, later searches skip the API", async () => {
    get.mockRejectedValue(httpError(503));
    expect(await searchEuropePMC("hydrogen water", 1, 10)).toEqual({ results: [], total: 0 });
    expect(await searchEuropePMC("hydrogen inhalation", 1, 10)).toEqual({ results: [], total: 0 });
    expect(get).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(line).toMatch(/Europe PMC unavailable/);
    expect(warn.mock.calls[0]).toHaveLength(1); // a string, not the axios object
    expect(error).not.toHaveBeenCalled();
  });

  it("the breaker closes after EUROPE_PMC_BREAKER_MS", async () => {
    vi.useFakeTimers();
    get.mockRejectedValueOnce(httpError(503));
    await searchEuropePMC("a", 1, 10);
    vi.setSystemTime(Date.now() + EUROPE_PMC_BREAKER_MS + 1);
    get.mockResolvedValueOnce({ data: { hitCount: 0, resultList: { result: [] } } });
    await searchEuropePMC("b", 1, 10);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("a 4xx doesn't open the breaker and logs one concise error line", async () => {
    get.mockRejectedValueOnce(httpError(400));
    await searchEuropePMC("bad query", 1, 10);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]).toHaveLength(1);
    get.mockResolvedValueOnce({ data: { hitCount: 0, resultList: { result: [] } } });
    await searchEuropePMC("ok", 1, 10);
    expect(get).toHaveBeenCalledTimes(2);
  });
});

describe("CrossRef DOI lookups", () => {
  beforeEach(() => get.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("a 404 (DOI not indexed by CrossRef) is a warning, not an error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    get.mockRejectedValueOnce(httpError(404));
    await expect(getCrossRefArticleByDOI("10.3760/cma.j.issn.0376-2491.2014.40.015")).rejects.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/CrossRef lookup failed for DOI 10\.3760/);
    expect(error).not.toHaveBeenCalled();
  });

  it("other failures stay errors", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    get.mockRejectedValueOnce(httpError(500));
    await expect(getCrossRefArticleByDOI("10.1000/x")).rejects.toThrow();
    expect(error).toHaveBeenCalledTimes(1);
  });
});
