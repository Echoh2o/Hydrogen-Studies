/**
 * CORS Configuration Module
 * Provides secure CORS settings for production and development
 */

import cors from "cors";

/**
 * Checks if running on Replit
 */
function isReplitEnvironment(): boolean {
  // Check for Replit environment variables or domain
  return (
    !!process.env.REPL_ID ||
    !!process.env.REPL_SLUG ||
    !!process.env.REPLIT_DEPLOYMENT_ID ||
    !!process.env.REPLIT_DEV_DOMAIN ||
    !!process.env.REPLIT_CLUSTER
  );
}

/**
 * Gets allowed origins based on environment
 */
function getAllowedOrigins(): string[] {
  const isProduction = process.env.NODE_ENV === "production";
  const isReplit = isReplitEnvironment();

  if (isProduction && !isReplit) {
    // Production (non-Replit): Use explicit allowed origins from environment
    const allowedOrigins = process.env.ALLOWED_ORIGINS || "";

    if (!allowedOrigins) {
      console.warn("⚠️  ALLOWED_ORIGINS not set in production!");
      console.warn(
        "⚠️  CORS will be restrictive. Set ALLOWED_ORIGINS environment variable.",
      );

      // Default to same-origin only in production if not configured
      return [];
    }

    // Parse comma-separated origins
    return allowedOrigins
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  } else {
    // Development and Replit: Allow localhost origins and Replit domains
    const origins = [
      "http://localhost:3000",
      "http://localhost:5000",
      "http://localhost:5173",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5000",
      "http://127.0.0.1:5173",
      "https://localhost:3000",
      "https://localhost:5000",
      "https://localhost:5173",
    ];

    // Add user-provided origins if any
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
  const isReplit = isReplitEnvironment();
  const allowedOrigins = getAllowedOrigins();

  return {
    origin: (origin, callback) => {
      // In development or Replit, be more permissive
      if (!isProduction || isReplit) {
        // Allow requests with no origin
        if (!origin) {
          return callback(null, true);
        }

        // Check if it's a Replit domain
        if (
          origin.includes(".replit.dev") ||
          origin.includes(".repl.co") ||
          origin.includes(".replit.app") ||
          origin.includes(".repl.run")
        ) {
          console.log(`✅ Allowing Replit origin: ${origin}`);
          return callback(null, true);
        }

        // Check if it's localhost
        if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
          return callback(null, true);
        }

        // Check against allowed origins list
        if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // In development/Replit, allow all origins as fallback
        console.log(`✅ Allowing origin in development: ${origin}`);
        return callback(null, true);
      }

      // Production (non-Replit) mode - strict checking
      // Allow requests with no origin (e.g., mobile apps, Postman)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is allowed in production
      if (allowedOrigins.length === 0) {
        // No origins configured in production = same-origin only
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

      // Reject unknown origins in production
      console.warn(`CORS blocked origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"), false);
    },

    credentials: true, // Allow cookies

    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-CSRF-Token", // Allow CSRF token header
      "Accept",
      "Origin",
    ],

    exposedHeaders: [
      "X-CSRF-Token", // Expose CSRF token header to client
      "X-Total-Count", // For pagination
      "X-Page-Count",
    ],

    maxAge: isProduction ? 86400 : 3600, // 24 hours in production, 1 hour in dev

    preflightContinue: false,

    optionsSuccessStatus: 204,
  };
}

/**
 * Validates CORS configuration
 */
export function validateCorsConfig(): void {
  const isProduction = process.env.NODE_ENV === "production";
  const isReplit = isReplitEnvironment();

  if (isReplit) {
    console.log("🌐 Running on Replit - CORS configured for Replit domains");
    console.log(
      "✅ Allowing *.replit.dev, *.repl.co, *.replit.app, *.repl.run",
    );
  } else if (isProduction && !process.env.ALLOWED_ORIGINS) {
    console.error("⚠️  WARNING: ALLOWED_ORIGINS not set in production!");
    console.error("⚠️  This will block all cross-origin requests.");
    console.error(
      "⚠️  Set ALLOWED_ORIGINS to a comma-separated list of allowed origins.",
    );
    console.error(
      "⚠️  Example: ALLOWED_ORIGINS=https://example.com,https://app.example.com",
    );
  } else if (!isProduction) {
    console.log(
      "🔧 Development mode - CORS allowing localhost and configured origins",
    );
  }
}
