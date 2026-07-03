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

/** Caps for the optional `context` object on /api/search/natural-language. */
export const MAX_CONTEXT_PREVIOUS_QUERIES = 10;
export const MAX_CONTEXT_INTERESTS = 20;
export const MAX_CONTEXT_STUDY_TYPES = 10;
export const MAX_CONTEXT_VIEWED_STUDIES = 50;
export const MAX_CONTEXT_ITEM_LENGTH = 200;

export type QueryValidation =
  | { ok: true; query: string }
  | { ok: false; error: string };

export type BatchValidation =
  | { ok: true; queries: string[] }
  | { ok: false; error: string };

/**
 * Shape produced by sanitizeContext. Structurally compatible with
 * QueryContext in server/services/query-understanding.ts (kept local so this
 * module stays import-free and pure).
 */
export interface SanitizedQueryContext {
  previousQueries: string[];
  userPreferences: {
    interests: string[];
    preferredStudyTypes: string[];
  };
  sessionContext: {
    viewedStudies: number[];
    appliedFilters: Record<string, never>;
  };
}

/**
 * Validates a single query value from a request body.
 * Trims first, then length-checks, so padded-but-under-cap queries pass.
 * Returns the trimmed query on success.
 */
export function validateQueryInput(value: unknown): QueryValidation {
  if (typeof value !== "string") {
    return { ok: false, error: "Query is required" };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Query is required" };
  }
  if (trimmed.length > MAX_QUERY_LENGTH) {
    return {
      ok: false,
      error: `Query is too long. Maximum ${MAX_QUERY_LENGTH} characters allowed.`,
    };
  }
  return { ok: true, query: trimmed };
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

/**
 * Sanitizes string-array fields from untrusted context: keeps only string
 * items, trims them, drops empties and anything over MAX_CONTEXT_ITEM_LENGTH,
 * and caps the list length.
 */
function sanitizeStringList(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (out.length >= maxItems) break;
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_CONTEXT_ITEM_LENGTH) {
      continue;
    }
    out.push(trimmed);
  }
  return out;
}

/**
 * Sanitizes the optional `context` body field on
 * POST /api/search/natural-language. Context strings flow into Claude prompts
 * (see generateContextualExpansions in server/services/query-understanding.ts),
 * so without caps an attacker could stuff megabytes of "previous queries" into
 * the prompt and bypass the per-query length cap for cost amplification.
 *
 * Returns a fully-formed, capped context object, or undefined when the input
 * is missing or not an object (non-conforming context is dropped, never 400d —
 * the search still runs without personalization).
 */
export function sanitizeContext(
  value: unknown,
): SanitizedQueryContext | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const prefs =
    raw.userPreferences && typeof raw.userPreferences === "object"
      ? (raw.userPreferences as Record<string, unknown>)
      : {};
  const session =
    raw.sessionContext && typeof raw.sessionContext === "object"
      ? (raw.sessionContext as Record<string, unknown>)
      : {};

  const viewedStudies = Array.isArray(session.viewedStudies)
    ? session.viewedStudies
        .filter((id): id is number => typeof id === "number" && Number.isFinite(id))
        .slice(0, MAX_CONTEXT_VIEWED_STUDIES)
    : [];

  return {
    previousQueries: sanitizeStringList(
      raw.previousQueries,
      MAX_CONTEXT_PREVIOUS_QUERIES,
    ),
    userPreferences: {
      interests: sanitizeStringList(prefs.interests, MAX_CONTEXT_INTERESTS),
      preferredStudyTypes: sanitizeStringList(
        prefs.preferredStudyTypes,
        MAX_CONTEXT_STUDY_TYPES,
      ),
    },
    sessionContext: {
      viewedStudies,
      // appliedFilters is not consumed by any prompt; drop untrusted content.
      appliedFilters: {},
    },
  };
}
