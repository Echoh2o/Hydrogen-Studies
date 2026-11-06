/**
 * TRUST-BADGE-PLAN Phase 3: retrieval-only answers with enforced citations,
 * medical refusals, support routing, Appendix E redirect on echowater.com.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/research-query", () => ({
  findStudies: async (f: { query: string }) => ({
    studies: /recovery|athlete|exercise/i.test(f.query)
      ? [{ id: 11, title: "H2 water and recovery in athletes", year: 2021 }, { id: 12, title: "H2 water and lactate", year: 2019 }]
      : [],
  }),
  studyCard: (s: any) => ({ id: s.id, title: s.title, url: `https://hydrogenstudies.com/study/${s.id}`, year: s.year, design: "rct", subject: "human", outcome: "positive", key_finding: "lower lactate", sample_size: 20 }),
}));
vi.mock("../db", () => ({ db: { execute: async () => ({ rows: [{ n: 0 }] }) } }));
vi.mock("../utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { askResearch, classifyIntent, mentionsProhibitedTopic, validateAnswer } from "../services/ask-research";
import { ASK } from "../../shared/evidence-badge-copy";

describe("intent routing (mini eval set)", () => {
  it.each([
    ["Should I take hydrogen water instead of my medication?", "medical"],
    ["I have type 2 diabetes, can hydrogen help?", "medical"],
    ["What dose for my arthritis?", "medical"],
    ["Is it safe while pregnant?", "medical"],
    ["Where is my order?", "product_support"],
    ["My Flask won't charge", "product_support"],
    ["How do I clean the Flask?", "product_support"],
    ["What's the warranty on the H2 machine?", "product_support"],
    ["Does hydrogen water help exercise recovery?", "research"],
    ["What do studies say about hydrogen and sleep?", "research"],
    ["How much hydrogen did the trials use?", "research"],
  ])("%s → %s", (q, intent) => {
    expect(classifyIntent(q)).toBe(intent);
  });
  it("flags disease topics for the store redirect", () => {
    expect(mentionsProhibitedTopic("hydrogen water and cancer")).toBe(true);
    expect(mentionsProhibitedTopic("does it help with inflammation")).toBe(true);
    expect(mentionsProhibitedTopic("athletic recovery")).toBe(false);
  });
});

describe("validateAnswer", () => {
  const ids = new Set([11, 12]);
  it("accepts number-free hedge sentences and grouped citations", () => {
    expect(validateAnswer("A trial in 20 athletes found lower lactate [study:11, study:12]. However, these are small studies.", ids).ok).toBe(true);
    expect(validateAnswer("Several trials found lower lactate. A trial in 20 athletes found less soreness [study:11].", ids).ok).toBe(true);
    expect(validateAnswer("A trial in 20 athletes found lower lactate. More research is needed [study:11].", ids).ok).toBe(false);
  });
  it("rejects disease topics in answers on the store only", () => {
    const a = "A small trial in patients with diabetes found lower glucose [study:11].";
    expect(validateAnswer(a, ids, "echowater").ok).toBe(false);
    expect(validateAnswer(a, ids, "hydrogenstudies").ok).toBe(true);
  });
  it("accepts fully cited answers", () => {
    expect(validateAnswer("A small trial in 20 athletes found lower lactate [study:11]. Another found no change [study:12].", ids).ok).toBe(true);
  });
  it("rejects uncited sentences, unknown IDs, advice, products and forbidden words", () => {
    expect(validateAnswer("Hydrogen helps recovery 20%.", ids).ok).toBe(false);
    expect(validateAnswer("It helped [study:99].", ids).ok).toBe(false);
    expect(validateAnswer("You should drink it daily [study:11].", ids).ok).toBe(false);
    expect(validateAnswer("The Echo Flask helps [study:11].", ids).ok).toBe(false);
    expect(validateAnswer("This is proven [study:11].", ids).ok).toBe(false);
  });
});

describe("askResearch", () => {
  it("refuses medical questions without calling the model", async () => {
    const gen = vi.fn();
    const r = await askResearch("I have diabetes, should I take it?", "hydrogenstudies", { generate: gen });
    expect(r.status).toBe("refused_medical");
    expect(r.answer).toBe(ASK.medical);
    expect(gen).not.toHaveBeenCalled();
  });
  it("redirects disease topics on echowater.com but answers research on hydrogenstudies.com", async () => {
    const gen = vi.fn(async () => ({ answer: "Nothing here.", evidence_strength: "none" }));
    expect((await askResearch("hydrogen and cancer research", "echowater", { generate: gen })).status).toBe("redirected_disease");
  });
  it("says so when nothing is found", async () => {
    expect((await askResearch("hydrogen and astrophysics", "hydrogenstudies")).status).toBe("no_evidence");
  });
  it("returns a cited answer, retries once on a rule break, then falls back to the study list", async () => {
    const good = vi.fn(async () => ({ answer: "A small trial in athletes found lower lactate [study:11].", evidence_strength: "weak" }));
    const r = await askResearch("does hydrogen help exercise recovery", "echowater", { generate: good });
    expect(r.status).toBe("answered");
    expect(r.answer.startsWith(ASK.weakPrefix)).toBe(true);
    expect(r.citations.map((c) => c.id)).toEqual([11]);
    const bad = vi.fn(async () => ({ answer: "Hydrogen is proven to help.", evidence_strength: "moderate" }));
    const f = await askResearch("does hydrogen help exercise recovery", "hydrogenstudies", { generate: bad });
    expect(bad).toHaveBeenCalledTimes(2);
    expect(f.status).toBe("fallback");
    expect(f.answer).toBe(ASK.fallback);
  });
});

describe("POST /api/ask", async () => {
  const express = (await import("express")).default;
  const request = (await import("supertest")).default;
  const { default: routes, scrubPII } = await import("../routes/ask-routes");
  const app = express();
  app.use(express.json());
  app.use(routes);
  beforeEach(() => { delete process.env.ASK_ENABLED; });
  it("is off unless ASK_ENABLED=true", async () => {
    expect((await request(app).post("/api/ask").send({ question: "does hydrogen help exercise recovery" })).status).toBe(503);
  });
  it("answers when enabled and only reflects allowed origins", async () => {
    process.env.ASK_ENABLED = "true";
    const r = await request(app).post("/api/ask").set("Origin", "https://echowater.com").send({ question: "where is my order", site: "echowater" });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("support");
    expect(r.headers["access-control-allow-origin"]).toBe("https://echowater.com");
    const evil = await request(app).post("/api/ask").set("Origin", "https://evil.example").send({ question: "where is my order" });
    expect(evil.headers["access-control-allow-origin"]).toBeUndefined();
  });
  it("scrubs emails and phone numbers before logging", () => {
    expect(scrubPII("email me at a.b@x.com or +1 (555) 123-4567")).toBe("email me at [email] or [number]");
  });
});
