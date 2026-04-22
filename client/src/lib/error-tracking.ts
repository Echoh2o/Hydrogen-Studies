/**
 * Client-side Error Tracking
 * Collects frontend errors and reports them to the server for monitoring.
 *
 * To enable Sentry:
 *   1. npm install @sentry/react
 *   2. Set VITE_SENTRY_DSN in environment
 *   3. The tracker auto-detects and uses Sentry alongside server reporting
 * Uses Sentry in production when VITE_SENTRY_DSN is set.
 * Falls back to server beacon reporting.
 */

import * as Sentry from "@sentry/react";
import { reloadOnceForStaleChunk } from "./chunk-reload";

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

let sentryInitialized = false;

/** Report an error to the server and Sentry if available */
async function reportError(report: ErrorReport): Promise<void> {
  if (errorsReported >= MAX_ERRORS_PER_SESSION) return;
  errorsReported++;

  // Report to Sentry if available
  if (sentryInitialized) {
    try {
      Sentry.captureException(new Error(report.message));
    } catch {
      // Swallow
    }
  }

  try {
    // sendBeacon defaults to Content-Type: text/plain. Wrap in a Blob with
    // application/json so express.json() on the server can parse the body —
    // without this, the server logs every client error as `{"message":"unknown"}`.
    const blob = new Blob([JSON.stringify(report)], { type: "application/json" });
    navigator.sendBeacon?.("/api/client-errors", blob);
  } catch {
    // Swallow — we don't want error reporting to cause errors
  }
}

/** Initialize global error tracking listeners */
export function initErrorTracking(): void {
  if (typeof window === "undefined") return;

  // Initialize Sentry if DSN is configured
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (dsn && !sentryInitialized) {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
      beforeSend(event) {
        const frames = event.exception?.values?.[0]?.stacktrace?.frames;
        if (frames?.some((f) => f.filename?.includes("extension://"))) {
          return null;
        }
        return event;
      },
    });
    sentryInitialized = true;
  }

  window.addEventListener("error", (event) => {
    // Stale JS chunk after a deploy — reload the page once instead of
    // bubbling up as a user-visible error.
    if (reloadOnceForStaleChunk(event.error ?? event.message)) return;
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
    if (reloadOnceForStaleChunk(event.reason)) return;
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
