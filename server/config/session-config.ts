/**
 * Session Configuration Module
 * Provides secure session management with PostgreSQL storage
 */

import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { randomBytes } from "crypto";
import { pool } from "../db";

const PgSession = connectPgSimple(session);

/**
 * Creates the session table if it doesn't exist
 * Returns a promise that resolves when the table is ready
 */
async function ensureSessionTable(): Promise<void> {
  try {
    // Create session table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid varchar NOT NULL COLLATE "default",
        sess json NOT NULL,
        expire timestamp(6) NOT NULL,
        PRIMARY KEY (sid)
      );
    `);
    // Session table and index ready
  } catch (err) {
    console.error("Error setting up session table:", err);

    // Try alternative approach - check if table exists first
    try {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'session'
        );
      `);

      if (!result.rows[0].exists) {
        await pool.query(`
          CREATE TABLE session (
            sid varchar PRIMARY KEY,
            sess json NOT NULL,
            expire timestamp(6) NOT NULL
          );
        `);

        await pool.query(`
          CREATE INDEX IDX_session_expire ON session(expire);
        `);
      }
    } catch (altErr) {
      console.error("Failed to create session table:", altErr);
      // Don't throw - let connect-pg-simple try to create it
    }
  }
}

/**
 * Validates and returns session configuration
 * Ensures secure settings for production environment
 */
export async function getSessionConfig() {
  const isProduction = process.env.NODE_ENV === "production";

  // SESSION_SECRET must be set (validateEnvironment() auto-generates one in dev).
  // Fail closed in production if missing — never fall back to a hardcoded secret.
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error(
      "SESSION_SECRET is required and must be at least 32 characters. " +
        "Generate with: openssl rand -hex 32",
    );
  }

  // Ensure session table exists before creating the store
  await ensureSessionTable();

  // Create session store configuration (reuse pool from db.ts)
  const storeConfig = {
    pool: pool,
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
    /**
     * `Lax` (not `Strict`) so cross-site OAuth redirects (Google Search
     * Console, future SSO) preserve the user's session. Strict blocks the
     * cookie on top-level navigations from external origins, which causes
     * the user to appear logged-out the moment they return from any
     * external auth flow.
     *
     * CSRF on mutating endpoints is still enforced by the dedicated
     * csrf middleware (see csrf-protection.ts) — Lax provides
     * defense-in-depth rather than primary protection.
     */
    sameSite: "lax" as const,
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
          })
          .catch((err) => {
            // Reset so next request retries initialization
            initPromise = null;
            console.error("Failed to initialize session middleware:", err);
          });
      }
      await initPromise;
    }

    if (sessionMiddleware) {
      sessionMiddleware(req, res, next);
    } else {
      // Session store failed — return error instead of silently bypassing auth
      console.error("Session middleware unavailable, rejecting request");
      res.status(503).json({ error: "Service temporarily unavailable" });
    }
  };
}

/**
 * Generates a cryptographically secure session secret
 */
export function generateSessionSecret(): string {
  return randomBytes(32).toString("hex");
}
