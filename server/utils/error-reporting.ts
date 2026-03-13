/**
 * Error Reporting Service
 * Centralized error tracking that can be backed by Sentry, Datadog, or console logging.
 *
 * To enable Sentry:
 *   1. npm install @sentry/node
 *   2. Set SENTRY_DSN environment variable
 *   3. The service will auto-detect and use Sentry
 *
 * Without Sentry, errors are logged with structured JSON for log aggregation tools.
 */

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

let sentryModule: any = null;
let sentryInitialized = false;

/**
 * Initialize error reporting. Call once at server startup.
 */
export function initErrorReporting(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log("Error reporting: using structured console logging (set SENTRY_DSN for Sentry)");
    return;
  }

  try {
    // Dynamic import — only loads if @sentry/node is installed
    import("@sentry/node")
      .then((Sentry) => {
        Sentry.init({
          dsn,
          environment: process.env.NODE_ENV || "development",
          release: process.env.npm_package_version || "unknown",
          tracesSampleRate: 0.1,
          // Don't send PII by default
          sendDefaultPii: false,
          beforeSend(event) {
            // Strip sensitive headers
            if (event.request?.headers) {
              delete event.request.headers.authorization;
              delete event.request.headers.cookie;
              delete event.request.headers["x-csrf-token"];
              delete event.request.headers["x-admin-token"];
            }
            // Strip sensitive data from request body
            if (event.request?.data && typeof event.request.data === "object") {
              const data = event.request.data as Record<string, unknown>;
              const sensitiveKeys = ["password", "token", "secret", "creditCard", "ssn"];
              for (const key of sensitiveKeys) {
                if (key in data) {
                  data[key] = "[REDACTED]";
                }
              }
            }
            return event;
          },
        });
        sentryModule = Sentry;
        sentryInitialized = true;
        console.log("Error reporting: Sentry initialized");
      })
      .catch(() => {
        console.log(
          "Error reporting: SENTRY_DSN set but @sentry/node not installed. " +
          "Run `npm install @sentry/node` to enable Sentry.",
        );
      });
  } catch {
    // Module not available — fall through to console logging
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

  if (sentryInitialized && sentryModule) {
    sentryModule.withScope((scope: any) => {
      if (context.requestId) scope.setTag("requestId", context.requestId);
      if (context.userId) scope.setUser({ id: context.userId });
      if (context.url) scope.setTag("url", context.url);
      if (context.tags) {
        Object.entries(context.tags).forEach(([k, v]) => scope.setTag(k, v));
      }
      if (context.extra) {
        Object.entries(context.extra).forEach(([k, v]) => scope.setExtra(k, v));
      }
      sentryModule.captureException(err);
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

  if (sentryInitialized && sentryModule) {
    sentryModule.withScope((scope: any) => {
      if (context.tags) {
        Object.entries(context.tags).forEach(([k, v]) => scope.setTag(k, v));
      }
      sentryModule.captureMessage(message, "warning");
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
    if (sentryInitialized && sentryModule) {
      sentryModule.withScope((scope: any) => {
        scope.setTag("requestId", req.requestId);
        scope.setTag("method", req.method);
        scope.setTag("url", req.url);
        if (req.session?.userId) {
          scope.setUser({ id: req.session.userId });
        }
      });
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
