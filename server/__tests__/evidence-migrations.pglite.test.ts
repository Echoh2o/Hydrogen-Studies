/**
 * Migrations 031 (study approvals + trigger) and 032 (evidence fields +
 * products seed) run against REAL Postgres (PGlite) — boot migrations are
 * fatal on error, so prove they apply cleanly and are idempotent.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { sql } from "drizzle-orm";

vi.mock("../db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite();
  return { db: drizzle(client), pool: { query: (t: string, p?: unknown[]) => client.query(t, p), on: () => {}, end: () => client.close() } };
});

const { db } = (await import("../db")) as unknown as { db: import("drizzle-orm/pglite").PgliteDatabase };
const { addStudyApprovals } = await import("../migrations/add-study-approvals");
const { addEvidenceFieldsAndProducts } = await import("../migrations/add-evidence-fields-and-products");

async function rows(q: string): Promise<any[]> {
  const r: any = await db.execute(sql.raw(q));
  return r.rows ?? r;
}

beforeAll(async () => {
  await rows(`CREATE TABLE studies (id SERIAL PRIMARY KEY, title TEXT, created_at TIMESTAMP DEFAULT NOW(), is_excluded BOOLEAN DEFAULT false)`);
  await rows(`INSERT INTO studies (title, created_at) VALUES ('a', '2026-04-08'), ('b', '2026-10-30')`);
  for (let i = 0; i < 2; i++) {
    await addStudyApprovals();
    await addEvidenceFieldsAndProducts();
  }
});

describe("migration 031 study_approvals", () => {
  it("backfills one approval per existing study, once, dated created_at", async () => {
    const r = await rows(`SELECT study_id, method, approved_at::date::text AS d FROM study_approvals ORDER BY study_id`);
    expect(r).toEqual([
      { study_id: 1, method: "backfill", d: "2026-04-08" },
      { study_id: 2, method: "backfill", d: "2026-10-30" },
    ]);
  });
  it("records an 'import' approval for every new study via the trigger", async () => {
    await rows(`INSERT INTO studies (title) VALUES ('c')`);
    const r = await rows(`SELECT method, reviewer_name FROM study_approvals WHERE study_id = 3`);
    expect(r).toEqual([{ method: "import", reviewer_name: "Sarah Taylor-Laine" }]);
  });
});

describe("migration 032 evidence fields + products", () => {
  it("adds the evidence columns to studies", async () => {
    const cols = (await rows(`SELECT column_name FROM information_schema.columns WHERE table_name = 'studies'`)).map((c) => c.column_name);
    for (const c of ["h2_concentration_ppm", "effect_direction", "funded_by_echo", "used_echo_device", "evidence_fields_status"]) expect(cols).toContain(c);
  });
  it("seeds products from the lab reports once; no badge enabled yet", async () => {
    const p = await rows(`SELECT slug, certified_concentration_ppm::float AS ppm, report_id, status, badge_enabled FROM products ORDER BY slug`);
    expect(p).toHaveLength(10);
    const flask = p.find((x) => x.slug === "echo-flask");
    expect(flask).toMatchObject({ ppm: 8.25, report_id: "H2AR-250116-1", status: "on_sale", badge_enabled: false });
    expect(p.filter((x) => x.status === "in_development").map((x) => x.slug).sort()).toEqual(["echo-forty", "echo-one"]);
    expect(p.every((x) => x.badge_enabled === false)).toBe(true);
    expect((await rows(`SELECT count(*)::int AS n FROM product_measurements`))[0].n).toBe(4);
  });
});
