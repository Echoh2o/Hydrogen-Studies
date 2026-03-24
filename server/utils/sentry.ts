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
      tracesSampleRate: 0.3, // 30% of transactions for performance monitoring
      sampleRate: 1.0, // Capture 100% of errors (never drop errors)
      beforeSend(event) {
        // Strip sensitive data
        if (event.request?.cookies) delete event.request.cookies;
        if (event.request?.headers?.authorization)
          delete event.request.headers.authorization;
        if (event.request?.headers?.cookie)
          delete event.request.headers.cookie;
        return event;
      },
    });
  }
}

export { Sentry };
