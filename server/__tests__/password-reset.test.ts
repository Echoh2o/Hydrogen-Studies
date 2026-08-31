/**
 * Regression tests for the password-reset confirmation flow
 * (POST /api/auth/reset-password → executePasswordReset).
 *
 * Regression being pinned: the token row used to be fetched with raw SQL
 * (tx.execute), so the row kept the pg driver's snake_case keys (used_at,
 * user_id, expires_at) while the code read camelCase properties. The effects:
 *   - resetToken.usedAt was always undefined → the used-token guard was a
 *     no-op (a used-but-unexpired token passed validation),
 *   - resetToken.userId was undefined → the users UPDATE matched no rows, so
 *     the user was told "Password reset successfully" while the password
 *     never changed, and session eviction ran with undefined.
 * The fix fetches the row through the drizzle query builder so column mapping
 * applies; these tests verify the consume-token core against a mock tx.
 *
 * Mocked-db unit tests per repo convention — no real Postgres. The FOR UPDATE
 * SKIP LOCKED race-safety itself needs an integration DB and is not covered
 * here; we only pin that the query still requests that lock mode.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";

const h = vi.hoisted(() => {
  const updateCalls: Array<{ table: unknown; values: Record<string, unknown>; where: unknown }> =
    [];
  const selectWhereArgs: unknown[] = [];
  const selectForArgs: unknown[][] = [];
  const state = { rows: [] as unknown[] };

  // Minimal drizzle-shaped transaction: select().from().where().limit().for()
  // resolves to `state.rows`; update(table).set(values).where(cond) records the call.
  const tx = {
    select: () => ({
      from: () => ({
        where: (cond: unknown) => {
          selectWhereArgs.push(cond);
          return {
            limit: () => ({
              for: (...args: unknown[]) => {
                selectForArgs.push(args);
                return Promise.resolve(state.rows);
              },
            }),
          };
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: (cond: unknown) => {
          updateCalls.push({ table, values, where: cond });
          return Promise.resolve();
        },
      }),
    }),
  };

  return { updateCalls, selectWhereArgs, selectForArgs, state, tx };
});

vi.mock("../db", () => ({
  db: {
    // Run the transaction callback with our mock tx (commit/rollback is not modeled;
    // a throw from the callback propagates like a rolled-back drizzle transaction).
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => fn(h.tx)),
    // destroyUserSessions() deletes rows from the session table via db.execute.
    execute: vi.fn(async () => ({ rows: [], rowCount: 0 })),
  },
}));

// Must import after mocks are set up
const { executePasswordReset } = await import("../routes/auth-routes");
const { db } = await import("../db");
const { passwordResetTokens, users } = await import("../../shared/schema");

/**
 * Collect bound parameter values from a drizzle SQL condition (eq/and/sql``).
 * eq()/and() wrap values eagerly as `Param` instances ({ value, encoder });
 * the sql`` tagged template keeps interpolated values as raw primitives in
 * queryChunks (they become params at build time). Handle both.
 */
function collectParamValues(node: unknown, out: unknown[] = [], seen = new Set<unknown>()): unknown[] {
  if (node === null || node === undefined) return out;
  if (typeof node !== "object") {
    out.push(node);
    return out;
  }
  if (seen.has(node)) return out;
  seen.add(node);
  const anyNode = node as { value?: unknown; encoder?: unknown; queryChunks?: unknown[] };
  if ("encoder" in anyNode && "value" in anyNode) {
    out.push(anyNode.value);
    return out;
  }
  if (Array.isArray(anyNode.queryChunks)) {
    for (const chunk of anyNode.queryChunks) collectParamValues(chunk, out, seen);
  }
  return out;
}

const HOUR = 60 * 60 * 1000;

function tokenRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 7,
    userId: "user-123",
    token: "tok-abc",
    expiresAt: new Date(Date.now() + HOUR),
    usedAt: null,
    createdAt: new Date(Date.now() - HOUR),
    ...overrides,
  };
}

beforeEach(() => {
  h.updateCalls.length = 0;
  h.selectWhereArgs.length = 0;
  h.selectForArgs.length = 0;
  h.state.rows = [];
  vi.mocked(db.transaction).mockClear();
  vi.mocked(db.execute).mockClear();
});

describe("executePasswordReset — token validation", () => {
  it("rejects an already-used token (usedAt set) without touching users or sessions", async () => {
    // Under the old raw-SQL fetch the row only had `used_at`, so this guard
    // never fired and a used-but-unexpired token passed validation.
    h.state.rows = [tokenRow({ usedAt: new Date(Date.now() - HOUR / 2) })];

    await expect(executePasswordReset("tok-abc", "new-hash")).rejects.toThrow("INVALID_TOKEN");

    expect(h.updateCalls).toHaveLength(0); // no password change, token not re-marked
    expect(db.execute).not.toHaveBeenCalled(); // no session eviction
  });

  it("rejects an expired token", async () => {
    h.state.rows = [tokenRow({ expiresAt: new Date(Date.now() - 1000) })];

    await expect(executePasswordReset("tok-abc", "new-hash")).rejects.toThrow("INVALID_TOKEN");

    expect(h.updateCalls).toHaveLength(0);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("rejects when no token row matches (unknown token, or locked row skipped)", async () => {
    h.state.rows = [];

    await expect(executePasswordReset("tok-abc", "new-hash")).rejects.toThrow("INVALID_TOKEN");

    expect(h.updateCalls).toHaveLength(0);
    expect(db.execute).not.toHaveBeenCalled();
  });
});

describe("executePasswordReset — successful reset", () => {
  it("updates the RIGHT user, marks the token used first, and destroys the user's sessions", async () => {
    const row = tokenRow();
    h.state.rows = [row];

    const result = await executePasswordReset("tok-abc", "new-hash");

    // The whole consume runs inside one transaction.
    expect(db.transaction).toHaveBeenCalledTimes(1);

    // Token lookup binds the SHA-256 of the presented token (tokens are stored
    // hashed at rest) and keeps FOR UPDATE SKIP LOCKED (single-use under concurrency).
    const expectedTokenHash = createHash("sha256").update("tok-abc").digest("hex");
    expect(collectParamValues(h.selectWhereArgs[0])).toContain(expectedTokenHash);
    expect(h.selectForArgs[0]).toEqual(["update", { skipLocked: true }]);

    // Two updates, in order: mark token used (prevents concurrent reuse),
    // THEN set the password hash.
    expect(h.updateCalls).toHaveLength(2);
    const [markUsed, setPassword] = h.updateCalls;

    expect(markUsed.table).toBe(passwordResetTokens);
    expect(markUsed.values.usedAt).toBeInstanceOf(Date);
    expect(collectParamValues(markUsed.where)).toContain(row.id);

    // The core of the regression: the users UPDATE must target the userId
    // from the (camelCase-mapped) row — previously undefined, so no rows matched.
    expect(setPassword.table).toBe(users);
    expect(setPassword.values).toEqual({ passwordHash: "new-hash" });
    expect(collectParamValues(setPassword.where)).toContain("user-123");

    // Session eviction ran with the real userId (previously undefined).
    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(collectParamValues(vi.mocked(db.execute).mock.calls[0][0])).toContain("user-123");

    // The handler audit-logs from the returned row, so it must be the mapped row.
    expect(result).toBe(row);
  });
});
