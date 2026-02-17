import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Loader2,
  Search,
  Database,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

export default function SemanticScholarSearch() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPaperId, setSelectedPaperId] = useState("");
  const [page, setPage] = useState(1);
  const [offset, setOffset] = useState(0);
  const limit = 10;

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: async ({
      query,
      offset,
    }: {
      query: string;
      offset: number;
    }) => {
      const response = await apiRequest(
        "GET",
        `/api/research/semantic-scholar/search?query=${encodeURIComponent(query)}&offset=${offset}&limit=${limit}`,
      );
      return response.json();
    },
    onSuccess: (data) => {
      setSearchResults(data.data || []);
    },
    onError: (error: any) => {
      toast({
        title: "Search failed",
        description: error.message || "Failed to search Semantic Scholar",
        variant: "destructive",
      });
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (paperId: string) => {
      const response = await apiRequest(
        "POST",
        `/api/semantic-scholar/import`,
        { paperId },
      );
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Study imported",
          description: `Successfully imported: ${data.study.title}`,
        });
      } else {
        toast({
          title: "Import failed",
          description: data.message || "Failed to import study",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Import failed",
        description: error.message || "Failed to import study",
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Search query required",
        description: "Please enter a search term",
        variant: "destructive",
      });
      return;
    }
    setOffset((page - 1) * limit);
    searchMutation.mutate({ query: searchQuery, offset });
  };

  const handleImport = (paperId: string) => {
    setSelectedPaperId(paperId);
    importMutation.mutate(paperId);
  };

  const formatAuthors = (authors: any[]) => {
    if (!authors || !authors.length) return "Unknown authors";
    return (
      authors
        .slice(0, 3)
        .map((author: any) => author.name || "")
        .join(", ") + (authors.length > 3 ? " et al." : "")
    );
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    const newOffset = (newPage - 1) * limit;
    setOffset(newOffset);
    searchMutation.mutate({ query: searchQuery, offset: newOffset });
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-2">
        <div className="flex-1">
          <Label htmlFor="search-query">Search Term</Label>
          <div className="flex mt-1.5">
            <Input
              id="search-query"
              placeholder="Search for articles (e.g., hydrogen therapy inflammation)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button
              onClick={handleSearch}
              disabled={searchMutation.isPending || !searchQuery.trim()}
              className="ml-2"
            >
              {searchMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Enter keywords to search for research articles in Semantic Scholar
          </p>
        </div>
      </div>

      {searchMutation.isPending ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
        </div>
      ) : searchResults.length > 0 ? (
        <div className="space-y-4">
          <div className="text-sm text-gray-500">
            Showing {searchResults.length} results (page {page})
          </div>

          {searchResults.map((paper: any, index: number) => (
            <Card key={index} className="overflow-hidden">
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
                    <div className="flex items-center mt-2">
                      {paper.isOpenAccess && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mr-2">
                          Open Access
                        </span>
                      )}
                      {paper.fieldsOfStudy &&
                        paper.fieldsOfStudy.map((field: string, i: number) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800 mr-2"
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
                      onClick={() => handleImport(paper.paperId)}
                      disabled={
                        importMutation.isPending &&
                        selectedPaperId === paper.paperId
                      }
                    >
                      {importMutation.isPending &&
                      selectedPaperId === paper.paperId ? (
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

          <div className="flex justify-between mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1 || searchMutation.isPending}
            >
              Previous
            </Button>
            <div className="text-sm py-2">Page {page}</div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={
                searchResults.length < limit || searchMutation.isPending
              }
            >
              Next
            </Button>
          </div>
        </div>
      ) : searchMutation.isSuccess && searchResults.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <AlertCircle className="h-10 w-10 mx-auto text-gray-300 mb-3" />
          <p>No results found. Try different search terms.</p>
        </div>
      ) : null}
    </div>
  );
}
