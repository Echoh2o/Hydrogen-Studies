/**
 * Custom application error classes with detailed error tracking
 */

export enum ErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE = 'UNSUPPORTED_FILE_TYPE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // Server errors (5xx)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',
  
  // Specific service errors
  OPENAI_ERROR = 'OPENAI_ERROR',
  IMAGE_GENERATION_ERROR = 'IMAGE_GENERATION_ERROR',
  EMAIL_SEND_ERROR = 'EMAIL_SEND_ERROR',
  FILE_UPLOAD_ERROR = 'FILE_UPLOAD_ERROR',
  SEARCH_ERROR = 'SEARCH_ERROR',
  ENRICHMENT_ERROR = 'ENRICHMENT_ERROR',
}

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  endpoint?: string;
  method?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly isOperational: boolean;
  public readonly context?: ErrorContext;
  public readonly originalError?: Error;

  constructor(
    message: string,
    statusCode: number,
    code: ErrorCode,
    isOperational = true,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.context = {
      ...context,
      timestamp: context?.timestamp || new Date().toISOString()
    };
    this.originalError = originalError;

    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AppError.prototype);
  }

  public toJSON() {
    return {
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined,
    };
  }
}

// Specific error classes
export class ValidationError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 400, ErrorCode.VALIDATION_ERROR, true, context);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, context?: ErrorContext) {
    super(`${resource} not found`, 404, ErrorCode.NOT_FOUND, true, context);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access', context?: ErrorContext) {
    super(message, 401, ErrorCode.UNAUTHORIZED, true, context);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden', context?: ErrorContext) {
    super(message, 403, ErrorCode.FORBIDDEN, true, context);
  }
}

export class DatabaseError extends AppError {
  public readonly retryable: boolean;

  constructor(
    message: string,
    retryable = false,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(
      message,
      503,
      ErrorCode.DATABASE_ERROR,
      true,
      context,
      originalError
    );
    this.retryable = retryable;
  }
}

export class ExternalAPIError extends AppError {
  public readonly service: string;
  public readonly retryable: boolean;

  constructor(
    service: string,
    message: string,
    retryable = true,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(
      `${service} error: ${message}`,
      502,
      ErrorCode.EXTERNAL_API_ERROR,
      true,
      context,
      originalError
    );
    this.service = service;
    this.retryable = retryable;
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(retryAfter?: number, context?: ErrorContext) {
    super(
      'Rate limit exceeded. Please try again later.',
      429,
      ErrorCode.RATE_LIMIT_EXCEEDED,
      true,
      context
    );
    this.retryAfter = retryAfter;
  }
}

export class FileUploadError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 400, ErrorCode.FILE_UPLOAD_ERROR, true, context);
  }
}

export class SessionExpiredError extends AppError {
  constructor(context?: ErrorContext) {
    super('Session has expired. Please log in again.', 401, ErrorCode.SESSION_EXPIRED, true, context);
  }
}

// Error factory for common scenarios
export class ErrorFactory {
  static badRequest(message: string, context?: ErrorContext): AppError {
    return new AppError(message, 400, ErrorCode.BAD_REQUEST, true, context);
  }

  static serverError(message = 'Internal server error', context?: ErrorContext): AppError {
    return new AppError(message, 500, ErrorCode.INTERNAL_SERVER_ERROR, false, context);
  }

  static serviceUnavailable(message = 'Service temporarily unavailable', context?: ErrorContext): AppError {
    return new AppError(message, 503, ErrorCode.SERVICE_UNAVAILABLE, true, context);
  }

  static timeout(message = 'Request timeout', context?: ErrorContext): AppError {
    return new AppError(message, 504, ErrorCode.GATEWAY_TIMEOUT, true, context);
  }

  static conflict(message: string, context?: ErrorContext): AppError {
    return new AppError(message, 409, ErrorCode.CONFLICT, true, context);
  }
}

// Helper to determine if error is retryable
export function isRetryableError(error: any): boolean {
  if (error instanceof DatabaseError || error instanceof ExternalAPIError) {
    return error.retryable;
  }
  
  // Check for common retryable error patterns
  const retryablePatterns = [
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNRESET',
    'EPIPE',
    'ENETUNREACH',
    'EAI_AGAIN',
  ];
  
  const errorMessage = error?.message || error?.code || '';
  return retryablePatterns.some(pattern => errorMessage.includes(pattern));
}

// Helper to get user-friendly error message
export function getUserFriendlyMessage(error: any): string {
  if (error instanceof AppError) {
    return error.message;
  }

  const errorMap: Record<string, string> = {
    ECONNREFUSED: 'Unable to connect to the service. Please try again later.',
    ETIMEDOUT: 'The request took too long to complete. Please try again.',
    ENOTFOUND: 'Service is currently unavailable. Please try again later.',
    ECONNRESET: 'Connection was interrupted. Please try again.',
    '404': 'The requested resource was not found.',
    '500': 'An unexpected error occurred. Our team has been notified.',
    '503': 'Service is temporarily unavailable. Please try again later.',
  };

  const errorCode = error?.code || error?.statusCode || '';
  
  for (const [key, message] of Object.entries(errorMap)) {
    if (String(errorCode).includes(key)) {
      return message;
    }
  }

  return 'An unexpected error occurred. Please try again later.';
}