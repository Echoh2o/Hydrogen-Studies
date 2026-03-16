/**
 * Natural Language Search Results Component
 * Displays search results with relevance explanations and smart filters
 */

import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles,
  ChevronRight,
  BookOpen,
  Calendar,
  Users,
  Target,
  TrendingUp,
  AlertCircle,
  Bookmark,
  Share2,
  ExternalLink,
} from "lucide-react";
import { motion } from "framer-motion";

interface SearchResult {
  id: number;
  title: string;
  plainLanguageTitle?: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate?: string;
  journalPublishDate?: string;
  category: string;
  relevanceScore: number;
  semanticScore: number;
  matchReasons: string[];
  highlights: {
    title?: string;
    abstract?: string;
    methods?: string;
    results?: string;
    conclusion?: string;
  };
  doi?: string;
  slug?: string;
  imageUrl?: string;
  consumerCategories?: any;
  keywords?: string[];
}

interface SearchFacets {
  conditions: { name: string; count: number }[];
  bodySystems: { name: string; count: number }[];
  deliveryMethods: { name: string; count: number }[];
  years: { year: number; count: number }[];
  studyTypes: { type: string; count: number }[];
}

interface NaturalLanguageSearchResultsProps {
  results: SearchResult[];
  facets?: SearchFacets;
  queryInterpretation?: any;
  suggestions?: any;
  totalCount?: number;
  isLoading?: boolean;
  onFilterApply?: (filters: any) => void;
  onSaveSearch?: () => void;
}

export function NaturalLanguageSearchResults({
  results,
  facets,
  queryInterpretation,
  suggestions,
  totalCount = 0,
  isLoading = false,
  onFilterApply,
  onSaveSearch,
}: NaturalLanguageSearchResultsProps) {
  const [selectedFilters, setSelectedFilters] = useState<any>({});
  const [expandedResults, setExpandedResults] = useState<Set<number>>(
    new Set(),
  );

  // Toggle result expansion
  const toggleExpanded = (id: number) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedResults(newExpanded);
  };

  // Apply filter
  const applyFilter = (filterType: string, value: string) => {
    const newFilters = { ...selectedFilters };
    if (!newFilters[filterType]) {
      newFilters[filterType] = [];
    }

    const index = newFilters[filterType].indexOf(value);
    if (index > -1) {
      newFilters[filterType].splice(index, 1);
    } else {
      newFilters[filterType].push(value);
    }

    setSelectedFilters(newFilters);
    if (onFilterApply) {
      onFilterApply(newFilters);
    }
  };

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return "Date unknown";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
    });
  };

  // Highlight text - render as plain text (no HTML injection)
  const highlightText = (text?: string) => {
    if (!text) return null;
    return <span>{text}</span>;
  };

  return (
    <div className="grid lg:grid-cols-4 gap-6">
      {/* Faceted Filters Sidebar */}
      {facets && (
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-sm">Refine Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Conditions */}
              {facets.conditions?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold mb-2">
                    Health Conditions
                  </h4>
                  <div className="space-y-1">
                    {facets.conditions.slice(0, 5).map((condition) => (
                      <button
                        key={condition.name}
                        onClick={() =>
                          applyFilter("conditions", condition.name)
                        }
                        className={`w-full text-left text-xs p-1 rounded hover:bg-muted transition-colors ${
                          selectedFilters.conditions?.includes(condition.name)
                            ? "bg-muted"
                            : ""
                        }`}
                        data-testid={`filter-condition-${condition.name}`}
                      >
                        <span className="flex justify-between items-center">
                          {condition.name}
                          <Badge variant="secondary" className="text-xs">
                            {condition.count}
                          </Badge>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivery Methods */}
              {facets.deliveryMethods?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold mb-2">
                    Delivery Methods
                  </h4>
                  <div className="space-y-1">
                    {facets.deliveryMethods.map((method) => (
                      <button
                        key={method.name}
                        onClick={() => applyFilter("methods", method.name)}
                        className={`w-full text-left text-xs p-1 rounded hover:bg-muted transition-colors ${
                          selectedFilters.methods?.includes(method.name)
                            ? "bg-muted"
                            : ""
                        }`}
                        data-testid={`filter-method-${method.name}`}
                      >
                        <span className="flex justify-between items-center">
                          {method.name}
                          <Badge variant="secondary" className="text-xs">
                            {method.count}
                          </Badge>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Years */}
              {facets.years?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold mb-2">
                    Publication Year
                  </h4>
                  <div className="space-y-1">
                    {facets.years.slice(0, 5).map((yearItem) => (
                      <button
                        key={yearItem.year}
                        onClick={() =>
                          applyFilter("years", yearItem.year.toString())
                        }
                        className={`w-full text-left text-xs p-1 rounded hover:bg-muted transition-colors ${
                          selectedFilters.years?.includes(
                            yearItem.year.toString(),
                          )
                            ? "bg-muted"
                            : ""
                        }`}
                        data-testid={`filter-year-${yearItem.year}`}
                      >
                        <span className="flex justify-between items-center">
                          {yearItem.year}
                          <Badge variant="secondary" className="text-xs">
                            {yearItem.count}
                          </Badge>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search Results */}
      <div className={facets ? "lg:col-span-3" : "lg:col-span-4"}>
        {/* Results Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold">
              {totalCount} Results Found
            </h3>
            {queryInterpretation && (
              <p className="text-sm text-muted-foreground">
                Showing results for: "{queryInterpretation.original}"
              </p>
            )}
          </div>
          {onSaveSearch && (
            <Button variant="outline" size="sm" onClick={onSaveSearch}>
              <Bookmark className="h-4 w-4 mr-2" />
              Save Search
            </Button>
          )}
        </div>

        {/* Related Searches */}
        {suggestions?.related && suggestions.related.length > 0 && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Related:</span>
                {suggestions.related.map((related: string, idx: number) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    data-testid={`related-search-${idx}`}
                  >
                    {related}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results List */}
        <div className="space-y-4">
          {results.map((result, index) => {
            const isExpanded = expandedResults.has(result.id);

            return (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <Link href={`/study/${result.slug || result.id}`}>
                          <CardTitle className="text-lg hover:text-primary transition-colors cursor-pointer">
                            {result.plainLanguageTitle || result.title}
                          </CardTitle>
                        </Link>

                        {/* Relevance Score */}
                        <div className="flex items-center gap-2 mt-2">
                          <Progress
                            value={result.relevanceScore * 100}
                            className="w-24 h-2"
                          />
                          <span className="text-xs text-muted-foreground">
                            {(result.relevanceScore * 100).toFixed(0)}% relevant
                          </span>
                          {result.semanticScore > 0.8 && (
                            <Badge variant="default" className="text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              Best Match
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon">
                          <Bookmark className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* Match Reasons */}
                    {result.matchReasons && result.matchReasons.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {result.matchReasons.map((reason, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="text-xs"
                          >
                            <Target className="h-3 w-3 mr-1" />
                            {reason}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Abstract with Highlights */}
                    <div className="text-sm text-muted-foreground mb-3">
                      {result.highlights?.abstract ? (
                        highlightText(result.highlights.abstract)
                      ) : (
                        <span>{result.abstract?.substring(0, 200)}...</span>
                      )}
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="space-y-3 mt-3">
                        <Separator />

                        {result.highlights?.methods && (
                          <div>
                            <h4 className="text-xs font-semibold mb-1">
                              Methods
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {highlightText(result.highlights.methods)}
                            </p>
                          </div>
                        )}

                        {result.highlights?.results && (
                          <div>
                            <h4 className="text-xs font-semibold mb-1">
                              Results
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {highlightText(result.highlights.results)}
                            </p>
                          </div>
                        )}

                        {result.highlights?.conclusion && (
                          <div>
                            <h4 className="text-xs font-semibold mb-1">
                              Conclusion
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {highlightText(result.highlights.conclusion)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {result.authors?.split(",")[0]} et al.
                      </span>
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {result.journal}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(
                          result.journalPublishDate || result.publishDate,
                        )}
                      </span>
                      {result.doi && (
                        <a
                          href={`https://doi.org/${result.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          DOI
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    {/* Keywords */}
                    {result.keywords && result.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {result.keywords.slice(0, 5).map((keyword, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="text-xs"
                          >
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Expand/Collapse Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpanded(result.id)}
                      className="mt-3"
                      data-testid={`button-expand-${result.id}`}
                    >
                      {isExpanded ? "Show Less" : "Show More"}
                      <ChevronRight
                        className={`h-4 w-4 ml-1 transition-transform ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                      />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* No Results */}
        {results.length === 0 && !isLoading && (
          <Card>
            <CardContent className="text-center py-12">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search query or filters
              </p>
              {suggestions?.alternatives &&
                suggestions.alternatives.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Try these alternative searches:
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {suggestions.alternatives.map((alt: any, idx: number) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="cursor-pointer"
                        >
                          {alt.text}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
