import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon connection for WebSockets
neonConfig.webSocketConstructor = ws;

// Check for database URL
if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL not set. Database operations will not work.");
}

// Create a database connection pool
export const pool = process.env.DATABASE_URL 
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

// Create a Drizzle ORM instance with our schema
export const db = pool 
  ? drizzle(pool, { schema })
  : null;

console.log("Database connection initialized:", !!db);