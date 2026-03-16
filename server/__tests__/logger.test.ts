import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("logger", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("logger.info calls console.log", async () => {
    process.env.NODE_ENV = "development";
    const { logger } = await import("../utils/logger");
    logger.info("test message", "TestContext");
    expect(console.log).toHaveBeenCalled();
    const output = (console.log as any).mock.calls[0][0];
    expect(output).toContain("[INFO]");
    expect(output).toContain("TestContext");
    expect(output).toContain("test message");
  });

  it("logger.warn calls console.warn", async () => {
    process.env.NODE_ENV = "development";
    const { logger } = await import("../utils/logger");
    logger.warn("warning message", "WarnCtx");
    expect(console.warn).toHaveBeenCalled();
    const output = (console.warn as any).mock.calls[0][0];
    expect(output).toContain("[WARN]");
    expect(output).toContain("warning message");
  });

  it("logger.error includes error details", async () => {
    process.env.NODE_ENV = "development";
    const { logger } = await import("../utils/logger");
    const err = new Error("test error");
    logger.error("something failed", err, "ErrCtx");
    expect(console.error).toHaveBeenCalled();
    const output = (console.error as any).mock.calls[0][0];
    expect(output).toContain("[ERROR]");
    expect(output).toContain("something failed");
  });

  it("logger.info includes structured data", async () => {
    process.env.NODE_ENV = "development";
    const { logger } = await import("../utils/logger");
    logger.info("event", "Ctx", { userId: "123", action: "login" });
    const output = (console.log as any).mock.calls[0][0];
    expect(output).toContain("userId");
    expect(output).toContain("123");
  });
});
