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

export default function PubMedSearch() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPmid, setSelectedPmid] = useState("");
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const resultsPerPage = 10;

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: async ({ query, page }: { query: string; page: number }) => {
      const response = await apiRequest(
        "GET",
        `/api/research/pubmed/search?query=${encodeURIComponent(query)}&page=${page}&pageSize=${resultsPerPage}`,
      );
      return response.json();
    },
    onSuccess: (data) => {
      setSearchResults(data.data || []);
      setTotalResults(data.total || 0);
    },
    onError: (error: any) => {
      toast({
        title: "Search failed",
        description: error.message || "Failed to search PubMed",
        variant: "destructive",
      });
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (pmid: string) => {
      const response = await apiRequest("POST", `/api/research/pubmed/import`, {
        pmid,
      });
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
    searchMutation.mutate({ query: searchQuery, page });
  };

  const handleImport = (pmid: string) => {
    setSelectedPmid(pmid);
    importMutation.mutate(pmid);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      return dateString;
    }
  };

  const totalPages = Math.ceil(totalResults / resultsPerPage);

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
            Enter keywords to search for research articles in PubMed
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
            Showing {searchResults.length} of {totalResults} results (page{" "}
            {page} of {totalPages || 1})
          </div>

          {searchResults.map((article: any, index: number) => (
            <Card key={index} className="overflow-hidden">
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
                      onClick={() => handleImport(article.pmid)}
                      disabled={
                        importMutation.isPending &&
                        selectedPmid === article.pmid
                      }
                    >
                      {importMutation.isPending &&
                      selectedPmid === article.pmid ? (
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
                          window.open(
                            `https://doi.org/${article.doi}`,
                            "_blank",
                          )
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

          <div className="flex justify-between mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (page > 1) {
                  const newPage = page - 1;
                  setPage(newPage);
                  searchMutation.mutate({ query: searchQuery, page: newPage });
                }
              }}
              disabled={page === 1 || searchMutation.isPending}
            >
              Previous
            </Button>
            <div className="text-sm py-2">
              Page {page} of {totalPages || 1}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (page < totalPages) {
                  const newPage = page + 1;
                  setPage(newPage);
                  searchMutation.mutate({ query: searchQuery, page: newPage });
                }
              }}
              disabled={page >= totalPages || searchMutation.isPending}
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
