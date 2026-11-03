/**
 * Researcher and journal profiles (PLAN.md 4.7) — built from the live studies
 * table and cached for 30 minutes (same TTL as the hub lists). One query feeds
 * both indexes; the study-page author links read the same index.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import { logger } from "../utils/logger";
import { studyEvidence } from "../../shared/study-page";
import {
  JOURNAL_MIN_STUDIES,
  RESEARCHER_MIN_STUDIES,
  authorKey,
  authorSlug,
  displayName,
  journalSlug,
  splitAuthors,
  topCounts,
  yearRange,
  type JournalProfile,
  type ProfileStudy,
  type ResearcherProfile,
} from "../../shared/profiles";

interface Row {
  id: number;
  slug: string;
  title: string;
  publish_year: number | null;
  journal: string | null;
  study_design: string | null;
  study_type: string | null;
  is_human_trial: boolean | null;
  authors: string | null;
  health_conditions: string[] | null;
}

const TTL_MS = 30 * 60 * 1000;
let _rows: Row[] | null = null;
let _rowsAt = 0;

async function liveRows(): Promise<Row[]> {
  if (_rows && Date.now() - _rowsAt < TTL_MS) return _rows;
  const r = await db.execute(sql`
    SELECT id, slug, COALESCE(plain_language_title, title) AS title, publish_year, journal,
           study_design, study_type, is_human_trial, authors, health_conditions
      FROM studies
     WHERE is_excluded = false AND slug IS NOT NULL AND COALESCE(authors, '') <> ''
     ORDER BY publish_year DESC NULLS LAST, id DESC
  `);
  _rows = (r.rows || []) as unknown as Row[];
  _rowsAt = _rows.length ? Date.now() : 0; // empty → not cached
  return _rows;
}

function toStudy(r: Row): ProfileStudy {
  return {
    id: Number(r.id),
    slug: r.slug,
    title: r.title,
    year: r.publish_year ?? null,
    journal: r.journal?.trim() || null,
    evidence: studyEvidence({ studyDesign: r.study_design, studyType: r.study_type, isHumanTrial: r.is_human_trial })?.label ?? null,
    isHuman: !!r.is_human_trial,
  };
}

export interface AuthorIndex {
  bySlug: Map<string, ResearcherProfile>;
  list: ResearcherProfile[];
}

let _authors: AuthorIndex | null = null;
let _authorsAt = 0;

export async function getAuthorIndex(): Promise<AuthorIndex> {
  if (_authors && Date.now() - _authorsAt < TTL_MS) return _authors;
  const rows = await liveRows();
  const acc = new Map<string, { variants: Map<string, number>; studies: Map<number, Row> }>();
  for (const row of rows) {
    for (const name of splitAuthors(row.authors)) {
      const key = authorKey(name);
      if (!key) continue;
      const a = acc.get(key) ?? { variants: new Map<string, number>(), studies: new Map<number, Row>() };
      a.variants.set(name, (a.variants.get(name) ?? 0) + 1);
      a.studies.set(Number(row.id), row);
      acc.set(key, a);
    }
  }
  const list: ResearcherProfile[] = [];
  for (const [key, a] of acc) {
    if (a.studies.size < RESEARCHER_MIN_STUDIES) continue;
    const studyRows = [...a.studies.values()];
    const studies = studyRows.map(toStudy);
    const name = displayName(a.variants);
    const { first, last } = yearRange(studies);
    list.push({
      slug: authorSlug(key),
      name,
      variants: [...a.variants].sort((x, y) => y[1] - x[1]).map(([n]) => n).filter((n) => n !== name),
      studies,
      humanCount: studies.filter((s) => s.isHuman).length,
      firstYear: first,
      lastYear: last,
      journals: topCounts(studyRows.map((r) => r.journal), 5),
      conditions: topCounts(studyRows.flatMap((r) => r.health_conditions ?? []), 5),
    });
  }
  list.sort((a, b) => b.studies.length - a.studies.length || a.name.localeCompare(b.name));
  _authors = { bySlug: new Map(list.map((p) => [p.slug, p])), list };
  _authorsAt = list.length ? Date.now() : 0;
  return _authors;
}

export async function getResearcher(slug: string): Promise<ResearcherProfile | null> {
  try {
    return (await getAuthorIndex()).bySlug.get(slug.toLowerCase()) ?? null;
  } catch (err) {
    logger.error("researcher index failed", err, "Profiles", { slug });
    return null;
  }
}

export interface JournalIndex {
  bySlug: Map<string, JournalProfile>;
  list: JournalProfile[];
}

let _journals: JournalIndex | null = null;
let _journalsAt = 0;

export async function getJournalIndex(): Promise<JournalIndex> {
  if (_journals && Date.now() - _journalsAt < TTL_MS) return _journals;
  const rows = await liveRows();
  const acc = new Map<string, { variants: Map<string, number>; studies: Row[] }>();
  for (const row of rows) {
    const name = row.journal?.trim();
    if (!name) continue;
    const slug = journalSlug(name);
    if (!slug) continue;
    const j = acc.get(slug) ?? { variants: new Map<string, number>(), studies: [] as Row[] };
    j.variants.set(name, (j.variants.get(name) ?? 0) + 1);
    j.studies.push(row);
    acc.set(slug, j);
  }
  const list: JournalProfile[] = [];
  for (const [slug, j] of acc) {
    if (j.studies.length < JOURNAL_MIN_STUDIES) continue;
    const studies = j.studies.map(toStudy);
    const { first, last } = yearRange(studies);
    list.push({
      slug,
      name: displayName(j.variants),
      studies,
      humanCount: studies.filter((s) => s.isHuman).length,
      firstYear: first,
      lastYear: last,
    });
  }
  list.sort((a, b) => b.studies.length - a.studies.length || a.name.localeCompare(b.name));
  _journals = { bySlug: new Map(list.map((p) => [p.slug, p])), list };
  _journalsAt = list.length ? Date.now() : 0;
  return _journals;
}

export async function getJournal(slug: string): Promise<JournalProfile | null> {
  try {
    return (await getJournalIndex()).bySlug.get(slug.toLowerCase()) ?? null;
  } catch (err) {
    logger.error("journal index failed", err, "Profiles", { slug });
    return null;
  }
}

export interface AuthorLink {
  name: string;
  /** /researchers/<slug> when the author has a profile page, else null. */
  href: string | null;
}

/** The authors of one study, each linked to their profile when one exists. */
export async function authorLinksFor(authors: string | null | undefined): Promise<AuthorLink[]> {
  const names = splitAuthors(authors);
  if (!names.length) return [];
  let index: AuthorIndex | null = null;
  try {
    index = await getAuthorIndex();
  } catch (err) {
    logger.warn("author index unavailable — plain author names", "Profiles", { error: err instanceof Error ? err.message : String(err) });
  }
  return names.map((name) => {
    const slug = authorSlug(authorKey(name));
    return { name, href: index?.bySlug.has(slug) ? `/researchers/${slug}` : null };
  });
}

export function invalidateProfileCaches(): void {
  _rows = null;
  _authors = null;
  _journals = null;
}

export function __resetProfilesForTests(): void {
  invalidateProfileCaches();
}
