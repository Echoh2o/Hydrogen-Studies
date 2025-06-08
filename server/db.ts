import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Optimized connection pool configuration for better performance
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // Maximum number of connections
  min: 5,                     // Minimum number of connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Timeout for new connections
  maxUses: 7500,              // Close connections after 7500 uses
  allowExitOnIdle: false      // Keep pool alive
});

export const db = drizzle(pool, { 
  schema,
  logger: process.env.NODE_ENV === 'development' ? false : undefined // Disable logging in production
});