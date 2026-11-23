/**
 * /learn/health-benefits (audit 2026-11-22): the cards showed "0 studies"
 * because /api/consumer-categories/counts mapped to retired `category`
 * values, and "View Studies" linked empty /studies?category=… pages. Counts
 * and links now use the /explore-by-body-system/* hubs. Mocked-db unit test.
 */
import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs";
import path from "path";
import { PgDialect } from "drizzle-orm/pg-core";
import { BODY_SYSTEM_HUBS, bodySystemLikePatterns } from "../../shared/explore-hubs";

const HUB_N: Record<string, number> = { cardiovascular: 412, "skin-dermatology": 37 };

vi.mock("../db", () => {
  const dialect = new PgDialect();
  return {
    db: {
      execute: async (q: any) => {
        const { sql, params } = dialect.sqlToQuery(q);
        if (/COUNT\(\*\)::int AS n/i.test(sql)) {
          const hub = BODY_SYSTEM_HUBS.find((h) =>
            bodySystemLikePatterns(h.slug).every((p) => params.includes(p)),
          );
          return { rows: [{ n: HUB_N[hub?.slug ?? ""] ?? 0 }] };
        }
        return { rows: [] };
      },
    },
    pool: { query: async () => ({ rows: [] }) },
  };
});
vi.mock("../auth", () => ({ requireAdmin: (_q: any, _s: any, n: any) => n() }));

const { default: routes, CONSUMER_CATEGORY_HUB } = await import("../routes/consumer-categories-routes");
const hubSlugs = new Set(BODY_SYSTEM_HUBS.map((h) => h.slug));

describe("consumer category → body-system hub mapping", () => {
  it("every mapped hub is a canonical /explore-by-body-system hub", () => {
    for (const slug of Object.values(CONSUMER_CATEGORY_HUB)) expect(hubSlugs.has(slug), slug).toBe(true);
  });

  it("/counts reports hub-matched counts", async () => {
    const app = express().use("/api/consumer-categories", routes);
    const res = await request(app).get("/api/consumer-categories/counts");
    expect(res.status).toBe(200);
    expect(res.body.data.body_system_hubs.cardiovascular).toBe(412);
    expect(res.body.data.body_system_hubs["skin-dermatology"]).toBe(37);
    const heart = res.body.data.condition.find((c: any) => c.name === "Heart Disease & Hypertension");
    expect(heart.count).toBe("412");
    const skin = res.body.data.body_system.find((c: any) => c.name === "Integumentary System");
    expect(skin.count).toBe("37");
  });
});

describe("HealthBenefitsContent links", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../../client/src/pages/content/HealthBenefitsContent.tsx"),
    "utf8",
  );
  it("no card links an empty /studies?category= filter", () => {
    expect(src).not.toMatch(/\/studies\?category=/);
  });
  it("every card hub slug is a canonical body-system hub", () => {
    const slugs = [...src.matchAll(/hubSlug: "([^"]+)"/g)].map((m) => m[1]);
    expect(slugs).toHaveLength(6);
    for (const s of slugs) expect(hubSlugs.has(s), s).toBe(true);
  });
});
