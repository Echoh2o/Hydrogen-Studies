import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const captureException = vi.fn();
const init = vi.fn();
vi.mock("@sentry/react", () => ({ captureException, init }));
vi.mock("../chunk-reload", () => ({ reloadOnceForStaleChunk: () => false }));

type Listener = (event: any) => void;

describe("error-tracking", () => {
  let listeners: Record<string, Listener>;
  let sendBeacon: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    captureException.mockClear();
    init.mockClear();
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
});
