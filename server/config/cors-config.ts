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
      if (!isProduction) {
        // Allow requests with no origin in development
        if (!origin) {
          return callback(null, true);
        }

        // Check if it's localhost
        if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
          return callback(null, true);
        }

        // Check against allowed origins list
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // In development, allow all origins as fallback
        return callback(null, true);
      }

      // Production mode - strict checking
      // Allow same-origin requests (no origin header)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.length === 0) {
        console.warn(
          `CORS blocked origin: ${origin} (no ALLOWED_ORIGINS configured)`,
        );
        return callback(
          new Error("CORS not allowed - no allowed origins configured"),
          false,
        );
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(`CORS blocked origin: ${origin}`);
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
    console.error("WARNING: ALLOWED_ORIGINS not set in production!");
    console.error("This will block all cross-origin requests.");
    console.error(
      "Set ALLOWED_ORIGINS to a comma-separated list of allowed origins.",
    );
    console.error(
      "Example: ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com",
    );
  } else if (!isProduction) {
    console.log(
      "Development mode - CORS allowing localhost and configured origins",
    );
  }
}
