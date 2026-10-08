/**
 * Structured Logger
 * Provides consistent JSON-formatted logging for production observability.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: Record<string, unknown>;
}

const isProduction = process.env.NODE_ENV === "production";

const EMAIL_RE = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

/**
 * Mask email addresses so customer PII never lands in Railway logs:
 * "jane.doe@example.com" -> "j***@example.com". Keeps the domain for triage.
 */
export function maskEmail(text: string): string {
  return text.replace(EMAIL_RE, "$1***@$2");
}

/** Deep-mask every string in a log payload (webhook bodies, error messages). */
function redact<T>(value: T, depth = 0): T {
  if (typeof value === "string") return maskEmail(value) as T;
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1)) as T;
  if (value instanceof Date) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = redact(v, depth + 1);
  return out as T;
}

/**
 * Keep the error message line plus the first `maxFrames` stack frames so logs
 * stay debuggable without ballooning each line. Returns undefined for missing
 * stacks.
 */
function truncateStack(stack?: string, maxFrames = 10): string | undefined {
  if (!stack) return undefined;
  const lines = stack.split("\n");
  // lines[0] is the "Error: message" header; keep it plus up to maxFrames frames.
  if (lines.length <= maxFrames + 1) return stack;
  return lines.slice(0, maxFrames + 1).join("\n");
}

function formatLog(entry: LogEntry): string {
  if (isProduction) {
    return JSON.stringify(entry);
  }
  // In development, use a more readable format
  const prefix = `[${entry.level.toUpperCase()}]`;
  const ctx = entry.context ? ` (${entry.context})` : "";
  const data = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
  return `${prefix}${ctx} ${entry.message}${data}`;
}

function createLogEntry(
  level: LogLevel,
  message: string,
  context?: string,
  data?: Record<string, unknown>,
): LogEntry {
  return {
    level,
    message: maskEmail(message),
    timestamp: new Date().toISOString(),
    context,
    data: data ? redact(data) : data,
  };
}

export const logger = {
  debug(message: string, context?: string, data?: Record<string, unknown>) {
    if (isProduction) return; // Skip debug in production
    console.debug(formatLog(createLogEntry("debug", message, context, data)));
  },

  info(message: string, context?: string, data?: Record<string, unknown>) {
    console.log(formatLog(createLogEntry("info", message, context, data)));
  },

  warn(message: string, context?: string, data?: Record<string, unknown>) {
    console.warn(formatLog(createLogEntry("warn", message, context, data)));
  },

  error(
    message: string,
    error?: Error | unknown,
    context?: string,
    data?: Record<string, unknown>,
  ) {
    const entry = createLogEntry("error", message, context, {
      ...data,
      errorMessage: error instanceof Error ? error.message : String(error),
      // Include the stack in every environment (including production) — JSON
      // logs handle multi-line strings fine, and prod errors are undebuggable
      // without it. Bounded to the first ~10 frames to keep log lines small.
      stack: error instanceof Error ? truncateStack(error.stack) : undefined,
    });
    console.error(formatLog(entry));
  },
};
