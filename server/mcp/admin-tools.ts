/**
 * Admin-only MCP tools (/mcp/admin, bearer key). Read-only like the public
 * tier — merges, 410s, noindex and other content-destructive operations stay
 * out of MCP (CLAUDE.md: they need a report and Josh's approval first).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { answerQuestion, synthesizeTopic } from "../services/research-synthesis";
import { getCorpus, getStudyDetail, parseStudyRef, type CorpusStudy } from "../services/research-query";
import { READ_ONLY, fail, filterObject, instrument, json, toFilters } from "./tool-helpers";

const depthEnum = z.enum(["standard", "deep"]).optional();

/** Per-field known/unknown counts over the live corpus (the Phase 0 report, live). */
export function fieldCoverage(rows: CorpusStudy[]) {
  const fields: Record<string, (s: CorpusStudy) => unknown> = {
    design: (s) => s.design,
    subject: (s) => (s.subject === "unknown" ? null : s.subject),
    outcome: (s) => s.outcome,
    delivery_method: (s) => s.deliveryMethod,
    sample_size: (s) => s.sampleSize,
    duration_days: (s) => s.durationDays,
    species: (s) => s.species,
    conditions: (s) => (s.conditions.length ? s.conditions : null),
    year: (s) => s.year,
    doi: (s) => s.doi,
    key_finding: (s) => s.keyFinding,
    quality_score: (s) => s.qualityScore,
  };
  const total = rows.length;
  return {
    live_studies: total,
    fields: Object.fromEntries(
      Object.entries(fields).map(([name, pick]) => {
        const known = rows.filter((s) => pick(s) !== null && pick(s) !== undefined).length;
        return [name, { known, pct: total ? Math.round((known / total) * 1000) / 10 : 0 }];
      }),
    ),
  };
}

export function registerAdminTools(server: McpServer): void {
  server.registerTool(
    "answer_question",
    {
      title: "Answer a research question",
      description:
        "Answer a question from the Hydrogen Studies corpus server-side: retrieves the most relevant studies (strongest evidence first), then Claude writes a cited answer ([n] markers map to `citations`). depth 'deep' uses Opus.",
      inputSchema: {
        question: z.string().min(3).max(1000),
        filters: filterObject.omit({ query: true }).optional().describe("Optional filters to scope retrieval"),
        depth: depthEnum.describe("standard (Sonnet, default) or deep (Opus)"),
        max_studies: z.number().int().min(3).max(25).optional().describe("Studies given to the model (default 12)"),
      },
      annotations: { title: "Answer a research question", ...READ_ONLY },
    },
    instrument("admin", "answer_question", async (a) =>
      json(await answerQuestion({ question: a.question, filters: a.filters ? toFilters(a.filters) : undefined, depth: a.depth, maxStudies: a.max_studies })),
    ),
  );

  server.registerTool(
    "synthesize_topic",
    {
      title: "Synthesize a topic",
      description:
        "Structured evidence synthesis for a condition or topic from the local corpus: 1–10 evidence rating with justification, supported benefits, null/negative findings, safety, delivery and dosing, gaps — each tied to numbered studies. Cached 24h (refresh: true to regenerate).",
      inputSchema: {
        topic: z.string().min(2).max(200).describe("Condition hub name/slug or free-text topic"),
        depth: depthEnum.describe("deep (Opus, default) or standard (Sonnet)"),
        refresh: z.boolean().optional(),
      },
      annotations: { title: "Synthesize a topic", ...READ_ONLY },
    },
    instrument("admin", "synthesize_topic", async (a) => {
      const out = await synthesizeTopic({ topic: a.topic, depth: a.depth ?? "deep", refresh: a.refresh });
      return "error" in out ? fail(String(out.error)) : json(out);
    }),
  );

  server.registerTool(
    "get_quality_breakdown",
    {
      title: "Quality score breakdown",
      description: "The full rubric scoring for one study: all sub-scores, red flags, confidence, rubric version and the detailed breakdown JSON.",
      inputSchema: { study: z.string().min(1).max(300).describe("Study id, slug, DOI or URL") },
      annotations: { title: "Quality score breakdown", ...READ_ONLY },
    },
    instrument("admin", "get_quality_breakdown", async ({ study }) => {
      // Both lookup paths go through the live (non-excluded) corpus.
      const ref = parseStudyRef(study);
      const id = ref.kind === "id" ? (await getCorpus()).byId.get(Number(ref.value))?.id : (await getStudyDetail(study))?.id;
      if (!id) return fail(`No study found for "${study}".`);
      const r = await db.execute(sql`SELECT * FROM study_quality_scores WHERE study_id = ${id} ORDER BY id DESC LIMIT 1`);
      const row = r.rows?.[0] as Record<string, unknown> | undefined;
      if (!row) return fail(`Study ${id} has no quality score yet.`);
      let breakdown: unknown = row.score_breakdown;
      try {
        breakdown = typeof breakdown === "string" ? JSON.parse(breakdown) : breakdown;
      } catch {
        // keep the raw string
      }
      return json({ study_id: id, ...row, score_breakdown: breakdown });
    }),
  );

  server.registerTool(
    "mcp_usage_report",
    {
      title: "MCP usage report",
      description:
        "How the MCP server is being used: calls per tool and tier, error rate, median/p95 latency, calls per day, and the most common search queries / topics.",
      inputSchema: { days: z.number().int().min(1).max(365).optional().describe("Look-back window (default 30)") },
      annotations: { title: "MCP usage report", ...READ_ONLY },
    },
    instrument("admin", "mcp_usage_report", async ({ days }) => {
      const d = days ?? 30;
      const since = sql`at >= NOW() - (${d} || ' days')::interval`;
      const [byTool, perDay, topQueries] = await Promise.all([
        db.execute(sql`
          SELECT tier, tool, COUNT(*)::int AS calls, COUNT(*) FILTER (WHERE NOT ok)::int AS errors,
                 PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ms)::int AS p50_ms,
                 PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ms)::int AS p95_ms
            FROM mcp_calls WHERE ${since} GROUP BY tier, tool ORDER BY calls DESC`),
        db.execute(sql`
          SELECT to_char(date_trunc('day', at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS calls
            FROM mcp_calls WHERE ${since} GROUP BY 1 ORDER BY 1`),
        db.execute(sql`
          SELECT LOWER(TRIM(COALESCE(args->>'query', args->>'question', args->>'topic', args->>'condition'))) AS q,
                 COUNT(*)::int AS n
            FROM mcp_calls
           WHERE ${since} AND COALESCE(args->>'query', args->>'question', args->>'topic', args->>'condition') IS NOT NULL
           GROUP BY 1 ORDER BY n DESC LIMIT 40`),
      ]);
      return json({ days: d, by_tool: byTool.rows, per_day: perDay.rows, top_queries: topQueries.rows });
    }),
  );

  server.registerTool(
    "field_coverage_report",
    {
      title: "Field coverage report",
      description: "How complete the structured study fields are right now (design, outcome, delivery method, sample size, ...), as known counts and percentages.",
      inputSchema: {},
      annotations: { title: "Field coverage report", ...READ_ONLY },
    },
    instrument("admin", "field_coverage_report", async () => json(fieldCoverage((await getCorpus()).rows))),
  );
}
