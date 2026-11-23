import type { NextFunction, Request, Response } from "express";
import { abstractExcerpt } from "@shared/seo-markup";
import { isAdminRequest } from "../auth";

/**
 * CLAUDE.md: "Abstracts: show ≤300-character excerpt + link to PubMed/DOI.
 * Never republish full abstracts (publisher copyright)." The rendered pages
 * already comply; this applies the same rule to every JSON response.
 *
 * Only serialization changes. The DB keeps the full abstract, and server-side
 * readers (embeddings, enrichment, search indexing, chat/Ask context) read it
 * from the DB as before. Admins get the full text so the admin UI, which loads
 * studies through these same endpoints and saves them back, never sees (and so
 * never writes back) an excerpt.
 */

/** A response object we treat as a study record: it carries a string `abstract`. */
function isStudyLike(o: Record<string, unknown>): boolean {
  // Scientific articles (`articleType`) carry our own generated "abstract"
  // section, not the publisher's — leave those alone.
  return typeof o.abstract === "string" && !("articleType" in o);
}

/**
 * One study record as the public may see it: `abstract` becomes the ≤300-char
 * excerpt (same field name, so client code keeps working; null when there is
 * no real abstract), and the stored full paper text (`fullText`) is withheld.
 * With `fullAccess` (admin) the record is returned unchanged.
 */
export function publicStudy<T>(study: T, fullAccess = false): T {
  if (fullAccess || !study || typeof study !== "object") return study;
  const o = study as unknown as Record<string, unknown>;
  const studyLike = isStudyLike(o);
  const hasFullText = o.fullText != null;
  if (!studyLike && !hasFullText) return study;
  const out: Record<string, unknown> = { ...o };
  if (studyLike) out.abstract = abstractExcerpt(o.abstract as string) || null;
  if (hasFullText) out.fullText = null;
  return out as T;
}

const MAX_DEPTH = 12;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * Apply publicStudy to every study record anywhere in a response body (lists,
 * `{ studies: [...] }`, search hits, nested `study` objects). Copy-on-write:
 * cached objects are never mutated, untouched branches are returned as-is.
 */
export function publicAbstracts<T>(body: T, fullAccess = false, depth = 0): T {
  if (fullAccess || depth > MAX_DEPTH || body === null || typeof body !== "object") return body;
  if (Array.isArray(body)) {
    let changed = false;
    const out = body.map((v) => {
      const nv = publicAbstracts(v, false, depth + 1);
      if (nv !== v) changed = true;
      return nv;
    });
    return (changed ? out : body) as T;
  }
  if (!isPlainObject(body)) return body;
  let out: Record<string, unknown> | null = null;
  for (const [k, v] of Object.entries(body)) {
    if (v === null || typeof v !== "object") continue;
    const nv = publicAbstracts(v, false, depth + 1);
    if (nv !== v) (out ??= { ...body })[k] = nv;
  }
  return publicStudy((out ?? body) as T, false);
}

/** True when this request may see full abstracts (set by resolveAbstractAccess). */
export function hasFullAbstractAccess(res: Response): boolean {
  return res.locals?.fullAbstractAccess === true;
}

/**
 * Mount first, before any router: every res.json() body is passed through
 * publicAbstracts unless resolveAbstractAccess (mounted after the session
 * middleware) marked the request as admin. Routers mounted before the session
 * (embed, evidence, Ask, MCP, page-data, proxy…) therefore always excerpt.
 */
export function publicAbstractsJson(_req: Request, res: Response, next: NextFunction): void {
  const json = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (hasFullAbstractAccess(res)) {
      // Full text is per-user: never let a shared cache keep it.
      res.setHeader("Cache-Control", "private, no-store");
      return json(body);
    }
    return json(publicAbstracts(body));
  }) as Response["json"];
  next();
}

/** Mount right after the session middleware. Anonymous requests cost no DB hit. */
export async function resolveAbstractAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.locals.fullAbstractAccess = await isAdminRequest(req);
  } catch {
    res.locals.fullAbstractAccess = false;
  }
  next();
}

/**
 * Write-back guard for admin edits: when an incoming abstract is exactly the
 * public excerpt of the stored (longer) abstract — e.g. the edit form was
 * filled from a response cached before the admin logged in — it is not a real
 * edit and must not overwrite the full text.
 */
export function isExcerptOfStored(incoming: unknown, stored: string | null | undefined): boolean {
  if (typeof incoming !== "string" || !stored) return false;
  const inc = incoming.trim();
  if (!inc || inc === stored.trim()) return false;
  return inc.length < stored.trim().length && inc === abstractExcerpt(stored);
}
