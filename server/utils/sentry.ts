/**
 * Sentry Error Tracking Initialization
 * Captures unhandled errors and performance data in production.
 */

import * as Sentry from "@sentry/node";

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (dsn && process.env.NODE_ENV === "production") {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      // Deployed commit SHA — must match the client release in vite.config.ts.
      release: process.env.SENTRY_RELEASE || process.env.RAILWAY_GIT_COMMIT_SHA,
      tracesSampleRate: 0.3, // 30% of transactions for performance monitoring
      sampleRate: 1.0, // Capture 100% of errors (never drop errors)
      beforeSend(event) {
        // Strip sensitive headers/cookies
        if (event.request?.cookies) delete event.request.cookies;
        if (event.request?.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
          delete event.request.headers["x-csrf-token"];
          delete event.request.headers["x-admin-token"];
        }
        // Redact sensitive fields from the request body
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
  }
}

export { Sentry };
