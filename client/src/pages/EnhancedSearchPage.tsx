import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdvancedSearchFilters } from "@/components/AdvancedSearchFilters";
import { EnhancedStudyCard } from "@/components/EnhancedStudyCard";
import { Link } from "wouter";

interface SearchFilters {
  query: string;
  healthBenefits: string[];
  healthConditions: string[];
  bodySystems: string[];
  lifeStages: string[];
  studyTypes: string[];
  mechanisms: string[];
  yearFrom: string;
  yearTo: string;
  category: string;
  aiEnhanced: boolean | null;
  readingLevel: string;
  sortBy: string;
}

interface Study {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate: string;
  category: string;
  healthCondition?: string;
  intervention?: string;
  population?: string;
  imageUrl?: string;
  simplifiedExplanation?: string;
  tags?: string[];
  healthBenefits?: string[];
  healthConditions?: string[];
  bodySystems?: string[];
  lifeStages?: string[];
  studyTypes?: string[];
  mechanisms?: string[];
  enhancedWithAI?: boolean;
  readingLevel?: string;
  estimatedReadTime?: number;
  popularityScore?: number;
}

export default function EnhancedSearchPage() {
  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    healthBenefits: [],
    healthConditions: [],
    bodySystems: [],
    lifeStages: [],
    studyTypes: [],
    mechanisms: [],
    yearFrom: "",
    yearTo: "",
    category: "",
    aiEnhanced: null,
    readingLevel: "",
    sortBy: "relevance"
  });

  const [searchParams, setSearchParams] = useState<URLSearchParams>(new URLSearchParams());

  // Convert filters to search parameters
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (filters.query) params.set("query", filters.query);
    if (filters.category) params.set("category", filters.category);
    if (filters.yearFrom) params.set("yearFrom", filters.yearFrom);
    if (filters.yearTo) params.set("yearTo", filters.yearTo);
    if (filters.sortBy !== "relevance") params.set("sortBy", filters.sortBy);
    
    // Add array filters
    if (filters.healthBenefits.length > 0) {
      params.set("healthBenefits", filters.healthBenefits.join(","));
    }
    if (filters.healthConditions.length > 0) {
      params.set("healthConditions", filters.healthConditions.join(","));
    }
    if (filters.bodySystems.length > 0) {
      params.set("bodySystems", filters.bodySystems.join(","));
    }
    if (filters.lifeStages.length > 0) {
      params.set("lifeStages", filters.lifeStages.join(","));
    }
    if (filters.studyTypes.length > 0) {
      params.set("studyTypes", filters.studyTypes.join(","));
    }
    if (filters.mechanisms.length > 0) {
      params.set("mechanisms", filters.mechanisms.join(","));
    }

    setSearchParams(params);
  }, [filters]);

  // Fetch studies based on current filters
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ["/api/studies", searchParams.toString()],
    queryFn: async () => {
      const response = await fetch(`/api/studies?${searchParams.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch studies");
      return response.json();
    },
  });

  const studies = searchResults?.data || [];
  const totalResults = searchResults?.total || 0;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };





  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Advanced Hydrogen Research Search
        </h1>
        <p className="text-gray-600">
          Discover hydrogen health studies with powerful filtering and AI-enhanced content
        </p>
      </div>

      {/* Search Filters */}
      <div className="mb-8">
        <AdvancedSearchFilters 
          onFiltersChange={setFilters}
          totalResults={totalResults}
        />
      </div>

      {/* Results */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : studies.length > 0 ? (
          <>
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">
                {totalResults.toLocaleString()} Studies Found
              </h2>
              <div className="text-sm text-gray-500">
                Sorted by {filters.sortBy}
              </div>
            </div>
            
            <div className="grid gap-6">
              {studies.map((study: Study) => (
                <StudyCard key={study.id} study={study} />
              ))}
            </div>
          </>
        ) : (
          <Card className="p-12 text-center">
            <CardContent>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No studies found
              </h3>
              <p className="text-gray-600 mb-4">
                Try adjusting your search filters or search terms
              </p>
              <Button 
                variant="outline" 
                onClick={() => setFilters({
                  query: "",
                  healthBenefits: [],
                  healthConditions: [],
                  bodySystems: [],
                  lifeStages: [],
                  studyTypes: [],
                  mechanisms: [],
                  yearFrom: "",
                  yearTo: "",
                  category: "",
                  aiEnhanced: null,
                  readingLevel: "",
                  sortBy: "relevance"
                })}
              >
                Clear All Filters
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}