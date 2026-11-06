import type { NextFunction, Request, Response } from "express";

/**
 * CLAUDE.md: "no placeholder strings (__no_content__) reach HTML" — and the
 * public JSON that SPA pages, the MCP server and third parties read is no
 * different. Pipeline sentinels stay in the DB (enrichment uses them to skip
 * processed rows); responses get null instead.
 */
const SENTINEL = /^__[a-z0-9_]+__$/i;

export function stripSentinelValues<T>(value: T, depth = 0): T {
  if (depth > 8 || value === null || value === undefined) return value;
  if (typeof value === "string") return (SENTINEL.test(value.trim()) ? null : value) as T;
  if (Array.isArray(value)) return value.map((v) => stripSentinelValues(v, depth + 1)) as T;
  if (typeof value === "object" && (value as object).constructor === Object) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = stripSentinelValues(v, depth + 1);
    return out as T;
  }
  return value;
}

export function stripSentinels(_req: Request, res: Response, next: NextFunction): void {
  const json = res.json.bind(res);
  res.json = ((body: unknown) => json(stripSentinelValues(body))) as Response["json"];
  next();
}
