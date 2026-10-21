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
const citationSql: string[] = [];

const usageRows: unknown[][] = [];

function route(text: string, params: unknown[]) {
  if (text.includes("INSERT INTO mcp_calls")) {
    usageRows.push(params);
    return [];
  }
  if (text.includes("FROM study_embeddings")) return []; // no vectors → keyword-only path
  if (text.includes("study_quality_scores q WHERE q.study_id = s.id")) return CORPUS_ROWS;
  const cond = text.match(/cond_match_([a-z-]+)/);
  if (cond) return (CONDITION_IDS[cond[1]] ?? []).map((id) => ({ id }));
  if (text.includes("AS df0")) {
    // document frequency per term (params: one term each)
    const row: Record<string, number> = { total: CORPUS_ROWS.length };
    params.forEach((w, i) => (row[`df${i}`] = CORPUS_ROWS.filter((r) => r.title.toLowerCase().includes(String(w))).length));
    return [row];
  }
  if (text.includes("ts_rank")) {
    // params: (term, weight) per scored term, the OR query, then the min score.
    const pairs: Array<[string, number]> = [];
    for (let i = 0; i + 1 < params.length - 2; i += 2) pairs.push([String(params[i]), Number(params[i + 1])]);
    const minScore = Number(params[params.length - 1]);
    return CORPUS_ROWS.map((r) => ({
      id: r.id,
      score: pairs.reduce((a, [w, wt]) => a + (r.title.toLowerCase().includes(w) ? wt : 0), 0),
      rank: 0.5,
    })).filter((r) => r.score >= minScore);
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
  if (text.includes("study_citations")) {
    citationSql.push(text);
    // #999 is an internal study missing from the live corpus (e.g. excluded) — must never surface.
    return [
      { direction: "cites", to_study_id: 999, to_doi: "10.1000/excluded", to_title: "Excluded retracted paper" },
      { direction: "cited_by", to_study_id: null, to_doi: "10.1000/ext", to_title: "External citing paper" },
      { direction: "cites", to_study_id: 2, to_doi: null, to_title: null },
    ];
  }
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
const generateText = vi.fn(async () => "Bottom line: small human trials suggest a modest effect [1][2].");
const generateJSON = vi.fn(async () => ({ topic_scope: "BP", evidence_strength_rating: 4, research_gaps: ["larger RCTs"] }));
vi.mock("../services/ai-provider", () => ({
  ai: { generateText, generateJSON },
  MODELS: { SONNET: "claude-sonnet-4-6", OPUS: "claude-opus-4-8", HAIKU: "claude-haiku-4-5" },
}));

const ADMIN_KEY = "test-admin-key-0123456789abcdef";
process.env.MCP_ADMIN_KEYS = `another-key-that-is-long-enough-xx, ${ADMIN_KEY}`;
const { mcpPublicRouter, mcpAdminRouter } = await import("../mcp/http");

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
  app.use("/mcp/admin", mcpAdminRouter());
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
    expect(data.studies[0].citation).toBe("Ito et al., 2021, J Hypertension");
  });

  it("search_studies notes and boosts a condition hub the query names", async () => {
    const { data } = await call("search_studies", { query: "hydrogen lowers blood pressure rats" });
    expect(data.notes.join(" ")).toMatch(/"blood-pressure" condition hub/);
    expect(data.studies.length).toBeGreaterThan(0);
    expect(data.studies.every((s: any) => CONDITION_IDS["blood-pressure"].includes(s.id))).toBe(true);
  });

  it("search_studies treats a pasted DOI as an exact lookup", async () => {
    const { data } = await call("search_studies", { query: "https://doi.org/10.1000/rat.3" });
    expect(data.studies.map((s: any) => s.id)).toEqual([3]);
    const miss = (await call("search_studies", { query: "10.9999/none" })).data;
    expect(miss.total_matches).toBe(0);
    expect(miss.notes.join(" ")).toMatch(/No live study has DOI/);
  });

  it("records each tool call in mcp_calls without client identifiers", async () => {
    await call("search_studies", { query: "fatigue athletes", limit: 2 });
    await new Promise((r) => setTimeout(r, 10));
    const row = usageRows.at(-1)!;
    expect(row.slice(0, 2)).toEqual(["public", "search_studies"]);
    expect(JSON.parse(String(row[2]))).toEqual({ query: "fatigue athletes", limit: 2 });
    expect(JSON.stringify(row)).not.toMatch(/127\.0\.0\.1/);
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
    // citations: internal live study shown as a card, external shown, excluded/missing internal skipped
    expect(related.cites.map((c: any) => c.id ?? c.title)).toEqual([2]);
    expect(related.cited_by).toEqual([{ title: "External citing paper", doi_url: "https://doi.org/10.1000/ext" }]);
    expect(JSON.stringify(related)).not.toMatch(/Excluded retracted paper/);
    // and the SQL itself filters excluded targets by id and by DOI
    expect(citationSql.at(-1)).toMatch(/t\."?is_excluded"? = false/);
    expect(citationSql.at(-1)).toMatch(/NOT EXISTS/);
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

describe("redactArgs", () => {
  it("truncates long strings and caps arrays, leaving other values alone", async () => {
    const { redactArgs } = await import("../mcp/tool-helpers");
    const out = redactArgs({ q: "y".repeat(500), n: 3, list: Array(20).fill("a"), nested: { s: "ok" } }) as any;
    expect(out.q.length).toBe(301);
    expect(out.n).toBe(3);
    expect(out.list).toHaveLength(10);
    expect(out.nested).toEqual({ s: "ok" });
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

describe("admin MCP server", () => {
  let admin: Client;

  beforeAll(async () => {
    admin = new Client({ name: "admin-test", version: "1.0.0" });
    await admin.connect(
      new StreamableHTTPClientTransport(new URL(`${base}/mcp/admin`), {
        requestInit: { headers: { Authorization: `Bearer ${ADMIN_KEY}` } },
      }),
    );
  });

  afterAll(async () => {
    await admin.close();
  });

  const initialize = (headers: Record<string, string>) =>
    fetch(`${base}/mcp/admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "x", version: "1" } } }),
    });

  it("rejects missing and wrong keys with 401", async () => {
    expect((await initialize({})).status).toBe(401);
    expect((await initialize({ Authorization: "Bearer nope" })).status).toBe(401);
    expect((await initialize({ Authorization: `Bearer ${ADMIN_KEY}x` })).status).toBe(401);
    expect((await initialize({ Authorization: `Bearer ${ADMIN_KEY}` })).status).toBe(200);
  });

  it("lists the admin tools on top of the public ones", async () => {
    const names = (await admin.listTools()).tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["search_studies", "answer_question", "synthesize_topic", "get_quality_breakdown", "field_coverage_report", "mcp_usage_report"]));
  });

  it("answer_question returns the model answer with numbered citations", async () => {
    const res = (await admin.callTool({ name: "answer_question", arguments: { question: "blood pressure", depth: "deep" } })) as any;
    const data = JSON.parse(res.content[0].text);
    expect(data.answer).toMatch(/\[1\]/);
    expect(data.model).toBe("claude-opus-4-8");
    expect(data.citations[0]).toMatchObject({ n: 1, url: expect.stringContaining("/study/") });
    expect(data.retrieval.matched).toBeGreaterThan(0);
    const [, userPrompt, opts] = generateText.mock.calls.at(-1) as unknown as [string, string, any];
    expect(userPrompt).toMatch(/^Question: blood pressure/);
    expect(opts).toMatchObject({ model: "claude-opus-4-8", caller: "mcp-answer-question" });
  });

  it("synthesize_topic synthesizes a condition hub and caches it", async () => {
    const first = JSON.parse(((await admin.callTool({ name: "synthesize_topic", arguments: { topic: "blood-pressure" } })) as any).content[0].text);
    expect(first).toMatchObject({ cached: false, condition_hub: { slug: "blood-pressure" }, synthesis: { evidence_strength_rating: 4 } });
    const again = JSON.parse(((await admin.callTool({ name: "synthesize_topic", arguments: { topic: "Blood-Pressure" } })) as any).content[0].text);
    expect(again.cached).toBe(true);
    expect(generateJSON).toHaveBeenCalledTimes(1);
  });

  it("get_study on the admin tier includes the full abstract", async () => {
    const data = JSON.parse(((await admin.callTool({ name: "get_study", arguments: { study: "1" } })) as any).content[0].text);
    expect(data.abstract).toBe(LONG_ABSTRACT);
    expect(data).not.toHaveProperty("abstract_excerpt");
  });

  it("field_coverage_report summarizes known fields", async () => {
    const data = JSON.parse(((await admin.callTool({ name: "field_coverage_report", arguments: {} })) as any).content[0].text);
    expect(data.live_studies).toBe(6);
    expect(data.fields.design).toEqual({ known: 3, pct: 50 });
  });
});
