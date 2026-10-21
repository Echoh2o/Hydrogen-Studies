/**
 * Migration 027: study_embeddings + mcp_calls.
 *
 * study_embeddings — one text-embedding-3-small vector (512 dims) per study,
 * for the MCP server's meaning-based search (server/services/study-embeddings.ts).
 * Stored as real[] and searched in memory: ~2.2k vectors, so no pgvector
 * dependency. content_hash lets the sync re-embed only studies whose text changed.
 *
 * mcp_calls — one row per MCP tool call (tool, tier, truncated args, latency,
 * success). No IP or client identifiers. Replaces log-only visibility, which
 * reset on every deploy.
 *
 * Additive and idempotent; failures rethrow — migration errors are fatal at boot.
 */
import { migrationDb as db } from "../db";
import { sql } from "drizzle-orm";

export async function addStudyEmbeddingsAndMcpCalls(): Promise<void> {
  console.log("Starting migration: study_embeddings / mcp_calls");
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS study_embeddings (
        study_id INTEGER PRIMARY KEY REFERENCES studies(id) ON DELETE CASCADE,
        model TEXT NOT NULL,
        dims INTEGER NOT NULL,
        embedding REAL[] NOT NULL,
        content_hash TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS mcp_calls (
        id BIGSERIAL PRIMARY KEY,
        at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        tier TEXT NOT NULL,
        tool TEXT NOT NULL,
        args JSONB,
        ms INTEGER NOT NULL,
        ok BOOLEAN NOT NULL,
        response_bytes INTEGER
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS mcp_calls_at_idx ON mcp_calls (at)`);
    console.log("study_embeddings / mcp_calls migration completed");
  } catch (error) {
    console.error("Error creating study_embeddings / mcp_calls:", error);
    throw error;
  }
}
