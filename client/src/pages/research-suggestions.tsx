import React from "react";
import Container from "@/components/ui/container";
import ResearchWizard from "@/components/research-wizard/ResearchWizard";
import { Helmet } from "react-helmet";
import { Lightbulb, Sparkles } from "lucide-react";

const ResearchSuggestionsPage: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Research Suggestions Wizard | HydrogenStudies.com</title>
        <meta
          name="description"
          content="Get personalized hydrogen research suggestions based on your health interests, conditions, and preferences. Our AI-powered wizard helps you discover the most relevant hydrogen studies for your needs."
        />
      </Helmet>

      <Container>
        <div className="max-w-4xl mx-auto mb-12">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="absolute -inset-1 rounded-full blur-md bg-gradient-to-r from-teal-400 to-cyan-300 opacity-70"></div>
                <div className="relative bg-white rounded-full p-3">
                  <Lightbulb size={36} className="text-primary" />
                </div>
              </div>
            </div>

            <h1 className="text-3xl font-bold mb-2">
              Research Suggestions Wizard
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Get personalized hydrogen research suggestions based on your
              interests and preferences
            </p>
          </div>

          <div className="bg-muted/30 rounded-lg p-4 mb-8 border flex items-start gap-3">
            <Sparkles className="text-teal-500 mt-1 flex-shrink-0" size={20} />
            <div>
              <h3 className="font-medium mb-1">How it works</h3>
              <p className="text-sm text-muted-foreground">
                Our AI-powered wizard analyzes thousands of hydrogen studies to
                recommend the most relevant research based on your health
                interests, demographic information, and delivery method
                preferences. Just follow the simple steps below to get tailored
                research suggestions.
              </p>
            </div>
          </div>
        </div>

        <ResearchWizard />
      </Container>
    </>
  );
};

export default ResearchSuggestionsPage;
