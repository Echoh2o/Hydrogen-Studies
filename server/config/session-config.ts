/**
 * Session Configuration Module
 * Provides secure session management with PostgreSQL storage
 */

import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { neon } from "@neondatabase/serverless";

const PgSession = connectPgSimple(session);

/**
 * Creates the session table if it doesn't exist
 * Returns a promise that resolves when the table is ready
 */
async function ensureSessionTable(): Promise<void> {
  const sql = neon(process.env.DATABASE_URL!);

  try {
    // Create session table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS session (
        sid varchar NOT NULL COLLATE "default",
        sess json NOT NULL,
        expire timestamp(6) NOT NULL,
        PRIMARY KEY (sid)
      ) WITH (OIDS=FALSE);
    `;
    console.log("✅ Session table created or already exists");

    // Add index for expired session cleanup
    await sql`
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON session(expire);
    `;
    console.log("✅ Session expire index created or already exists");
  } catch (err) {
    console.error("❌ Error setting up session table:", err);

    // Try alternative approach - check if table exists first
    try {
      const result = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'session'
        );
      `;

      if (!result[0].exists) {
        console.log(
          "🔄 Attempting to create session table with alternative method...",
        );

        // Try without COLLATE if that's causing issues
        await sql`
          CREATE TABLE session (
            sid varchar PRIMARY KEY,
            sess json NOT NULL,
            expire timestamp(6) NOT NULL
          );
        `;

        await sql`
          CREATE INDEX IDX_session_expire ON session(expire);
        `;

        console.log("✅ Session table created with alternative method");
      } else {
        console.log("✅ Session table already exists");
      }
    } catch (altErr) {
      console.error(
        "❌ Failed to create session table with alternative method:",
        altErr,
      );
      // Don't throw - let connect-pg-simple try to create it
      console.log("⚠️  Will let connect-pg-simple attempt to create the table");
    }
  }
}

/**
 * Validates and returns session configuration
 * Ensures secure settings for production environment
 */
export async function getSessionConfig() {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && !process.env.SESSION_SECRET) {
    throw new Error(
      "SESSION_SECRET is required in production. " +
        "Generate a secure secret using: openssl rand -hex 32",
    );
  }

  let sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    sessionSecret = "dev-secret-change-me-before-production";
    console.warn("Using default SESSION_SECRET for development only.");
    console.warn(
      "Set SESSION_SECRET environment variable for production.",
    );
  }

  // Ensure session table exists before creating the store
  await ensureSessionTable();

  // Create session store configuration
  const storeConfig = {
    conString: process.env.DATABASE_URL!,
    tableName: "session",
    createTableIfMissing: true, // Let the store also try to create the table
    pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 minutes
    errorLog: (error: Error) => {
      console.error("Session store error:", error);
      // Don't log connection errors repeatedly
      if (!error.message?.includes("connect")) {
        console.error("Session store error details:", error.stack);
      }
    },
  };

  // Cookie configuration based on environment
  const cookieConfig = {
    secure: isProduction, // HTTPS only in production
    httpOnly: true, // Prevent XSS
    sameSite: isProduction ? ("strict" as const) : ("lax" as const), // CSRF protection
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    domain: undefined as string | undefined, // Let browser handle domain automatically
  };

  // In production, set domain if provided
  if (isProduction && process.env.COOKIE_DOMAIN) {
    cookieConfig.domain = process.env.COOKIE_DOMAIN;
  }

  return {
    store: new PgSession(storeConfig),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiry on activity
    name: "hydrogen.sid", // Custom session cookie name
    cookie: cookieConfig,
    proxy: isProduction, // Trust proxy in production (for secure cookies behind proxy)
  };
}

/**
 * Non-async wrapper for Express middleware
 * This allows the session config to be used in Express setup
 */
export function getSessionMiddleware() {
  let sessionMiddleware: any = null;
  let initPromise: Promise<void> | null = null;

  return async (req: any, res: any, next: any) => {
    if (!sessionMiddleware) {
      if (!initPromise) {
        initPromise = getSessionConfig()
          .then((config) => {
            sessionMiddleware = session(config);
            console.log("✅ Session middleware initialized");
          })
          .catch((err) => {
            console.error("❌ Failed to initialize session middleware:", err);
            throw err;
          });
      }
      await initPromise;
    }

    if (sessionMiddleware) {
      sessionMiddleware(req, res, next);
    } else {
      next(new Error("Session middleware not initialized"));
    }
  };
}

/**
 * Generates a cryptographically secure session secret
 */
export function generateSessionSecret(): string {
  const crypto = require("crypto");
  return crypto.randomBytes(32).toString("hex");
}
