/**
 * Import guard ("study finder" — owner request 2026-09-28: "adjust the code for
 * the study finder tool so it ignores hydrogen energy studies").
 *
 * Wraps shared/study-topic-filter.ts for the ingestion paths: discovery
 * (runDiscovery), the AI pipeline, the review queue, manual/bulk import,
 * the URL scraper and the admin external-search result lists. Off-topic
 * hydrogen-ENERGY papers are skipped before any insert or AI spend.
 */
import {
  isHydrogenEnergyStudy,
  partitionByEnergyTopic,
  type StudyTopicInput,
  type StudyTopicVerdict,
} from "@shared/study-topic-filter";
import { logger } from "../utils/logger";

const TAG = "StudyTopicGuard";

export class OffTopicStudyError extends Error {
  readonly status = 422;
  readonly code = "OFF_TOPIC_HYDROGEN_ENERGY";
  constructor(
    readonly title: string,
    readonly verdict: StudyTopicVerdict,
  ) {
    super(
      `Skipped off-topic study (${verdict.reason ?? "hydrogen energy"}): "${title.slice(0, 120)}". ` +
        `Hydrogen Studies covers molecular hydrogen for human health only.`,
    );
    this.name = "OffTopicStudyError";
  }
}

export function isOffTopicStudyError(err: unknown): err is OffTopicStudyError {
  return err instanceof OffTopicStudyError || (err as any)?.code === "OFF_TOPIC_HYDROGEN_ENERGY";
}

/** Classify an import candidate; logs every skip with its reason. */
export function checkStudyTopic(input: StudyTopicInput, source: string): StudyTopicVerdict {
  const verdict = isHydrogenEnergyStudy(input);
  if (verdict.excluded) {
    logger.info(`Skipping off-topic hydrogen-energy study from ${source}`, TAG, {
      title: String(input.title ?? "").slice(0, 120),
      confidence: verdict.confidence,
      reason: verdict.reason,
    } as Record<string, unknown>);
  }
  return verdict;
}

/** Throw OffTopicStudyError when the candidate is hydrogen-energy research. */
export function assertOnTopicStudy(input: StudyTopicInput, source: string): void {
  const verdict = checkStudyTopic(input, source);
  if (verdict.excluded) throw new OffTopicStudyError(String(input.title ?? ""), verdict);
}

/** Pull title/abstract/keywords out of any external search-result shape. */
export function topicInputFromSearchResult(item: any): StudyTopicInput {
  const rawTitle = item?.title ?? item?.paper_title;
  const title = Array.isArray(rawTitle) ? rawTitle[0] : rawTitle;
  const abstract = item?.abstract ?? item?.abstractText ?? item?.tldr?.text ?? null;
  const kwRaw =
    item?.keywords ??
    item?.keywordList?.keyword ??
    item?.meshHeadings ??
    item?.subject ??
    item?.fieldsOfStudy ??
    null;
  const keywords = Array.isArray(kwRaw)
    ? kwRaw.map((k: any) => (typeof k === "string" ? k : k?.descriptorName ?? k?.category ?? "")).filter(Boolean)
    : typeof kwRaw === "string"
      ? kwRaw
      : null;
  const journal = Array.isArray(item?.["container-title"])
    ? item["container-title"][0]
    : item?.journal ?? item?.journalTitle ?? item?.venue ?? item?.publication_journal_name ?? null;
  return {
    title: typeof title === "string" ? title : null,
    abstract: typeof abstract === "string" ? abstract : null,
    keywords,
    journal: typeof journal === "string" ? journal : null,
  };
}

/**
 * Drop hydrogen-energy papers from an admin external-search result list.
 * Returns the kept items plus how many were hidden (surfaced in the API
 * response so the admin knows results were filtered).
 */
export function filterOffTopicSearchResults<T>(items: readonly T[], source: string): { kept: T[]; excludedOffTopic: number } {
  const { kept, excluded } = partitionByEnergyTopic(items, topicInputFromSearchResult);
  if (excluded.length > 0) {
    logger.info(`Hid ${excluded.length} off-topic hydrogen-energy result(s) from ${source} search`, TAG);
  }
  return { kept, excludedOffTopic: excluded.length };
}
