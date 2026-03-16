/**
 * Enhanced error handler utility for comprehensive error management
 */

import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import {
  AppError,
  ErrorCode,
  getUserFriendlyMessage,
  isRetryableError,
} from "./app-errors";
import { Sentry } from "./sentry";

// Standard error types for the application
export enum ErrorType {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  DATABASE_ERROR = "DATABASE_ERROR",
  EXTERNAL_API_ERROR = "EXTERNAL_API_ERROR",
  RATE_LIMIT = "RATE_LIMIT",
  UNKNOWN = "UNKNOWN",
}

// Interface for standard error response
export interface ErrorResponse {
  success: false;
  message: string;
  errorType: ErrorType;
  errorCode?: ErrorCode;
  details?: any;
  code?: string;
  timestamp: string;
  requestId: string;
  retryable?: boolean;
  retryAfter?: number;
}

/**
 * Handles API errors with standardized responses
 * @param res Express Response object
 * @param error Error that occurred
 * @param errorType Type of error for categorization
 * @param statusCode HTTP status code to return
 * @param message Custom message to show (defaults to error.message)
 */
export function handleApiError(
  res: Response,
  error: any,
  errorType: ErrorType = ErrorType.UNKNOWN,
  statusCode: number = 500,
  message?: string,
): void {
  // Generate request ID if not present
  const requestId = (res.req as any).requestId || uuidv4();

  // Sanitized logging — strip sensitive fields from request data
  const sanitizedBody = res.req?.body
    ? Object.fromEntries(
        Object.entries(res.req.body).filter(
          ([key]) =>
            !["password", "confirmPassword", "currentPassword", "newPassword",
              "token", "secret", "authorization", "cookie", "sessionId",
              "passwordHash", "creditCard", "ssn"].includes(key),
        ),
      )
    : undefined;

  const sanitizedHeaders = res.req?.headers
    ? Object.fromEntries(
        Object.entries(res.req.headers).filter(
          ([key]) =>
            !["authorization", "cookie", "x-csrf-token", "x-admin-token"].includes(key),
        ),
      )
    : undefined;

  // For NOT_FOUND errors, log minimally to avoid noisy production logs
  if (errorType === ErrorType.NOT_FOUND) {
    console.warn(`404 Not Found: ${res.req?.method} ${res.req?.url}`);
  } else {
    const logContext = {
      requestId,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      url: res.req?.url,
      method: res.req?.method,
      body: sanitizedBody,
      params: res.req?.params,
      query: res.req?.query,
      ip: res.req?.ip,
      userAgent: res.req?.get("user-agent"),
    };

    console.error(
      `API Error [${errorType}] at ${new Date().toISOString()}:`,
      logContext,
    );
  }

  // Send non-operational errors to Sentry in production
  if (process.env.NODE_ENV === "production" && !isOperationalError(error)) {
    Sentry.captureException(error, {
      tags: { errorType },
      extra: { requestId, url: res.req?.url, method: res.req?.method },
    });
  }

  // Determine if error is from AppError class
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    errorType = mapErrorCodeToType(error.code);
  }

  const errorResponse: ErrorResponse = {
    success: false,
    message: message || getUserFriendlyMessage(error),
    errorType,
    errorCode: error instanceof AppError ? error.code : undefined,
    timestamp: new Date().toISOString(),
    requestId,
    retryable: isRetryableError(error),
  };

  // Add retry-after header for rate limit errors
  if (error.retryAfter) {
    res.setHeader("Retry-After", error.retryAfter);
    errorResponse.retryAfter = error.retryAfter;
  }

  // Add comprehensive debugging info in development
  if (process.env.NODE_ENV === "development") {
    errorResponse.details = {
      stack: error.stack,
      url: res.req?.url,
      method: res.req?.method,
      originalError: error.toString(),
      context: error instanceof AppError ? error.context : undefined,
    };
  }

  res
    .status(statusCode)
    .setHeader("Content-Type", "application/json")
    .json(errorResponse);
}

/**
 * Handles validation errors
 */
export function handleValidationError(
  res: Response,
  error: any,
  message?: string,
): void {
  handleApiError(
    res,
    error,
    ErrorType.VALIDATION_ERROR,
    400,
    message || "Validation error",
  );
}

/**
 * Handles not found errors
 */
export function handleNotFoundError(
  res: Response,
  error: any,
  message?: string,
): void {
  handleApiError(
    res,
    error,
    ErrorType.NOT_FOUND,
    404,
    message || "Resource not found",
  );
}

/**
 * Handles unauthorized errors
 */
export function handleUnauthorizedError(
  res: Response,
  error: any,
  message?: string,
): void {
  handleApiError(
    res,
    error,
    ErrorType.UNAUTHORIZED,
    401,
    message || "Unauthorized",
  );
}

/**
 * Handles database errors
 */
export function handleDatabaseError(
  res: Response,
  error: any,
  message?: string,
): void {
  handleApiError(
    res,
    error,
    ErrorType.DATABASE_ERROR,
    500,
    message || "Database error",
  );
}

/**
 * Enhanced global error handler middleware
 */
export function globalErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Don't handle response if already sent
  if (res.headersSent) {
    return next(err);
  }

  // Add request ID to request object for tracking
  (req as any).requestId = (req as any).requestId || uuidv4();

  // Handle different error types appropriately
  if (err instanceof AppError) {
    handleApiError(res, err, mapErrorCodeToType(err.code), err.statusCode);
  } else if (err.name === "ValidationError") {
    handleValidationError(res, err);
  } else if (err.name === "CastError" || err.name === "TypeError") {
    handleApiError(
      res,
      err,
      ErrorType.VALIDATION_ERROR,
      400,
      "Invalid data format",
    );
  } else if (err.code === "LIMIT_FILE_SIZE") {
    handleApiError(
      res,
      err,
      ErrorType.VALIDATION_ERROR,
      413,
      "File size exceeds limit",
    );
  } else if (err.code === "EBADCSRFTOKEN") {
    handleApiError(res, err, ErrorType.FORBIDDEN, 403, "Invalid CSRF token");
  } else {
    handleApiError(res, err, ErrorType.UNKNOWN, 500);
  }
}

/**
 * Request ID middleware to track requests
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  (req as any).requestId = uuidv4();
  res.setHeader("X-Request-Id", (req as any).requestId);
  next();
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Map ErrorCode to ErrorType
 */
function mapErrorCodeToType(code: ErrorCode): ErrorType {
  const mapping: Record<ErrorCode, ErrorType> = {
    [ErrorCode.VALIDATION_ERROR]: ErrorType.VALIDATION_ERROR,
    [ErrorCode.NOT_FOUND]: ErrorType.NOT_FOUND,
    [ErrorCode.UNAUTHORIZED]: ErrorType.UNAUTHORIZED,
    [ErrorCode.SESSION_EXPIRED]: ErrorType.UNAUTHORIZED,
    [ErrorCode.FORBIDDEN]: ErrorType.FORBIDDEN,
    [ErrorCode.DATABASE_ERROR]: ErrorType.DATABASE_ERROR,
    [ErrorCode.EXTERNAL_API_ERROR]: ErrorType.EXTERNAL_API_ERROR,
    [ErrorCode.OPENAI_ERROR]: ErrorType.EXTERNAL_API_ERROR,
    [ErrorCode.IMAGE_GENERATION_ERROR]: ErrorType.EXTERNAL_API_ERROR,
    [ErrorCode.RATE_LIMIT_EXCEEDED]: ErrorType.RATE_LIMIT,
    [ErrorCode.BAD_REQUEST]: ErrorType.VALIDATION_ERROR,
    [ErrorCode.CONFLICT]: ErrorType.VALIDATION_ERROR,
    [ErrorCode.INTERNAL_SERVER_ERROR]: ErrorType.UNKNOWN,
    [ErrorCode.SERVICE_UNAVAILABLE]: ErrorType.UNKNOWN,
    [ErrorCode.GATEWAY_TIMEOUT]: ErrorType.UNKNOWN,
    [ErrorCode.FILE_TOO_LARGE]: ErrorType.VALIDATION_ERROR,
    [ErrorCode.UNSUPPORTED_FILE_TYPE]: ErrorType.VALIDATION_ERROR,
    [ErrorCode.FILE_UPLOAD_ERROR]: ErrorType.VALIDATION_ERROR,
    [ErrorCode.EMAIL_SEND_ERROR]: ErrorType.EXTERNAL_API_ERROR,
    [ErrorCode.SEARCH_ERROR]: ErrorType.UNKNOWN,
    [ErrorCode.ENRICHMENT_ERROR]: ErrorType.EXTERNAL_API_ERROR,
  };

  return mapping[code] || ErrorType.UNKNOWN;
}

/**
 * Success response helper
 */
export function sendSuccessResponse(
  res: Response,
  data: any = null,
  message: string = "Operation successful",
): void {
  res.json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}

export function handleError(error: Error | unknown, context?: string): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(`Error ${context ? `in ${context}` : ""}:`, {
    message: errorMessage,
    stack: errorStack,
    timestamp: new Date().toISOString(),
  });
}

export function isOperationalError(error: any): boolean {
  // AppError instances with isOperational flag
  if (error instanceof AppError) {
    return error.isOperational;
  }

  // Common operational errors
  return (
    error.name === "ValidationError" ||
    error.name === "NotFoundError" ||
    error.name === "CastError" ||
    error.message?.includes("ENOTFOUND") ||
    error.message?.includes("ECONNREFUSED") ||
    error.message?.includes("ETIMEDOUT")
  );
}

/**
 * Error recovery middleware for graceful degradation
 */
export function errorRecoveryMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Store original send method
  const originalSend = res.send;

  // Override send to catch errors
  res.send = function (data: any) {
    try {
      return originalSend.call(this, data);
    } catch (error) {
      console.error("Error in response send:", error);
      return originalSend.call(
        this,
        JSON.stringify({
          success: false,
          message: "An error occurred while processing the response",
          requestId: (req as any).requestId,
        }),
      );
    }
  };

  next();
}

/**
 * Timeout middleware to prevent hanging requests
 */
export function timeoutMiddleware(timeout = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          success: false,
          message: "Request timeout",
          requestId: (req as any).requestId,
        });
      }
    }, timeout);

    // Clear timer when response is sent
    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));

    next();
  };
}

/**
 * Standardized API response helpers
 * Use these in route handlers for consistent response formats across all endpoints.
 *
 * Success: { success: true, data: ... }
 * Error:   { success: false, error: "message" }
 */
export function apiSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({ success: true, data });
}

export function apiError(res: Response, message: string, statusCode = 500): void {
  res.status(statusCode).json({ success: false, error: message });
}
