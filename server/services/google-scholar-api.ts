/**
 * Google Scholar Search Integration
 *
 * Google Scholar doesn't have an official API. We use the SerpAPI service
 * if a SERPAPI_KEY is configured. When no key is present the Scholar source
 * is a no-op — we deliberately do NOT scrape scholar.google.com directly.
 * Direct HTML scraping (with a spoofed browser User-Agent) violates Google's
 * ToS, gets the production egress IP blocked, and is unreliable, so that path
 * has been removed.
 *
 * Supported strategies:
 * 1. SerpAPI (preferred, reliable, paid) — env: SERPAPI_KEY
 *    Without SERPAPI_KEY, searches return no results.
 *
 * Google Scholar is valuable because it indexes:
 * - Published journal articles
 * - Conference papers
 * - Theses and dissertations
 * - Preprints (arXiv, SSRN, etc.)
 * - Court opinions and patents (less relevant for us)
 *
 * It also provides citation counts — useful for prioritizing studies.
 */

import { fetchWithTimeout } from "../utils/http";

interface ScholarResult {
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate: string;
  doi: string;
  url: string;
  source: string;
  externalId: string;
  citationCount?: number;
  pdfUrl?: string;
}

const USER_AGENT = "Mozilla/5.0 (compatible; HydrogenStudiesBot/1.0; +https://hydrogenstudies.com)";

/**
 * Search Google Scholar via SerpAPI
 * Requires SERPAPI_KEY environment variable
 */
async function searchViaSerpApi(
  query: string,
  start: number = 0,
  num: number = 20,
): Promise<ScholarResult[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      engine: "google_scholar",
      q: query,
      api_key: apiKey,
      start: String(start),
      num: String(num),
      hl: "en",
    });

    // 30s: SerpAPI runs a live Scholar search server-side and can take
    // well over 10s on cache misses.
    const response = await fetchWithTimeout(`https://serpapi.com/search.json?${params}`, {
      headers: { "User-Agent": USER_AGENT },
    }, 30_000);

    if (!response.ok) {
      console.error(`[Google Scholar] SerpAPI error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const results = data.organic_results || [];

    return results.map((item: any) => {
      // Extract authors and journal from the publication info
      const pubInfo = item.publication_info?.summary || "";
      const authorMatch = pubInfo.match(/^([^-]+)/);
      const journalMatch = pubInfo.match(/-\s*(.+?)(?:,\s*\d{4}|$)/);

      // Extract year from snippet or publication info
      const yearMatch = pubInfo.match(/(\d{4})/);

      return {
        title: item.title || "",
        abstract: item.snippet || "",
        authors: authorMatch ? authorMatch[1].trim() : "",
        journal: journalMatch ? journalMatch[1].trim() : "",
        publishDate: yearMatch ? `${yearMatch[1]}-01-01` : "",
        doi: "", // Scholar doesn't always provide DOI directly
        url: item.link || "",
        source: "google_scholar",
        externalId: item.result_id || item.link || "",
        citationCount: item.inline_links?.cited_by?.total || 0,
        pdfUrl: item.resources?.[0]?.link || "",
      };
    });
  } catch (error) {
    console.error("[Google Scholar] SerpAPI search error:", error);
    return [];
  }
}

/**
 * Main search function — uses SerpAPI when SERPAPI_KEY is configured.
 *
 * When no key is present this is a deliberate no-op: we do not scrape
 * scholar.google.com directly (ToS violation + IP-block risk), so the source
 * simply returns no results with a warning.
 */
export async function searchGoogleScholar(
  query: string,
  page: number = 1,
  pageSize: number = 20,
): Promise<{ results: ScholarResult[]; total: number; method: string }> {
  const start = (page - 1) * pageSize;

  // SerpAPI is the only supported strategy.
  if (process.env.SERPAPI_KEY) {
    const results = await searchViaSerpApi(query, start, pageSize);
    return { results, total: results.length, method: "serpapi" };
  }

  // No key: return empty. Direct HTML scraping has been removed.
  console.warn(
    "[Google Scholar] SERPAPI_KEY not set — Google Scholar source disabled (returning no results). " +
      "Configure SERPAPI_KEY to enable Scholar searches.",
  );
  return { results: [], total: 0, method: "disabled" };
}

/**
 * Get citation count for a specific paper by title
 * Useful for updating citation metrics on existing studies
 */
export async function getCitationCount(title: string): Promise<number | null> {
  if (!process.env.SERPAPI_KEY) return null;

  try {
    const results = await searchViaSerpApi(`"${title}"`, 0, 1);
    if (results.length > 0 && results[0].citationCount !== undefined) {
      return results[0].citationCount;
    }
    return null;
  } catch {
    return null;
  }
}
