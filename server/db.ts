import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Optimized connection pool configuration for better stability and performance
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 15, // Reduced max connections for stability
  min: 3, // Reduced min connections
  idleTimeoutMillis: 60000, // Increased idle timeout to 60s for stability
  connectionTimeoutMillis: 8000, // Increased timeout for slower connections
  maxUses: 10000, // Increased max uses before recycling
  allowExitOnIdle: false, // Keep pool alive

  // Additional stability configurations
  statement_timeout: 30000, // 30 second statement timeout
  query_timeout: 25000, // 25 second query timeout

  // Connection validation
  application_name: "hydrogen-studies-app",
});

export const db = drizzle(pool, {
  schema,
  logger: process.env.NODE_ENV === "development" ? false : undefined, // Disable logging in production
});
