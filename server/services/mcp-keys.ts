/**
 * Internal MCP keys for /mcp/admin, issued and revoked from /admin/mcp
 * (mcp_api_keys, migration 028). Only SHA-256 hashes are stored; the
 * plaintext key is returned once, by createKey.
 *
 * verifyKey accepts the MCP_ADMIN_KEYS env keys first (timing-safe digest
 * compare, no DB), then active DB keys from a 30 s cache that create/revoke
 * drop. A DB failure fails closed for DB keys; env keys keep working.
 */
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { logger } from "../utils/logger";

export const KEY_PREFIX = "hsk_";
const PREFIX_SHOWN = 8;
const CACHE_MS = 30_000;
const TOUCH_EVERY_MS = 60_000;

export interface McpKeyRow {
  id: number;
  name: string;
  key_prefix: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export const hashKey = (key: string): string => crypto.createHash("sha256").update(key).digest("hex");

export function generateKey(): string {
  return KEY_PREFIX + crypto.randomBytes(32).toString("base64url");
}

/** Keys from MCP_ADMIN_KEYS (comma-separated; < 24 chars ignored), as SHA-256 digests. */
function envKeyDigests(): Buffer[] {
  return (process.env.MCP_ADMIN_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length >= 24)
    .map((k) => crypto.createHash("sha256").update(k).digest());
}

// Active DB keys by hash. `generation` bumps on every create/revoke so a load
// that started before the change can't repopulate the cache with stale rows.
let cache: { at: number; byHash: Map<string, number> } | null = null;
let generation = 0;
const lastTouched = new Map<number, number>();

export function clearKeyCache(): void {
  cache = null;
  generation++;
  lastTouched.clear();
}

async function activeKeys(): Promise<Map<string, number>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.byHash;
  const gen = generation;
  const r = await db.execute(sql`SELECT id, key_hash FROM mcp_api_keys WHERE revoked_at IS NULL`);
  const byHash = new Map((r.rows as Array<{ id: number; key_hash: string }>).map((row) => [row.key_hash, Number(row.id)]));
  if (gen === generation) cache = { at: Date.now(), byHash };
  return byHash;
}

function touch(id: number): void {
  const now = Date.now();
  if (now - (lastTouched.get(id) ?? 0) < TOUCH_EVERY_MS) return;
  lastTouched.set(id, now);
  db.execute(sql`UPDATE mcp_api_keys SET last_used_at = NOW() WHERE id = ${id}`).catch((err: unknown) =>
    logger.warn("mcp_api_keys last_used_at update failed", "MCP", { error: String((err as Error)?.message ?? err) }),
  );
}

export async function verifyKey(presented: string): Promise<{ ok: boolean; source?: "env" | "db"; keyId?: number }> {
  const digest = crypto.createHash("sha256").update(presented).digest();
  let envOk = false;
  for (const d of envKeyDigests()) envOk = crypto.timingSafeEqual(d, digest) || envOk;
  if (envOk) return { ok: true, source: "env" };
  if (!presented.startsWith(KEY_PREFIX)) return { ok: false };
  try {
    const id = (await activeKeys()).get(digest.toString("hex"));
    if (id === undefined) return { ok: false };
    touch(id);
    return { ok: true, source: "db", keyId: id };
  } catch (err) {
    logger.warn("mcp_api_keys lookup failed", "MCP", { error: String((err as Error)?.message ?? err) });
    return { ok: false };
  }
}

export async function createKey(name: string, createdBy: string | null) {
  const key = generateKey();
  const keyPrefix = key.slice(0, PREFIX_SHOWN);
  const r = await db.execute(sql`
    INSERT INTO mcp_api_keys (name, key_prefix, key_hash, created_by)
    VALUES (${name}, ${keyPrefix}, ${hashKey(key)}, ${createdBy})
    RETURNING id, created_at`);
  clearKeyCache();
  const row = r.rows[0] as { id: number; created_at: string };
  return { id: Number(row.id), name, key, key_prefix: keyPrefix, created_at: row.created_at };
}

/** Every key, active first then newest; never the hash. */
export async function listKeys(): Promise<McpKeyRow[]> {
  const r = await db.execute(sql`
    SELECT k.id, k.name, k.key_prefix, k.created_by, COALESCE(u.username, u.email) AS created_by_name,
           k.created_at, k.last_used_at, k.revoked_at
      FROM mcp_api_keys k LEFT JOIN users u ON u.id = k.created_by
     ORDER BY k.revoked_at IS NOT NULL, k.created_at DESC`);
  return r.rows as unknown as McpKeyRow[];
}

/** Revoke (idempotent; keeps the first revoked_at). False when the id doesn't exist. */
export async function revokeKey(id: number): Promise<boolean> {
  const r = await db.execute(sql`UPDATE mcp_api_keys SET revoked_at = COALESCE(revoked_at, NOW()) WHERE id = ${id} RETURNING id`);
  clearKeyCache();
  return (r.rows?.length ?? 0) > 0;
}
