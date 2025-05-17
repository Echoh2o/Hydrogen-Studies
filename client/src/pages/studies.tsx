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
  });
  
  // Create query parameters for API request
  const queryParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) queryParams.append(key, value.toString());
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
  
  const { data: studies, isLoading, isError, error, refetch } = useQuery<Study[]>({
    queryKey: [`/api/studies`, queryParams.toString()],
  });
  
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
    });
  };
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // The query is automatically sent via queryParams
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
