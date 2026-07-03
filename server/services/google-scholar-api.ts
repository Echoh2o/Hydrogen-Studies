/**
 * Google Scholar Search Integration
 *
 * Google Scholar doesn't have an official API. We use the SerpAPI service
 * if a SERPAPI_KEY is configured, otherwise fall back to a lightweight
 * scraping approach via the scholarly JSON proxy.
 *
 * Supported strategies:
 * 1. SerpAPI (preferred, reliable, paid) — env: SERPAPI_KEY
 * 2. Scholarly proxy (free, rate-limited) — no key needed
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
 * Search Google Scholar via direct HTTP (fallback, rate-limited)
 *
 * This makes a direct request to Google Scholar and parses the response.
 * WARNING: Google aggressively rate-limits this. Use sparingly (< 10 req/hour).
 * SerpAPI is strongly recommended for production use.
 */
async function searchViaDirectHttp(
  query: string,
  start: number = 0,
): Promise<ScholarResult[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      start: String(start),
      hl: "en",
    });

    const response = await fetchWithTimeout(`https://scholar.google.com/scholar?${params}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn("[Google Scholar] Rate limited (429). Use SERPAPI_KEY for reliable access.");
      }
      return [];
    }

    const html = await response.text();

    // Parse results from HTML (lightweight extraction)
    const results: ScholarResult[] = [];
    const articleRegex = /<div class="gs_ri">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
    let match;

    while ((match = articleRegex.exec(html)) !== null) {
      const block = match[1];

      // Title and URL
      const titleMatch = block.match(/<h3[^>]*>.*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
      const title = titleMatch ? titleMatch[2].replace(/<[^>]*>/g, "").trim() : "";
      const url = titleMatch ? titleMatch[1] : "";

      // Authors and journal info
      const infoMatch = block.match(/<div class="gs_a">([\s\S]*?)<\/div>/);
      const info = infoMatch ? infoMatch[1].replace(/<[^>]*>/g, "").trim() : "";
      const infoParts = info.split(" - ");
      const authors = infoParts[0]?.trim() || "";
      const journalInfo = infoParts[1]?.trim() || "";

      // Snippet/abstract
      const snippetMatch = block.match(/<div class="gs_rs">([\s\S]*?)<\/div>/);
      const abstract = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, "").trim() : "";

      // Citation count
      const citeMatch = block.match(/Cited by (\d+)/);
      const citationCount = citeMatch ? parseInt(citeMatch[1]) : 0;

      // Year
      const yearMatch = info.match(/(\d{4})/);

      if (title) {
        results.push({
          title,
          abstract,
          authors,
          journal: journalInfo,
          publishDate: yearMatch ? `${yearMatch[1]}-01-01` : "",
          doi: "",
          url,
          source: "google_scholar",
          externalId: url,
          citationCount,
        });
      }
    }

    return results;
  } catch (error) {
    console.error("[Google Scholar] Direct HTTP search error:", error);
    return [];
  }
}

/**
 * Main search function — uses SerpAPI if available, falls back to direct HTTP
 */
export async function searchGoogleScholar(
  query: string,
  page: number = 1,
  pageSize: number = 20,
): Promise<{ results: ScholarResult[]; total: number; method: string }> {
  const start = (page - 1) * pageSize;

  // Prefer SerpAPI
  if (process.env.SERPAPI_KEY) {
    const results = await searchViaSerpApi(query, start, pageSize);
    return { results, total: results.length, method: "serpapi" };
  }

  // Fallback to direct HTTP (rate-limited)
  console.warn("[Google Scholar] No SERPAPI_KEY set. Using direct HTTP (rate-limited, unreliable).");
  const results = await searchViaDirectHttp(query, start);
  return { results, total: results.length, method: "direct_http" };
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
