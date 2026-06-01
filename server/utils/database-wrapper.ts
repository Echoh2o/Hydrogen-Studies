/**
 * Database wrapper with retry logic and error handling
 */

import { DatabaseError, isRetryableError } from "./app-errors";

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  backoffMultiplier?: number;
  maxRetryDelay?: number;
  onRetry?: (attempt: number, error: any) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
  maxRetryDelay: 10000,
  onRetry: (attempt, error) => {
    console.log(
      `Database operation retry attempt ${attempt} after error:`,
      error.message,
    );
  },
};

/**
 * Executes a database operation with automatic retry logic for transient failures
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: any;
  let delay = opts.retryDelay;

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry if it's not a retryable error or we've exhausted retries
      if (!isRetryableError(error) || attempt === opts.maxRetries) {
        throw transformDatabaseError(error);
      }

      // Call retry callback
      opts.onRetry(attempt, error);

      // Wait before retrying with exponential backoff
      await sleep(Math.min(delay, opts.maxRetryDelay));
      delay *= opts.backoffMultiplier;
    }
  }

  throw transformDatabaseError(lastError);
}

/**
 * Wraps a database operation with proper error handling
 */
export async function safeDbOperation<T>(
  operation: () => Promise<T>,
  errorMessage = "Database operation failed",
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw transformDatabaseError(error, errorMessage);
  }
}

/**
 * Executes a database transaction with automatic rollback on failure
 */
export async function withTransaction<T>(
  db: any,
  operation: (tx: any) => Promise<T>,
): Promise<T> {
  const transaction = await db.transaction();

  try {
    const result = await operation(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw transformDatabaseError(error, "Transaction failed");
  }
}

/**
 * Transform database errors into appropriate AppError instances
 */
function transformDatabaseError(
  error: any,
  customMessage?: string,
): DatabaseError {
  const message = customMessage || error.message || "Database operation failed";

  // Determine if error is retryable based on error code/message
  const retryable = isRetryableDatabaseError(error);

  // Extract useful context from the error
  const context = {
    code: error.code,
    constraint: error.constraint,
    detail: error.detail,
    table: error.table,
    column: error.column,
    dataType: error.dataType,
    severity: error.severity,
  };

  return new DatabaseError(
    getUserFriendlyDatabaseMessage(error, message),
    retryable,
    { metadata: context },
    error,
  );
}

/**
 * Determine if a database error is retryable
 */
function isRetryableDatabaseError(error: any): boolean {
  const retryableErrorCodes = [
    "40001", // Serialization failure
    "40P01", // Deadlock detected
    "55P03", // Lock not available
    "57P03", // Cannot connect now
    "08000", // Connection error
    "08001", // Unable to establish connection
    "08003", // Connection does not exist
    "08006", // Connection failure
    "08P01", // Protocol violation
    "57P01", // Admin shutdown
    "57P02", // Crash shutdown
    "57P03", // Cannot connect now
    "58000", // System error
    "58030", // IO error
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "EPIPE",
  ];

  const errorCode = error?.code || error?.errno || "";
  const errorMessage = error?.message || "";

  return retryableErrorCodes.some(
    (code) => errorCode.includes(code) || errorMessage.includes(code),
  );
}

/**
 * Get user-friendly message for database errors
 */
function getUserFriendlyDatabaseMessage(
  error: any,
  defaultMessage: string,
): string {
  const errorCode = error?.code || "";

  const messageMap: Record<string, string> = {
    "23505": "This record already exists. Please use unique values.",
    "23503": "Cannot complete operation due to related records.",
    "23502":
      "Required information is missing. Please fill in all required fields.",
    "23514": "The provided data does not meet validation requirements.",
    "22001": "The provided text is too long for this field.",
    "22P02": "Invalid input format. Please check your data.",
    "42703": "Database schema error. Please contact support.",
    "42P01": "Database table not found. Please contact support.",
    "40001": "Database conflict detected. Please retry the operation.",
    "40P01": "Database is busy. Please try again in a moment.",
    ECONNREFUSED: "Cannot connect to database. Please try again later.",
    ETIMEDOUT: "Database connection timed out. Please try again.",
  };

  for (const [code, message] of Object.entries(messageMap)) {
    if (errorCode.includes(code)) {
      return message;
    }
  }

  return defaultMessage;
}

/**
 * Helper function for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// NOTE: A DatabaseCircuitBreaker class and a checkDatabaseHealth() helper used
// to live here. Both were dead code — the breaker was instantiated in app.ts
// but its .execute() was never called (so it protected nothing), and
// checkDatabaseHealth called db.raw() which doesn't exist on the drizzle
// instance. They were removed to avoid a false sense of resilience. The live
// health checks use db.execute(sql`SELECT 1`) directly (see /health, /healthz
// in app.ts). Reintroduce a breaker only if it is actually wired into the
// query path.
