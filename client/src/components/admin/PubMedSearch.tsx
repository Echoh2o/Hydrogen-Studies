import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { Database, ExternalLink, Loader2 } from "lucide-react";
import { SearchInputBar } from "./external-search/SearchInputBar";
import { SearchPagination } from "./external-search/SearchPagination";
import { EmptySearchState } from "./external-search/EmptySearchState";
import { useExternalSearch } from "./external-search/use-external-search";

interface PubMedArticle {
  pmid: string;
  title?: string;
  authors?: string;
  journal?: string;
  pubDate?: string;
  doi?: string;
  abstract?: string;
}

const RESULTS_PER_PAGE = 10;

function formatDate(dateString?: string): string {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

export default function PubMedSearch() {
  const search = useExternalSearch<PubMedArticle, string>({
    sourceName: "PubMed",
    pageSize: RESULTS_PER_PAGE,
    search: async (query, page) => {
      const res = await apiRequest(
        "GET",
        `/api/research/pubmed/search?query=${encodeURIComponent(query)}&page=${page}&pageSize=${RESULTS_PER_PAGE}`,
      );
      const data = await res.json();
      return { items: data.data ?? [], totalResults: data.total ?? 0 };
    },
    import: async (pmid) => {
      const res = await apiRequest("POST", "/api/research/pubmed/import", { pmid });
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <SearchInputBar
        value={search.query}
        onChange={search.setQuery}
        onSubmit={() => search.runSearch(1)}
        isLoading={search.isSearching}
        placeholder="Search for articles (e.g., hydrogen therapy inflammation)"
        helpText="Enter keywords to search for research articles in PubMed"
      />

      {search.results.length > 0 ? (
        <div className="space-y-4">
          <div className="text-sm text-gray-500">
            Showing {search.results.length} of {search.totalResults} results
            (page {search.page} of {search.totalPages})
          </div>

          {search.results.map((article, index) => (
            <Card key={article.pmid || index} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:justify-between">
                  <div className="flex-1 space-y-1">
                    <h3 className="font-medium text-base">{article.title}</h3>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Authors:</span>{" "}
                      {article.authors || "N/A"}
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Journal:</span>{" "}
                      {article.journal || "N/A"}
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Published:</span>{" "}
                      {formatDate(article.pubDate)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      <span className="font-medium">PMID:</span> {article.pmid}
                    </div>
                    {article.abstract && (
                      <div className="text-sm text-gray-700 mt-2 border-t pt-2">
                        <p className="line-clamp-3">{article.abstract}</p>
                      </div>
                    )}
                  </div>
                  <div className="md:ml-4 mt-3 md:mt-0 flex md:flex-col justify-end md:justify-center space-y-2">
                    <Button
                      size="sm"
                      onClick={() => search.runImport(article.pmid)}
                      disabled={
                        search.isImporting && search.selectedImportId === article.pmid
                      }
                    >
                      {search.isImporting && search.selectedImportId === article.pmid ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Database className="mr-2 h-4 w-4" />
                          Import
                        </>
                      )}
                    </Button>
                    {article.doi && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          window.open(`https://doi.org/${article.doi}`, "_blank")
                        }
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View DOI
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <SearchPagination
            page={search.page}
            totalPages={search.totalPages}
            isLoading={search.isSearching}
            onPageChange={(p) => search.runSearch(p)}
          />
        </div>
      ) : (
        <EmptySearchState
          isLoading={search.isSearching}
          hasSearched={search.hasSearched}
        />
      )}
    </div>
  );
}
