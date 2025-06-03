import session from "express-session";
import connectPg from "connect-pg-simple";
import { Pool } from "@neondatabase/serverless";

/**
 * Production-ready session configuration
 * Fixes the MemoryStore deployment warning
 */
export function createProductionSessionConfig() {
  if (process.env.NODE_ENV === 'production') {
    // Use PostgreSQL session store for production
    const pgStore = connectPg(session);
    
    return session({
      store: new pgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
        ttl: 7 * 24 * 60 * 60, // 7 days in seconds
        tableName: 'sessions'
      }),
      secret: process.env.SESSION_SECRET || 'hydrogen-studies-secret-key',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: true, // HTTPS only in production
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
        sameSite: 'strict'
      },
      name: 'hydrogenstudies.sid'
    });
  } else {
    // Development configuration (keeps existing behavior)
    return session({
      secret: process.env.SESSION_SECRET || 'dev-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 1 day
      }
    });
  }
}