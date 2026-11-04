/**
 * PLAN.md 4.7 follow-up — deciding which OpenAlex author an author-name key
 * on our studies refers to. Pure: fed by scripts/research/backfill-author-identities.ts.
 *
 * A key gets an identity only when one OpenAlex author id accounts for most
 * of the key's authorship occurrences across our matched works. Shared names
 * ("Yang Yu") split across several ids and get nothing — the profile page then
 * stays name-only, as it says it is.
 */
export interface AuthorshipOccurrence {
  /** shared/profiles.ts authorKey of the raw author name on the work. */
  authorKey: string;
  rawName: string;
  openalexAuthorId: string | null;
  displayName: string | null;
  orcid: string | null;
  institution: string | null;
  institutionCountry: string | null;
  institutionRor: string | null;
}

export interface ResolvedIdentity {
  authorKey: string;
  openalexAuthorId: string;
  displayName: string;
  orcid: string | null;
  institution: string | null;
  institutionCountry: string | null;
  institutionRor: string | null;
  occurrences: number;
  /** Share of the key's occurrences carrying this author id (0–1). */
  share: number;
}

export const IDENTITY_MIN_OCCURRENCES = 2;
export const IDENTITY_MIN_SHARE = 0.6;

function mode<T extends string>(values: (T | null)[]): T | null {
  const c = new Map<T, number>();
  for (const v of values) if (v) c.set(v, (c.get(v) ?? 0) + 1);
  let best: T | null = null;
  let n = 0;
  for (const [v, k] of c) if (k > n) { best = v; n = k; }
  return best;
}

export function decideIdentities(occurrences: readonly AuthorshipOccurrence[]): ResolvedIdentity[] {
  const byKey = new Map<string, AuthorshipOccurrence[]>();
  for (const o of occurrences) {
    if (!o.authorKey) continue;
    byKey.set(o.authorKey, [...(byKey.get(o.authorKey) ?? []), o]);
  }
  const out: ResolvedIdentity[] = [];
  for (const [authorKey, occ] of byKey) {
    const withId = occ.filter((o) => o.openalexAuthorId);
    if (withId.length < IDENTITY_MIN_OCCURRENCES) continue;
    const top = mode(withId.map((o) => o.openalexAuthorId));
    if (!top) continue;
    const mine = withId.filter((o) => o.openalexAuthorId === top);
    const share = mine.length / occ.length;
    if (mine.length < IDENTITY_MIN_OCCURRENCES || share < IDENTITY_MIN_SHARE) continue;
    const orcid = mode(mine.map((o) => o.orcid));
    const inst = mode(mine.map((o) => o.institution));
    const instRows = mine.filter((o) => o.institution === inst);
    out.push({
      authorKey,
      openalexAuthorId: top,
      displayName: mode(mine.map((o) => o.displayName)) ?? mine[0].rawName,
      orcid: orcid ? normalizeOrcid(orcid) : null,
      institution: inst,
      institutionCountry: inst ? mode(instRows.map((o) => o.institutionCountry)) : null,
      institutionRor: inst ? mode(instRows.map((o) => o.institutionRor)) : null,
      occurrences: mine.length,
      share: Math.round(share * 1000) / 1000,
    });
  }
  return out.sort((a, b) => b.occurrences - a.occurrences || a.authorKey.localeCompare(b.authorKey));
}

/** "https://orcid.org/0000-0002-0758-1907" | "0000-0002-0758-1907" → "0000-0002-0758-1907"; null when malformed. */
export function normalizeOrcid(v: string | null | undefined): string | null {
  const m = String(v ?? "").match(/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])/);
  return m ? m[1] : null;
}

export function orcidUrl(orcid: string): string {
  return `https://orcid.org/${orcid}`;
}

export function openAlexAuthorUrl(id: string): string {
  return `https://openalex.org/${id.replace(/^https?:\/\/openalex\.org\//, "")}`;
}
