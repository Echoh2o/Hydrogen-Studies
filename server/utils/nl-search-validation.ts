/**
 * Input validation for the natural-language search endpoints.
 *
 * These endpoints invoke Claude per request, so oversized or malformed input
 * translates directly into API cost. Kept as pure functions (no imports) so
 * they are trivially unit-testable (see server/__tests__/nl-search-validation.test.ts).
 */

/** Maximum characters allowed in a single search query. */
export const MAX_QUERY_LENGTH = 1000;

/** Maximum number of queries allowed in one /api/search/batch request. */
export const MAX_BATCH_QUERIES = 5;

export type QueryValidation =
  | { ok: true; query: string }
  | { ok: false; error: string };

export type BatchValidation =
  | { ok: true; queries: string[] }
  | { ok: false; error: string };

/**
 * Validates a single query value from a request body.
 * Returns the trimmed query on success.
 */
export function validateQueryInput(value: unknown): QueryValidation {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { ok: false, error: "Query is required" };
  }
  if (value.length > MAX_QUERY_LENGTH) {
    return {
      ok: false,
      error: `Query is too long. Maximum ${MAX_QUERY_LENGTH} characters allowed.`,
    };
  }
  return { ok: true, query: value.trim() };
}

/**
 * Validates the queries array for the batch endpoint:
 * must be a non-empty array of at most MAX_BATCH_QUERIES strings,
 * each non-empty and within MAX_QUERY_LENGTH characters.
 */
export function validateBatchQueries(value: unknown): BatchValidation {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: "Queries array is required" };
  }
  if (value.length > MAX_BATCH_QUERIES) {
    return {
      ok: false,
      error: `Maximum ${MAX_BATCH_QUERIES} queries allowed per batch`,
    };
  }
  const queries: string[] = [];
  for (const item of value) {
    const result = validateQueryInput(item);
    if (!result.ok) {
      return { ok: false, error: `Invalid query in batch: ${result.error}` };
    }
    queries.push(result.query);
  }
  return { ok: true, queries };
}
