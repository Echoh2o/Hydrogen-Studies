/**
 * Stable study URLs (PLAN.md 3.3, CLAUDE.md "Study URLs use the permanent ID").
 *
 * Every live study slug today is `<title-words>-<13-digit epoch>`, where the
 * epoch is the import batch's Date.now() — 92 distinct values across 2,276
 * studies, so it identifies nothing. The stable form keeps the title words
 * and ends in the study's permanent identifier:
 *
 *   <title>-pmid-<PMID>          PubMed ID (preferred)
 *   <title>-doi-<slugified DOI>  when there is no PMID
 *   <title>-hs-<row id>          when there is neither
 *
 * The suffix is what resolves the page (studyService.getStudyBySlug); the
 * title portion is cosmetic, so a changed title never breaks a link — the
 * Next study page 301s a drifted title portion to the canonical slug.
 *
 * Slugs are only ever rewritten by scripts/consolidation/stable-study-urls.ts
 * after Josh approves the 301 map; nothing here regenerates a slug ad hoc.
 */
import { normalizeDoi } from "./seo-markup";

export type StableSuffix =
  | { kind: "pmid"; pmid: string }
  | { kind: "doi"; doiSlug: string }
  | { kind: "id"; id: number };

// The import-batch epoch — after a dash, or the whole slug when there were no title words.
const EPOCH_SUFFIX = /(?:^|-)\d{13}$/;
const PMID_SUFFIX = /-pmid-(\d{4,9})$/;
// A DOI always starts with "10." + a 4–9 digit registrant code, so a title
// that merely contains the word "doi" can't be mistaken for a DOI suffix.
const DOI_SUFFIX = /-doi-(10-\d{4,9}-[a-z0-9-]+)$/;
const ID_SUFFIX = /-hs-(\d+)$/;

/** `<title>-pmid-123` → `<title>`; `<title>-1777577956377` → `<title>`. */
export function titlePortion(slug: string): string {
  return slug
    .replace(PMID_SUFFIX, "")
    .replace(DOI_SUFFIX, "")
    .replace(ID_SUFFIX, "")
    .replace(EPOCH_SUFFIX, "")
    .replace(/^-+|-+$/g, "");
}

/** A PMID is 4–9 digits; anything else (empty, "n/a", "PMC123") is treated as missing. */
export function cleanPmid(pmid: string | number | null | undefined): string | null {
  const v = String(pmid ?? "").trim();
  return /^\d{4,9}$/.test(v) ? v : null;
}

/** `10.3760/cma.j.issn.0412-4081.2018.08.010` → `10-3760-cma-j-issn-0412-4081-2018-08-010`. */
export function doiSlug(doi: string | null | undefined): string | null {
  const v = normalizeDoi(doi).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return /^10-\d{4,9}-/.test(v) ? v : null;
}

export function stableStudySlug(study: {
  id: number;
  slug: string;
  pmid?: string | number | null;
  doi?: string | null;
}): { slug: string; kind: StableSuffix["kind"] } {
  const title = titlePortion(study.slug) || "study";
  const pmid = cleanPmid(study.pmid);
  if (pmid) return { slug: `${title}-pmid-${pmid}`, kind: "pmid" };
  const doi = doiSlug(study.doi);
  if (doi) return { slug: `${title}-doi-${doi}`, kind: "doi" };
  return { slug: `${title}-hs-${study.id}`, kind: "id" };
}

/** The permanent identifier a stable slug ends in, or null for a legacy slug. */
export function parseStableSuffix(slug: string): StableSuffix | null {
  const pmid = PMID_SUFFIX.exec(slug);
  if (pmid) return { kind: "pmid", pmid: pmid[1] };
  const doi = DOI_SUFFIX.exec(slug);
  if (doi) return { kind: "doi", doiSlug: doi[1] };
  const id = ID_SUFFIX.exec(slug);
  if (id) return { kind: "id", id: Number(id[1]) };
  return null;
}
