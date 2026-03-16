import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("validateEnvironment", () => {
  // Save and restore the entire relevant env slice so tests are hermetic
  const envSnapshot: Record<string, string | undefined> = {};
  const trackedKeys = [
    "NODE_ENV",
    "DATABASE_URL",
    "SESSION_SECRET",
    "ALLOWED_ORIGINS",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "SENDGRID_API_KEY",
    "SENTRY_DSN",
    "VITE_SENTRY_DSN",
    "SHOPIFY_WEBHOOK_SECRET",
  ];

  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Snapshot current env values
    for (const key of trackedKeys) {
      envSnapshot[key] = process.env[key];
    }

    // Prevent process.exit from actually killing the test runner
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as unknown as (code?: number) => never);

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Reset module cache so each test gets a fresh import
    vi.resetModules();
  });

  afterEach(() => {
    // Restore environment
    for (const key of trackedKeys) {
      if (envSnapshot[key] !== undefined) {
        process.env[key] = envSnapshot[key];
      } else {
        delete process.env[key];
      }
    }
    vi.restoreAllMocks();
  });

  it("calls process.exit(1) when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    process.env.NODE_ENV = "development";

    const { validateEnvironment } = await import("../config/env");
    validateEnvironment();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Missing required environment variables"),
      expect.stringContaining("DATABASE_URL"),
    );
  });

  it("calls process.exit(1) when SESSION_SECRET is missing in production", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.NODE_ENV = "production";
    delete process.env.SESSION_SECRET;

    const { validateEnvironment } = await import("../config/env");
    validateEnvironment();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Missing required environment variables"),
      expect.stringContaining("SESSION_SECRET"),
    );
  });

  it("does not exit when DATABASE_URL is provided in development", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.NODE_ENV = "development";
    delete process.env.SESSION_SECRET; // should auto-generate

    const { validateEnvironment } = await import("../config/env");
    validateEnvironment();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Environment validation completed successfully"),
    );
  });

  it("auto-generates SESSION_SECRET in development when not provided", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.NODE_ENV = "development";
    delete process.env.SESSION_SECRET;

    const { validateEnvironment } = await import("../config/env");
    validateEnvironment();

    // After validation, SESSION_SECRET should have been set
    expect(process.env.SESSION_SECRET).toBeDefined();
    expect(process.env.SESSION_SECRET!.length).toBeGreaterThanOrEqual(32);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("generated a random secret"),
    );
  });

  it("calls process.exit(1) when DATABASE_URL has invalid format", async () => {
    process.env.DATABASE_URL = "not-a-valid-url";
    process.env.NODE_ENV = "development";
    process.env.SESSION_SECRET = "a".repeat(32);

    const { validateEnvironment } = await import("../config/env");
    validateEnvironment();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid DATABASE_URL format"),
    );
  });

  it("warns about short SESSION_SECRET in development without exiting", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.NODE_ENV = "development";
    process.env.SESSION_SECRET = "short";

    const { validateEnvironment } = await import("../config/env");
    validateEnvironment();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("SESSION_SECRET is short"),
    );
  });

  it("warns about missing optional service keys", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.NODE_ENV = "development";
    process.env.SESSION_SECRET = "a".repeat(32);
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const { validateEnvironment } = await import("../config/env");
    validateEnvironment();

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("ANTHROPIC_API_KEY not set"),
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("OPENAI_API_KEY not set"),
    );
  });
});
