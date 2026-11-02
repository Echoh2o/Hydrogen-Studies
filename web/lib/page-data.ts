import { unstable_cache } from "next/cache";

/**
 * Fetch page data from Express (server/routes/page-data-routes.ts) over the
 * private network. Express owns queries, redirects and 410s; Next renders.
 */
export const SITE_URL = "https://hydrogenstudies.com";
const EXPRESS_ORIGIN = process.env.EXPRESS_ORIGIN || "http://localhost:5000";

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
export async function pageData<T>(path: string, revalidate: number): Promise<T> {
  return expressJson<T>(`/api/page-data${path}`, revalidate);
}

/** Any Express JSON endpoint (e.g. the public stats the homepage shows). */
export async function expressJson<T>(path: string, revalidate: number): Promise<T> {
  const fetcher = async (): Promise<T> => {
    const res = await fetch(`${EXPRESS_ORIGIN}${path}`, {
      headers: { "x-page-data-key": process.env.PAGE_DATA_KEY ?? "" },
      cache: "no-store",
    });
    if (!res.ok) throw new PageDataError(res.status);
    return res.json() as Promise<T>;
  };
  return revalidate > 0 ? unstable_cache(fetcher, ["express", path], { revalidate })() : fetcher();
}

export interface FooterCondition {
  name: string;
  slug: string;
}
