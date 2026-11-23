import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";

/**
 * Fetch page data from Express (server/routes/page-data-routes.ts) over the
 * private network. Express owns queries, redirects and 410s; Next renders.
 */
export const SITE_URL = "https://hydrogenstudies.com";
/** Tag on every cached page-data entry — revalidating it refreshes everything. */
export const PAGE_DATA_TAG = "page-data";
const EXPRESS_ORIGIN = process.env.EXPRESS_ORIGIN || "http://localhost:5000";

/**
 * Next rejects cache tags over 256 chars (it warns and drops them), so a long
 * study slug produced a tag that /web_revalidate could never bust. Tags over
 * MAX_TAG_LENGTH become a stable short form: a readable prefix plus a sha1
 * digest of the full tag. Both the cache (expressJson) and revalidation
 * (app/web_revalidate/route.ts) must go through this so the forms match.
 */
const MAX_TAG_LENGTH = 200;
export function cacheTag(tag: string): string {
  if (tag.length <= MAX_TAG_LENGTH) return tag;
  const digest = createHash("sha1").update(tag).digest("hex").slice(0, 16);
  return `${tag.slice(0, 64)}~${digest}`;
}

export class PageDataError extends Error {
  constructor(public status: number) {
    super(`page-data ${status}`);
  }
}

/**
 * Pages render per request (fresh CSP nonce each time), so the page DATA is
 * what's cached: Next's data cache keeps each path's JSON for `revalidate`
 * seconds (0 = always fresh). Errors (404/410) are never cached.
 */
export async function pageData<T>(path: string, revalidate: number, tags: string[] = []): Promise<T> {
  return expressJson<T>(`/api/page-data${path}`, revalidate, tags);
}

/** Any Express JSON endpoint (e.g. the public stats the homepage shows). */
export async function expressJson<T>(path: string, revalidate: number, tags: string[] = []): Promise<T> {
  const fetcher = async (): Promise<T> => {
    const res = await fetch(`${EXPRESS_ORIGIN}${path}`, {
      headers: { "x-page-data-key": process.env.PAGE_DATA_KEY ?? "" },
      cache: "no-store",
    });
    if (!res.ok) throw new PageDataError(res.status);
    return res.json() as Promise<T>;
  };
  // Tagged with the page path so an admin edit can drop it at once
  // (Express → POST /web_revalidate, see app/web_revalidate/route.ts).
  return revalidate > 0
    ? unstable_cache(fetcher, ["express", path], { revalidate, tags: [PAGE_DATA_TAG, ...tags.map(cacheTag)] })()
    : fetcher();
}

export interface FooterCondition {
  name: string;
  slug: string;
}
