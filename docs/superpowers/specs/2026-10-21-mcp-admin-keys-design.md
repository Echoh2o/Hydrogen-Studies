# MCP admin keys in /admin — design

Approved by Josh 2026-10-21 ("approved, admins only").

## Goal

Manage internal MCP keys (`/mcp/admin`) from the admin UI instead of the
Railway `MCP_ADMIN_KEYS` variable, so issuing or revoking a key takes effect in
seconds with no redeploy, and show setup instructions next to the keys.

## Scope

- New admin page `/admin/mcp`, sidebar label "AI / MCP", role `admin` only.
- DB-backed keys: create (shown once), list, revoke.
- `/mcp/admin` accepts DB keys and, unchanged, `MCP_ADMIN_KEYS` keys.
- Out of scope: per-key usage reporting, editor access, key expiry, editing
  key names.

## Data — migration 028 `mcp_api_keys`

| column | type | notes |
| --- | --- | --- |
| id | serial PK | |
| name | text not null | e.g. "Sarah – Claude Code", ≤ 100 chars |
| key_prefix | text not null | first 8 chars of the key, for display |
| key_hash | text not null unique | SHA-256 hex of the full key |
| created_by | text null | users.id (text) of the creating admin, ON DELETE SET NULL |
| created_at | timestamptz not null default now() | |
| last_used_at | timestamptz null | |
| revoked_at | timestamptz null | null = active |

Additive and idempotent (`CREATE TABLE IF NOT EXISTS`), registered in
`server/app.ts` like 027. Plaintext keys are never stored.

## Keys

- Format: `hsk_` + 32 random bytes base64url (≈47 chars, above the 24-char
  minimum). Generated server-side with `crypto.randomBytes`.
- Returned exactly once, in the `POST` response.

## Server

- `server/services/mcp-keys.ts`: `createKey(name, userId)`, `listKeys()`
  (no hashes), `revokeKey(id)`, `verifyKey(plaintext)` → `{ ok, keyId? }`.
  `verifyKey` checks env keys first (existing timing-safe digest compare),
  then active DB hashes, held in a 30 s in-memory cache that create/revoke
  clear. `last_used_at` written fire-and-forget, at most once a minute per key.
- `server/mcp/http.ts`: `isValidAdminKey` delegates to `verifyKey` (now async).
  The log fingerprint stays as is.
- `server/routes/admin-mcp-keys-routes.ts` at `/api/admin/mcp-keys`, every
  route behind `requireAdmin`: `GET /`, `POST /` `{ name }`, `DELETE /:id`
  (sets `revoked_at`; idempotent).

## Client

- `client/src/pages/admin/McpPage.tsx`, route in `App.tsx` under
  `ProtectedRoute requiredRoles={["admin"]}`, sidebar entry in `AdminLayout.tsx`.
- Instructions panel: endpoint URLs and copy buttons for Claude Code, Claude
  Desktop config, claude.ai and ChatGPT; link to the team guide.
- New-key dialog: name → shows the key once with the Claude Code and Claude
  Desktop snippets filled in, and a warning that it won't be shown again.
- Keys table: name, prefix, created by/at, last used, status, Revoke (confirm
  dialog). Revoked rows stay, greyed out.

## Error handling

- Empty/over-long name → 400. Unknown id on revoke → 404.
- DB failure during `verifyKey` → env keys still work; DB keys fail closed (401).

## Tests (vitest, mocked db)

- POST returns the key once; GET never contains `key_hash` or full keys.
- Revoked key → 401 on `/mcp/admin` (after cache clear); active key → 200.
- `MCP_ADMIN_KEYS` keys keep working.
- Non-admin → 401/403 on `/api/admin/mcp-keys`.

## Follow-ups

- Team guide "For Josh" section → "Admin → AI / MCP → New key".
