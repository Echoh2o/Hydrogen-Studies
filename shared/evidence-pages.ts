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

// ── /is-hydrogen-water-a-scam ─────────────────────────────────────
import { LEARN_FAQS } from "./learn-faqs";

export const SCAM_PATH = "/is-hydrogen-water-a-scam";
export const SCAM_H1 = "Is hydrogen water a scam? An honest answer";
/** When the prose (not the numbers) was last reviewed. */
export const SCAM_LAST_REVIEWED = "2026-11-03";

function learnFaq(question: string): { question: string; answer: string } {
  const f = LEARN_FAQS.find((x) => x.question === question);
  if (!f) throw new Error(`learn FAQ missing: ${question}`);
  return f;
}

/**
 * Visible FAQ on the scam page (and its FAQPage schema). Three answers are the
 * Learn page's, verbatim, so the site gives one answer to one question.
 */
export const SCAM_FAQS: { question: string; answer: string }[] = [
  {
    question: "Is hydrogen water just a placebo?",
    answer:
      "Not entirely, but the gap between hydrogen and placebo in trials is small and inconsistent. Several placebo-controlled trials found differences from placebo on specific measures, such as blood markers of oxidative stress or how tired people felt after exercise; others found none. With trials this small and short, a null result is as informative as a positive one. Our topic hubs grade the evidence for each use.",
  },
  {
    question: "Can hydrogen water treat or cure a disease?",
    answer:
      "No. No randomized trial has shown that drinking hydrogen water treats, cures or prevents any disease, and it is not an approved treatment for any condition. The trials in people with a diagnosis, such as type 2 diabetes or fatty liver disease, measured changes in blood markers over weeks or months, not whether the disease got better. A seller who claims otherwise is making a claim the research in this database does not support.",
  },
  learnFaq("Is hydrogen water safe?"),
  learnFaq("Does hydrogen stay in the water once it is made?"),
  learnFaq('Is this the same as "smart water," "structured water," or "alkaline water"?'),
  {
    question: "Why does a hydrogen water company publish this page?",
    answer:
      "Because a database of hydrogen research run by a hydrogen water company is only worth reading if it says plainly what the research does not show. Echo Technologies LLC funds this site; our editorial policy explains what that does and does not buy. This page recommends no product.",
  },
];

// ── /evidence-gap-map ──────────────────────────────────────────────
export const GAP_MAP_PATH = "/evidence-gap-map";
export const GAP_MAP_H1 = "Evidence gap map: what has been studied, in whom, how well";
/** When the prose (not the numbers) was last reviewed. */
export const GAP_MAP_LAST_REVIEWED = "2026-11-03";
/** Condition tags with at least this many studies appear as rows. */
export const GAP_MAP_MIN_STUDIES = 20;

/** Shade bucket for a cell count: 0 → none … 4 → heavy. */
export function gapBucket(n: number): 0 | 1 | 2 | 3 | 4 {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  if (n <= 9) return 2;
  if (n <= 29) return 3;
  return 4;
}
