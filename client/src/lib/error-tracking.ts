/**
 * Client-side Error Tracking
 * Uses Sentry in production when VITE_SENTRY_DSN is set.
 * Falls back to server beacon reporting.
 */

import * as Sentry from "@sentry/react";

interface ErrorReport {
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  url: string;
  userAgent: string;
  timestamp: string;
}

const MAX_ERRORS_PER_SESSION = 20;
let errorsReported = 0;

/** Report an error to the server (fallback when Sentry not configured) */
async function reportError(report: ErrorReport): Promise<void> {
  if (errorsReported >= MAX_ERRORS_PER_SESSION) return;
  errorsReported++;

  try {
    navigator.sendBeacon?.(
      "/api/client-errors",
      JSON.stringify(report),
    );
  } catch {
    // Swallow — we don't want error reporting to cause errors
  }
}

/** Initialize global error tracking listeners */
export function initErrorTracking(): void {
  if (typeof window === "undefined") return;

  // Initialize Sentry if DSN is configured
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (dsn) {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
    });
  }

  window.addEventListener("error", (event) => {
    reportError({
      message: event.message,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    reportError({
      message: reason?.message || String(reason),
      stack: reason?.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  });
}

/** Manually track an error (e.g., from error boundaries) */
export function trackError(error: Error, context?: string): void {
  // Send to Sentry if available
  Sentry.captureException(error, { tags: { context: context || "unknown" } });

  // Also send to server beacon as fallback
  reportError({
    message: `${context ? `[${context}] ` : ""}${error.message}`,
    stack: error.stack,
    url: typeof window !== "undefined" ? window.location.href : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    timestamp: new Date().toISOString(),
  });
}
