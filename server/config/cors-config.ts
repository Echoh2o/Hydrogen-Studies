/**
 * CORS Configuration Module
 * Provides secure CORS settings for production and development
 */

import cors from "cors";

/**
 * Gets allowed origins based on environment
 */
function getAllowedOrigins(): string[] {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS || "";

    if (!allowedOrigins) {
      console.warn("ALLOWED_ORIGINS not set in production.");
      console.warn(
        "CORS will be restrictive. Set ALLOWED_ORIGINS environment variable.",
      );
      return [];
    }

    return allowedOrigins
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  } else {
    // Development: Allow localhost origins
    const origins = [
      "http://localhost:3000",
      "http://localhost:5000",
      "http://localhost:5173",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5000",
      "http://127.0.0.1:5173",
    ];

    if (process.env.ALLOWED_ORIGINS) {
      const additionalOrigins = process.env.ALLOWED_ORIGINS.split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);
      origins.push(...additionalOrigins);
    }

    return origins;
  }
}

/**
 * Creates CORS configuration
 */
export function getCorsConfig(): cors.CorsOptions {
  const isProduction = process.env.NODE_ENV === "production";
  const allowedOrigins = getAllowedOrigins();

  return {
    origin: (origin, callback) => {
      // Same-origin requests (no Origin header) are always allowed.
      if (!origin) {
        return callback(null, true);
      }

      // In development, allow localhost/127.0.0.1 and the configured allowlist —
      // but never blanket-allow arbitrary origins. Misconfigured NODE_ENV
      // shouldn't collapse CORS.
      if (!isProduction) {
        try {
          const host = new URL(origin).hostname;
          if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
            return callback(null, true);
          }
        } catch {
          // fall through to allowlist check
        }
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      if (!isProduction && allowedOrigins.length === 0) {
        console.warn(
          `CORS blocked origin: ${origin} (set ALLOWED_ORIGINS to permit non-localhost dev origins)`,
        );
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
      }
      return callback(new Error("Not allowed by CORS"), false);
    },

    credentials: true,

    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-CSRF-Token",
      "Accept",
      "Origin",
    ],

    exposedHeaders: [
      "X-CSRF-Token",
      "X-Total-Count",
      "X-Page-Count",
      "X-Request-Id",
      "RateLimit-Limit",
      "RateLimit-Remaining",
      "RateLimit-Reset",
      "Retry-After",
    ],

    maxAge: isProduction ? 86400 : 3600,

    preflightContinue: false,

    optionsSuccessStatus: 204,
  };
}

/**
 * Validates CORS configuration
 */
export function validateCorsConfig(): void {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && !process.env.ALLOWED_ORIGINS) {
    console.warn("ALLOWED_ORIGINS not set in production - only same-origin requests allowed.");
    console.warn(
      "Set ALLOWED_ORIGINS if you need cross-origin access (e.g., ALLOWED_ORIGINS=https://yourdomain.com)",
    );
  } else if (!isProduction) {
    console.log(
      "Development mode - CORS allowing localhost and configured origins",
    );
  }
}
