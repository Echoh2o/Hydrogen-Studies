import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Optimized connection pool configuration for better stability and performance
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 15,
  min: 2,
  idleTimeoutMillis: 120000, // 2 min — well below Neon's 5 min idle disconnect
  connectionTimeoutMillis: 10000, // 10s to acquire from pool
  application_name: "hydrogen-studies-app",
  // statement_timeout prevents runaway queries from holding connections forever
  options: "-c statement_timeout=30000", // 30 second max per query
});

// Prevent unhandled pool errors from crashing the process
pool.on("error", (err) => {
  console.error("Unexpected error on idle database connection:", err);
});

export const db = drizzle(pool, {
  schema,
  logger: process.env.NODE_ENV === "development" ? false : undefined,
});

/**
 * Tagged template helper for raw SQL queries (replaces neon() function).
 * Returns rows array with rowCount property attached (matching neon's API).
 * Usage: const rows = await sqlQuery`SELECT * FROM studies WHERE id = ${id}`;
 */
export async function sqlQuery(strings: TemplateStringsArray, ...values: any[]) {
  let query = "";
  strings.forEach((string, i) => {
    query += string;
    if (i < values.length) {
      query += `$${i + 1}`;
    }
  });
  const result = await pool.query(query, values);
  const rows = result.rows as any;
  rows.rowCount = result.rowCount;
  return rows;
}
