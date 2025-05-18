import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Lightbulb, 
  Sparkles, 
  Search, 
  BookOpen, 
  BarChart, 
  ArrowRight,
  DownloadIcon
} from "lucide-react";
import { Link } from "wouter";

interface StudyReference {
  id: number;
  title: string;
  authors: string;
  abstract: string;
  journal: string;
  publishDate: string;
}

interface ResearchSuggestion {
  title: string;
  description: string;
  searchTerms: string[];
  researchGaps?: string[];
  confidence: number;
  relatedStudies: StudyReference[];
}

interface WizardResultsProps {
  results: {
    suggestions: ResearchSuggestion[];
    searchTerms: string[];
  };
  onReset: () => void;
  selections: Record<string, any>;
}

const WizardResults = ({ results, onReset, selections }: WizardResultsProps) => {
  // Function to generate PDF report
  const generateReport = () => {
    // This would be implemented in a real-world scenario
    // For now, just showing how it would be triggered
    alert('PDF report generation would be implemented here');
    // Would use a library like jspdf or html2canvas to generate a PDF
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Research Suggestions</h2>
        <p className="text-muted-foreground mb-4">
          Based on your selections, we've generated the following research suggestions
        </p>
        
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {results.searchTerms.map((term, index) => (
            <Badge key={index} variant="secondary" className="text-sm">
              {term}
            </Badge>
          ))}
        </div>
        
        <div className="flex justify-center gap-4">
          <Button onClick={onReset} variant="outline">
            Start Over
          </Button>
          <Button onClick={generateReport} className="gap-2">
            <DownloadIcon size={16} />
            Download Report
          </Button>
        </div>
      </div>
      
      <div className="space-y-6">
        {results.suggestions.map((suggestion, index) => (
          <Card key={index} className="overflow-hidden">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl mb-1">{suggestion.title}</CardTitle>
                  <CardDescription>
                    Confidence Score: {suggestion.confidence}%
                  </CardDescription>
                </div>
                <Badge 
                  variant={suggestion.confidence > 80 ? "default" : 
                        suggestion.confidence > 60 ? "secondary" : "outline"}
                  className="text-xs"
                >
                  {suggestion.confidence > 80 ? "High Confidence" : 
                  suggestion.confidence > 60 ? "Medium Confidence" : "Exploratory"}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="pt-4 pb-2">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-primary mb-2">
                    <Lightbulb size={18} />
                    <h4 className="font-medium">Research Focus</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 text-primary mb-2">
                    <Search size={18} />
                    <h4 className="font-medium">Search Terms</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestion.searchTerms.map((term, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {term}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                {suggestion.researchGaps && suggestion.researchGaps.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-primary mb-2">
                      <Sparkles size={18} />
                      <h4 className="font-medium">Research Gaps</h4>
                    </div>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 pl-1">
                      {suggestion.researchGaps.map((gap, idx) => (
                        <li key={idx}>{gap}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {suggestion.relatedStudies && suggestion.relatedStudies.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-primary mb-2">
                      <BookOpen size={18} />
                      <h4 className="font-medium">Related Studies</h4>
                    </div>
                    <div className="space-y-2">
                      {suggestion.relatedStudies.slice(0, 3).map((study) => (
                        <Link href={`/studies/${study.id}`} key={study.id}>
                          <a className="block p-3 border rounded-md hover:bg-muted transition-colors">
                            <h5 className="font-medium text-sm mb-1 line-clamp-1">{study.title}</h5>
                            <div className="flex items-center text-xs text-muted-foreground gap-2">
                              <span>{study.journal}</span>
                              <span>•</span>
                              <span>{study.publishDate}</span>
                            </div>
                          </a>
                        </Link>
                      ))}
                      {suggestion.relatedStudies.length > 3 && (
                        <Button variant="link" size="sm" className="mt-1 h-auto p-0">
                          View {suggestion.relatedStudies.length - 3} more related studies
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            
            <CardFooter className="border-t py-3">
              <Link href={`/studies?query=${encodeURIComponent(suggestion.title)}`}>
                <Button variant="ghost" size="sm" className="ml-auto flex items-center gap-1">
                  Find related research
                  <ArrowRight size={14} />
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
      
      <div className="border rounded-md p-4 bg-muted/50">
        <div className="flex items-center gap-2 text-primary mb-3">
          <BarChart size={18} />
          <h4 className="font-medium">Your Research Criteria</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Interests:</span>
            <span className="font-medium">{selections.interests.join(', ') || 'None selected'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Health Conditions:</span>
            <span className="font-medium">{selections.healthConditions.join(', ') || 'None selected'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Demographic Group:</span>
            <span className="font-medium">{selections.demographicGroup || 'Any'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Research Type:</span>
            <span className="font-medium">{selections.researchType || 'Any'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery Methods:</span>
            <span className="font-medium">{selections.deliveryMethod.join(', ') || 'Any'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Time Frame:</span>
            <span className="font-medium">{selections.timeFrame || 'Any'}</span>
          </div>
        </div>
      </div>
      
      <div className="flex justify-center pt-4">
        <Button onClick={onReset} variant="outline">
          Start Over
        </Button>
      </div>
    </div>
  );
};

export default WizardResults;