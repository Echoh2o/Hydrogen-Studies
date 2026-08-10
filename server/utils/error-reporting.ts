/**
 * Error Reporting Service
 * Centralized error tracking backed by Sentry (when initialized) or structured
 * console logging.
 *
 * Sentry is initialized exactly once, in `initSentry()` (server/utils/sentry.ts).
 * This module REUSES that client rather than calling `Sentry.init` again — a
 * second init would replace the client and silently discard the sampling/
 * scrubbing config from sentry.ts.
 *
 * Without an initialized Sentry client, errors are logged with structured JSON
 * for log aggregation tools (Railway, Datadog, etc.).
 */

import { Sentry } from "./sentry";

interface ErrorContext {
  requestId?: string;
  userId?: string;
  url?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

interface ErrorReport {
  message: string;
  stack?: string;
  level: "error" | "warning" | "info";
  context: ErrorContext;
  timestamp: string;
}

let sentryEnabled = false;

/**
 * Initialize error reporting. Call once at server startup, AFTER initSentry().
 *
 * This does NOT init Sentry itself — it detects whether initSentry() already
 * created a client and, if so, routes reports through it. Otherwise it falls
 * back to structured console logging.
 */
export function initErrorReporting(): void {
  if (Sentry.getClient()) {
    sentryEnabled = true;
    console.log("Error reporting: using Sentry client initialized by initSentry()");
  } else {
    console.log(
      "Error reporting: using structured console logging " +
      "(set SENTRY_DSN in production to enable Sentry)",
    );
  }
}

/**
 * Report an error to the configured error tracking service.
 */
export function reportError(error: Error | unknown, context: ErrorContext = {}): void {
  const err = error instanceof Error ? error : new Error(String(error));

  const report: ErrorReport = {
    message: err.message,
    stack: err.stack,
    level: "error",
    context,
    timestamp: new Date().toISOString(),
  };

  if (sentryEnabled) {
    Sentry.withScope((scope) => {
      if (context.requestId) scope.setTag("requestId", context.requestId);
      if (context.userId) scope.setUser({ id: context.userId });
      if (context.url) scope.setTag("url", context.url);
      if (context.tags) {
        Object.entries(context.tags).forEach(([k, v]) => scope.setTag(k, v));
      }
      if (context.extra) {
        Object.entries(context.extra).forEach(([k, v]) => scope.setExtra(k, v));
      }
      Sentry.captureException(err);
    });
  } else {
    // Structured JSON logging for log aggregation (Railway, Datadog, etc.)
    console.error(JSON.stringify(report));
  }
}

/**
 * Report a warning (non-critical issue).
 */
export function reportWarning(message: string, context: ErrorContext = {}): void {
  const report: ErrorReport = {
    message,
    level: "warning",
    context,
    timestamp: new Date().toISOString(),
  };

  if (sentryEnabled) {
    Sentry.withScope((scope) => {
      if (context.tags) {
        Object.entries(context.tags).forEach(([k, v]) => scope.setTag(k, v));
      }
      Sentry.captureMessage(message, "warning");
    });
  } else {
    console.warn(JSON.stringify(report));
  }
}

/**
 * Express middleware that attaches request context to Sentry scope.
 * Must be added after requestIdMiddleware.
 */
export function errorReportingMiddleware() {
  return (req: any, res: any, next: any) => {
    if (sentryEnabled) {
      // Set tags on the per-request isolation scope so they persist onto any
      // event captured later during this request. withScope() would pop its
      // scope as soon as the callback returned, so the tags never attached.
      const scope = Sentry.getIsolationScope();
      scope.setTag("requestId", req.requestId);
      scope.setTag("method", req.method);
      scope.setTag("url", req.url);
      if (req.session?.userId) {
        scope.setUser({ id: req.session.userId });
      }
    }
    next();
  };
}

/**
 * Express error handler that reports unhandled errors.
 * Add before the global error handler.
 */
export function errorReportingHandler() {
  return (err: any, req: any, res: any, next: any) => {
    // Only report unexpected/non-operational errors
    const isOperational =
      err.isOperational ||
      err.name === "ValidationError" ||
      err.name === "NotFoundError" ||
      (err.statusCode && err.statusCode < 500);

    if (!isOperational) {
      reportError(err, {
        requestId: req.requestId,
        userId: req.session?.userId,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });
    }

    next(err);
  };
}
