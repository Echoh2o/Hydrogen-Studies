/**
 * Unit tests for withAdvisoryLock — the cross-process mutual-exclusion wrapper
 * around Postgres session-level advisory locks.
 *
 * Pure control-flow tests over a mocked pg pool (repo convention: no
 * integration DB). They verify the client-lifecycle contract:
 *   - lock acquired  → fn runs on the SAME held client, unlock in finally
 *   - lock contended → fn skipped, null returned
 *   - fn throws      → unlock + release still happen, error propagates
 *   - unlock fails   → client DESTROYED (release(true)) so the lock dies
 *                      with the connection instead of leaking a pool slot
 *   - pool down      → availability fallback: fn runs WITHOUT the lock
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};
const mockConnect = vi.fn(async () => mockClient);

vi.mock("../db", () => ({
  pool: {
    connect: () => mockConnect(),
  },
}));

vi.mock("../utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const { withAdvisoryLock } = await import("../utils/advisory-lock");
const { logger } = await import("../utils/logger");

/** Route the try-lock query to `locked`, and the unlock query to `unlock`. */
function primeQueries(locked: boolean, unlock: () => Promise<unknown> = async () => ({ rows: [] })) {
  mockClient.query.mockImplementation(async (text: string) => {
    if (text.includes("pg_try_advisory_lock")) {
      return { rows: [{ locked }] };
    }
    return unlock();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockConnect.mockImplementation(async () => mockClient);
});

describe("withAdvisoryLock", () => {
  it("runs fn and returns its value when the lock is acquired", async () => {
    primeQueries(true);
    const fn = vi.fn(async () => "payload");

    const result = await withAdvisoryLock("test-lock", fn);

    expect(result).toBe("payload");
    expect(fn).toHaveBeenCalledTimes(1);
    // Lock and unlock both target the same lock name on the SAME client.
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("pg_try_advisory_lock"),
      ["test-lock"],
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("pg_advisory_unlock"),
      ["test-lock"],
    );
    // Client returned to the pool healthy (no destroy flag).
    expect(mockClient.release).toHaveBeenCalledTimes(1);
    expect(mockClient.release).toHaveBeenCalledWith();
  });

  it("does NOT run fn and returns null when another session holds the lock", async () => {
    primeQueries(false);
    const fn = vi.fn(async () => "payload");

    const result = await withAdvisoryLock("test-lock", fn);

    expect(result).toBeNull();
    expect(fn).not.toHaveBeenCalled();
    // No unlock attempt — we never held the lock.
    expect(mockClient.query).toHaveBeenCalledTimes(1);
    expect(mockClient.release).toHaveBeenCalledTimes(1);
    expect(mockClient.release).toHaveBeenCalledWith();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("test-lock"),
      expect.anything(),
      expect.anything(),
    );
  });

  it("unlocks and releases the client even when fn throws, propagating the error", async () => {
    primeQueries(true);
    const boom = new Error("sync exploded");
    const fn = vi.fn(async () => {
      throw boom;
    });

    await expect(withAdvisoryLock("test-lock", fn)).rejects.toThrow("sync exploded");

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("pg_advisory_unlock"),
      ["test-lock"],
    );
    expect(mockClient.release).toHaveBeenCalledTimes(1);
    expect(mockClient.release).toHaveBeenCalledWith();
  });

  it("destroys the client (release(true)) when the unlock query fails", async () => {
    primeQueries(true, async () => {
      throw new Error("connection terminated");
    });
    const fn = vi.fn(async () => 42);

    const result = await withAdvisoryLock("test-lock", fn);

    // fn's result still comes back — the job itself succeeded.
    expect(result).toBe(42);
    // Destroyed, not returned: the advisory lock dies with the connection.
    expect(mockClient.release).toHaveBeenCalledTimes(1);
    expect(mockClient.release).toHaveBeenCalledWith(true);
    expect(logger.warn).toHaveBeenCalled();
  });

  it("runs fn WITHOUT the lock when a pool client cannot be acquired (availability fallback)", async () => {
    mockConnect.mockImplementation(async () => {
      throw new Error("pool exhausted");
    });
    const fn = vi.fn(async () => "unlocked-run");

    const result = await withAdvisoryLock("test-lock", fn);

    expect(result).toBe("unlocked-run");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(mockClient.query).not.toHaveBeenCalled();
    expect(mockClient.release).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("WITHOUT cross-process lock"),
      expect.anything(),
      expect.anything(),
    );
  });

  it("destroys the client and runs fn WITHOUT the lock when the lock query itself fails", async () => {
    mockClient.query.mockImplementation(async () => {
      throw new Error("server closed the connection unexpectedly");
    });
    const fn = vi.fn(async () => "unlocked-run");

    const result = await withAdvisoryLock("test-lock", fn);

    expect(result).toBe("unlocked-run");
    expect(fn).toHaveBeenCalledTimes(1);
    // The suspect client must not be returned to the pool healthy.
    expect(mockClient.release).toHaveBeenCalledTimes(1);
    expect(mockClient.release).toHaveBeenCalledWith(true);
    expect(logger.warn).toHaveBeenCalled();
  });
});
