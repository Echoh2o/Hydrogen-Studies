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
  min: 3,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 8000,
  application_name: "hydrogen-studies-app",
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
