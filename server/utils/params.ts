/**
 * Strict integer parsing for route params and query strings.
 *
 * `parseInt("abc")` is NaN and `parseInt("12abc")` is 12; both used to flow
 * into SQL / Date math and surface as 500s or Invalid Date. These helpers
 * accept only a plain base-10 integer string (optional leading minus) that
 * falls within the given bounds, and return null otherwise so the route can
 * answer 400.
 */

/** Largest value a Postgres `integer` (int4) column accepts. */
export const PG_INT_MAX = 2147483647;

export interface IntParamOptions {
  min?: number;
  max?: number;
}

export function parseIntParam(value: unknown, opts: IntParamOptions = {}): number | null {
  if (Array.isArray(value)) return null;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) return null;
    return inBounds(value, opts) ? value : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^-?\d{1,15}$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isSafeInteger(n)) return null;
  return inBounds(n, opts) ? n : null;
}

/**
 * Optional integer query param: undefined/empty → `fallback`; present but
 * malformed or out of bounds → null (caller returns 400).
 */
export function parseOptionalIntParam(
  value: unknown,
  fallback: number,
  opts: IntParamOptions = {},
): number | null {
  if (value === undefined || value === "") return fallback;
  return parseIntParam(value, opts);
}

/**
 * Lenient page-size clamp for search endpoints: malformed → fallback,
 * otherwise clamped into [1, max]. Never throws, never exceeds max.
 */
export function clampPageSize(value: unknown, fallback = 10, max = 100): number {
  const n = typeof value === "string" ? parseInt(value, 10) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n)) return Math.min(fallback, max);
  return Math.max(1, Math.min(Math.trunc(n), max));
}

function inBounds(n: number, { min, max }: IntParamOptions): boolean {
  if (min !== undefined && n < min) return false;
  if (max !== undefined && n > max) return false;
  return true;
}
