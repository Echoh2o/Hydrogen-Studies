/**
 * Researcher identities (migration 030) as the profile pages read them:
 * author-name key → ORCID / institution / OpenAlex author, cached 30 minutes.
 * Absent row = name-only profile (shared names, or not yet backfilled).
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import { logger } from "../utils/logger";

export interface ResearcherIdentity {
  authorKey: string;
  openalexAuthorId: string;
  displayName: string;
  orcid: string | null;
  institution: string | null;
  institutionCountry: string | null;
  institutionRor: string | null;
  occurrences: number;
  share: number;
  updatedAt: Date | null;
}

const TTL_MS = 30 * 60 * 1000;
let _map: Map<string, ResearcherIdentity> | null = null;
let _at = 0;

export async function getIdentityMap(): Promise<Map<string, ResearcherIdentity>> {
  if (_map && Date.now() - _at < TTL_MS) return _map;
  try {
    const r = await db.execute(sql`
      SELECT author_key, openalex_author_id, display_name, orcid, institution, institution_country, institution_ror,
             occurrences, share, updated_at
        FROM researcher_identities`);
    _map = new Map(
      (r.rows as any[]).map((x) => [
        String(x.author_key),
        {
          authorKey: String(x.author_key),
          openalexAuthorId: String(x.openalex_author_id),
          displayName: String(x.display_name),
          orcid: x.orcid ? String(x.orcid) : null,
          institution: x.institution ? String(x.institution) : null,
          institutionCountry: x.institution_country ? String(x.institution_country) : null,
          institutionRor: x.institution_ror ? String(x.institution_ror) : null,
          occurrences: Number(x.occurrences),
          share: Number(x.share),
          updatedAt: x.updated_at ? new Date(x.updated_at) : null,
        },
      ]),
    );
    // An empty table (migration just ran, backfill not yet applied) is not cached,
    // so the first apply shows up on the next request rather than after the TTL.
    _at = _map.size ? Date.now() : 0;
  } catch (err) {
    // Table missing (migration pending) or DB blip: profiles render name-only.
    logger.warn("researcher identities unavailable", "Profiles", { error: err instanceof Error ? err.message : String(err) });
    _map = _map ?? new Map();
    _at = _map.size ? Date.now() : 0;
  }
  return _map;
}

export async function getIdentity(authorKey: string): Promise<ResearcherIdentity | null> {
  return (await getIdentityMap()).get(authorKey) ?? null;
}

export function __resetIdentitiesForTests(): void {
  _map = null;
  _at = 0;
}
