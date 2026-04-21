import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { Database, ExternalLink, Loader2 } from "lucide-react";
import { SearchInputBar } from "./external-search/SearchInputBar";
import { SearchPagination } from "./external-search/SearchPagination";
import { EmptySearchState } from "./external-search/EmptySearchState";
import { useExternalSearch } from "./external-search/use-external-search";

interface SemanticScholarAuthor {
  name?: string;
}

interface SemanticScholarPaper {
  paperId: string;
  title?: string;
  authors?: SemanticScholarAuthor[];
  venue?: string;
  journal?: { name?: string };
  year?: number;
  citationCount?: number;
  isOpenAccess?: boolean;
  fieldsOfStudy?: string[];
  abstract?: string;
  url?: string;
}

const LIMIT = 10;

function formatAuthors(authors?: SemanticScholarAuthor[]): string {
  if (!authors || !authors.length) return "Unknown authors";
  return (
    authors
      .slice(0, 3)
      .map((a) => a.name || "")
      .join(", ") + (authors.length > 3 ? " et al." : "")
  );
}

export default function SemanticScholarSearch() {
  const search = useExternalSearch<SemanticScholarPaper, string>({
    sourceName: "Semantic Scholar",
    pageSize: LIMIT,
    search: async (query, page) => {
      const offset = (page - 1) * LIMIT;
      const res = await apiRequest(
        "GET",
        `/api/research/semantic-scholar/search?query=${encodeURIComponent(query)}&offset=${offset}&limit=${LIMIT}`,
      );
      const data = await res.json();
      const items: SemanticScholarPaper[] = data.data ?? [];
      // No total count — infer from whether we hit a full page.
      return {
        items,
        totalResults: items.length < LIMIT ? (page - 1) * LIMIT + items.length : page * LIMIT + 1,
      };
    },
    import: async (paperId) => {
      const res = await apiRequest("POST", "/api/semantic-scholar/import", { paperId });
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
        helpText="Enter keywords to search for research articles in Semantic Scholar"
      />

      {search.results.length > 0 ? (
        <div className="space-y-4">
          <div className="text-sm text-gray-500">
            Showing {search.results.length} results (page {search.page})
          </div>

          {search.results.map((paper, index) => (
            <Card key={paper.paperId || index} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:justify-between">
                  <div className="flex-1 space-y-1">
                    <h3 className="font-medium text-base">{paper.title}</h3>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Authors:</span>{" "}
                      {formatAuthors(paper.authors)}
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Journal:</span>{" "}
                      {paper.venue || paper.journal?.name || "N/A"}
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Year:</span>{" "}
                      {paper.year || "N/A"} •{" "}
                      <span className="font-medium">Citations:</span>{" "}
                      {paper.citationCount || 0}
                    </div>
                    <div className="flex items-center mt-2 flex-wrap gap-1">
                      {paper.isOpenAccess && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Open Access
                        </span>
                      )}
                      {paper.fieldsOfStudy?.map((field, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                    {paper.abstract && (
                      <div className="text-sm text-gray-700 mt-2 border-t pt-2">
                        <p className="line-clamp-3">{paper.abstract}</p>
                      </div>
                    )}
                  </div>
                  <div className="md:ml-4 mt-3 md:mt-0 flex md:flex-col justify-end md:justify-center space-y-2">
                    <Button
                      size="sm"
                      onClick={() => search.runImport(paper.paperId)}
                      disabled={
                        search.isImporting && search.selectedImportId === paper.paperId
                      }
                    >
                      {search.isImporting && search.selectedImportId === paper.paperId ? (
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
                    {paper.url && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(paper.url, "_blank")}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View
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
