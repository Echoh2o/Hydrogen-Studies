/**
 * Excluded (off-topic hydrogen-energy) studies — the 410 guard (services/excluded-studies.ts).
 *
 * Mocked-db unit tests: the excluded set comes from
 * `SELECT id, slug FROM studies WHERE is_excluded = true` (db.execute).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const excludedRows = vi.hoisted(() => ({
  current: [
    { id: 4298, slug: "hydrogen-producing-facultative-anaerobic-bacteria-isolated-from-kitchen-wastewater-for-sustainable-bioenergy-applications-1788216910213" },
    { id: 3592, slug: "rational-comparison-of-biohydrogen-production-1775650467180" },
  ] as Array<{ id: number; slug: string | null }>,
}));
const executeSpy = vi.hoisted(() => vi.fn());

vi.mock("../db", () => ({
  db: {
    execute: (...args: any[]) => {
      executeSpy(...args);
      return excludedRows.current
        ? Promise.resolve({ rows: excludedRows.current })
        : Promise.reject(new Error('column "is_excluded" does not exist'));
    },
  },
}));

const {
  parseStudyPath,
  isExcludedStudyPath,
  excludedStudyGoneMiddleware,
  invalidateExcludedStudies,
} = await import("../services/excluded-studies");

const ENERGY_SLUG = excludedRows.current[0].slug!;

function makeApp() {
  const app = express();
  app.use(excludedStudyGoneMiddleware());
  app.get("*", (_req, res) => res.status(200).send("SPA or page"));
  app.post("*", (_req, res) => res.status(200).send("posted"));
  return app;
}

describe("parseStudyPath", () => {
  it("recognizes every public study URL form", () => {
    expect(parseStudyPath(`/study/${ENERGY_SLUG}`)).toEqual({ kind: "slug", slug: ENERGY_SLUG });
    expect(parseStudyPath(`/studies/${ENERGY_SLUG}`)).toEqual({ kind: "slug", slug: ENERGY_SLUG });
    expect(parseStudyPath(`/proxy/study/${ENERGY_SLUG}`)).toEqual({ kind: "slug", slug: ENERGY_SLUG });
    expect(parseStudyPath("/study/id/4298")).toEqual({ kind: "id", id: 4298 });
    expect(parseStudyPath("/study/id%2F4298")).toEqual({ kind: "id", id: 4298 });
    expect(parseStudyPath("/study/4298")).toEqual({ kind: "id", id: 4298 });
    expect(parseStudyPath(`/Study/${ENERGY_SLUG.toUpperCase()}/`)).toEqual({ kind: "slug", slug: ENERGY_SLUG });
  });

  it("ignores non-study paths", () => {
    expect(parseStudyPath("/studies")).toBeNull();
    expect(parseStudyPath("/studies/tags")).toBeNull();
    expect(parseStudyPath("/blog/some-post")).toBeNull();
    expect(parseStudyPath("/api/studies/4298")).toBeNull();
    expect(parseStudyPath("/study/a/b")).toBeNull();
  });
});

describe("excludedStudyGoneMiddleware", () => {
  beforeEach(() => {
    invalidateExcludedStudies();
    executeSpy.mockClear();
  });

  it.each([
    `/study/${ENERGY_SLUG}`,
    `/studies/${ENERGY_SLUG}`,
    `/proxy/study/${ENERGY_SLUG}`,
    "/study/id/4298",
    "/study/4298",
  ])("answers 410 Gone for %s", async (path) => {
    const res = await request(makeApp()).get(path);
    expect(res.status).toBe(410);
    expect(res.text).toContain("410 Gone");
  });

  it("serves bots and browsers the identical 410 (no user-agent branching)", async () => {
    const path = `/study/${ENERGY_SLUG}`;
    const browser = await request(makeApp()).get(path).set("User-Agent", "Mozilla/5.0 (Macintosh)");
    const bot = await request(makeApp())
      .get(path)
      .set("User-Agent", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)");
    expect(browser.status).toBe(410);
    expect(bot.status).toBe(410);
    expect(bot.text).toBe(browser.text);
  });

  it("passes live studies and non-GET requests through", async () => {
    expect((await request(makeApp()).get("/study/hydrogen-rich-water-and-sleep-1")).status).toBe(200);
    expect((await request(makeApp()).get("/study/12")).status).toBe(200);
    expect((await request(makeApp()).post(`/study/${ENERGY_SLUG}`)).status).toBe(200);
    expect((await request(makeApp()).get("/studies")).status).toBe(200);
  });

  it("caches the excluded set (one query, not one per request)", async () => {
    const app = makeApp();
    await request(app).get(`/study/${ENERGY_SLUG}`);
    await request(app).get("/study/id/3592");
    await request(app).get("/study/some-live-study");
    expect(executeSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps the last known set when a reload fails (never 500s, never blocks live pages)", async () => {
    await isExcludedStudyPath(`/study/${ENERGY_SLUG}`); // warm the cache
    const saved = excludedRows.current;
    excludedRows.current = null as any; // next load rejects
    invalidateExcludedStudies();
    expect(await isExcludedStudyPath(`/study/${ENERGY_SLUG}`)).toBe(true);
    expect(await isExcludedStudyPath("/study/hydrogen-rich-water-1")).toBe(false);
    const res = await request(makeApp()).get("/study/hydrogen-rich-water-1");
    expect(res.status).toBe(200);
    excludedRows.current = saved;
  });
});
