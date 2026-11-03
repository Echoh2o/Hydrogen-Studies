/**
 * PLAN.md 4.6 — the radical-honesty pages. Paths, H1s and the prose review
 * date, shared by the renderer (server/middleware/evidence-pages.ts), page
 * meta and the Next routes. The numbers on these pages are computed live from
 * the studies table (server/services/evidence-stats.ts); the prose around
 * them is reviewed and dated here.
 */
export const LIMITS_PATH = "/limits-of-the-evidence";
export const LIMITS_H1 = "The limits of the evidence on molecular hydrogen";
/** When the prose (not the numbers) was last reviewed. */
export const LIMITS_LAST_REVIEWED = "2026-11-03";

export const NULL_RESULTS_PATH = "/null-and-negative-results";
export const NULL_RESULTS_H1 = "Null and negative results";

/** Outcome-direction values (lowercased) that put a study on the null/negative hub. */
export const NON_POSITIVE_OUTCOMES = ["neutral", "negative", "mixed"] as const;

export function pct(part: number, whole: number, digits = 0): string {
  if (!whole) return "0%";
  return `${((part / whole) * 100).toFixed(digits)}%`;
}

export function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}
