/**
 * Client-side Error Tracking
 * Collects frontend errors and reports them to the server for monitoring.
 *
 * To enable Sentry:
 *   1. npm install @sentry/react
 *   2. Set VITE_SENTRY_DSN in environment
 *   3. The tracker auto-detects and uses Sentry alongside server reporting
 */

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

// Sentry client (lazy-loaded if DSN is configured)
let sentryClient: any = null;

function initSentry(): void {
  const dsn = import.meta.env?.VITE_SENTRY_DSN;
  if (!dsn) return;

  // Dynamic module name prevents Vite/Rollup from resolving at build time
  const sentryModule = ["@sentry", "react"].join("/");
  import(/* @vite-ignore */ sentryModule)
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env?.MODE || "production",
        tracesSampleRate: 0.1,
        // Don't report errors from browser extensions
        beforeSend(event: any) {
          const frames = event.exception?.values?.[0]?.stacktrace?.frames;
          if (frames?.some((f: any) => f.filename?.includes("extension://"))) {
            return null;
          }
          return event;
        },
      });
      sentryClient = Sentry;
    })
    .catch(() => {
      // @sentry/react not installed — silent fallback
    });
}

/** Report an error to the server (and Sentry if available) */
async function reportError(report: ErrorReport): Promise<void> {
  if (errorsReported >= MAX_ERRORS_PER_SESSION) return;
  errorsReported++;

  // Report to Sentry if available
  if (sentryClient) {
    try {
      sentryClient.captureException(new Error(report.message));
    } catch {
      // Swallow
    }
  }

  try {
    // Send to server error reporting endpoint (non-blocking)
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
  initSentry();

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
  reportError({
    message: `${context ? `[${context}] ` : ""}${error.message}`,
    stack: error.stack,
    url: typeof window !== "undefined" ? window.location.href : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    timestamp: new Date().toISOString(),
  });
}
