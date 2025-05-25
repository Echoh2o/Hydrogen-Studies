import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, Clock, FileText, Image, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'wouter';

interface SearchFilters {
  query: string;
  healthConditions: string[];
  bodySystems: string[];
  studyTypes: string[];
  yearRange?: { start: number; end: number };
  hasFullText?: boolean;
  hasImages?: boolean;
  hasConclusion?: boolean;
  sortBy: 'relevance' | 'date' | 'title';
  page: number;
  limit: number;
}

interface SearchResult {
  studies: any[];
  totalCount: number;
  facets: {
    healthConditions: Array<{ name: string; count: number }>;
    bodySystems: Array<{ name: string; count: number }>;
    studyTypes: Array<{ name: string; count: number }>;
    years: Array<{ year: number; count: number }>;
  };
  searchMetadata: {
    query: string;
    totalResults: number;
    searchTime: number;
    page: number;
    totalPages: number;
  };
}

export default function AdvancedSearchPage() {
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    healthConditions: [],
    bodySystems: [],
    studyTypes: [],
    sortBy: 'relevance',
    page: 1,
    limit: 20
  });

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Search query with fallback to studies endpoint
  const { data: searchResults, isLoading: isSearching, error } = useQuery<SearchResult>({
    queryKey: ['/api/studies', filters],
    queryFn: async () => {
      // Try the direct studies endpoint first
      const searchParams = new URLSearchParams();
      if (filters.query) searchParams.append('search', filters.query);
      searchParams.append('page', filters.page.toString());
      searchParams.append('limit', filters.limit.toString());
      
      const response = await fetch(`/api/studies?${searchParams.toString()}`);
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      
      // Transform the response to match our expected format
      return {
        studies: data.data || [],
        totalCount: data.total || 0,
        facets: {
          healthConditions: [],
          bodySystems: [],
          studyTypes: [],
          years: []
        },
        searchMetadata: {
          query: filters.query,
          totalResults: data.total || 0,
          searchTime: 0,
          page: filters.page,
          totalPages: Math.ceil((data.total || 0) / filters.limit)
        }
      };
    },
    enabled: true
  });

  // Suggestions query
  const { data: suggestionsData } = useQuery({
    queryKey: ['/api/hydrogen-search/suggestions', filters.query],
    queryFn: async () => {
      if (!filters.query || filters.query.length < 2) return [];
      const response = await fetch(`/api/hydrogen-search/suggestions?q=${encodeURIComponent(filters.query)}`);
      return response.json();
    },
    enabled: filters.query.length >= 2
  });

  // Popular terms query
  const { data: popularTerms } = useQuery({
    queryKey: ['/api/hydrogen-search/popular-terms'],
    queryFn: async () => {
      const response = await fetch('/api/hydrogen-search/popular-terms');
      return response.json();
    }
  });

  useEffect(() => {
    if (suggestionsData && Array.isArray(suggestionsData)) {
      setSuggestions(suggestionsData);
    }
  }, [suggestionsData]);

  const handleSearch = useCallback((newQuery: string) => {
    setFilters(prev => ({ ...prev, query: newQuery, page: 1 }));
    setSuggestions([]);
  }, []);

  const handleFilterChange = useCallback((key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  }, []);

  const toggleArrayFilter = useCallback((key: 'healthConditions' | 'bodySystems' | 'studyTypes', value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key].includes(value) 
        ? prev[key].filter(item => item !== value)
        : [...prev[key], value],
      page: 1
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      query: filters.query, // Keep the search query
      healthConditions: [],
      bodySystems: [],
      studyTypes: [],
      sortBy: 'relevance',
      page: 1,
      limit: 20
    });
  }, [filters.query]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Advanced Research Search
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Explore our comprehensive database of hydrogen health studies with powerful filtering and search capabilities.
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="text"
                placeholder="Search studies by title, abstract, keywords, or health conditions..."
                value={filters.query}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-12 pr-4 py-4 text-lg bg-white shadow-lg border-2 border-gray-200 focus:border-blue-500 rounded-xl"
              />
            </div>
            
            {/* Search Suggestions */}
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSearch(suggestion)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Popular Search Terms */}
          {!filters.query && popularTerms && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Popular search terms:</p>
              <div className="flex flex-wrap gap-2">
                {popularTerms.popularConditions?.slice(0, 8).map((term: any, index: number) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSearch(term.term)}
                    className="text-xs"
                  >
                    {term.term} ({term.count})
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto">
          {/* Filters Sidebar */}
          <div className="lg:w-80">
            <Card className="sticky top-4">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Filters
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)} className="lg:hidden">
                    {showFilters ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className={`space-y-6 ${showFilters ? 'block' : 'hidden lg:block'}`}>
                {/* Sort Options */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Sort by</label>
                  <Select value={filters.sortBy} onValueChange={(value) => handleFilterChange('sortBy', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevance">Relevance</SelectItem>
                      <SelectItem value="date">Publication Date</SelectItem>
                      <SelectItem value="title">Title</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Data Completeness Filters */}
                <div>
                  <label className="text-sm font-medium mb-3 block">Data Completeness</label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="hasFullText"
                        checked={filters.hasFullText || false}
                        onCheckedChange={(checked) => handleFilterChange('hasFullText', checked)}
                      />
                      <label htmlFor="hasFullText" className="text-sm flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        Has Full Text
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="hasImages"
                        checked={filters.hasImages || false}
                        onCheckedChange={(checked) => handleFilterChange('hasImages', checked)}
                      />
                      <label htmlFor="hasImages" className="text-sm flex items-center gap-1">
                        <Image className="h-4 w-4" />
                        Has Images
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="hasConclusion"
                        checked={filters.hasConclusion || false}
                        onCheckedChange={(checked) => handleFilterChange('hasConclusion', checked)}
                      />
                      <label htmlFor="hasConclusion" className="text-sm flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        Has Conclusions
                      </label>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Health Conditions */}
                {searchResults?.facets.healthConditions && searchResults.facets.healthConditions.length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-3 block">Health Conditions</label>
                    <ScrollArea className="h-40">
                      <div className="space-y-2">
                        {searchResults.facets.healthConditions.slice(0, 15).map((condition) => (
                          <div key={condition.name} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`condition-${condition.name}`}
                              checked={filters.healthConditions.includes(condition.name)}
                              onCheckedChange={() => toggleArrayFilter('healthConditions', condition.name)}
                            />
                            <label htmlFor={`condition-${condition.name}`} className="text-sm flex-1">
                              {condition.name} ({condition.count})
                            </label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Body Systems */}
                {searchResults?.facets.bodySystems && searchResults.facets.bodySystems.length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-3 block">Body Systems</label>
                    <ScrollArea className="h-32">
                      <div className="space-y-2">
                        {searchResults.facets.bodySystems.slice(0, 10).map((system) => (
                          <div key={system.name} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`system-${system.name}`}
                              checked={filters.bodySystems.includes(system.name)}
                              onCheckedChange={() => toggleArrayFilter('bodySystems', system.name)}
                            />
                            <label htmlFor={`system-${system.name}`} className="text-sm flex-1">
                              {system.name} ({system.count})
                            </label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Study Types */}
                {searchResults?.facets.studyTypes && searchResults.facets.studyTypes.length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-3 block">Study Types</label>
                    <div className="space-y-2">
                      {searchResults.facets.studyTypes.slice(0, 8).map((type) => (
                        <div key={type.name} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`type-${type.name}`}
                            checked={filters.studyTypes.includes(type.name)}
                            onCheckedChange={() => toggleArrayFilter('studyTypes', type.name)}
                          />
                          <label htmlFor={`type-${type.name}`} className="text-sm flex-1">
                            {type.name} ({type.count})
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clear Filters */}
                <Button variant="outline" onClick={clearFilters} className="w-full">
                  Clear All Filters
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Search Results */}
          <div className="flex-1">
            {/* Search Metadata */}
            {searchResults && (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm text-gray-600">
                  {searchResults.searchMetadata.totalResults.toLocaleString()} studies found
                  {searchResults.searchMetadata.query && (
                    <span> for "{searchResults.searchMetadata.query}"</span>
                  )}
                  <span className="ml-2 text-gray-400">
                    ({searchResults.searchMetadata.searchTime}ms)
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    Page {searchResults.searchMetadata.page} of {searchResults.searchMetadata.totalPages}
                  </span>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isSearching && (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded"></div>
                        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Error State */}
            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-6">
                  <p className="text-red-600">
                    Search failed. Please try again or contact support if the problem persists.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Results */}
            {searchResults && searchResults.studies && (
              <div className="space-y-4">
                {searchResults.studies.map((study) => (
                  <Card key={study.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <CardTitle className="text-lg leading-tight">
                            <Link 
                              href={`/study/${study.id}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {study.title}
                            </Link>
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {study.authors} • {new Date(study.publicationDate).getFullYear()}
                            {study.journal && ` • ${study.journal}`}
                          </CardDescription>
                        </div>
                        
                        {/* Relevance Score */}
                        {study.relevanceScore > 0 && (
                          <Badge variant="secondary" className="shrink-0">
                            {Math.round(study.relevanceScore)}% match
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      {/* Abstract */}
                      {study.abstract && (
                        <p className="text-gray-700 mb-4 line-clamp-3">
                          {study.abstract.length > 300 
                            ? `${study.abstract.substring(0, 300)}...`
                            : study.abstract
                          }
                        </p>
                      )}

                      {/* Tags */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {study.healthConditions && study.healthConditions.slice(0, 3).map((condition: string, index: number) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {condition}
                          </Badge>
                        ))}
                        {study.bodySystems && study.bodySystems.slice(0, 2).map((system: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {system}
                          </Badge>
                        ))}
                      </div>

                      {/* Study Metadata */}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        {study.studyType && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            {study.studyType}
                          </span>
                        )}
                        {study.imageUrl && (
                          <span className="flex items-center gap-1">
                            <Image className="h-4 w-4" />
                            Has Images
                          </span>
                        )}
                        {study.conclusion && (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" />
                            Has Conclusion
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Pagination */}
                {searchResults.searchMetadata.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <Button
                      variant="outline"
                      disabled={filters.page <= 1}
                      onClick={() => handleFilterChange('page', filters.page - 1)}
                    >
                      Previous
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {[...Array(Math.min(5, searchResults.searchMetadata.totalPages))].map((_, i) => {
                        const pageNum = i + 1;
                        return (
                          <Button
                            key={i}
                            variant={pageNum === filters.page ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleFilterChange('page', pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      disabled={filters.page >= searchResults.searchMetadata.totalPages}
                      onClick={() => handleFilterChange('page', filters.page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* No Results */}
            {searchResults && searchResults.studies.length === 0 && !isSearching && (
              <Card>
                <CardContent className="pt-6 text-center">
                  <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No studies found</h3>
                  <p className="text-gray-600 mb-4">
                    Try adjusting your search terms or filters to find more results.
                  </p>
                  <Button variant="outline" onClick={clearFilters}>
                    Clear All Filters
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}