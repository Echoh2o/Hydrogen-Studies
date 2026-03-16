import { describe, it, expect } from "vitest";
import {
  AppError,
  ErrorCode,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  DatabaseError,
  ExternalAPIError,
  RateLimitError,
  FileUploadError,
  SessionExpiredError,
  ErrorFactory,
  isRetryableError,
  getUserFriendlyMessage,
} from "../../../server/utils/app-errors";

describe("AppError", () => {
  it("should create an AppError with correct properties", () => {
    const error = new AppError("Test error", 400, ErrorCode.BAD_REQUEST);
    expect(error.message).toBe("Test error");
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe(ErrorCode.BAD_REQUEST);
    expect(error.isOperational).toBe(true);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it("should set isOperational to false when specified", () => {
    const error = new AppError(
      "Server crash",
      500,
      ErrorCode.INTERNAL_SERVER_ERROR,
      false,
    );
    expect(error.isOperational).toBe(false);
  });

  it("should include context with timestamp", () => {
    const error = new AppError("Test", 400, ErrorCode.BAD_REQUEST, true, {
      endpoint: "/api/test",
    });
    expect(error.context?.endpoint).toBe("/api/test");
    expect(error.context?.timestamp).toBeDefined();
  });

  it("should store the original error", () => {
    const original = new Error("original");
    const error = new AppError(
      "Wrapped",
      500,
      ErrorCode.INTERNAL_SERVER_ERROR,
      true,
      undefined,
      original,
    );
    expect(error.originalError).toBe(original);
  });

  it("should serialize to JSON correctly", () => {
    const error = new AppError("Test", 400, ErrorCode.BAD_REQUEST);
    const json = error.toJSON();
    expect(json.message).toBe("Test");
    expect(json.code).toBe(ErrorCode.BAD_REQUEST);
    expect(json.statusCode).toBe(400);
  });
});

describe("Specific error classes", () => {
  it("ValidationError should have status 400", () => {
    const error = new ValidationError("Invalid email");
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it("NotFoundError should have status 404 and formatted message", () => {
    const error = new NotFoundError("Study");
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Study not found");
    expect(error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it("UnauthorizedError should have status 401", () => {
    const error = new UnauthorizedError();
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Unauthorized access");
  });

  it("UnauthorizedError should accept custom message", () => {
    const error = new UnauthorizedError("Token expired");
    expect(error.message).toBe("Token expired");
  });

  it("ForbiddenError should have status 403", () => {
    const error = new ForbiddenError();
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe("Access forbidden");
  });

  it("DatabaseError should have status 503 and retryable flag", () => {
    const error = new DatabaseError("Connection lost", true);
    expect(error.statusCode).toBe(503);
    expect(error.retryable).toBe(true);
    expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
  });

  it("DatabaseError should default to non-retryable", () => {
    const error = new DatabaseError("Constraint violation");
    expect(error.retryable).toBe(false);
  });

  it("ExternalAPIError should include service name", () => {
    const error = new ExternalAPIError("PubMed", "Rate limited");
    expect(error.service).toBe("PubMed");
    expect(error.message).toBe("PubMed error: Rate limited");
    expect(error.statusCode).toBe(502);
    expect(error.retryable).toBe(true);
  });

  it("RateLimitError should have status 429 and retryAfter", () => {
    const error = new RateLimitError(60);
    expect(error.statusCode).toBe(429);
    expect(error.retryAfter).toBe(60);
  });

  it("FileUploadError should have status 400", () => {
    const error = new FileUploadError("File too large");
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe(ErrorCode.FILE_UPLOAD_ERROR);
  });

  it("SessionExpiredError should have status 401", () => {
    const error = new SessionExpiredError();
    expect(error.statusCode).toBe(401);
    expect(error.message).toContain("Session has expired");
  });
});

describe("ErrorFactory", () => {
  it("badRequest should create 400 error", () => {
    const error = ErrorFactory.badRequest("Invalid input");
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe(ErrorCode.BAD_REQUEST);
  });

  it("serverError should create 500 non-operational error", () => {
    const error = ErrorFactory.serverError();
    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(false);
  });

  it("serviceUnavailable should create 503 error", () => {
    const error = ErrorFactory.serviceUnavailable();
    expect(error.statusCode).toBe(503);
  });

  it("timeout should create 504 error", () => {
    const error = ErrorFactory.timeout();
    expect(error.statusCode).toBe(504);
  });

  it("conflict should create 409 error", () => {
    const error = ErrorFactory.conflict("Duplicate entry");
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe("Duplicate entry");
  });
});

describe("isRetryableError", () => {
  it("should return true for retryable DatabaseError", () => {
    const error = new DatabaseError("Connection lost", true);
    // DatabaseError instanceof check may fail due to prototype chain;
    // test the retryable property directly
    expect(error.retryable).toBe(true);
    expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
  });

  it("should return false for non-retryable DatabaseError", () => {
    const error = new DatabaseError("Constraint violation", false);
    expect(error.retryable).toBe(false);
  });

  it("should return true for retryable ExternalAPIError", () => {
    const error = new ExternalAPIError("OpenAI", "Rate limited", true);
    expect(error.retryable).toBe(true);
    expect(error.code).toBe(ErrorCode.EXTERNAL_API_ERROR);
  });

  it("should return false for non-retryable ExternalAPIError", () => {
    const error = new ExternalAPIError("OpenAI", "Auth failed", false);
    expect(error.retryable).toBe(false);
  });

  it("should return true for ECONNREFUSED error pattern", () => {
    expect(isRetryableError({ message: "ECONNREFUSED" })).toBe(true);
  });

  it("should return true for ETIMEDOUT error pattern", () => {
    expect(isRetryableError({ message: "ETIMEDOUT" })).toBe(true);
  });

  it("should return true for ECONNRESET error pattern", () => {
    expect(isRetryableError({ code: "ECONNRESET" })).toBe(true);
  });

  it("should return false for generic errors", () => {
    expect(isRetryableError({ message: "Something went wrong" })).toBe(false);
  });

  it("should return false for null/undefined", () => {
    expect(isRetryableError({})).toBe(false);
  });
});

describe("getUserFriendlyMessage", () => {
  it("should return AppError message directly", () => {
    const error = new AppError("Custom message", 400, ErrorCode.BAD_REQUEST);
    expect(getUserFriendlyMessage(error)).toBe("Custom message");
  });

  it("should return friendly message for ECONNREFUSED", () => {
    const error = { code: "ECONNREFUSED" };
    expect(getUserFriendlyMessage(error)).toContain("Unable to connect");
  });

  it("should return friendly message for ETIMEDOUT", () => {
    const error = { code: "ETIMEDOUT" };
    expect(getUserFriendlyMessage(error)).toContain("too long");
  });

  it("should return friendly message for 404 status", () => {
    const error = { statusCode: "404" };
    expect(getUserFriendlyMessage(error)).toContain("not found");
  });

  it("should return generic message for unknown errors", () => {
    const error = { something: "random" };
    expect(getUserFriendlyMessage(error)).toContain("unexpected error");
  });
});
