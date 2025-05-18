import { Helmet } from "react-helmet";
import { Container } from "@/components/ui/container";
import ResearchWizard from "@/components/research-wizard/ResearchWizard";
import { Lightbulb, BookOpen, Search } from "lucide-react";

export default function ResearchSuggestionsPage() {
  return (
    <>
      <Helmet>
        <title>Research Suggestion Wizard | Hydrogen Studies</title>
        <meta
          name="description"
          content="Get personalized hydrogen research suggestions based on your interests and health conditions."
        />
      </Helmet>
      
      <Container className="py-8 md:py-12">
        <div className="mx-auto max-w-3xl text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Research Suggestion Wizard
          </h1>
          <p className="text-lg text-muted-foreground">
            Let our AI help you discover relevant hydrogen research topics tailored to your interests
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <div className="flex flex-col items-center text-center p-4 border rounded-lg">
            <div className="bg-primary/10 p-3 rounded-full mb-3">
              <Lightbulb className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-medium mb-1">Personalized Suggestions</h3>
            <p className="text-sm text-muted-foreground">
              Get research topics tailored to your specific interests and health conditions
            </p>
          </div>
          
          <div className="flex flex-col items-center text-center p-4 border rounded-lg">
            <div className="bg-primary/10 p-3 rounded-full mb-3">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-medium mb-1">Optimized Search Terms</h3>
            <p className="text-sm text-muted-foreground">
              Discover the most effective search terms to find relevant studies
            </p>
          </div>
          
          <div className="flex flex-col items-center text-center p-4 border rounded-lg">
            <div className="bg-primary/10 p-3 rounded-full mb-3">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-medium mb-1">Research Gap Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Identify areas where more hydrogen research is needed
            </p>
          </div>
        </div>
        
        <ResearchWizard />
      </Container>
    </>
  );
}