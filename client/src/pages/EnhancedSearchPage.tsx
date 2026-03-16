import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { formatAuthors } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
  Search,
  Filter,
  Sparkles,
  TrendingUp,
  Calendar,
  Users,
} from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { Helmet } from "react-helmet";

interface SearchFilters {
  query: string;
  tags: number[];
  category: string;
  dateRange: string;
  studyType: string;
  minViewCount: number;
  sortBy: string;
}

interface SearchResult {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate?: string;
  journal_publish_date?: string;
  category: string;
  viewCount?: number;
  relevanceScore?: number;
  doi?: string;
  keywords?: string;
  consumer_categories?: string;
  tags?: Array<{
    id: number;
    name: string;
    category: string;
    confidence: number;
  }>;
  relatedStudies?: number[];
  slug?: string;
}

interface SearchResponse {
  data: SearchResult[];
  total: number;
  facets: {
    tags: Array<{ name: string; count: number }>;
    journals: Array<{ name: string; count: number }>;
    years: Array<{ year: string; count: number }>;
  };
  suggestions: string[];
  trending: string[];
}

export default function EnhancedSearchPage() {
  const [location, setLocation] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);

  const [filters, setFilters] = useState<SearchFilters>({
    query: urlParams.get("q") || "",
    tags: [],
    category: "all",
    dateRange: "all",
    studyType: "all",
    minViewCount: 0,
    sortBy: "relevance",
  });

  const [searchMode, setSearchMode] = useState<"simple" | "advanced">("simple");

  // Enhanced search with multiple filters and AI-powered relevance
  const { data: searchResults, isLoading: searchLoading } =
    useQuery<SearchResponse>({
      queryKey: ["/api/search/enhanced", filters],
      enabled: filters.query.length > 0 || filters.tags.length > 0,
    });

  // Get search suggestions as user types
  const { data: suggestions } = useQuery<string[]>({
    queryKey: ["/api/search/suggestions", { query: filters.query }],
    enabled: filters.query.length > 2,
  });

  // Popular searches and trending topics
  const { data: trendingData } = useQuery<{ trending: string[] }>({
    queryKey: ["/api/search/trending"],
  });

  const handleSearch = (newFilters: Partial<SearchFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);

    // Update URL with search parameters
    const params = new URLSearchParams();
    if (updatedFilters.query) params.set("q", updatedFilters.query);
    if (updatedFilters.category && updatedFilters.category !== "all")
      params.set("category", updatedFilters.category);
    if (updatedFilters.sortBy !== "relevance")
      params.set("sort", updatedFilters.sortBy);

    setLocation(`/search?${params.toString()}`);
  };

  const handleTagSelect = (tagId: number) => {
    const newTags = filters.tags.includes(tagId)
      ? filters.tags.filter((id) => id !== tagId)
      : [...filters.tags, tagId];
    handleSearch({ tags: newTags });
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 0.8) return "bg-green-100 text-green-800";
    if (score >= 0.6) return "bg-yellow-100 text-yellow-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>Advanced Search - Hydrogen Studies Database</title>
        <meta name="description" content="Use our advanced search to find specific hydrogen research studies with detailed filters and options." />
        <meta property="og:title" content="Advanced Search - Hydrogen Studies Database" />
        <meta property="og:description" content="Use our advanced search to find specific hydrogen research studies with detailed filters and options." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hydrogenstudies.com/advanced-search" />
        <meta name="twitter:card" content="summary" />
        <link rel="canonical" href="https://hydrogenstudies.com/advanced-search" />
      </Helmet>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Advanced Search
          </h1>
          <p className="text-muted-foreground">
            Discover hydrogen research with AI-powered search and intelligent
            filtering
          </p>
        </div>

        {/* Search Interface */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Search className="h-5 w-5" />
                <span>Search Studies</span>
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Button
                  variant={searchMode === "simple" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSearchMode("simple")}
                >
                  Simple
                </Button>
                <Button
                  variant={searchMode === "advanced" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSearchMode("advanced")}
                >
                  Advanced
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Main Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search studies, conditions, mechanisms, or keywords..."
                value={filters.query}
                onChange={(e) => handleSearch({ query: e.target.value })}
                className="pl-9 text-lg"
              />
            </div>

            {/* Search Suggestions */}
            {suggestions &&
              Array.isArray(suggestions) &&
              suggestions.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Suggestions</label>
                  <div className="flex flex-wrap gap-2">
                    {suggestions
                      .slice(0, 6)
                      .map((suggestion: string, index: number) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                          onClick={() => handleSearch({ query: suggestion })}
                        >
                          {suggestion}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}

            {/* Advanced Filters */}
            {searchMode === "advanced" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select
                    value={filters.category}
                    onValueChange={(value) => handleSearch({ category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      <SelectItem value="health_condition">
                        Health Conditions
                      </SelectItem>
                      <SelectItem value="study_type">Study Types</SelectItem>
                      <SelectItem value="mechanism">Mechanisms</SelectItem>
                      <SelectItem value="delivery_method">
                        Delivery Methods
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Date Range</label>
                  <Select
                    value={filters.dateRange}
                    onValueChange={(value) =>
                      handleSearch({ dateRange: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All time</SelectItem>
                      <SelectItem value="1year">Last year</SelectItem>
                      <SelectItem value="3years">Last 3 years</SelectItem>
                      <SelectItem value="5years">Last 5 years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Study Type</label>
                  <Select
                    value={filters.studyType}
                    onValueChange={(value) =>
                      handleSearch({ studyType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="human">Human Studies</SelectItem>
                      <SelectItem value="animal">Animal Studies</SelectItem>
                      <SelectItem value="review">Review Articles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Sort By</label>
                  <Select
                    value={filters.sortBy}
                    onValueChange={(value) => handleSearch({ sortBy: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevance">Relevance</SelectItem>
                      <SelectItem value="date">Publication Date</SelectItem>
                      <SelectItem value="views">View Count</SelectItem>
                      <SelectItem value="title">Title A-Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Search Results */}
          <div className="lg:col-span-3">
            {searchResults?.data ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">
                    {searchResults.total} Studies Found
                  </h2>
                  <div className="flex items-center space-x-2">
                    <Sparkles className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm text-muted-foreground">
                      AI-Enhanced Results
                    </span>
                  </div>
                </div>

                {searchLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <Card key={i}>
                        <CardContent className="p-6">
                          <div className="space-y-2">
                            <div className="h-4 bg-gray-200 rounded animate-pulse" />
                            <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4" />
                            <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {searchResults.data.map((study) => (
                      <Card
                        key={study.id}
                        className="hover:shadow-md transition-shadow"
                      >
                        <CardContent className="p-6">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <h3 className="font-semibold text-lg leading-tight flex-1">
                                {study.title}
                              </h3>
                              <Badge
                                variant="outline"
                                className={`ml-2 ${getRelevanceColor(study.relevanceScore || 0.5)}`}
                              >
                                {Math.round(
                                  (study.relevanceScore || 0.5) * 100,
                                )}
                                % match
                              </Badge>
                            </div>

                            <div className="text-sm text-muted-foreground">
                              <span className="font-medium">
                                {formatAuthors(study.authors)}
                              </span>
                              {" • "}
                              <span>{study.journal}</span>
                              {" • "}
                              <span>{study.publishDate}</span>
                            </div>

                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {study.abstract}
                            </p>

                            <div className="flex flex-wrap gap-1">
                              {study.tags && study.tags.length > 0 ? (
                                <>
                                  {study.tags.slice(0, 6).map((tag) => (
                                    <Badge
                                      key={tag.id}
                                      variant="outline"
                                      className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground"
                                      onClick={() => handleTagSelect(tag.id)}
                                    >
                                      {tag.name}
                                    </Badge>
                                  ))}
                                  {study.tags.length > 6 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      +{study.tags.length - 6} more
                                    </Badge>
                                  )}
                                </>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  {study.category}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-2">
                              <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                                <span className="flex items-center">
                                  <Users className="h-3 w-3 mr-1" />
                                  {study.viewCount || 0} views
                                </span>
                                {study.relatedStudies &&
                                  study.relatedStudies.length > 0 && (
                                    <span>
                                      {study.relatedStudies.length} related
                                      studies
                                    </span>
                                  )}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setLocation(
                                    study.slug
                                      ? `/study/${study.slug}`
                                      : `/study/id/${study.id}`,
                                  )
                                }
                              >
                                View Study
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ) : !searchLoading && filters.query.length > 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No studies found</h3>
                  <p className="text-muted-foreground">
                    Try adjusting your search terms or filters
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    Start your search
                  </h3>
                  <p className="text-muted-foreground">
                    Enter keywords, conditions, or research topics to find
                    relevant studies
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Search Facets & Trending */}
          <div className="space-y-4">
            {/* Trending Topics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Trending Research</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {trendingData?.trending ? (
                  <div className="space-y-2">
                    {trendingData.trending
                      .slice(0, 8)
                      .map((topic: string, index: number) => (
                        <div
                          key={index}
                          className="text-sm cursor-pointer hover:text-primary hover:underline"
                          onClick={() => handleSearch({ query: topic })}
                        >
                          {topic}
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm">Oxidative Stress</div>
                    <div className="text-sm">Cardiovascular Health</div>
                    <div className="text-sm">Neuroprotection</div>
                    <div className="text-sm">Athletic Performance</div>
                    <div className="text-sm">Anti-inflammatory</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Search Facets */}
            {searchResults?.facets && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Filter className="h-5 w-5" />
                    <span>Filter Results</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {searchResults.facets.tags.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Popular Tags</h4>
                      <div className="space-y-1">
                        {searchResults.facets.tags.slice(0, 8).map((tag) => (
                          <div
                            key={tag.name}
                            className="flex items-center justify-between text-sm"
                          >
                            <span
                              className="cursor-pointer hover:text-primary"
                              onClick={() =>
                                handleSearch({
                                  query: `${filters.query} ${tag.name}`,
                                })
                              }
                            >
                              {tag.name}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {tag.count}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.facets.years.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Publication Years</h4>
                      <div className="space-y-1">
                        {searchResults.facets.years.slice(0, 5).map((year) => (
                          <div
                            key={year.year}
                            className="flex items-center justify-between text-sm"
                          >
                            <span
                              className="cursor-pointer hover:text-primary"
                              onClick={() =>
                                handleSearch({ dateRange: year.year })
                              }
                            >
                              {year.year}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {year.count}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
