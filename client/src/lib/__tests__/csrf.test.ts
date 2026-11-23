/**
 * Regression (PR #192 E2E): the CSRF-priming GET never read its response
 * body. Sent `Cache-Control: no-store`, Chrome kept that request in flight
 * forever, so admin pages never reached network idle. The body must be drained.
 */
import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("installCsrfInterceptor", () => {
  it("drains the priming response body and caches its token", async () => {
    const cancel = vi.fn(async () => {});
    const primingRes = {
      headers: new Headers({ "X-CSRF-Token": "tok-123" }),
      body: { cancel },
    };
    const nativeFetch = vi.fn(async (_input: unknown, _init?: RequestInit) => primingRes as unknown as Response);
    const win: any = { fetch: nativeFetch, location: { href: "http://localhost/", origin: "http://localhost" } };
    vi.stubGlobal("window", win);

    const { installCsrfInterceptor } = await import("../csrf");
    installCsrfInterceptor();
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
    expect(nativeFetch.mock.calls[0][0]).toBe("/api/auth/check-session");

    // The token from the priming response is attached to the next mutation.
    await win.fetch("/api/x", { method: "POST" });
    const headers = new Headers(nativeFetch.mock.calls[1][1]?.headers);
    expect(headers.get("x-csrf-token")).toBe("tok-123");
  });
});
