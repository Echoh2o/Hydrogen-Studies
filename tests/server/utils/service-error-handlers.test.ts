import { describe, it, expect, vi } from "vitest";
import {
  handleFileUpload,
  handleSearchQuery,
  handleSessionValidation,
  withTimeout,
  handleBatchOperation,
  handleEnrichmentRequest,
} from "../../../server/utils/service-error-handlers";
import { FileUploadError, AppError, ExternalAPIError } from "../../../server/utils/app-errors";

describe("handleFileUpload", () => {
  const makeFile = (overrides = {}): Express.Multer.File => ({
    fieldname: "file",
    originalname: "test.pdf",
    encoding: "7bit",
    mimetype: "application/pdf",
    size: 1024 * 1024, // 1MB
    destination: "/tmp",
    filename: "test.pdf",
    path: "/tmp/test.pdf",
    buffer: Buffer.from(""),
    stream: null as any,
    ...overrides,
  });

  it("should return the file when valid", () => {
    const file = makeFile();
    expect(handleFileUpload(file)).toBe(file);
  });

  it("should throw when no file is provided and required", () => {
    expect(() => handleFileUpload(undefined)).toThrow("No file provided");
  });

  it("should throw when no file and not required", () => {
    expect(() => handleFileUpload(undefined, { required: false })).toThrow(
      "No file provided",
    );
  });

  it("should throw when file exceeds max size", () => {
    const file = makeFile({ size: 20 * 1024 * 1024 }); // 20MB
    expect(() => handleFileUpload(file, { maxSizeMB: 10 })).toThrow(
      "exceeds maximum allowed size",
    );
  });

  it("should throw when file type is not allowed", () => {
    const file = makeFile({ originalname: "test.exe", mimetype: "application/x-msdownload" });
    expect(() =>
      handleFileUpload(file, { allowedTypes: [".pdf", ".csv"] }),
    ).toThrow("File type not allowed");
  });

  it("should accept file with allowed extension", () => {
    const file = makeFile({ originalname: "data.csv", mimetype: "text/csv" });
    expect(handleFileUpload(file, { allowedTypes: ["csv"] })).toBe(file);
  });

  it("should accept file with allowed mime type", () => {
    const file = makeFile();
    expect(
      handleFileUpload(file, { allowedTypes: ["application/pdf"] }),
    ).toBe(file);
  });
});

describe("handleSearchQuery", () => {
  it("should return trimmed query", () => {
    expect(handleSearchQuery("  hydrogen therapy  ")).toBe("hydrogen therapy");
  });

  it("should throw when required query is empty", () => {
    expect(() => handleSearchQuery("")).toThrow(AppError);
  });

  it("should throw when required query is undefined", () => {
    expect(() => handleSearchQuery(undefined)).toThrow(AppError);
  });

  it("should return empty string when not required and empty", () => {
    expect(handleSearchQuery("", { required: false })).toBe("");
  });

  it("should throw when query is too short", () => {
    expect(() => handleSearchQuery("a", { minLength: 2 })).toThrow(AppError);
  });

  it("should throw when query exceeds max length", () => {
    const longQuery = "a".repeat(201);
    expect(() => handleSearchQuery(longQuery, { maxLength: 200 })).toThrow(
      AppError,
    );
  });

  it("should reject SQL injection attempts with --", () => {
    expect(() => handleSearchQuery("SELECT -- drop")).toThrow(AppError);
  });

  it("should reject SQL injection attempts with semicolons", () => {
    expect(() => handleSearchQuery("test; DROP TABLE")).toThrow(AppError);
  });

  it("should reject queries containing exec", () => {
    expect(() => handleSearchQuery("exec sp_something")).toThrow(AppError);
  });

  it("should reject queries containing drop", () => {
    expect(() => handleSearchQuery("drop table studies")).toThrow(AppError);
  });

  it("should accept normal search queries", () => {
    expect(handleSearchQuery("hydrogen water benefits")).toBe(
      "hydrogen water benefits",
    );
  });
});

describe("handleSessionValidation", () => {
  it("should return authenticated when session has userId", () => {
    const req = { session: { userId: "user-123" } };
    const result = handleSessionValidation(req);
    expect(result.isAuthenticated).toBe(true);
    expect(result.userId).toBe("user-123");
  });

  it("should throw when no session and auth required", () => {
    const req = { session: null };
    expect(() => handleSessionValidation(req)).toThrow(AppError);
  });

  it("should return unauthenticated when no session and auth not required", () => {
    const req = { session: null };
    const result = handleSessionValidation(req, false);
    expect(result.isAuthenticated).toBe(false);
  });

  it("should throw when session exists but no userId and auth required", () => {
    const req = { session: {} };
    expect(() => handleSessionValidation(req)).toThrow(AppError);
  });
});

describe("withTimeout", () => {
  it("should resolve when operation completes before timeout", async () => {
    const result = await withTimeout(
      () => Promise.resolve("success"),
      1000,
    );
    expect(result).toBe("success");
  });

  it("should reject when operation exceeds timeout", async () => {
    await expect(
      withTimeout(
        () => new Promise((resolve) => setTimeout(resolve, 500)),
        50,
        "Too slow",
      ),
    ).rejects.toThrow("Too slow");
  });
});

describe("handleBatchOperation", () => {
  it("should process all items successfully", async () => {
    const items = [1, 2, 3];
    const result = await handleBatchOperation(items, async (item) => item * 2);
    expect(result.successful).toEqual([2, 4, 6]);
    expect(result.failed).toEqual([]);
    expect(result.totalProcessed).toBe(3);
  });

  it("should continue on error when continueOnError is true", async () => {
    const items = [1, 2, 3];
    const result = await handleBatchOperation(items, async (item) => {
      if (item === 2) throw new Error("Failed on 2");
      return item * 2;
    });
    expect(result.successful).toEqual([2, 6]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].item).toBe(2);
  });

  it("should throw on error when continueOnError is false", async () => {
    const items = [1, 2, 3];
    await expect(
      handleBatchOperation(
        items,
        async (item) => {
          if (item === 2) throw new Error("Failed");
          return item;
        },
        { continueOnError: false },
      ),
    ).rejects.toThrow("Failed");
  });

  it("should handle empty items array", async () => {
    const result = await handleBatchOperation([], async (item) => item);
    expect(result.successful).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(result.totalProcessed).toBe(0);
  });
});

describe("handleEnrichmentRequest", () => {
  it("should return operation result on success", async () => {
    const result = await handleEnrichmentRequest(
      async () => ({ title: "Study", abstract: "Test" }),
    );
    expect(result).toEqual({ title: "Study", abstract: "Test" });
  });

  it("should return partial data on failure when provided", async () => {
    const result = await handleEnrichmentRequest(
      async () => {
        throw new Error("API down");
      },
      { title: "Fallback" },
    );
    expect(result).toEqual({ title: "Fallback" });
  });

  it("should throw when no fallback provided", async () => {
    await expect(
      handleEnrichmentRequest(async () => {
        throw new Error("API down");
      }),
    ).rejects.toThrow("Failed to enrich content");
  });
});
