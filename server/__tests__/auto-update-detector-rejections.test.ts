/**
 * The auto-update detector's interval/initial checks are fire-and-forget; a
 * rejected checkForUpdates() must be logged, never left as an unhandled
 * rejection.
 */
import { describe, it, expect, vi, afterEach } from "vitest";

const loggerError = vi.hoisted(() => vi.fn());

vi.mock("../db", () => ({ db: {} }));
vi.mock("../services/content-optimization-service", () => ({ contentOptimizationService: {} }));
vi.mock("../services/ai-provider", () => ({ ai: {} }));
vi.mock("../utils/logger", () => ({
  logger: { error: loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { AutoUpdateDetector } = await import("../services/auto-update-detector");

describe("AutoUpdateDetector fire-and-forget checks", () => {
  afterEach(() => {
    vi.useRealTimers();
    loggerError.mockReset();
  });

  it("logs (does not leak) a rejected initial and interval check", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const detector = new AutoUpdateDetector();
    const boom = new Error("db down");
    vi.spyOn(detector, "checkForUpdates").mockRejectedValue(boom);

    detector.start(1);
    await vi.advanceTimersByTimeAsync(60_000);
    detector.stop();

    expect(loggerError).toHaveBeenCalledTimes(2);
    expect(loggerError).toHaveBeenCalledWith("Auto-update check failed", boom, "AutoUpdateDetector");
  });
});
