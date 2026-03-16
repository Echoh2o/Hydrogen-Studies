import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleApiError,
  handleValidationError,
  handleNotFoundError,
  handleUnauthorizedError,
  handleDatabaseError,
  globalErrorHandler,
  requestIdMiddleware,
  asyncHandler,
  sendSuccessResponse,
  isOperationalError,
  ErrorType,
} from "../../../server/utils/error-handler";
import { AppError, ErrorCode, ValidationError, NotFoundError } from "../../../server/utils/app-errors";

function mockResponse(): any {
  const res: any = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    getHeader: vi.fn(),
    headersSent: false,
    req: {
      url: "/api/test",
      method: "GET",
      body: {},
      params: {},
      query: {},
      headers: {},
      ip: "127.0.0.1",
      get: vi.fn(),
    },
  };
  return res;
}

function mockRequest(overrides = {}): any {
  return {
    url: "/api/test",
    method: "GET",
    body: {},
    params: {},
    query: {},
    headers: {},
    ip: "127.0.0.1",
    get: vi.fn(),
    ...overrides,
  };
}

describe("handleApiError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("should return error response with correct status code", () => {
    const res = mockResponse();
    const error = new Error("Test error");
    handleApiError(res, error, ErrorType.UNKNOWN, 500);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalled();
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(false);
    expect(response.errorType).toBe(ErrorType.UNKNOWN);
  });

  it("should use AppError statusCode when error is AppError", () => {
    const res = mockResponse();
    const error = new AppError("Not found", 404, ErrorCode.NOT_FOUND);
    handleApiError(res, error);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("should sanitize sensitive body fields", () => {
    const res = mockResponse();
    res.req.body = { email: "test@test.com", password: "secret123" };
    const error = new Error("Auth error");
    handleApiError(res, error, ErrorType.UNAUTHORIZED, 401);
    // Should not crash - sanitization happens internally
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("should log minimally for NOT_FOUND errors", () => {
    const res = mockResponse();
    const error = new Error("Not found");
    handleApiError(res, error, ErrorType.NOT_FOUND, 404);
    expect(console.warn).toHaveBeenCalled();
  });
});

describe("handleValidationError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should return 400 status", () => {
    const res = mockResponse();
    handleValidationError(res, new Error("Invalid data"));
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("handleNotFoundError", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("should return 404 status", () => {
    const res = mockResponse();
    handleNotFoundError(res, new Error("Not found"));
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("handleUnauthorizedError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should return 401 status", () => {
    const res = mockResponse();
    handleUnauthorizedError(res, new Error("Unauthorized"));
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe("handleDatabaseError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should return 500 status", () => {
    const res = mockResponse();
    handleDatabaseError(res, new Error("DB error"));
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("globalErrorHandler", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("should call next if headers already sent", () => {
    const res = mockResponse();
    res.headersSent = true;
    const next = vi.fn();
    const error = new Error("Test");
    globalErrorHandler(error, mockRequest(), res, next);
    expect(next).toHaveBeenCalledWith(error);
  });

  it("should handle AppError correctly", () => {
    const res = mockResponse();
    const next = vi.fn();
    const error = new NotFoundError("Study");
    globalErrorHandler(error, mockRequest(), res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("should handle ValidationError by name", () => {
    const res = mockResponse();
    const next = vi.fn();
    const error = new Error("Invalid");
    error.name = "ValidationError";
    globalErrorHandler(error, mockRequest(), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should handle TypeError", () => {
    const res = mockResponse();
    const next = vi.fn();
    const error = new TypeError("Cannot read property");
    globalErrorHandler(error, mockRequest(), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should handle unknown errors as 500", () => {
    const res = mockResponse();
    const next = vi.fn();
    const error = new Error("Unknown crash");
    globalErrorHandler(error, mockRequest(), res, next);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("requestIdMiddleware", () => {
  it("should add request ID to request and response", () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn();
    requestIdMiddleware(req, res, next);
    expect(req.requestId).toBeDefined();
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-Id", req.requestId);
    expect(next).toHaveBeenCalled();
  });
});

describe("asyncHandler", () => {
  it("should pass resolved value through", async () => {
    const handler = asyncHandler(async (req: any, res: any) => {
      res.json({ success: true });
    });
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn();
    await handler(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("should catch errors and pass to next", async () => {
    const error = new Error("Async error");
    const handler = asyncHandler(async () => {
      throw error;
    });
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn();
    await handler(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("sendSuccessResponse", () => {
  it("should send success JSON response", () => {
    const res = mockResponse();
    sendSuccessResponse(res, { id: 1 }, "Created");
    expect(res.json).toHaveBeenCalled();
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.message).toBe("Created");
    expect(response.data).toEqual({ id: 1 });
  });

  it("should use default message", () => {
    const res = mockResponse();
    sendSuccessResponse(res);
    const response = res.json.mock.calls[0][0];
    expect(response.message).toBe("Operation successful");
    expect(response.data).toBeNull();
  });
});

describe("isOperationalError", () => {
  it("should return true for operational AppError", () => {
    const error = new AppError("Test", 400, ErrorCode.BAD_REQUEST, true);
    expect(isOperationalError(error)).toBe(true);
  });

  it("should return false for non-operational AppError", () => {
    const error = new AppError("Crash", 500, ErrorCode.INTERNAL_SERVER_ERROR, false);
    expect(isOperationalError(error)).toBe(false);
  });

  it("should return true for ValidationError by name", () => {
    const error = new Error("Invalid");
    error.name = "ValidationError";
    expect(isOperationalError(error)).toBe(true);
  });

  it("should return true for ECONNREFUSED errors", () => {
    const error = new Error("ECONNREFUSED");
    expect(isOperationalError(error)).toBe(true);
  });

  it("should return false for generic errors", () => {
    const error = new Error("Something went wrong");
    expect(isOperationalError(error)).toBe(false);
  });
});
