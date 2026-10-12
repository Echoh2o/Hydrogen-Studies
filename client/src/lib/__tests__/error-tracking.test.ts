import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const captureException = vi.fn();
const init = vi.fn();
vi.mock("@sentry/react", () => ({ captureException, init }));
const reloadOnceForStaleChunk = vi.fn((_err: unknown) => false);
vi.mock("../chunk-reload", () => ({ reloadOnceForStaleChunk }));

type Listener = (event: any) => void;

describe("error-tracking", () => {
  let listeners: Record<string, Listener>;
  let sendBeacon: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    captureException.mockClear();
    init.mockClear();
    reloadOnceForStaleChunk.mockReset();
    reloadOnceForStaleChunk.mockReturnValue(false);
    listeners = {};
    sendBeacon = vi.fn();
    vi.stubGlobal("window", {
      location: { href: "https://hydrogenstudies.com/x" },
      addEventListener: (type: string, fn: Listener) => {
        listeners[type] = fn;
      },
    });
    vi.stubGlobal("navigator", { userAgent: "test-ua", sendBeacon });
    vi.stubEnv("VITE_SENTRY_DSN", "https://key@o0.ingest.sentry.io/0");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("trackError captures the original error in Sentry exactly once", async () => {
    const { initErrorTracking, trackError } = await import("../error-tracking");
    initErrorTracking();
    const err = new Error("boom");

    trackError(err, "ErrorBoundary");

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(err, { tags: { context: "ErrorBoundary" } });
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it("global error/rejection listeners beacon to the server without a duplicate Sentry capture", async () => {
    const { initErrorTracking } = await import("../error-tracking");
    initErrorTracking();

    listeners.error({ message: "Uncaught boom", error: new Error("boom") });
    listeners.unhandledrejection({ reason: new Error("nope") });

    // Sentry's own GlobalHandlers integration captures these; we must not.
    expect(captureException).not.toHaveBeenCalled();
    expect(sendBeacon).toHaveBeenCalledTimes(2);
    expect(sendBeacon.mock.calls[0][0]).toBe("/api/client-errors");
  });

  it("beforeSend drops chunk-load errors that trigger a stale-chunk reload", async () => {
    const { initErrorTracking } = await import("../error-tracking");
    initErrorTracking();
    const { beforeSend } = init.mock.calls[0][0];
    const chunkErr = new TypeError("Importing a module script failed.");
    const event = { exception: { values: [{ type: "TypeError" }] } };

    reloadOnceForStaleChunk.mockReturnValue(true);
    expect(beforeSend(event, { originalException: chunkErr })).toBeNull();
    expect(reloadOnceForStaleChunk).toHaveBeenCalledWith(chunkErr);

    // Loop guard tripped (reload already attempted) — the failure is real, report it.
    reloadOnceForStaleChunk.mockReturnValue(false);
    expect(beforeSend(event, { originalException: chunkErr })).toBe(event);
  });

  it("ignores known extension / in-app browser noise", async () => {
    const { initErrorTracking } = await import("../error-tracking");
    initErrorTracking();
    const { ignoreErrors } = init.mock.calls[0][0];

    expect(ignoreErrors).toEqual(
      expect.arrayContaining([
        "Invalid call to runtime.sendMessage(). Tab not found",
        "Java object is gone",
        "Object Not Found Matching Id",
      ]),
    );
  });
});
