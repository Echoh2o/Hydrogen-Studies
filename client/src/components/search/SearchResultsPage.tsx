/**
 * Enhanced Search Results Page with Advanced Filtering
 * Provides comprehensive search results with intelligent ranking and filtering
 */

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  HiSearch,
  HiFilter,
  HiSortAscending,
  HiSortDescending,
  HiBookmark,
  HiEye,
  HiDocument,
} from "react-icons/hi";
import { Link } from "wouter";
import SearchAutocomplete from "./SearchAutocomplete";
import AdvancedSearchModal from "./AdvancedSearchModal";
import SavedSearches from "./SavedSearches";

interface SearchResultsPageProps {
  initialQuery?: string;
  initialFilters?: any;
}

interface SearchFilters {
  query: string;
  categories: string[];
  yearRange: { start: number | null; end: number | null };
  studyTypes: string[];
  hasFullText: boolean | null;
  hasDOI: boolean | null;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export const SearchResultsPage: React.FC<SearchResultsPageProps> = ({
  initialQuery = "",
  initialFilters = {},
}) => {
  const [filters, setFilters] = useState<SearchFilters>({
    query: initialQuery,
    categories: [],
    yearRange: { start: null, end: null },
    studyTypes: [],
    hasFullText: null,
    hasDOI: null,
    sortBy: "relevance",
    sortOrder: "desc",
    ...initialFilters,
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showSavedSearches, setShowSavedSearches] = useState(false);

  // Fetch search results
  const {
    data: searchResults,
    isLoading,
    error,
  } = useQuery<{ total: number; data: any[]; pageCount: number }>({
    queryKey: ["/api/search/advanced", filters, page, pageSize],
    enabled: true,
  });

  // Fetch filter options for sidebar
  const { data: filterOptions } = useQuery<{ categories?: Array<{ id: number; name: string; studyCount: number }> }>({
    queryKey: ["/api/search/filter-options"],
  });

  // Update search filters
  const updateFilters = (newFilters: Partial<SearchFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setPage(1); // Reset to first page when filters change
  };

  // Handle category filter toggle
  const toggleCategoryFilter = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter((c) => c !== category)
      : [...filters.categories, category];
    updateFilters({ categories: newCategories });
  };

  // Handle study type filter toggle
  const toggleStudyTypeFilter = (type: string) => {
    const newTypes = filters.studyTypes.includes(type)
      ? filters.studyTypes.filter((t) => t !== type)
      : [...filters.studyTypes, type];
    updateFilters({ studyTypes: newTypes });
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilters({
      query: "",
      categories: [],
      yearRange: { start: null, end: null },
      studyTypes: [],
      hasFullText: null,
      hasDOI: null,
      sortBy: "relevance",
      sortOrder: "desc",
    });
    setPage(1);
  };

  // Load saved search
  const loadSavedSearch = (savedSearch: any) => {
    setFilters({
      query: savedSearch.query,
      ...savedSearch.filters,
    });
    setPage(1);
    setShowSavedSearches(false);
  };

  // Get active filter count
  const activeFiltersCount = [
    filters.query && 1,
    filters.categories.length,
    (filters.yearRange.start || filters.yearRange.end) && 1,
    filters.studyTypes.length,
    filters.hasFullText && 1,
    filters.hasDOI && 1,
  ]
    .filter(Boolean)
    .reduce((sum, count) => sum + (count || 0), 0);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Research Search</h1>

        {/* Search Bar */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <SearchAutocomplete
              value={filters.query}
              onChange={(value) => updateFilters({ query: value })}
              onSearch={(query) => updateFilters({ query })}
            />
          </div>

          <AdvancedSearchModal
            isOpen={showAdvancedSearch}
            setIsOpen={setShowAdvancedSearch}
            onSearch={(newFilters) => {
              updateFilters(newFilters);
              setShowAdvancedSearch(false);
            }}
          />
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSavedSearches(!showSavedSearches)}
          >
            <HiBookmark className="h-4 w-4 mr-1" />
            Saved Searches
          </Button>

          {activeFiltersCount > 0 && (
            <Button variant="outline" size="sm" onClick={clearAllFilters}>
              Clear Filters ({activeFiltersCount})
            </Button>
          )}
        </div>

        {/* Saved Searches Panel */}
        {showSavedSearches && (
          <Card className="mb-4">
            <CardContent className="py-4">
              <SavedSearches
                onLoadSearch={loadSavedSearch}
                currentSearch={{ query: filters.query, filters }}
              />
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Filters */}
        <div className="lg:col-span-1">
          <div className="sticky top-4 space-y-6">
            {/* Sort Options */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Sort Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={filters.sortBy}
                  onValueChange={(value) => updateFilters({ sortBy: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="date">Publication Date</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                    <SelectItem value="views">View Count</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateFilters({
                      sortOrder: filters.sortOrder === "asc" ? "desc" : "asc",
                    })
                  }
                  className="w-full"
                >
                  {filters.sortOrder === "asc" ? (
                    <HiSortAscending className="h-4 w-4 mr-1" />
                  ) : (
                    <HiSortDescending className="h-4 w-4 mr-1" />
                  )}
                  {filters.sortOrder === "asc" ? "Ascending" : "Descending"}
                </Button>
              </CardContent>
            </Card>

            {/* Category Filters */}
            {filterOptions?.categories && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Categories</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filterOptions.categories
                      .slice(0, 10)
                      .map((category: any) => (
                        <div
                          key={category.id}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`category-${category.id}`}
                            checked={filters.categories.includes(category.name)}
                            onCheckedChange={() =>
                              toggleCategoryFilter(category.name)
                            }
                          />
                          <label
                            htmlFor={`category-${category.id}`}
                            className="text-sm flex-1"
                          >
                            {category.name}
                          </label>
                          <Badge variant="secondary" className="text-xs">
                            {category.studyCount}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Study Type Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Study Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    "Clinical Trial",
                    "Meta-Analysis",
                    "Animal Study",
                    "In Vitro Study",
                  ].map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={`type-${type}`}
                        checked={filters.studyTypes.includes(type)}
                        onCheckedChange={() => toggleStudyTypeFilter(type)}
                      />
                      <label htmlFor={`type-${type}`} className="text-sm">
                        {type}
                      </label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Year Range Filter */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Publication Year</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs">From</label>
                  <Input
                    type="number"
                    placeholder="2000"
                    value={filters.yearRange.start || ""}
                    onChange={(e) =>
                      updateFilters({
                        yearRange: {
                          ...filters.yearRange,
                          start: e.target.value
                            ? parseInt(e.target.value)
                            : null,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs">To</label>
                  <Input
                    type="number"
                    placeholder="2024"
                    value={filters.yearRange.end || ""}
                    onChange={(e) =>
                      updateFilters({
                        yearRange: {
                          ...filters.yearRange,
                          end: e.target.value ? parseInt(e.target.value) : null,
                        },
                      })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-3">
          {/* Results Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              {searchResults && (
                <p className="text-gray-600">
                  {searchResults.total} results found
                  {filters.query && ` for "${filters.query}"`}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Results per page:</span>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => setPageSize(parseInt(value))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              {Array(5)
                .fill(0)
                .map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="py-6">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                      <div className="h-20 bg-gray-200 rounded"></div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}

          {/* Results List */}
          {searchResults?.data && (
            <div className="space-y-4">
              {searchResults.data.map((study: any) => (
                <Link
                  key={study.id}
                  href={
                    study.slug ? `/study/${study.slug}` : `/study/${study.id}`
                  }
                >
                  <Card className="hover:shadow-md transition-shadow cursor-pointer hover:border-primary/50">
                    <CardContent className="py-6">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-lg font-semibold text-teal-600 hover:text-teal-800">
                          {study.title}
                        </h3>
                        <div className="flex gap-2 ml-4">
                          <Badge variant="secondary">{study.category}</Badge>
                          {study.doi && (
                            <HiDocument
                              className="h-4 w-4 text-green-600"
                              title="DOI available"
                            />
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 mb-2">
                        {study.authors} • {study.journal} •{" "}
                        {new Date(study.publishDate).getFullYear()}
                      </p>

                      <p className="text-gray-700 mb-3 line-clamp-3">
                        {study.abstract}
                      </p>

                      <div className="flex justify-between items-center">
                        <div className="flex gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <HiEye className="h-4 w-4" />
                            {study.viewCount || 0} views
                          </span>
                        </div>

                        <Button variant="outline" size="sm">
                          View Study
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {searchResults && searchResults.pageCount > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>

              <span className="px-4 py-2 text-sm">
                Page {page} of {searchResults.pageCount}
              </span>

              <Button
                variant="outline"
                disabled={page >= searchResults.pageCount}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}

          {/* No Results */}
          {searchResults?.data?.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <HiSearch className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold mb-2">No results found</h3>
                <p className="text-gray-600 mb-4">
                  Try adjusting your search terms or filters
                </p>
                <Button onClick={clearAllFilters}>Clear all filters</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchResultsPage;
