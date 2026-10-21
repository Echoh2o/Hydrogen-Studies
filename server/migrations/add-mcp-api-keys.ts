/**
 * Migration 028: mcp_api_keys.
 *
 * Internal MCP keys issued from /admin/mcp (server/services/mcp-keys.ts).
 * Only the SHA-256 hash is stored; the plaintext key is shown once, at
 * creation. Revoking sets revoked_at, so the row stays as an audit trail.
 * Keys in the MCP_ADMIN_KEYS env var keep working alongside these.
 *
 * Additive and idempotent; failures rethrow — migration errors are fatal at boot.
 */
import { migrationDb as db } from "../db";
import { sql } from "drizzle-orm";

export async function addMcpApiKeys(): Promise<void> {
  console.log("Starting migration: mcp_api_keys");
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS mcp_api_keys (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_used_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ
      )
    `);
    console.log("mcp_api_keys migration completed");
  } catch (error) {
    console.error("Error creating mcp_api_keys:", error);
    throw error;
  }
}
