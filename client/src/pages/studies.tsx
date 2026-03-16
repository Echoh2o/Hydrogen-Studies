import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import StudyCard from "@/components/studies/study-card";
import {
  StudyListSkeleton,
  ErrorDisplay,
  EmptyState,
} from "@/components/ui/loading-states";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { FileSearch, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Study } from "@/types";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import PageBreadcrumb from "@/components/seo/PageBreadcrumb";

export default function Studies() {
  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split("?")[1] || "");

  const [currentPage, setCurrentPage] = useState(
    parseInt(urlParams.get("page") || "1")
  );
  const pageSize = 20;

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
    enrichmentStatus:
      (urlParams.get("enrichmentStatus") as
        | "basic"
        | "partial"
        | "complete"
        | "") || "",
    tags: urlParams.get("tags")?.split(",") || [],
  });

  // Create query parameters for API request
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    // Always include pagination
    params.append("page", currentPage.toString());
    params.append("limit", pageSize.toString());

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        if (Array.isArray(value) && value.length > 0) {
          params.append(key, value.join(","));
        } else if (typeof value === "boolean") {
          if (value) params.append(key, value.toString());
        } else if (value) {
          const stringValue = value.toString().trim();
          if (stringValue && stringValue !== "all" && stringValue !== "any") {
            params.append(key, stringValue);
          }
        }
      }
    });
    return params;
  };

  const queryParams = buildQueryParams();

  const {
    data: studiesResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<{
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
        throw new Error("Failed to fetch studies");
      }
      return response.json();
    },
  });

  // Extract the studies array from the paginated response
  const studies = studiesResponse?.data || [];
  const totalStudies = studiesResponse?.total || 0;
  const totalPages = studiesResponse?.pageCount || Math.ceil(totalStudies / pageSize);

  const handleFilterChange = (key: string, value: string | boolean) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to page 1 on filter change
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
      useFuzzyMatch: false,
      searchInMethods: true,
      searchInResults: true,
      searchInConclusion: true,
      searchInSimplified: true,
      enrichmentStatus: "",
      tags: [],
    });
    setCurrentPage(1);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    refetch();
  };

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Categories for filter dropdown
  const categories = [
    { id: "neurodegenerative", name: "Neurodegenerative Diseases" },
    { id: "cardiovascular", name: "Cardiovascular Health" },
    { id: "metabolism", name: "Metabolism & Diabetes" },
    { id: "inflammation", name: "Inflammation" },
    { id: "cancer", name: "Cancer Research" },
    { id: "aging", name: "Anti-Aging" },
    { id: "neurological", name: "Neurological" },
    { id: "respiratory", name: "Respiratory" },
    { id: "renal", name: "Renal / Kidney" },
    { id: "hepatic", name: "Hepatic / Liver" },
    { id: "dermatological", name: "Dermatological / Skin" },
    { id: "gastrointestinal", name: "Gastrointestinal" },
    { id: "exercise", name: "Exercise & Performance" },
    { id: "oncology", name: "Oncology" },
  ];

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <>
      <Helmet>
        <title>Studies - Hydrogen Studies Research Database</title>
        <meta
          name="description"
          content="Browse and search through our comprehensive database of hydrogen gas studies and research papers."
        />
        <meta property="og:title" content="Studies - Hydrogen Studies Research Database" />
        <meta property="og:description" content="Browse and search through our comprehensive database of hydrogen gas studies and research papers." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hydrogenstudies.com/studies" />
        <meta name="twitter:card" content="summary" />
        <link rel="canonical" href="https://hydrogenstudies.com/studies" />
      </Helmet>

      <SiteHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <PageBreadcrumb items={[
          { label: "Home", href: "/" },
          { label: "Studies" },
        ]} />
      </div>

      <div className="bg-neutral-100 py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-screen-xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold">All Studies</h1>
              <span className="text-sm text-neutral-600">
                {totalStudies.toLocaleString()} studies found
              </span>
            </div>

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
                        onChange={(e) =>
                          handleFilterChange("query", e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={filters.category}
                        onValueChange={(value) =>
                          handleFilterChange("category", value)
                        }
                      >
                        <SelectTrigger id="category" className="mt-1">
                          <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {categories.map((category) => (
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
                        onChange={(e) =>
                          handleFilterChange("author", e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">Year Range</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="yearFrom" className="sr-only">
                            From
                          </Label>
                          <Input
                            id="yearFrom"
                            placeholder="From"
                            type="number"
                            value={filters.yearFrom}
                            onChange={(e) =>
                              handleFilterChange("yearFrom", e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="yearTo" className="sr-only">
                            To
                          </Label>
                          <Input
                            id="yearTo"
                            placeholder="To"
                            type="number"
                            value={filters.yearTo}
                            onChange={(e) =>
                              handleFilterChange("yearTo", e.target.value)
                            }
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
                        onValueChange={(value) =>
                          handleFilterChange("sortBy", value)
                        }
                      >
                        <SelectTrigger id="sort-by" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="date">Most Recent</SelectItem>
                          <SelectItem value="title">Title (A-Z)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex space-x-2">
                      <Button type="submit" className="flex-1">
                        Apply Filters
                      </Button>
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
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {studies.map((study) => (
                          <StudyCard key={study.id} study={study} />
                        ))}
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="mt-8 flex flex-col items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => goToPage(1)}
                              disabled={currentPage === 1}
                            >
                              <ChevronsLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => goToPage(currentPage - 1)}
                              disabled={currentPage === 1}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>

                            {getPageNumbers().map((page) => (
                              <Button
                                key={page}
                                variant={page === currentPage ? "default" : "outline"}
                                size="sm"
                                onClick={() => goToPage(page)}
                                className="min-w-[36px]"
                              >
                                {page}
                              </Button>
                            ))}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => goToPage(currentPage + 1)}
                              disabled={currentPage === totalPages}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => goToPage(totalPages)}
                              disabled={currentPage === totalPages}
                            >
                              <ChevronsRight className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-sm text-neutral-600">
                            Page {currentPage} of {totalPages} ({totalStudies.toLocaleString()} total studies)
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <EmptyState
                      title="No studies found"
                      description="We couldn't find any studies matching your criteria. Try adjusting your filters."
                      icon={<FileSearch className="w-12 h-12" />}
                      action={
                        <Button onClick={handleResetFilters}>
                          Clear Filters
                        </Button>
                      }
                    />
                  )}
                </ErrorBoundary>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
