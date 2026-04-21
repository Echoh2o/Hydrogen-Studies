import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { Database, Loader2 } from "lucide-react";
import { SearchInputBar } from "./external-search/SearchInputBar";
import { SearchPagination } from "./external-search/SearchPagination";
import { EmptySearchState } from "./external-search/EmptySearchState";
import { useExternalSearch } from "./external-search/use-external-search";

interface CrossRefAuthor {
  family?: string;
  name?: string;
}

interface CrossRefItem {
  DOI: string;
  title?: string;
  author?: CrossRefAuthor[];
  container_title?: string;
  published?: { year?: number };
}

function formatAuthors(authors?: CrossRefAuthor[]): string {
  if (!authors || !authors.length) return "Unknown authors";
  return (
    authors
      .slice(0, 3)
      .map((a) => a.family || a.name || "")
      .join(", ") + (authors.length > 3 ? " et al." : "")
  );
}

export default function CrossRefSearch() {
  const search = useExternalSearch<CrossRefItem, string>({
    sourceName: "CrossRef",
    search: async (query, page) => {
      const res = await apiRequest(
        "GET",
        `/api/research/crossref/search?query=${encodeURIComponent(query)}&page=${page}`,
      );
      const data = await res.json();
      const items: CrossRefItem[] = data.items ?? [];
      // CrossRef doesn't return a total — infer totalPages from a full page.
      // If items < pageSize, this is the last page; otherwise assume there
      // could be at least one more.
      return {
        items,
        totalResults: items.length < 10 ? (page - 1) * 10 + items.length : page * 10 + 1,
      };
    },
    import: async (doi) => {
      const res = await apiRequest(
        "POST",
        `/api/crossref/import/${encodeURIComponent(doi)}`,
      );
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
        helpText="Enter keywords to search for research articles in CrossRef"
      />

      {search.results.length > 0 ? (
        <div className="space-y-4">
          <div className="text-sm text-gray-500">
            Showing {search.results.length} results (page {search.page})
          </div>

          {search.results.map((item, index) => (
            <Card key={item.DOI || index} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:justify-between">
                  <div className="flex-1 space-y-1">
                    <h3 className="font-medium text-base">{item.title}</h3>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Authors:</span>{" "}
                      {formatAuthors(item.author)}
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Journal:</span>{" "}
                      {item.container_title || "N/A"}
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Year:</span>{" "}
                      {item.published?.year || "N/A"}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      <span className="font-medium">DOI:</span> {item.DOI}
                    </div>
                  </div>
                  <div className="md:ml-4 mt-3 md:mt-0 flex md:flex-col justify-end md:justify-center">
                    <Button
                      size="sm"
                      onClick={() => search.runImport(item.DOI)}
                      disabled={
                        search.isImporting && search.selectedImportId === item.DOI
                      }
                    >
                      {search.isImporting && search.selectedImportId === item.DOI ? (
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
