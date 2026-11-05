/**
 * TRUST-BADGE-PLAN 0.8: reviewer can approve, unapprove and correct evidence
 * fields; every action is logged and invalidates the public evidence numbers.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { PgDialect } from "drizzle-orm/pg-core";

const dialect = new PgDialect();
const calls: string[] = [];
const invalidate = vi.fn();
vi.mock("../auth", () => ({ requireAdmin: (_req: any, _res: any, next: any) => next() }));
vi.mock("../services/evidence-stats", () => ({ invalidateEvidenceStats: () => invalidate() }));
vi.mock("../utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("../db", () => ({
  db: {
    execute: async (q: any) => {
      const text = dialect.sqlToQuery(q).sql;
      calls.push(text);
      if (/FROM users/.test(text)) return { rows: [{ who: "sarah" }] };
      if (/^\s*UPDATE studies SET evidence_fields_status/.test(text)) return { rows: [{ id: 7 }] };
      if (/^\s*SELECT effect_direction FROM studies/.test(text)) return { rows: [{ effect_direction: "improved" }] };
      if (/GROUP BY 1/.test(text)) return { rows: [{ status: "auto_approved", n: 327 }] };
      return { rows: [] };
    },
  },
}));

const { default: routes } = await import("../routes/admin-evidence-routes");
const app = express();
app.use(express.json());
app.use((req: any, _res, next) => { req.session = { userId: "u1" }; next(); });
app.use("/api/admin/evidence-fields", routes);

beforeEach(() => { calls.length = 0; invalidate.mockClear(); });

describe("admin evidence review API", () => {
  it("lists with counts", async () => {
    const r = await request(app).get("/api/admin/evidence-fields?status=auto_approved");
    expect(r.status).toBe(200);
    expect(r.body.counts).toEqual({ auto_approved: 327 });
  });

  it("unapprove sets status, logs the actor, invalidates public numbers", async () => {
    const r = await request(app).post("/api/admin/evidence-fields/7/unapprove");
    expect(r.status).toBe(200);
    expect(calls.some((c) => /evidence_fields_status = \$1/.test(c))).toBe(true);
    expect(calls.some((c) => /INSERT INTO evidence_field_changes/.test(c))).toBe(true);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("correction validates the value and counts as approval", async () => {
    expect((await request(app).patch("/api/admin/evidence-fields/7").send({ effect_direction: "amazing" })).status).toBe(400);
    const ok = await request(app).patch("/api/admin/evidence-fields/7").send({ effect_direction: "no_clear_effect" });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe("approved");
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("rejects a bad id and an out-of-range concentration", async () => {
    expect((await request(app).post("/api/admin/evidence-fields/abc/approve")).status).toBe(400);
    expect((await request(app).patch("/api/admin/evidence-fields/7").send({ h2_concentration_ppm: 999 })).status).toBe(400);
  });
});
