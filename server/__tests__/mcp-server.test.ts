/**
 * End-to-end MCP protocol test: the real /mcp router + SDK Client over
 * Streamable HTTP, with the database replaced by fixture rows (routed by the
 * SQL each query renders to).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { sql, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CORPUS_ROWS, CONDITION_ROWS, CONDITION_IDS, LONG_ABSTRACT } from "./fixtures/research-corpus";

const dialect = new PgDialect();

function route(text: string, params: unknown[]) {
  if (text.includes("study_quality_scores q WHERE q.study_id = s.id")) return CORPUS_ROWS;
  const cond = text.match(/cond_match_([a-z-]+)/);
  if (cond) return (CONDITION_IDS[cond[1]] ?? []).map((id) => ({ id }));
  if (text.includes("ts_rank")) {
    // params: one per-term hit check each, then the OR query, then minHits.
    const words = (params.filter((p) => typeof p === "string") as string[]).filter((p) => !p.includes(" | "));
    const minHits = params[params.length - 1] as number;
    return CORPUS_ROWS.map((r) => ({ id: r.id, hits: words.filter((w) => r.title.toLowerCase().includes(w)).length, rank: 0.5 }))
      .filter((r) => r.hits >= minHits);
  }
  if (text.includes("row_to_json")) {
    const target = CORPUS_ROWS.find((r) => params.includes(r.id) || params.includes(r.slug)) ?? null;
    return target
      ? [{ ...target, plain_language_title: null, authors: "Ito M, et al.", url: null, body_systems: [], mechanisms: [], tldr: "t",
          plain_summary: "Our summary.", practical_takeaway: null, h2_concentration: "1.6 ppm", dosage_protocol: "1 L/day",
          limitations: "Small n.", citation_count: 3, abstract: LONG_ABSTRACT, conclusion: "It worked.", full_text: null,
          quality: { overall_score: target.quality_score, methodology_score: 70, impact_score: 60, relevance_score: 90,
                     sample_size_score: 50, red_flags: ["single-centre"], score_confidence: "high" } }]
      : [];
  }
  if (text.includes("study_citations")) return [];
  throw new Error(`unrouted SQL in test: ${text.slice(0, 120)}`);
}

vi.mock("../db", () => ({
  db: {
    execute: vi.fn(async (q: SQL) => {
      const { sql: text, params } = dialect.sqlToQuery(q);
      return { rows: route(text, params) };
    }),
  },
}));
vi.mock("../middleware/seo-body-renderer", () => ({
  getConditionRows: vi.fn(async () => CONDITION_ROWS),
  conditionHubWhere: vi.fn((row: { slug: string }) => sql.raw(`cond_match_${row.slug}`)),
}));
vi.mock("../services/public-study-stats", () => ({
  getPublicStudyStats: vi.fn(async () => ({ totalStudies: 6, humanTrials: 3, healthConditions: 2 })),
}));
vi.mock("../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { mcpPublicRouter } = await import("../mcp/http");

let server: Server;
let base: string;
let client: Client;
const transcript: string[] = [];

async function call(name: string, args: Record<string, unknown> = {}) {
  const res = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: Array<{ text: string }> };
  const text = res.content[0].text;
  transcript.push(text);
  return { isError: !!res.isError, text, data: res.isError ? null : JSON.parse(text) };
}

beforeAll(async () => {
  const app = express();
  app.use("/mcp", mcpPublicRouter());
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
});

afterAll(async () => {
  await client.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("public MCP server", () => {
  it("initializes with instructions that carry the funding disclosure", () => {
    expect(client.getServerVersion()?.name).toBe("hydrogen-studies");
    expect(client.getInstructions()).toMatch(/funded by Echo Technologies/);
  });

  it("lists exactly the read-only public tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "aggregate_studies", "compare_evidence", "find_related_studies", "get_condition_evidence",
      "get_database_stats", "get_study", "list_conditions", "search_studies",
    ]);
    expect(tools.every((t) => t.annotations?.readOnlyHint === true)).toBe(true);
  });

  it("search_studies filters by condition + subject and links our pages", async () => {
    const { data } = await call("search_studies", { condition: "blood pressure", subject: "human" });
    expect(data.total_matches).toBe(2);
    expect(data.condition_hub).toMatchObject({ slug: "blood-pressure", url: "https://hydrogenstudies.com/explore-by-condition/blood-pressure" });
    expect(data.studies.map((s: any) => s.id)).toEqual([1, 2]);
    expect(data.studies[0].url).toBe("https://hydrogenstudies.com/study/h2-water-bp-rct");
  });

  it("search_studies ranks full-text matches and paginates", async () => {
    const { data } = await call("search_studies", { query: "fatigue", limit: 1 });
    expect(data.total_matches).toBe(1);
    expect(data.studies[0].id).toBe(6);
  });

  it("get_study returns a ≤300-char abstract excerpt, never the abstract", async () => {
    const { data } = await call("get_study", { study: "https://hydrogenstudies.com/study/h2-water-bp-rct" });
    expect(data.id).toBe(1);
    expect(data.abstract_excerpt.length).toBeLessThanOrEqual(300);
    expect(data).not.toHaveProperty("abstract");
    expect(data).not.toHaveProperty("conclusion");
    expect(data).not.toHaveProperty("full_text");
    expect(data.quality).toMatchObject({ overall: 82, red_flags: ["single-centre"] });
  });

  it("get_study reports a miss as a tool error", async () => {
    const res = await call("get_study", { study: "no-such-study" });
    expect(res.isError).toBe(true);
  });

  it("get_condition_evidence profiles a hub and rejects non-hubs", async () => {
    const { data } = await call("get_condition_evidence", { condition: "blood-pressure" });
    expect(data.profile.total_studies).toBe(4);
    expect(data.profile.human_evidence).toMatchObject({ studies: 2, randomized_controlled_trials: 1, total_participants_reported: 60 });
    expect((await call("get_condition_evidence", { condition: "glaucoma" })).isError).toBe(true);
  });

  it("compare_evidence merges shared filters into each group", async () => {
    const { data } = await call("compare_evidence", {
      shared: { condition: "blood-pressure" },
      groups: [
        { label: "Drinking", delivery_method: "drinking_water" },
        { label: "Inhalation", delivery_method: "inhalation" },
      ],
    });
    expect(data.groups.map((g: any) => [g.label, g.profile.total_studies])).toEqual([["Drinking", 1], ["Inhalation", 2]]);
    expect(data.groups[1].profile.by_subject).toEqual({ human: 1, animal: 1 });
  });

  it("aggregate_studies groups and counts unknowns", async () => {
    const { data } = await call("aggregate_studies", { group_by: "subject" });
    expect(data.buckets).toEqual([
      { value: "human", count: 3 }, { value: "animal", count: 1 }, { value: "in_vitro", count: 1 }, { value: "review", count: 1 },
    ]);
  });

  it("list_conditions, get_database_stats and find_related_studies work", async () => {
    expect((await call("list_conditions")).data.conditions[0]).toMatchObject({ slug: "blood-pressure", studies: 4 });
    const stats = (await call("get_database_stats")).data;
    expect(stats.total_studies).toBe(6);
    expect(stats).not.toHaveProperty("strongest_studies");
    const related = (await call("find_related_studies", { study: "1" })).data;
    expect(related.similar_by_condition.map((s: any) => s.id)).toEqual([2, 3, 5]);
  });

  it("serves the about resource and the evidence_review prompt", async () => {
    const about = await client.readResource({ uri: "hydrogenstudies://about" });
    expect((about.contents[0] as { text: string }).text).toMatch(/Funding disclosure/);
    const prompt = await client.getPrompt({ name: "evidence_review", arguments: { topic: "blood pressure" } });
    expect(JSON.stringify(prompt.messages)).toMatch(/blood pressure/);
  });

  it("never emits echowater / product links in tool output", () => {
    expect(transcript.length).toBeGreaterThan(5);
    expect(transcript.join("\n")).not.toMatch(/echowater\.com|utm_source/i);
  });
});

describe("HTTP surface", () => {
  it("answers CORS preflight and rejects GET in stateless mode", async () => {
    const pre = await fetch(`${base}/mcp`, { method: "OPTIONS" });
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-origin")).toBe("*");
    const get = await fetch(`${base}/mcp`);
    expect(get.status).toBe(405);
  });
});
