/** Shared pieces for registering MCP tools (public and admin tiers). */
import { z } from "zod";
import { DELIVERY_METHODS, OUTCOMES, STUDY_DESIGNS } from "@shared/research-vocab";
import { sql } from "drizzle-orm";
import { db } from "../db";
import type { ResearchFilters } from "../services/research-query";
import { logger } from "../utils/logger";

export type McpTier = "public" | "admin";

export const subjectEnum = z.enum(["human", "animal", "in_vitro", "review"]);

export const filterShape = {
  query: z.string().max(300).optional().describe("Full-text search terms, e.g. 'exercise fatigue lactate'"),
  condition: z
    .string()
    .max(100)
    .optional()
    .describe("Condition hub slug or name, e.g. 'blood-pressure' or 'Blood Pressure' (see list_conditions)"),
  subject: subjectEnum.optional().describe("Who/what was studied"),
  design: z.enum(STUDY_DESIGNS).optional().describe("Study design"),
  delivery_method: z.enum(DELIVERY_METHODS).optional().describe("How hydrogen was administered"),
  outcome: z.enum(OUTCOMES).optional().describe("Direction of the reported hydrogen effect"),
  year_from: z.number().int().min(1900).max(2100).optional(),
  year_to: z.number().int().min(1900).max(2100).optional(),
  min_sample_size: z.number().int().min(1).optional().describe("Minimum participants/animals"),
};
export const filterObject = z.object(filterShape);
export type FilterArgs = z.infer<typeof filterObject>;

export function toFilters(a: FilterArgs): ResearchFilters {
  return {
    query: a.query,
    condition: a.condition,
    subject: a.subject,
    design: a.design,
    deliveryMethod: a.delivery_method,
    outcome: a.outcome,
    yearFrom: a.year_from,
    yearTo: a.year_to,
    minSampleSize: a.min_sample_size,
  };
}

export const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data) }] });
export const fail = (message: string) => ({ isError: true, content: [{ type: "text" as const, text: message }] });

/** Arguments as stored in mcp_calls: strings truncated, nothing else touched. */
export function redactArgs(args: unknown): unknown {
  if (typeof args === "string") return args.length > 300 ? `${args.slice(0, 300)}…` : args;
  if (Array.isArray(args)) return args.slice(0, 10).map(redactArgs);
  if (args && typeof args === "object") {
    return Object.fromEntries(Object.entries(args as Record<string, unknown>).map(([k, v]) => [k, redactArgs(v)]));
  }
  return args;
}

/**
 * One mcp_calls row per tool call (migration 027): tool, tier, truncated
 * args, latency, success. No IP or client identifiers. Fire-and-forget — a
 * logging failure never affects the tool result.
 */
function recordCall(tier: McpTier, tool: string, args: unknown, ms: number, ok: boolean, bytes: number | null): void {
  db.execute(sql`
    INSERT INTO mcp_calls (tier, tool, args, ms, ok, response_bytes)
    VALUES (${tier}, ${tool}, ${JSON.stringify(redactArgs(args ?? {}))}::jsonb, ${ms}, ${ok}, ${bytes})
  `).catch((err: unknown) => logger.warn("mcp_calls insert failed", "MCP", { error: String((err as Error)?.message ?? err) }));
}

/** Wrap a handler with timing, usage recording and a uniform error result. */
export function instrument<A>(tier: McpTier, tool: string, fn: (args: A) => Promise<ReturnType<typeof json> | ReturnType<typeof fail>>) {
  return async (args: A) => {
    const started = Date.now();
    try {
      const out = await fn(args);
      const ms = Date.now() - started;
      const ok = !("isError" in out);
      logger.info("MCP tool call", "MCP", { tier, tool, ms, error: !ok });
      recordCall(tier, tool, args, ms, ok, out.content[0]?.text.length ?? null);
      return out;
    } catch (err) {
      logger.error("MCP tool failed", err, "MCP", { tier, tool });
      recordCall(tier, tool, args, Date.now() - started, false, null);
      return fail(`${tool} failed: ${err instanceof Error ? err.message : "internal error"}`);
    }
  };
}

export const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

export function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
