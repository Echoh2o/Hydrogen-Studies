# MCP Admin Keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Issue, list and revoke internal MCP keys from `/admin/mcp`, with setup instructions, no redeploy needed.

**Architecture:** Keys live hashed in `mcp_api_keys` (migration 028). `server/services/mcp-keys.ts` owns generation, hashing, a 30 s active-key cache and verification (env `MCP_ADMIN_KEYS` first, then DB). `/mcp/admin` auth delegates to it; `/api/admin/mcp-keys` (requireAdmin) exposes CRUD to a new React admin page.

**Tech Stack:** Express 4, drizzle `db.execute(sql…)`, vitest (mocked db, supertest), React + TanStack Query + shadcn/ui, wouter.

Spec: `docs/superpowers/specs/2026-10-21-mcp-admin-keys-design.md`.

## File map

| File | Responsibility |
| --- | --- |
| `server/migrations/add-mcp-api-keys.ts` (new) | Migration 028: `mcp_api_keys` table |
| `server/app.ts` (modify) | Register 028; mount `/api/admin/mcp-keys` next to `/api/admin/redirects` |
| `server/services/mcp-keys.ts` (new) | `generateKey`, `createKey`, `listKeys`, `revokeKey`, `verifyKey`, `clearKeyCache` |
| `server/mcp/http.ts` (modify) | Admin auth via `verifyKey` (async); drop local digest code |
| `server/routes/admin-mcp-keys-routes.ts` (new) | `GET /`, `POST /`, `DELETE /:id`, all `requireAdmin` |
| `client/src/pages/admin/McpPage.tsx` (new) | Instructions + keys table + create/revoke dialogs |
| `client/src/App.tsx`, `client/src/components/admin/AdminLayout.tsx` (modify) | Route (admin only) + sidebar "AI / MCP" |
| `server/__tests__/mcp-keys.test.ts` (new) | Service + route unit tests |
| `server/__tests__/mcp-server.test.ts` (modify) | DB key accepted/revoked on `/mcp/admin` |
| `server/__tests__/admin-route-guards.test.ts` (modify) | `/api/admin/mcp-keys` 401 without login |

## Interfaces

```ts
// server/services/mcp-keys.ts
export const KEY_PREFIX = "hsk_";
export function generateKey(): string;                       // "hsk_" + 32 random bytes base64url
export function hashKey(key: string): string;                // sha256 hex
export async function createKey(name: string, createdBy: string | null):
  Promise<{ id: number; name: string; key: string; key_prefix: string; created_at: string }>;
export async function listKeys(): Promise<McpKeyRow[]>;      // never includes key_hash
export async function revokeKey(id: number): Promise<boolean>; // false = unknown id
export async function verifyKey(presented: string): Promise<{ ok: boolean; source?: "env" | "db"; keyId?: number }>;
export function clearKeyCache(): void;
```

## Tasks

### Task 1: Migration 028
- [ ] Create `add-mcp-api-keys.ts` mirroring 027 (`migrationDb`, `CREATE TABLE IF NOT EXISTS`, rethrow on error): columns per spec, `key_hash UNIQUE`, `created_by TEXT REFERENCES users(id) ON DELETE SET NULL`, partial index on `revoked_at IS NULL`.
- [ ] Register `{ name: "028_add_mcp_api_keys", up: addMcpApiKeys }` after 027 in `server/app.ts`.

### Task 2: Key service (TDD)
- [ ] Write `mcp-keys.test.ts` service cases (mock `../db` `execute`, route by SQL text):
  - `createKey` returns `hsk_…` key ≥ 40 chars; INSERT params contain `hashKey(key)` and the 8-char prefix, never the plaintext key.
  - `verifyKey`: env key → `{ok:true, source:"env"}`; active DB key → `{ok:true, source:"db", keyId}`; unknown `hsk_` key → false; non-`hsk_` unknown key → false with no DB query; DB throws → false.
  - After `revokeKey` the cache is cleared and the next `verifyKey` re-queries.
  - `last_used_at` UPDATE fires once per key per minute (two verifies → one UPDATE).
- [ ] Run `npx vitest run server/__tests__/mcp-keys.test.ts` → FAIL (module missing).
- [ ] Implement `server/services/mcp-keys.ts` (generation-counter guarded cache so a load that started before a create/revoke cannot repopulate stale data).
- [ ] Re-run → PASS.

### Task 3: /mcp/admin uses the service
- [ ] In `mcp-server.test.ts`: route `FROM mcp_api_keys` → one active row whose `key_hash = hashKey(DB_KEY)`; route `UPDATE mcp_api_keys` → `[]`. Add test: `Bearer DB_KEY` → 200; unknown `hsk_` key → 401; env keys still 200 (existing test).
- [ ] Change `http.ts`: `isValidAdminKey` → async, `verifyKey`; middleware awaits it; log `keyId` beside the fingerprint.
- [ ] `npx vitest run server/__tests__/mcp-server.test.ts` → PASS.

### Task 4: Admin API (TDD)
- [ ] Route tests in `mcp-keys.test.ts` (supertest on an express app mounting the router, `../auth` mocked so `requireAdmin` passes and sets `session.userId`): POST `{name}` → 201 with `key`; POST empty / 101-char name → 400; GET → rows without `key_hash`/`key`; DELETE unknown → 404; DELETE `abc` → 400.
- [ ] Add `"/api/admin/mcp-keys"` to the 401 list in `admin-route-guards.test.ts`.
- [ ] Implement `admin-mcp-keys-routes.ts` (`router.use(requireAdmin)`), mount in `app.ts` after `/api/admin/redirects`.
- [ ] Run both test files → PASS.

### Task 5: Admin page
- [ ] `McpPage.tsx`: `AdminLayout`; Card "Connect" with URLs + copy buttons (Claude Code public/internal, Claude Desktop JSON, claude.ai/ChatGPT URL) and a link to the team guide; Card "Internal keys" with table (name, `prefix…`, created by/at, last used, status badge, Revoke via AlertDialog); "New key" Dialog → name → shows key once with filled-in Claude Code + Desktop snippets and a "won't be shown again" warning.
- [ ] Lazy import + `<Route path="/admin/mcp">` with `requiredRoles={["admin"]}` in `App.tsx`; sidebar entry `{ href: "/admin/mcp", label: "AI / MCP" }` in AdminLayout (Settings group area).
- [ ] `npm run check` (tsc) → clean.

### Task 6: Verify + ship
- [ ] `npx vitest run` → all pass; `npm run build` → success.
- [ ] Commit, push, PR, CI green, merge (deploys when Railway's pause lifts).
- [ ] Update the team guide: "For Josh" section → Admin → AI / MCP flow; drop the Railway-variable steps (keep as fallback note).
