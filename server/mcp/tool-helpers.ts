/** Shared pieces for registering MCP tools (public and admin tiers). */
import { z } from "zod";
import { DELIVERY_METHODS, OUTCOMES, STUDY_DESIGNS } from "@shared/research-vocab";
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

/** Wrap a handler with timing/logging and a uniform error result. */
export function instrument<A>(tier: McpTier, tool: string, fn: (args: A) => Promise<ReturnType<typeof json> | ReturnType<typeof fail>>) {
  return async (args: A) => {
    const started = Date.now();
    try {
      const out = await fn(args);
      logger.info("MCP tool call", "MCP", { tier, tool, ms: Date.now() - started, error: "isError" in out });
      return out;
    } catch (err) {
      logger.error("MCP tool failed", err, "MCP", { tier, tool });
      return fail(`${tool} failed: ${err instanceof Error ? err.message : "internal error"}`);
    }
  };
}

export const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

export function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
