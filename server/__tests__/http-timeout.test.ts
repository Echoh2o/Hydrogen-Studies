/**
 * Tests for server/utils/http.ts — the shared outbound-HTTP helpers that
 * enforce timeouts on external calls (audit 2026-07: hung upstreams wedged
 * route handlers and background sync guards indefinitely).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { externalApi, fetchWithTimeout, DEFAULT_TIMEOUT_MS } from "../utils/http";

describe("externalApi (shared axios instance)", () => {
  it("has a 10s default timeout", () => {
    expect(externalApi.defaults.timeout).toBe(10_000);
    expect(DEFAULT_TIMEOUT_MS).toBe(10_000);
  });

  it("caps response and request body sizes", () => {
    expect(externalApi.defaults.maxContentLength).toBe(25 * 1024 * 1024);
    expect(externalApi.defaults.maxBodyLength).toBe(25 * 1024 * 1024);
  });
});

describe("fetchWithTimeout", () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it("passes through url and init options to fetch", async () => {
    const mockResponse = new Response("ok");
    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    global.fetch = fetchMock as any;

    const init = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ a: 1 }),
    };
    const res = await fetchWithTimeout("https://example.com/api", init);

    expect(res).toBe(mockResponse);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, passedInit] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.com/api");
    expect(passedInit.method).toBe("POST");
    expect(passedInit.headers).toEqual({ "Content-Type": "application/json" });
    expect(passedInit.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("attaches an AbortSignal even when the caller passes none", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    global.fetch = fetchMock as any;

    await fetchWithTimeout("https://example.com");

    const [, passedInit] = fetchMock.mock.calls[0];
    expect(passedInit.signal).toBeInstanceOf(AbortSignal);
    expect(passedInit.signal.aborted).toBe(false);
  });

  it("combines a caller-provided signal with the timeout signal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    global.fetch = fetchMock as any;

    const callerController = new AbortController();
    await fetchWithTimeout(
      "https://example.com",
      { signal: callerController.signal },
      5_000,
    );

    const [, passedInit] = fetchMock.mock.calls[0];
    const combined: AbortSignal = passedInit.signal;
    expect(combined).toBeInstanceOf(AbortSignal);
    expect(combined.aborted).toBe(false);

    // Aborting the caller's controller must abort the combined signal.
    callerController.abort(new Error("caller cancelled"));
    expect(combined.aborted).toBe(true);
  });

  it("rejects with a TimeoutError when the upstream never responds", async () => {
    // fetch honors the signal like undici does: never resolves, rejects on abort.
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal!.reason),
          );
        }),
    );
    global.fetch = fetchMock as any;

    await expect(
      fetchWithTimeout("https://hung.example.com", undefined, 10),
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("still times out when a caller signal is present but never aborted", async () => {
    // Guards against a regression like `init.signal ?? timeoutSignal`, which
    // would silently drop timeout enforcement whenever callers pass a signal.
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal!.reason),
          );
        }),
    );
    global.fetch = fetchMock as any;

    const callerController = new AbortController();
    await expect(
      fetchWithTimeout(
        "https://hung.example.com",
        { signal: callerController.signal },
        10,
      ),
    ).rejects.toMatchObject({ name: "TimeoutError" });
    expect(callerController.signal.aborted).toBe(false);
  });

  it("does not abort when the response arrives before the timeout", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("fast")) as any;

    const res = await fetchWithTimeout("https://example.com", undefined, 1_000);
    expect(await res.text()).toBe("fast");
  });
});
