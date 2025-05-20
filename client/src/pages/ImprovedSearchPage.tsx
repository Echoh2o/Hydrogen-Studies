import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Pagination } from "@/components/ui/pagination";
import { Search, CalendarIcon, BookOpen, Award, AlertCircle, FileText, User } from "lucide-react";

type Study = {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate: string;
  category: string;
  peerReviewed: boolean;
  methods?: string | null;
  results?: string | null;
  conclusion?: string | null;
  doi?: string | null;
  imageUrl?: string | null;
  publishYear?: number | null;
};

type SearchResults = {
  data: Study[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  };
};

export default function ImprovedSearchPage() {
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const pageSize = 10;

  // Extract query parameters from URL if they exist
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const page = params.get("page");
    if (q) setSearchQuery(q);
    if (page) setCurrentPage(parseInt(page, 10));
  }, [location]);

  // Query the improved search endpoint
  const { data: searchResults, refetch, isFetching } = useQuery<SearchResults>({
    queryKey: ['/api/improved-search', searchQuery, currentPage, pageSize],
    enabled: !!searchQuery,
  });

  // Handle search submission
  const handleSearch = () => {
    if (searchQuery.trim() === "") return;
    setCurrentPage(1);
    const params = new URLSearchParams();
    params.set("q", searchQuery);
    params.set("page", "1");
    setLocation(`/improved-search?${params.toString()}`);
    refetch();
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const params = new URLSearchParams(window.location.search);
    params.set("page", page.toString());
    setLocation(`/improved-search?${params.toString()}`);
    refetch();
  };

  // Handle keypress for search input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };

  // Truncate text for display
  const truncateText = (text: string, maxLength: number) => {
    if (!text) return "";
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  // Get authors for display
  const getAuthors = (authors: string) => {
    if (!authors) return "";
    const authorList = authors.split(",");
    if (authorList.length <= 2) return authors;
    return `${authorList[0]}, ${authorList[1]}, et al.`;
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2 text-primary">Hydrogen Studies Search</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Search through our extensive collection of hydrogen health research studies.
          Our improved search system removes duplicates and finds the most relevant results.
        </p>
      </div>

      <div className="max-w-4xl mx-auto mb-6">
        <div className="relative">
          <Input
            type="text"
            placeholder="Search for hydrogen studies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pl-10 py-6 text-lg rounded-lg shadow-sm"
          />
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <Button 
            onClick={handleSearch} 
            disabled={isFetching || !searchQuery.trim()}
            className="absolute right-1 top-1 rounded-lg"
          >
            {isFetching ? "Searching..." : "Search"}
          </Button>
        </div>
      </div>

      {searchResults?.data?.length === 0 && searchQuery && !isFetching && (
        <Card className="max-w-4xl mx-auto mb-8">
          <CardContent className="pt-6 pb-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-xl font-medium mb-2">No studies found</h3>
            <p className="text-gray-600">
              We couldn't find any studies matching "{searchQuery}". 
              Try using different keywords or broadening your search.
            </p>
          </CardContent>
        </Card>
      )}

      {isFetching && (
        <div className="flex justify-center items-center my-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      )}

      {searchResults?.data?.length > 0 && !isFetching && (
        <div className="max-w-4xl mx-auto">
          <div className="mb-4 flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Found <span className="font-semibold">{searchResults.pagination.total}</span> distinct studies
              {searchQuery ? ` for "${searchQuery}"` : ""}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Sort by:</span>
              <select className="text-sm border rounded-md px-2 py-1">
                <option value="date">Date (Newest)</option>
                <option value="relevance">Relevance</option>
                <option value="title">Title</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {searchResults.data.map((study) => (
              <Card key={study.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <Link href={`/studies/${study.id}`}>
                          <a className="text-xl font-semibold text-primary-700 hover:text-primary-800 hover:underline">
                            {study.title}
                          </a>
                        </Link>
                      </div>
                      {study.peerReviewed && (
                        <Badge variant="outline" className="ml-2 flex items-center gap-1.5">
                          <Award className="h-3.5 w-3.5" />
                          <span>Peer Reviewed</span>
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        <span>{getAuthors(study.authors)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>{study.journal || "Journal not specified"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        <span>{formatDate(study.publishDate)}</span>
                      </div>
                    </div>

                    <p className="text-gray-700 mb-4">
                      {truncateText(study.abstract, 250)}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{study.category}</Badge>
                      {study.doi && (
                        <Badge variant="outline" className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[200px]">DOI: {study.doi}</span>
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {searchResults.pagination.pageCount > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={searchResults.pagination.pageCount}
              onPageChange={handlePageChange}
              className="mt-8"
            />
          )}
        </div>
      )}
    </div>
  );
}