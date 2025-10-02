/**
 * Europe PMC API integration
 * Searches for research articles in Europe PMC database
 */

import axios from "axios";

export async function searchEuropePMC(
  query: string,
  page: number = 1,
  pageSize: number = 10,
): Promise<{ results: any[]; total: number }> {
  try {
    console.log(
      `Searching EuropePMC for: "${query}", page ${page}, size ${pageSize}`,
    );

    // Use simple query format for Europe PMC
    const enhancedQuery = query;

    console.log(`Sending request to EuropePMC with query: ${enhancedQuery}`);

    const response = await axios.get(
      "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
      {
        params: {
          query: enhancedQuery,
          resultType: "core",
          format: "json",
          pageSize: pageSize,
          page: page,
          sort: "RELEVANCE",
        },
        timeout: 10000,
      },
    );

    // Debug: Check if we got actual results
    if (response.data.resultList && response.data.resultList.result) {
      console.log(
        `EuropePMC API found ${response.data.resultList.result.length} results`,
      );
    } else {
      console.log(
        `EuropePMC API response structure:`,
        Object.keys(response.data),
      );
    }
    console.log(
      `EuropePMC returned ${response.data.resultList?.result?.length || 0} results of ${response.data.hitCount || 0} total hits`,
    );

    const results = (response.data.resultList?.result || []).map(
      (article: any) => ({
        id: article.id || article.pmid || article.pmcid || "unknown",
        title: article.title || "No title available",
        abstract: article.abstractText || "No abstract available",
        authors:
          article.authorList?.author
            ?.map((author: any) =>
              `${author.firstName || ""} ${author.lastName || ""}`.trim(),
            )
            .join(", ") || "Unknown authors",
        journal: article.journalInfo?.journal?.title || "Unknown journal",
        year: article.pubYear || "Unknown year",
        url:
          article.fullTextUrlList?.fullTextUrl?.[0]?.url ||
          `https://europepmc.org/article/MED/${article.pmid || article.id}`,
        source: "Europe PMC",
      }),
    );

    return {
      results,
      total: response.data.hitCount || 0,
    };
  } catch (error) {
    console.error("Europe PMC search error:", error.message);
    console.error(
      "Europe PMC error details:",
      error.response?.data || error.response?.status,
    );
    return {
      results: [],
      total: 0,
    };
  }
}
