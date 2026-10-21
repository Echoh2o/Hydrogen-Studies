/**
 * Internal MCP keys (server/services/mcp-keys.ts + /api/admin/mcp-keys):
 * hashed storage, show-once creation, env + DB verification, revocation.
 * The database is a fake mcp_api_keys table routed by SQL text.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const dialect = new PgDialect();
const ENV_KEY = "env-admin-key-0123456789abcdef";
process.env.MCP_ADMIN_KEYS = ENV_KEY;

interface Row {
  id: number;
  name: string;
  key_prefix: string;
  key_hash: string;
  created_by: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}
const state = vi.hoisted(() => ({ rows: [] as any[], queries: [] as Array<{ text: string; params: unknown[] }>, fail: false }));

function route(text: string, params: unknown[]) {
  state.queries.push({ text, params });
  if (state.fail) throw new Error("db down");
  if (text.includes("INSERT INTO mcp_api_keys")) {
    const [name, key_prefix, key_hash, created_by] = params as [string, string, string, string | null];
    const row: Row = { id: state.rows.length + 1, name, key_prefix, key_hash, created_by, created_at: "2026-10-21T00:00:00Z", last_used_at: null, revoked_at: null };
    state.rows.push(row);
    return [{ id: row.id, created_at: row.created_at }];
  }
  if (text.includes("SELECT id, key_hash FROM mcp_api_keys")) {
    return state.rows.filter((r) => !r.revoked_at).map((r) => ({ id: r.id, key_hash: r.key_hash }));
  }
  if (text.includes("UPDATE mcp_api_keys SET last_used_at")) return [];
  if (text.includes("UPDATE mcp_api_keys SET revoked_at")) {
    const row = state.rows.find((r) => r.id === params[0]);
    if (!row) return [];
    row.revoked_at ??= "2026-10-21T01:00:00Z";
    return [{ id: row.id }];
  }
  if (text.includes("FROM mcp_api_keys k")) {
    return state.rows.map(({ key_hash: _h, ...r }) => ({ ...r, created_by_name: r.created_by ? "josh" : null }));
  }
  throw new Error(`unrouted SQL in test: ${text.slice(0, 120)}`);
}

vi.mock("../db", () => ({
  db: {
    execute: vi.fn(async (q: SQL) => {
      const { sql: text, params } = dialect.sqlToQuery(q);
      return { rows: route(text, params) };
    }),
  },
}));
vi.mock("../auth", () => ({
  requireAdmin: (req: any, _res: any, next: any) => {
    req.session = { userId: "user-1" };
    next();
  },
}));

const keys = await import("../services/mcp-keys");
const { default: adminMcpKeysRoutes } = await import("../routes/admin-mcp-keys-routes");

beforeEach(() => {
  state.rows.length = 0;
  state.queries.length = 0;
  state.fail = false;
  keys.clearKeyCache();
});

const keyQueries = () => state.queries.filter((q) => q.text.includes("SELECT id, key_hash")).length;

describe("mcp key service", () => {
  it("creates an hsk_ key and stores only its hash and prefix", async () => {
    const created = await keys.createKey("Sarah – Claude Code", "user-1");
    expect(created.key).toMatch(/^hsk_[A-Za-z0-9_-]{40,}$/);
    expect(created.key_prefix).toBe(created.key.slice(0, 8));
    const insert = state.queries.find((q) => q.text.includes("INSERT INTO mcp_api_keys"))!;
    expect(insert.params).toContain(keys.hashKey(created.key));
    expect(insert.params).not.toContain(created.key);
  });

  it("accepts env keys without touching the database", async () => {
    expect(await keys.verifyKey(ENV_KEY)).toEqual({ ok: true, source: "env" });
    expect(state.queries).toHaveLength(0);
  });

  it("accepts an active database key and rejects unknown ones", async () => {
    const { id, key } = await keys.createKey("A", null);
    expect(await keys.verifyKey(key)).toEqual({ ok: true, source: "db", keyId: id });
    expect((await keys.verifyKey(`${key}x`)).ok).toBe(false);
  });

  it("rejects non-hsk_ keys without a database lookup", async () => {
    expect((await keys.verifyKey("not-a-real-key-0123456789abcdef")).ok).toBe(false);
    expect(keyQueries()).toBe(0);
  });

  it("fails closed when the database errors, but env keys still work", async () => {
    const { key } = await keys.createKey("A", null);
    keys.clearKeyCache();
    state.fail = true;
    expect((await keys.verifyKey(key)).ok).toBe(false);
    expect((await keys.verifyKey(ENV_KEY)).ok).toBe(true);
  });

  it("caches active keys and drops the cache on revoke", async () => {
    const { id, key } = await keys.createKey("A", null);
    await keys.verifyKey(key);
    await keys.verifyKey(key);
    expect(keyQueries()).toBe(1);
    expect(await keys.revokeKey(id)).toBe(true);
    expect((await keys.verifyKey(key)).ok).toBe(false);
    expect(keyQueries()).toBe(2);
  });

  it("records last use at most once a minute per key", async () => {
    const { key } = await keys.createKey("A", null);
    await keys.verifyKey(key);
    await keys.verifyKey(key);
    expect(state.queries.filter((q) => q.text.includes("SET last_used_at")).length).toBe(1);
  });

  it("revokeKey reports unknown ids", async () => {
    expect(await keys.revokeKey(42)).toBe(false);
  });
});

describe("/api/admin/mcp-keys", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/mcp-keys", adminMcpKeysRoutes);

  it("creates a key, returning it once, with the creator recorded", async () => {
    const res = await request(app).post("/api/admin/mcp-keys").send({ name: "  Sarah  " });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Sarah");
    expect(res.body.key).toMatch(/^hsk_/);
    expect(state.rows[0].created_by).toBe("user-1");
  });

  it("rejects a missing or over-long name", async () => {
    expect((await request(app).post("/api/admin/mcp-keys").send({ name: " " })).status).toBe(400);
    expect((await request(app).post("/api/admin/mcp-keys").send({ name: "x".repeat(101) })).status).toBe(400);
  });

  it("lists keys without hashes or plaintext", async () => {
    const { key } = await keys.createKey("A", "user-1");
    const res = await request(app).get("/api/admin/mcp-keys");
    expect(res.status).toBe(200);
    expect(res.body.keys).toHaveLength(1);
    expect(JSON.stringify(res.body)).not.toContain(key);
    expect(res.body.keys[0]).not.toHaveProperty("key_hash");
    expect(res.body.keys[0].created_by_name).toBe("josh");
  });

  it("revokes by id; 404 for unknown ids, 400 for bad ids", async () => {
    const { id } = await keys.createKey("A", null);
    expect((await request(app).delete(`/api/admin/mcp-keys/${id}`)).status).toBe(200);
    expect(state.rows[0].revoked_at).not.toBeNull();
    expect((await request(app).delete("/api/admin/mcp-keys/999")).status).toBe(404);
    expect((await request(app).delete("/api/admin/mcp-keys/abc")).status).toBe(400);
  });
});
