import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Helmet } from "react-helmet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Share2, Download, Lightbulb } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import InsightCard from "@/components/insight-cards/InsightCard";
import InsightGenerator from "@/components/insight-cards/InsightGenerator";
import { Study } from "@/types";

export default function ShareInsightCard() {
  const params = useParams<{ id: string }>();
  const [_location, setLocation] = useLocation();
  const [selectedInsight, setSelectedInsight] = useState<string>("");

  // Fetch study data
  const {
    data: study,
    isLoading,
    error,
  } = useQuery<Study>({
    queryKey: [`/api/studies/${params.id}`],
    enabled: !!params.id,
  });

  const handleSelectInsight = (insight: string) => {
    setSelectedInsight(insight);
  };

  const handleGoBack = () => {
    setLocation(`/study/${params.id}`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !study) {
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Study Not Found</h2>
          <p className="mb-6">
            We couldn't find the study you're looking for. Please try again or
            go back to the studies list.
          </p>
          <Button onClick={() => setLocation("/studies")}>
            Back to Studies
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Helmet>
        <title>Share Research Insight | Hydrogen Studies</title>
        <meta
          name="description"
          content={`Create and share a visual insight card based on the study: ${study.title}`}
        />
      </Helmet>

      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={handleGoBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Study
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h1 className="text-2xl font-bold mb-2">
                Create Shareable Research Insight
              </h1>
              <p className="text-muted-foreground mb-6">
                Generate a visual insight card to share key findings from this
                study
              </p>

              <InsightGenerator
                study={study}
                onSelectInsight={handleSelectInsight}
                className="mb-6"
              />
            </div>

            <div className="flex flex-col">
              <h2 className="text-lg font-semibold mb-2">Preview & Share</h2>
              <p className="text-muted-foreground mb-4">
                Customize and share this insight card
              </p>

              <Card className="flex-grow">
                <CardContent className="p-6">
                  <InsightCard
                    study={study}
                    insight={selectedInsight || undefined}
                    isEditable={true}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>

        <div className="mt-12">
          <h2 className="text-lg font-semibold mb-4">Key Study Details</h2>
          <Card>
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-2">{study.title}</h3>
              <div className="flex flex-wrap text-sm text-muted-foreground gap-x-6 gap-y-2 mb-4">
                <div>
                  <strong>Authors:</strong> {study.authors}
                </div>
                <div>
                  <strong>Journal:</strong> {study.journal}
                </div>
                <div>
                  <strong>Published:</strong>{" "}
                  {new Date(study.publishDate).toLocaleDateString()}
                </div>
                <div>
                  <strong>Category:</strong> {study.category}
                </div>
              </div>

              <h4 className="font-medium mb-2">Abstract</h4>
              <p className="text-sm">{study.abstract}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
