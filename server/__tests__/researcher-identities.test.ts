/**
 * The identity map caches for 30 minutes — but never an empty read, so the
 * first backfill after migration 030 shows on the next request.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({ rows: [] as any[], calls: 0, fail: false }));
vi.mock("../db", () => ({
  db: {
    execute: async () => {
      state.calls++;
      if (state.fail) throw new Error("db down");
      return { rows: state.rows };
    },
  },
  pool: { query: () => new Promise(() => {}) },
}));
vi.mock("../utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { getIdentity, getIdentityMap, __resetIdentitiesForTests } = await import("../services/researcher-identities");

beforeEach(() => {
  __resetIdentitiesForTests();
  state.rows = [];
  state.calls = 0;
  state.fail = false;
});

describe("getIdentityMap", () => {
  it("re-reads after an empty result, then caches a non-empty one", async () => {
    expect((await getIdentityMap()).size).toBe(0);
    state.rows = [{ author_key: "xuejun sun", openalex_author_id: "A1", display_name: "Xuejun Sun", orcid: "0000-0003-2387-5531", institution: "Second Military Medical University", institution_country: "CN", institution_ror: null, occurrences: 105, share: "0.981", updated_at: "2026-11-04T01:37:00Z" }];
    const id = await getIdentity("xuejun sun");
    expect(id).toMatchObject({ openalexAuthorId: "A1", orcid: "0000-0003-2387-5531", occurrences: 105, share: 0.981 });
    expect(state.calls).toBe(2);
    await getIdentityMap();
    expect(state.calls).toBe(2); // cached now
  });

  it("fails soft when the table is missing", async () => {
    state.fail = true;
    expect(await getIdentity("anyone")).toBeNull();
  });
});
