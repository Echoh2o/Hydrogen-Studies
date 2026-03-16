/**
 * Natural Language Search Page
 * Main page for AI-powered natural language search functionality
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { NaturalLanguageSearch } from "@/components/search/NaturalLanguageSearch";
import { NaturalLanguageSearchResults } from "@/components/search/NaturalLanguageSearchResults";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  ArrowLeft,
  Info,
  Settings,
  Download,
  HelpCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet";
import Footer from "@/components/layout/Footer";

export default function NaturalLanguageSearchPage() {
  const [location, setLocation] = useLocation();
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  // Get query from URL params if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) {
      // Trigger search with URL query
      handleInitialSearch(q);
    }
  }, []);

  const handleInitialSearch = async (query: string) => {
    setIsSearching(true);
    try {
      const response = await fetch("/api/search/natural-language", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          page: 1,
          pageSize: 20,
        }),
      });

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Search Error",
        description: "Failed to perform search. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultsUpdate = (results: any) => {
    // This will be called when the search component gets results
    if (results) {
      setSearchResults({
        results,
        totalCount: results.length,
        facets: null,
        queryInterpretation: null,
        suggestions: null,
      });
    }
  };

  const handleSaveSearch = () => {
    if (searchResults?.query?.original) {
      const searchName = prompt("Name this search:");
      if (searchName) {
        // Save to localStorage for now
        let savedSearches: any[] = [];
        try { savedSearches = JSON.parse(localStorage.getItem("savedSearches") || "[]"); } catch (e) { console.warn("Failed to parse saved searches from localStorage", e); }
        savedSearches.push({
          id: Date.now(),
          name: searchName,
          query: searchResults.query.original,
          date: new Date().toISOString(),
        });
        localStorage.setItem("savedSearches", JSON.stringify(savedSearches));

        toast({
          title: "Search Saved",
          description: `Saved as "${searchName}"`,
        });
      }
    }
  };

  const handleExportResults = () => {
    if (!searchResults?.results) return;

    // Create CSV content
    const csvContent = [
      ["Title", "Authors", "Journal", "Year", "Abstract", "DOI"].join(","),
      ...searchResults.results.map((r: any) =>
        [
          `"${r.title?.replace(/"/g, '""') || ""}"`,
          `"${r.authors?.replace(/"/g, '""') || ""}"`,
          `"${r.journal?.replace(/"/g, '""') || ""}"`,
          new Date(r.publishDate || "").getFullYear() || "",
          `"${r.abstract?.replace(/"/g, '""').substring(0, 500) || ""}"`,
          r.doi || "",
        ].join(","),
      ),
    ].join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `search-results-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Results Exported",
      description: `Exported ${searchResults.results.length} results to CSV`,
    });
  };

  return (
    <>
      <Helmet>
        <title>AI-Powered Research Search - Hydrogen Studies</title>
        <meta name="description" content="Search hydrogen research studies using natural language. Our AI helps you find the most relevant studies for your questions." />
      </Helmet>
      <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <Button
                variant="ghost"
                onClick={() => setLocation("/search")}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Search
              </Button>
            </div>

            <h1 className="text-4xl font-bold mb-4 flex items-center gap-3">
              <Sparkles className="h-10 w-10 text-primary animate-pulse" />
              Natural Language Search
            </h1>

            <p className="text-lg text-muted-foreground max-w-3xl">
              Ask questions about hydrogen therapy research in plain English.
              Our AI-powered search understands your intent and finds the most
              relevant studies.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {searchResults?.results && searchResults.results.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportResults}
                data-testid="button-export"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                toast({
                  title: "Help",
                  description:
                    "Try asking questions like: 'Studies for arthritis in elderly patients' or 'Compare hydrogen water vs inhalation'",
                });
              }}
              data-testid="button-help"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Info Banner */}
        <Card className="mb-6 bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold mb-1">AI-Powered Understanding</h3>
                <p className="text-sm text-muted-foreground">
                  This search uses OpenAI to understand your questions, extract
                  key concepts, and find semantically similar research. Try
                  asking complex questions or making comparisons!
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge variant="secondary">Entity Extraction</Badge>
                  <Badge variant="secondary">Intent Classification</Badge>
                  <Badge variant="secondary">Semantic Matching</Badge>
                  <Badge variant="secondary">Query Expansion</Badge>
                  <Badge variant="secondary">Spell Correction</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Search Interface */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <NaturalLanguageSearch
          onResultsUpdate={(data) => setSearchResults(data)}
        />
      </motion.div>

      {/* Search Results */}
      {searchResults && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <NaturalLanguageSearchResults
            results={searchResults.results || []}
            facets={searchResults.facets}
            queryInterpretation={searchResults.queryInterpretation}
            suggestions={searchResults.suggestions}
            totalCount={searchResults.totalCount}
            isLoading={isSearching}
            onSaveSearch={handleSaveSearch}
          />
        </motion.div>
      )}

      {/* Features Section */}
      {!searchResults && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="grid md:grid-cols-3 gap-6 mt-12"
        >
          <Card>
            <CardContent className="p-6">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Smart Understanding</h3>
              <p className="text-sm text-muted-foreground">
                Our AI understands medical terminology, abbreviations, and
                complex queries. It expands H2 to hydrogen, recognizes
                conditions, and understands research context.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Settings className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Intelligent Filtering</h3>
              <p className="text-sm text-muted-foreground">
                Automatically extracts filters from your query. Mention age
                groups, conditions, or time periods, and we'll apply the right
                filters.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Info className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Transparent Results</h3>
              <p className="text-sm text-muted-foreground">
                See why each result matches your query. We explain our
                understanding and show relevance scores for complete
                transparency.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
      <Footer />
    </>
  );
}
