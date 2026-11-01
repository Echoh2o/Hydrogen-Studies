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

export async function pageData<T>(path: string, revalidate: number): Promise<T> {
  const res = await fetch(`${EXPRESS_ORIGIN}/api/page-data${path}`, {
    headers: { "x-page-data-key": process.env.PAGE_DATA_KEY ?? "" },
    next: { revalidate },
  });
  if (!res.ok) throw new PageDataError(res.status);
  return res.json() as Promise<T>;
}

export interface FooterCondition {
  name: string;
  slug: string;
}
