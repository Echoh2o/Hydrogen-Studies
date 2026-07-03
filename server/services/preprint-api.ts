/**
 * Preprint API Services — medRxiv & bioRxiv
 *
 * medRxiv: Health sciences preprints (clinical trials, public health, etc.)
 * bioRxiv: Biology preprints (molecular biology, biochemistry, etc.)
 *
 * Both use the same API at api.biorxiv.org (medRxiv is hosted by same org).
 * These preprints are NOT peer-reviewed but often contain early hydrogen
 * therapy research 6-12 months before journal publication.
 *
 * API docs: https://api.biorxiv.org/
 */

import { fetchWithTimeout } from "../utils/http";

interface PreprintResult {
  title: string;
  abstract: string;
  authors: string;
  journal: string; // "medRxiv" or "bioRxiv"
  publishDate: string;
  doi: string;
  url: string;
  source: string;
  externalId: string;
  category?: string;
  version?: string;
}

interface PreprintApiResponse {
  messages: Array<{ status: string; count: number; total: number }>;
  collection: Array<{
    doi: string;
    title: string;
    authors: string;
    author_corresponding: string;
    author_corresponding_institution: string;
    date: string;
    version: string;
    type: string; // "new" or "revised"
    license: string;
    category: string;
    jatsxml: string;
    abstract: string;
    published: string; // "NA" if not yet published
    server: string; // "medrxiv" or "biorxiv"
  }>;
}

const USER_AGENT = "HydrogenStudies.com Research Database/1.0 (https://hydrogenstudies.com)";

/**
 * Search medRxiv for preprints matching a query
 *
 * medRxiv API doesn't support keyword search directly — it uses date-range + content server endpoints.
 * We use the "details" endpoint to get recent preprints, then filter client-side by keywords.
 * For broader search, we can also use EuropePMC which indexes medRxiv preprints.
 */
async function fetchRecentPreprints(
  server: "medrxiv" | "biorxiv",
  fromDate: string, // YYYY-MM-DD
  toDate: string,   // YYYY-MM-DD
  cursor: number = 0,
  pageSize: number = 30,
): Promise<PreprintApiResponse> {
  const url = `https://api.biorxiv.org/details/${server}/${fromDate}/${toDate}/${cursor}`;

  // 30s: the biorxiv details endpoint returns bulk 100-record pages and the
  // public API is often sluggish.
  const response = await fetchWithTimeout(url, {
    headers: { "User-Agent": USER_AGENT },
  }, 30_000);

  if (!response.ok) {
    throw new Error(`${server} API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Search medRxiv preprints by keywords (client-side filtering on recent preprints)
 */
export async function searchMedRxiv(
  query: string,
  page: number = 1,
  pageSize: number = 20,
): Promise<{ results: PreprintResult[]; total: number }> {
  try {
    // Search the last 90 days of preprints
    const toDate = new Date().toISOString().split("T")[0];
    const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const data = await fetchRecentPreprints("medrxiv", fromDate, toDate, 0, 100);

    if (!data.collection || data.collection.length === 0) {
      return { results: [], total: 0 };
    }

    // Filter by query terms (case-insensitive)
    const terms = query.toLowerCase().split(/\s+or\s+|\s+/i).filter(t => t.length > 2);
    const filtered = data.collection.filter(item => {
      const text = `${item.title} ${item.abstract} ${item.category}`.toLowerCase();
      return terms.some(term => text.includes(term));
    });

    // Paginate
    const start = (page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    return {
      results: paged.map(item => ({
        title: item.title,
        abstract: item.abstract,
        authors: item.authors,
        journal: "medRxiv (Preprint)",
        publishDate: item.date,
        doi: item.doi,
        url: `https://www.medrxiv.org/content/${item.doi}v${item.version}`,
        source: "medrxiv",
        externalId: item.doi,
        category: item.category,
        version: item.version,
      })),
      total: filtered.length,
    };
  } catch (error) {
    console.error("[medRxiv API] Search error:", error);
    return { results: [], total: 0 };
  }
}

/**
 * Search bioRxiv preprints by keywords
 */
export async function searchBioRxiv(
  query: string,
  page: number = 1,
  pageSize: number = 20,
): Promise<{ results: PreprintResult[]; total: number }> {
  try {
    const toDate = new Date().toISOString().split("T")[0];
    const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const data = await fetchRecentPreprints("biorxiv", fromDate, toDate, 0, 100);

    if (!data.collection || data.collection.length === 0) {
      return { results: [], total: 0 };
    }

    const terms = query.toLowerCase().split(/\s+or\s+|\s+/i).filter(t => t.length > 2);
    const filtered = data.collection.filter(item => {
      const text = `${item.title} ${item.abstract} ${item.category}`.toLowerCase();
      return terms.some(term => text.includes(term));
    });

    const start = (page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    return {
      results: paged.map(item => ({
        title: item.title,
        abstract: item.abstract,
        authors: item.authors,
        journal: "bioRxiv (Preprint)",
        publishDate: item.date,
        doi: item.doi,
        url: `https://www.biorxiv.org/content/${item.doi}v${item.version}`,
        source: "biorxiv",
        externalId: item.doi,
        category: item.category,
        version: item.version,
      })),
      total: filtered.length,
    };
  } catch (error) {
    console.error("[bioRxiv API] Search error:", error);
    return { results: [], total: 0 };
  }
}

/**
 * Check if a preprint has been published in a peer-reviewed journal
 * Uses the biorxiv "published" endpoint
 */
export async function checkPreprintPublished(doi: string): Promise<{
  published: boolean;
  publishedDoi?: string;
  publishedUrl?: string;
} | null> {
  try {
    const url = `https://api.biorxiv.org/pubs/${doi}`;
    const response = await fetchWithTimeout(url, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.collection && data.collection.length > 0) {
      const pub = data.collection[0];
      if (pub.published_doi && pub.published_doi !== "NA") {
        return {
          published: true,
          publishedDoi: pub.published_doi,
          publishedUrl: `https://doi.org/${pub.published_doi}`,
        };
      }
    }

    return { published: false };
  } catch (error) {
    console.error("[Preprint API] Check published error:", error);
    return null;
  }
}
