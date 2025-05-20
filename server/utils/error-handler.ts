/**
 * Error handler utility for consistent API error responses
 */

import { Request, Response } from 'express';

// Standard error types for the application
export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  UNKNOWN = 'UNKNOWN'
}

// Interface for standard error response
export interface ErrorResponse {
  success: false;
  message: string;
  errorType: ErrorType;
  details?: any;
  code?: string;
  timestamp: string;
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
  message?: string
): void {
  console.error(`API Error [${errorType}]:`, error);
  
  const errorResponse: ErrorResponse = {
    success: false,
    message: message || (error instanceof Error ? error.message : 'An unknown error occurred'),
    errorType,
    timestamp: new Date().toISOString(),
  };
  
  // Add stack trace in development mode
  if (process.env.NODE_ENV === 'development' && error instanceof Error) {
    errorResponse.details = {
      stack: error.stack,
    };
  }
  
  res.status(statusCode).json(errorResponse);
}

/**
 * Handles validation errors
 */
export function handleValidationError(res: Response, error: any, message?: string): void {
  handleApiError(res, error, ErrorType.VALIDATION_ERROR, 400, message || 'Validation error');
}

/**
 * Handles not found errors
 */
export function handleNotFoundError(res: Response, error: any, message?: string): void {
  handleApiError(res, error, ErrorType.NOT_FOUND, 404, message || 'Resource not found');
}

/**
 * Handles unauthorized errors
 */
export function handleUnauthorizedError(res: Response, error: any, message?: string): void {
  handleApiError(res, error, ErrorType.UNAUTHORIZED, 401, message || 'Unauthorized');
}

/**
 * Handles database errors
 */
export function handleDatabaseError(res: Response, error: any, message?: string): void {
  handleApiError(res, error, ErrorType.DATABASE_ERROR, 500, message || 'Database error');
}

/**
 * Global error handler middleware
 */
export function globalErrorHandler(err: any, req: Request, res: Response, next: Function): void {
  handleApiError(res, err);
}

/**
 * Success response helper
 */
export function sendSuccessResponse(res: Response, data: any = null, message: string = 'Operation successful'): void {
  res.json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
}