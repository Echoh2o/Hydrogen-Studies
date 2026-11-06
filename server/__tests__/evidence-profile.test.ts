/**
 * TRUST-BADGE-PLAN Phase 1: matching rules, copy guardrails, public API.
 */
import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { doseMatch, topicMatch, isClaimTopic, doseMatchRuleText, type EvidenceStudyRow } from "../../shared/evidence-match";
import { BADGE, PROFILE, CLAIM_WIDGET, FORBIDDEN_COPY, mixPhrase } from "../../shared/evidence-badge-copy";

const row = (o: Partial<EvidenceStudyRow>): EvidenceStudyRow => ({
  id: 1, slug: "s", title: "t", publishYear: 2020, pmid: "12345678", doi: null, studyDesign: "rct", sampleSize: 20, durationDays: 28,
  deliveryRoute: "drinking_water", concentrationPpm: 1.6, concentrationKind: "stated", populationKind: "healthy", effectDirection: "improved",
  fundingCategory: "public", fundedByEcho: false, usedEchoDevice: false, healthConditions: [], ...o,
});
const rows = [
  row({ id: 1, concentrationPpm: 1.6 }),
  row({ id: 2, concentrationPpm: 8.25, effectDirection: "no_clear_effect" }),
  row({ id: 3, concentrationPpm: 10, effectDirection: "improved" }),
  row({ id: 4, concentrationPpm: null }),
  row({ id: 5, deliveryRoute: "inhaled_gas", concentrationPpm: null }),
  row({ id: 6, populationKind: "patients", healthConditions: ["Athletic Performance"], concentrationPpm: 1 }),
  row({ id: 7, healthConditions: ["Athletic Performance"], effectDirection: "mixed", concentrationPpm: 0.8 }),
];
const flask = { slug: "echo-flask", name: "Echo Flask", deliveryRoute: "drinking_water", certifiedConcentrationPpm: 8.25 };

describe("dose match (rule v1)", () => {
  const d = doseMatch(rows, flask);
  it("counts with denominators; ≤ ceiling inclusive; unreported counted separately; gas excluded", () => {
    expect(d.humanStudies).toBe(7);
    expect(d.drinkingStudies).toBe(6);
    expect(d.withConcentration).toBe(5);
    expect(d.notReported).toBe(1);
    expect(d.matched.map((r) => r.id).sort()).toEqual([1, 2, 6, 7]);
    expect(d.mix).toMatchObject({ improved: 2, no_clear_effect: 1, mixed: 1 });
  });
  it("rule text names the lab-measured ceiling and is reproducible", () => {
    expect(doseMatchRuleText(flask)).toMatch(/8\.25 mg\/L/);
    expect(doseMatchRuleText(flask)).toMatch(/counted separately, never matched/);
  });
});

describe("claim topics (Appendix E)", () => {
  it("only allowed topics exist; patients excluded", () => {
    expect(isClaimTopic("athletic-performance")).toBe(true);
    expect(isClaimTopic("diabetes")).toBe(false);
    expect(topicMatch(rows, "athletic-performance").studies.map((r) => r.id)).toEqual([7]);
  });
});

describe("copy guardrails", () => {
  const d = doseMatch(rows, flask);
  const all = [BADGE.line1(d), BADGE.line2(d, "8.3 ppm"), BADGE.source, PROFILE.summary(d, "Echo Flask", "8.3 ppm"), PROFILE.echoDevice(d), PROFILE.echoFunding(d), PROFILE.disclosure, CLAIM_WIDGET.line(4, d.mix)].join(" | ");
  it("contains no forbidden words", () => {
    for (const re of FORBIDDEN_COPY) expect(all).not.toMatch(re);
  });
  it("never implies the studies tested Echo products when none did", () => {
    expect(PROFILE.echoDevice(d)).toMatch(/None of these studies tested an Echo product/);
    expect(all).not.toMatch(/studies (?:of|on|tested) (?:the )?Echo/i);
  });
  it("every count travels with its outcome mix", () => {
    expect(mixPhrase(d.mix)).toMatch(/improved their main outcome.*no clear effect.*mixed/);
    expect(CLAIM_WIDGET.line(4, d.mix)).not.toMatch(/\bshow/i);
  });
});

vi.mock("../services/evidence-profile", () => {
  const profile = (enabled: boolean) => ({
    product: { slug: "echo-flask", name: "Echo Flask", deliveryRoute: "drinking_water", certifiedConcentrationPpm: 8.25, lab: "H2 Analytics (Las Vegas)", reportId: "H2AR-250116-1", testDate: "2025-01-16", measuredSummary: "8.25 mg/L after 20 minutes", reportUrl: "https://x", badgeEnabled: enabled },
    match: doseMatch(rows, flask), version: "abc", generatedAt: "2026-11-05T00:00:00Z",
  });
  return {
    getEvidenceProfile: async (slug: string) => (slug === "echo-flask" ? profile(true) : slug === "echo-off" ? profile(false) : null),
    getTopicEvidence: async (topic: string) => (isClaimTopic(topic) ? { topic, count: 1, mix: topicMatch(rows, topic).mix, studies: topicMatch(rows, topic).studies, version: "abc" } : null),
  };
});
vi.mock("../utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

describe("public evidence API", async () => {
  const { default: routes } = await import("../routes/evidence-profile-routes");
  const app = express();
  app.use(routes);
  it("serves JSON with CORS * for an enabled product; 404 when the badge is off or unknown", async () => {
    const ok = await request(app).get("/api/evidence/echo-flask");
    expect(ok.status).toBe(200);
    expect(ok.headers["access-control-allow-origin"]).toBe("*");
    expect(ok.body.counts.matched).toBe(4);
    expect(ok.body.matched[0].source).toMatch(/pubmed/);
    expect(ok.body.copy.echoDevice).toMatch(/None of these studies tested an Echo product/);
    expect((await request(app).get("/api/evidence/echo-off")).status).toBe(404);
    expect((await request(app).get("/api/evidence/nope")).status).toBe(404);
  });
  it("topic endpoint refuses non-Appendix-E topics", async () => {
    expect((await request(app).get("/api/evidence/echo-flask/topic/athletic-performance")).status).toBe(200);
    expect((await request(app).get("/api/evidence/echo-flask/topic/diabetes")).status).toBe(404);
  });
  it("SVG badge is immutable when versioned", async () => {
    const r = await request(app).get("/badge/echo-flask.svg?v=abc").buffer(true).parse((res, cb) => { let d = ""; res.on("data", (c: Buffer) => (d += c.toString())); res.on("end", () => cb(null, d)); });
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/svg/);
    expect(r.headers["cache-control"]).toMatch(/immutable/);
    expect(String(r.body)).toContain("used drinking water at");
  });
});
