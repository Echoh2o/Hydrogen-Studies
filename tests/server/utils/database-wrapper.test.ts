import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../../../server/utils/database-wrapper";

describe("withRetry", () => {
  it("should return result on first successful attempt", async () => {
    const operation = vi.fn().mockResolvedValue("success");
    const result = await withRetry(operation);
    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("should throw immediately for non-retryable errors", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("Constraint violation"));
    await expect(withRetry(operation, { maxRetries: 3 })).rejects.toThrow();
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("should retry for retryable errors", async () => {
    const error = new Error("ECONNREFUSED");
    const operation = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValue("recovered");

    const onRetry = vi.fn();
    const result = await withRetry(operation, {
      maxRetries: 3,
      retryDelay: 10,
      onRetry,
    });
    expect(result).toBe("recovered");
    expect(operation).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("should throw after exhausting all retries", async () => {
    const error = new Error("ECONNREFUSED");
    const operation = vi.fn().mockRejectedValue(error);

    await expect(
      withRetry(operation, { maxRetries: 2, retryDelay: 10 }),
    ).rejects.toThrow();
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
