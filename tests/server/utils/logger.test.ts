import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to mock process.env before importing
describe("logger", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  it("should export logger with debug, info, warn, error methods", async () => {
    const { logger } = await import("../../../server/utils/logger");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("info should call console.log", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { logger } = await import("../../../server/utils/logger");
    logger.info("Test message", "TestContext");
    expect(spy).toHaveBeenCalled();
  });

  it("warn should call console.warn", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { logger } = await import("../../../server/utils/logger");
    logger.warn("Warning message");
    expect(spy).toHaveBeenCalled();
  });

  it("error should call console.error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { logger } = await import("../../../server/utils/logger");
    logger.error("Error message", new Error("test"));
    expect(spy).toHaveBeenCalled();
  });
});
