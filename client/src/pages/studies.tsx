import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import StudyCard from "@/components/studies/study-card";
import { StudyListSkeleton, ErrorDisplay, EmptyState } from "@/components/ui/loading-states";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { FileSearch } from "lucide-react";
import { Study } from "@/types";

export default function Studies() {
  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split("?")[1] || "");
  
  const [filters, setFilters] = useState({
    query: urlParams.get("query") || "",
    keyword: urlParams.get("keyword") || "",
    author: urlParams.get("author") || "",
    yearFrom: urlParams.get("yearFrom") || "",
    yearTo: urlParams.get("yearTo") || "",
    category: urlParams.get("category") || "",
    peerReviewed: urlParams.get("peerReviewed") === "true",
    sortBy: "date",
    // Advanced search features
    useFuzzyMatch: urlParams.get("useFuzzyMatch") === "true",
    searchInMethods: urlParams.get("searchInMethods") !== "false",
    searchInResults: urlParams.get("searchInResults") !== "false",
    searchInConclusion: urlParams.get("searchInConclusion") !== "false",
    searchInSimplified: urlParams.get("searchInSimplified") !== "false",
    enrichmentStatus: (urlParams.get("enrichmentStatus") as "basic" | "partial" | "complete" | "") || "",
    tags: urlParams.get("tags")?.split(",") || [],
  });
  
  // Create query parameters for API request
  const queryParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    // Only add parameters that have actual values
    if (value !== undefined && value !== null && value !== '') {
      // For arrays, join with commas
      if (Array.isArray(value) && value.length > 0) {
        queryParams.append(key, value.join(','));
      } else if (typeof value === 'boolean') {
        queryParams.append(key, value.toString());
      } else if (value) {
        queryParams.append(key, value.toString());
      }
    }
  });
  
  // Update query when filters change
  useEffect(() => {
    // Update the URL with new filters without navigating
    const newParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && key !== 'sortBy') newParams.append(key, value.toString());
    });
    
    // Only update URL if we have parameters and they're different
    const newSearch = newParams.toString();
    if (newSearch && window.location.search !== `?${newSearch}`) {
      window.history.replaceState(null, '', `?${newSearch}`);
    }
  }, [filters]);
  
  const { data: studiesResponse, isLoading, isError, error, refetch } = useQuery<{
    data: Study[];
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  }>({
    queryKey: [`/api/studies`, queryParams.toString()],
    queryFn: async () => {
      const response = await fetch(`/api/studies?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch studies');
      }
      return response.json();
    }
  });
  
  // Extract the studies array from the paginated response
  const studies = studiesResponse?.data || [];
  
  const handleFilterChange = (key: string, value: string | boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  
  const handleResetFilters = () => {
    setFilters({
      query: "",
      keyword: "",
      author: "",
      yearFrom: "",
      yearTo: "",
      category: "",
      peerReviewed: false,
      sortBy: "date",
      // Reset advanced options
      useFuzzyMatch: true,
      searchInMethods: true,
      searchInResults: true,
      searchInConclusion: true,
      searchInSimplified: true,
      enrichmentStatus: "",
      tags: [],
    });
  };
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Search submitted with filters:", filters);
    
    // Update URL with search parameters
    const searchParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value) && value.length > 0) {
          searchParams.append(key, value.join(','));
        } else if (value) {
          searchParams.append(key, value.toString());
        }
      }
    });
    
    const newSearch = searchParams.toString();
    window.history.pushState(null, '', newSearch ? `?${newSearch}` : window.location.pathname);
    
    // Explicitly force a refetch
    refetch();
  };
  
  // Categories for filter dropdown
  const categories = [
    { id: "neurodegenerative", name: "Neurodegenerative Diseases" },
    { id: "cardiovascular", name: "Cardiovascular Health" },
    { id: "metabolism", name: "Metabolism & Diabetes" },
    { id: "inflammation", name: "Inflammation" },
    { id: "cancer", name: "Cancer Research" },
    { id: "aging", name: "Anti-Aging" },
  ];
  
  return (
    <>
      <Helmet>
        <title>Studies - Hydrogen Studies Research Database</title>
        <meta
          name="description"
          content="Browse and search through our comprehensive database of hydrogen gas studies and research papers."
        />
      </Helmet>
      
      <div className="bg-neutral-100 py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-screen-xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Studies</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Filters sidebar */}
              <div className="bg-white rounded-xl p-6 shadow-sm h-fit">
                <h2 className="font-bold text-lg mb-4">Filters</h2>
                <form onSubmit={handleSearch}>
                  <div className="space-y-6">
                    <div>
                      <Label htmlFor="search-query">Search</Label>
                      <Input
                        id="search-query"
                        placeholder="Search studies..."
                        className="mt-1"
                        value={filters.query}
                        onChange={(e) => handleFilterChange("query", e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={filters.category}
                        onValueChange={(value) => handleFilterChange("category", value)}
                      >
                        <SelectTrigger id="category" className="mt-1">
                          <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {categories.map(category => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="author">Author</Label>
                      <Input
                        id="author"
                        placeholder="Author name"
                        className="mt-1"
                        value={filters.author}
                        onChange={(e) => handleFilterChange("author", e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium mb-2">Year Range</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="yearFrom" className="sr-only">From</Label>
                          <Input
                            id="yearFrom"
                            placeholder="From"
                            type="number"
                            value={filters.yearFrom}
                            onChange={(e) => handleFilterChange("yearFrom", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="yearTo" className="sr-only">To</Label>
                          <Input
                            id="yearTo"
                            placeholder="To"
                            type="number"
                            value={filters.yearTo}
                            onChange={(e) => handleFilterChange("yearTo", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="peer-reviewed"
                        checked={filters.peerReviewed}
                        onCheckedChange={(checked) => 
                          handleFilterChange("peerReviewed", Boolean(checked))
                        }
                      />
                      <Label htmlFor="peer-reviewed">Peer-reviewed only</Label>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-4">
                      <details className="text-sm">
                        <summary className="font-medium cursor-pointer">Advanced Search Options</summary>
                        <div className="pl-2 pt-3 space-y-3">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="fuzzy-match"
                              checked={filters.useFuzzyMatch}
                              onCheckedChange={(checked) => 
                                handleFilterChange("useFuzzyMatch", Boolean(checked))
                              }
                            />
                            <Label htmlFor="fuzzy-match">Enable fuzzy matching for typos</Label>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium mb-2">Search within sections:</p>
                            <div className="grid grid-cols-2 gap-2 pl-2">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="search-methods"
                                  checked={filters.searchInMethods}
                                  onCheckedChange={(checked) => 
                                    handleFilterChange("searchInMethods", Boolean(checked))
                                  }
                                />
                                <Label htmlFor="search-methods">Methods</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="search-results"
                                  checked={filters.searchInResults}
                                  onCheckedChange={(checked) => 
                                    handleFilterChange("searchInResults", Boolean(checked))
                                  }
                                />
                                <Label htmlFor="search-results">Results</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="search-conclusion"
                                  checked={filters.searchInConclusion}
                                  onCheckedChange={(checked) => 
                                    handleFilterChange("searchInConclusion", Boolean(checked))
                                  }
                                />
                                <Label htmlFor="search-conclusion">Conclusion</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="search-simplified"
                                  checked={filters.searchInSimplified}
                                  onCheckedChange={(checked) => 
                                    handleFilterChange("searchInSimplified", Boolean(checked))
                                  }
                                />
                                <Label htmlFor="search-simplified">Simplified text</Label>
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <Label htmlFor="enrichment-status">Content Enrichment Level</Label>
                            <Select
                              value={filters.enrichmentStatus}
                              onValueChange={(value) => handleFilterChange("enrichmentStatus", value)}
                            >
                              <SelectTrigger id="enrichment-status" className="mt-1">
                                <SelectValue placeholder="Any enrichment level" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="any">Any enrichment level</SelectItem>
                                <SelectItem value="complete">Complete (all sections)</SelectItem>
                                <SelectItem value="partial">Partial (some sections)</SelectItem>
                                <SelectItem value="basic">Basic (title/abstract only)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </details>
                    </div>
                    
                    <div>
                      <Label htmlFor="sort-by">Sort By</Label>
                      <Select
                        value={filters.sortBy}
                        onValueChange={(value) => handleFilterChange("sortBy", value)}
                      >
                        <SelectTrigger id="sort-by" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="date">Most Recent</SelectItem>
                          <SelectItem value="relevance">Relevance</SelectItem>
                          <SelectItem value="title">Title (A-Z)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button type="submit" className="flex-1">Apply Filters</Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleResetFilters}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
              
              {/* Studies grid */}
              <div className="lg:col-span-3">
                <ErrorBoundary>
                  {isLoading ? (
                    <StudyListSkeleton />
                  ) : isError ? (
                    <ErrorDisplay
                      title="Error loading studies"
                      message="We're having trouble loading the studies right now. Please try again later."
                      onRetry={() => refetch()}
                    />
                  ) : studies && studies.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {studies.map(study => (
                        <StudyCard key={study.id} study={study} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No studies found"
                      description="We couldn't find any studies matching your criteria. Try adjusting your filters."
                      icon={<FileSearch className="w-12 h-12" />}
                      action={<Button onClick={handleResetFilters}>Clear Filters</Button>}
                    />
                  )}
                </ErrorBoundary>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
