/**
 * Researcher and journal profile pages (PLAN.md 4.7): one page per prolific
 * author and per journal, listing their studies. Pure helpers shared by the
 * server (index + renderer + page meta) and anything client-side.
 *
 * Author names are stored as one comma-separated string per study, in the
 * form the source index gave ("Xue-jun Sun", "Tyler W. Lebaron", "C. Zhao").
 * A profile groups the spellings of one name by a normalized key (lowercase
 * letters and spaces only, so "Xue-jun Sun" and "Xuejun Sun" are one person)
 * and shows the most common spelling. This is name matching, not identity
 * resolution: two researchers who share a name share a page, and the page says
 * so. ORCID/affiliation links are a follow-up (OpenAlex authorships).
 */
import { hubSlug } from "./explore-hubs";

/** Authors with at least this many studies get a profile page. */
export const RESEARCHER_MIN_STUDIES = 8;
/** Journals with at least this many studies get a profile page. */
export const JOURNAL_MIN_STUDIES = 10;

/** "Xue-jun Sun" | "xuejun  sun" → "xuejun sun"; "" for nothing usable. */
export function authorKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "xuejun sun" → "xuejun-sun" (URL slug of an author key). */
export function authorSlug(key: string): string {
  return key.replace(/ /g, "-");
}

export function journalSlug(name: string): string {
  return hubSlug(name);
}

/** Split a stored authors string into names; drops empties and "et al". */
export function splitAuthors(authors: string | null | undefined): string[] {
  return String(authors ?? "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s && !/^et al\.?$/i.test(s) && authorKey(s).length >= 3);
}

/** The most common spelling (ties → the first seen). */
export function displayName(variants: ReadonlyMap<string, number>): string {
  let best = "";
  let bestN = -1;
  for (const [name, n] of variants) {
    if (n > bestN) {
      best = name;
      bestN = n;
    }
  }
  return best;
}

export interface ProfileStudy {
  id: number;
  slug: string;
  title: string;
  year: number | null;
  journal: string | null;
  evidence: string | null;
  isHuman: boolean;
}

export interface ResearcherProfile {
  slug: string;
  name: string;
  /** Other spellings seen in the data, most common first. */
  variants: string[];
  studies: ProfileStudy[];
  humanCount: number;
  firstYear: number | null;
  lastYear: number | null;
  /** Journals they publish in most, with counts. */
  journals: { name: string; count: number }[];
  /** Health conditions their studies are tagged with most, with counts. */
  conditions: { name: string; count: number }[];
  /**
   * From OpenAlex authorships (migration 030), only when this name resolves to
   * ONE OpenAlex author across our studies; otherwise absent and the page is
   * name-only.
   */
  identity?: ResearcherIdentityView | null;
}

export interface ResearcherIdentityView {
  openalexAuthorId: string;
  orcid: string | null;
  institution: string | null;
  institutionCountry: string | null;
  /** How many of our works' authorships carry this OpenAlex author. */
  occurrences: number;
}

export interface JournalProfile {
  slug: string;
  name: string;
  studies: ProfileStudy[];
  humanCount: number;
  firstYear: number | null;
  lastYear: number | null;
}

export function yearRange(studies: readonly { year: number | null }[]): { first: number | null; last: number | null } {
  const years = studies.map((s) => s.year).filter((y): y is number => typeof y === "number" && y > 1800);
  return years.length ? { first: Math.min(...years), last: Math.max(...years) } : { first: null, last: null };
}

export function topCounts(values: readonly (string | null | undefined)[], limit: number): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const name = String(v ?? "").trim();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** "Xue-jun Sun" → "Sun X" style PubMed author query; falls back to the full name. */
export function pubmedAuthorQuery(name: string): string {
  const parts = name.replace(/[.,]/g, " ").trim().split(/\s+/);
  if (parts.length < 2) return `${name}[Author]`;
  const last = parts[parts.length - 1];
  const initials = parts
    .slice(0, -1)
    .map((p) => p.split("-").map((q) => q[0]?.toUpperCase() ?? "").join(""))
    .join("");
  return `${last} ${initials}[Author]`;
}

export function pubmedAuthorUrl(name: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(pubmedAuthorQuery(name))}`;
}

export function openAlexAuthorSearchUrl(name: string): string {
  return `https://openalex.org/authors?search=${encodeURIComponent(name)}`;
}

export function researcherTitle(p: Pick<ResearcherProfile, "name" | "studies">): string {
  return `${p.name}: hydrogen research (${p.studies.length} studies)`;
}

export function researcherDescription(p: ResearcherProfile): string {
  const span = p.firstYear && p.lastYear ? (p.firstYear === p.lastYear ? `in ${p.firstYear}` : `from ${p.firstYear} to ${p.lastYear}`) : "";
  const journals = p.journals.slice(0, 2).map((j) => j.name).join(" and ");
  const human = p.humanCount ? `${p.humanCount} in people` : "none in people";
  return `${p.studies.length} molecular hydrogen studies co-authored by ${p.name}${span ? ` ${span}` : ""} (${human})${journals ? `, including work in ${journals}` : ""}. Every study links to its paper.`;
}

export function journalTitle(p: Pick<JournalProfile, "name" | "studies">): string {
  return `${p.name}: hydrogen research (${p.studies.length} studies)`;
}

export function journalDescription(p: JournalProfile): string {
  const span = p.firstYear && p.lastYear ? ` published ${p.firstYear}–${p.lastYear}` : "";
  return `${p.studies.length} studies on molecular hydrogen${span} in ${p.name}, ${p.humanCount} of them in people, with plain-language summaries and links to each paper.`;
}

/** Visible H1s of the two index pages (renderer + page meta). */
export const RESEARCHERS_H1 = "Researchers publishing on molecular hydrogen";
export const JOURNALS_H1 = "Journals publishing hydrogen research";
