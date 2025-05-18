import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BookOpen, 
  RefreshCcw, 
  Search, 
  ArrowUpRight, 
  PlusCircle, 
  Lightbulb, 
  BarChart,
  ThumbsUp,
  ThumbsDown
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

interface WizardResultsProps {
  results: {
    suggestions: Array<{
      title: string;
      description: string;
      searchTerms: string[];
      researchGaps?: string[];
      confidence: number;
      relatedStudies: Array<{
        id: number;
        title: string;
        authors: string;
        abstract: string;
        journal: string;
        publishDate: string;
      }>;
    }>;
    searchTerms: string[];
  };
  onReset: () => void;
  selections: Record<string, any>;
}

const WizardResults: React.FC<WizardResultsProps> = ({ 
  results, 
  onReset,
  selections
}) => {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("suggestions");
  
  // Function to render confidence level as stars and percentage
  const renderConfidence = (confidence: number) => {
    const stars = Math.round(confidence * 5);
    return (
      <div className="flex items-center space-x-2">
        <div className="flex">
          {[...Array(5)].map((_, i) => (
            <span key={i} className={`text-lg ${i < stars ? 'text-yellow-500' : 'text-gray-300'}`}>
              ★
            </span>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">
          {Math.round(confidence * 100)}% confidence
        </span>
      </div>
    );
  };
  
  // Handle search with a particular term
  const handleSearch = (term: string) => {
    setLocation(`/studies?query=${encodeURIComponent(term)}`);
  };
  
  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          Research Suggestions
        </CardTitle>
        <CardDescription className="text-center">
          AI-generated research suggestions based on your preferences
        </CardDescription>
      </CardHeader>
      
      <Tabs defaultValue="suggestions" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="suggestions">
            <Lightbulb className="mr-2 h-4 w-4" />
            Suggestions
          </TabsTrigger>
          <TabsTrigger value="terms">
            <Search className="mr-2 h-4 w-4" />
            Search Terms
          </TabsTrigger>
          <TabsTrigger value="studies">
            <BookOpen className="mr-2 h-4 w-4" />
            Related Studies
          </TabsTrigger>
        </TabsList>
        
        {/* Suggestions Tab */}
        <TabsContent value="suggestions" className="pt-4 pb-2">
          <div className="space-y-6">
            {results.suggestions.map((suggestion, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3 bg-background hover:border-border transition-colors">
                <div className="space-y-1.5">
                  <h3 className="text-lg font-semibold">{suggestion.title}</h3>
                  <p className="text-muted-foreground">{suggestion.description}</p>
                  {renderConfidence(suggestion.confidence)}
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-1.5">Suggested search terms:</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestion.searchTerms.map((term, i) => (
                      <Badge 
                        key={i} 
                        variant="secondary" 
                        className="cursor-pointer hover:bg-secondary/80"
                        onClick={() => handleSearch(term)}
                      >
                        {term}
                        <Search className="ml-1 h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                </div>
                
                {suggestion.researchGaps && suggestion.researchGaps.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-1.5">Research gaps:</h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {suggestion.researchGaps.map((gap, i) => (
                        <li key={i}>{gap}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="flex justify-between pt-1">
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleSearch(suggestion.searchTerms[0])}
                    >
                      <Search className="mr-1 h-4 w-4" />
                      Search
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setActiveTab("studies")}
                    >
                      <BookOpen className="mr-1 h-4 w-4" />
                      Related Studies
                    </Button>
                  </div>
                  
                  {/* Feedback buttons */}
                  <div className="flex space-x-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8">
                      <ThumbsUp className="h-4 w-4 text-muted-foreground hover:text-green-500" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8">
                      <ThumbsDown className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
        
        {/* Search Terms Tab */}
        <TabsContent value="terms" className="pt-4 pb-2">
          <div className="space-y-4">
            <div className="border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">Recommended search terms based on your preferences:</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {results.searchTerms.map((term, index) => (
                  <Button 
                    key={index} 
                    variant="outline" 
                    className="justify-start"
                    onClick={() => handleSearch(term)}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    {term}
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">Try these search operators:</h3>
              <div className="space-y-2">
                <div className="p-2 bg-muted rounded-md">
                  <code className="text-sm">hydrogen AND inflammation</code>
                  <p className="text-xs text-muted-foreground mt-1">
                    Find studies containing both terms
                  </p>
                </div>
                <div className="p-2 bg-muted rounded-md">
                  <code className="text-sm">hydrogen OR molecular</code>
                  <p className="text-xs text-muted-foreground mt-1">
                    Find studies containing either term
                  </p>
                </div>
                <div className="p-2 bg-muted rounded-md">
                  <code className="text-sm">hydrogen -energy</code>
                  <p className="text-xs text-muted-foreground mt-1">
                    Exclude studies containing "energy"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
        
        {/* Related Studies Tab */}
        <TabsContent value="studies" className="pt-4 pb-2">
          <div className="space-y-4">
            {results.suggestions.flatMap(suggestion => 
              suggestion.relatedStudies.map((study, index) => (
                <div key={`${study.id}-${index}`} className="border rounded-lg p-4 hover:border-border transition-colors">
                  <div className="space-y-2">
                    <h3 className="font-medium">{study.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {study.authors} • {study.journal} • {new Date(study.publishDate).getFullYear()}
                    </p>
                    <p className="text-sm line-clamp-3">{study.abstract}</p>
                    <div className="pt-2">
                      <Button 
                        size="sm" 
                        onClick={() => setLocation(`/study/${study.id}`)}
                      >
                        View Study
                        <ArrowUpRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
            
            {results.suggestions.flatMap(s => s.relatedStudies).length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No related studies found</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
      
      <CardFooter className="flex justify-between pt-3">
        <Button variant="outline" onClick={onReset}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Start Over
        </Button>
        <Button 
          onClick={() => setLocation('/studies')}
        >
          Browse All Studies
          <BookOpen className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default WizardResults;