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
    message,
    timestamp: new Date().toISOString(),
    context,
    data,
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
      stack:
        !isProduction && error instanceof Error ? error.stack : undefined,
    });
    console.error(formatLog(entry));
  },
};
