import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdvancedSearchFilters } from "@/components/AdvancedSearchFilters";
import { ExternalLink, Calendar, Users, BookOpen, Sparkles } from "lucide-react";
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

  const getStudyTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      "Human Clinical Trial": "bg-green-100 text-green-800",
      "Animal Study": "bg-blue-100 text-blue-800",
      "In Vitro Study": "bg-purple-100 text-purple-800",
      "Randomized Controlled Trial": "bg-emerald-100 text-emerald-800",
      "Observational Study": "bg-orange-100 text-orange-800",
      "Meta-analysis": "bg-red-100 text-red-800",
      "Systematic Review": "bg-indigo-100 text-indigo-800"
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const StudyCard = ({ study }: { study: Study }) => (
    <Card className="hover:shadow-lg transition-shadow duration-200 border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-gray-900 leading-tight mb-2">
              <Link href={`/study/${study.id}`} className="hover:text-blue-600 transition-colors">
                {study.title}
              </Link>
            </CardTitle>
            
            <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(study.publishDate)}
              </div>
              <div className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {study.journal}
              </div>
              {study.estimatedReadTime && (
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {study.estimatedReadTime}min read
                </div>
              )}
              {study.enhancedWithAI && (
                <div className="flex items-center gap-1">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <span className="text-purple-600 font-medium">AI Enhanced</span>
                </div>
              )}
            </div>
          </div>
          
          {study.imageUrl && (
            <img
              src={study.imageUrl}
              alt={study.title}
              className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
            />
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Simplified Explanation (if available) */}
        {study.simplifiedExplanation && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-200">
            <h4 className="text-sm font-semibold text-blue-900 mb-1">Plain Language Summary</h4>
            <p className="text-sm text-blue-800 leading-relaxed">
              {study.simplifiedExplanation.length > 200 
                ? `${study.simplifiedExplanation.substring(0, 200)}...`
                : study.simplifiedExplanation
              }
            </p>
          </div>
        )}

        {/* Abstract */}
        <p className="text-gray-700 text-sm leading-relaxed mb-4">
          {study.abstract.length > 300 
            ? `${study.abstract.substring(0, 300)}...`
            : study.abstract
          }
        </p>

        {/* Health Benefits & Conditions */}
        {(study.healthBenefits?.length || study.healthConditions?.length) && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {study.healthBenefits?.slice(0, 3).map((benefit) => (
                <Badge key={benefit} variant="secondary" className="bg-green-100 text-green-800">
                  {benefit}
                </Badge>
              ))}
              {study.healthConditions?.slice(0, 2).map((condition) => (
                <Badge key={condition} variant="secondary" className="bg-amber-100 text-amber-800">
                  {condition}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Study Types & Body Systems */}
        {(study.studyTypes?.length || study.bodySystems?.length) && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {study.studyTypes?.slice(0, 2).map((type) => (
                <Badge key={type} className={getStudyTypeColor(type)}>
                  {type}
                </Badge>
              ))}
              {study.bodySystems?.slice(0, 2).map((system) => (
                <Badge key={system} variant="outline" className="border-purple-200 text-purple-700">
                  {system}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Author and Population Info */}
        <div className="text-xs text-gray-500 mb-4">
          <div><strong>Authors:</strong> {study.authors}</div>
          {study.population && <div><strong>Population:</strong> {study.population}</div>}
          {study.intervention && <div><strong>Intervention:</strong> {study.intervention}</div>}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <Link href={`/study/${study.id}`}>
            <Button variant="default" size="sm" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              View Full Study
            </Button>
          </Link>
          
          <div className="text-xs text-gray-500">
            Category: {study.category}
          </div>
        </div>
      </CardContent>
    </Card>
  );

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