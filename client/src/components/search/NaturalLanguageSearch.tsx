/**
 * Natural Language Search Component
 * Provides an intelligent search interface with OpenAI-powered query understanding
 */

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Sparkles,
  Mic,
  MicOff,
  X,
  ChevronRight,
  Brain,
  Target,
  Lightbulb,
  TrendingUp,
  AlertCircle,
  BookmarkPlus,
  Filter,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface NaturalLanguageSearchProps {
  onResultsUpdate?: (results: any[]) => void;
  initialQuery?: string;
  embedded?: boolean;
}

interface QueryExample {
  category: string;
  icon: any;
  queries: string[];
}

export function NaturalLanguageSearch({
  onResultsUpdate,
  initialQuery = "",
  embedded = false,
}: NaturalLanguageSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [isListening, setIsListening] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  const [selectedExample, setSelectedExample] = useState<string | null>(null);
  const { toast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Query examples organized by category
  const queryExamples: QueryExample[] = [
    {
      category: "Conditions",
      icon: Target,
      queries: [
        "Studies for arthritis in elderly patients",
        "Hydrogen therapy for diabetes management",
        "Heart disease treatment with molecular hydrogen",
      ],
    },
    {
      category: "Comparisons",
      icon: Brain,
      queries: [
        "Compare hydrogen water vs inhalation for heart health",
        "Which is better: H2 tablets or hydrogen water?",
        "Hydrogen therapy vs traditional antioxidants",
      ],
    },
    {
      category: "Effectiveness",
      icon: TrendingUp,
      queries: [
        "Most effective hydrogen therapy for inflammation",
        "Success rates of hydrogen for post-surgery recovery",
        "Best hydrogen treatment for oxidative stress",
      ],
    },
    {
      category: "Recent Research",
      icon: Sparkles,
      queries: [
        "Latest hydrogen therapy breakthroughs 2024",
        "Recent studies on hydrogen and longevity",
        "New discoveries in hydrogen medicine",
      ],
    },
  ];

  // Natural language search mutation
  const searchMutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      const res = await apiRequest("POST", "/api/search/natural-language", {
        query: searchQuery,
        page: 1,
        pageSize: 20,
      });
      return await res.json() as any;
    },
    onSuccess: (data: any) => {
      console.log("Search successful:", data);
      if (onResultsUpdate) {
        onResultsUpdate(data.results);
      }
      setShowExamples(false);

      // Show interpretation toast if confidence is low
      if (data.query?.confidence < 0.7) {
        toast({
          title: "Query Interpretation",
          description:
            data.interpretation?.understood ||
            "I'm doing my best to understand your query",
          variant: "default",
        });
      }
    },
    onError: (error: any) => {
      console.error("Search error:", error);
      toast({
        title: "Search Error",
        description: error.message || "Failed to perform search",
        variant: "destructive",
      });
    },
  });

  // Get search suggestions
  const { data: suggestions } = useQuery({
    queryKey: ["/api/search/nl-suggestions", query],
    enabled: query.length >= 2,
    queryFn: async () => {
      const response = await fetch(
        `/api/search/nl-suggestions?q=${encodeURIComponent(query)}`,
      );
      if (!response.ok) throw new Error("Failed to fetch suggestions");
      return response.json();
    },
  });

  // Get popular queries
  const { data: popularQueries } = useQuery({
    queryKey: ["/api/search/popular-queries"],
    queryFn: async () => {
      const response = await fetch("/api/search/popular-queries");
      if (!response.ok) throw new Error("Failed to fetch popular queries");
      return response.json();
    },
  });

  // Handle search submission
  const handleSearch = () => {
    if (!query.trim()) return;
    searchMutation.mutate(query);
  };

  // Handle example click
  const handleExampleClick = (exampleQuery: string) => {
    setQuery(exampleQuery);
    setSelectedExample(exampleQuery);
    searchMutation.mutate(exampleQuery);
  };

  // Voice search support (simplified for now)
  const toggleVoiceSearch = () => {
    if (
      !("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
    ) {
      toast({
        title: "Not Supported",
        description: "Voice search is not supported in your browser",
        variant: "destructive",
      });
      return;
    }

    setIsListening(!isListening);

    if (!isListening) {
      // Start listening (simplified implementation)
      toast({
        title: "Listening...",
        description: "Speak your search query",
      });
    } else {
      // Stop listening
      toast({
        title: "Processing...",
        description: "Converting speech to text",
      });
    }
  };

  // Clear search
  const clearSearch = () => {
    setQuery("");
    setShowExamples(true);
    searchInputRef.current?.focus();
  };

  return (
    <div className={`w-full ${embedded ? "" : "max-w-4xl mx-auto"}`}>
      {/* Search Header */}
      {!embedded && (
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
            <Sparkles className="h-8 w-8 text-primary animate-pulse" />
            Natural Language Search
          </h2>
          <p className="text-muted-foreground">
            Ask questions in plain English and I'll find relevant research for
            you
          </p>
        </div>
      )}

      {/* Search Input */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Ask me anything about hydrogen therapy research..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 pr-10"
                data-testid="input-natural-language-search"
              />
              {query && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  data-testid="button-clear-search"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleVoiceSearch}
              data-testid="button-voice-search"
            >
              {isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
            <Button
              onClick={handleSearch}
              disabled={!query.trim() || searchMutation.isPending}
              data-testid="button-search"
            >
              {searchMutation.isPending ? <>Searching...</> : <>Search</>}
            </Button>
          </div>

          {/* Suggestions */}
          {suggestions?.suggestions && suggestions.suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">
                Suggestions:
              </span>
              {suggestions.suggestions.map(
                (suggestion: string, idx: number) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => setQuery(suggestion)}
                    data-testid={`button-suggestion-${idx}`}
                  >
                    {suggestion}
                  </Button>
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Query Interpretation (shown after search) */}
      {searchMutation.data && searchMutation.data.interpretation && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Query Understanding
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    searchMutation.data.query.confidence > 0.7
                      ? "default"
                      : "secondary"
                  }
                >
                  {(searchMutation.data.query.confidence * 100).toFixed(0)}%
                  Confident
                </Badge>
                <Badge variant="outline">
                  {searchMutation.data.query.intent
                    ?.replace(/_/g, " ")
                    .toLowerCase()}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {searchMutation.data.interpretation.understood}
              </p>

              {/* Extracted entities */}
              {searchMutation.data.interpretation.entities && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {searchMutation.data.interpretation.entities.conditions?.map(
                    (condition: string) => (
                      <Badge
                        key={condition}
                        variant="secondary"
                        className="text-xs"
                      >
                        {condition}
                      </Badge>
                    ),
                  )}
                  {searchMutation.data.interpretation.entities.deliveryMethods?.map(
                    (method: string) => (
                      <Badge
                        key={method}
                        variant="secondary"
                        className="text-xs"
                      >
                        {method}
                      </Badge>
                    ),
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Query Examples */}
      {showExamples && !searchMutation.data && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Tabs defaultValue="examples" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="examples">Example Queries</TabsTrigger>
                <TabsTrigger value="popular">Popular Searches</TabsTrigger>
              </TabsList>

              <TabsContent value="examples" className="mt-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {queryExamples.map((category) => (
                    <Card key={category.category}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <category.icon className="h-4 w-4" />
                          {category.category}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {category.queries.map((exampleQuery) => (
                            <button
                              key={exampleQuery}
                              onClick={() => handleExampleClick(exampleQuery)}
                              className={`w-full text-left p-2 rounded-md hover:bg-muted transition-colors text-sm ${
                                selectedExample === exampleQuery
                                  ? "bg-muted"
                                  : ""
                              }`}
                              data-testid={`button-example-${exampleQuery.replace(/\s+/g, "-").toLowerCase()}`}
                            >
                              <ChevronRight className="inline h-3 w-3 mr-1" />
                              {exampleQuery}
                            </button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="popular" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Trending Searches</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {popularQueries?.queries?.map(
                        (popQuery: string, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => handleExampleClick(popQuery)}
                            className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors text-sm"
                            data-testid={`button-popular-${idx}`}
                          >
                            <TrendingUp className="inline h-3 w-3 mr-2 text-muted-foreground" />
                            {popQuery}
                          </button>
                        ),
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Loading State */}
      {searchMutation.isPending && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}
    </div>
  );
}
