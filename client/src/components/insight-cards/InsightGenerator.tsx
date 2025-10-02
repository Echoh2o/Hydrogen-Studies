import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Brain, Lightbulb, Wand2 } from "lucide-react";
import { motion } from "framer-motion";
import { Study } from "@/types";
import { useToast } from "@/hooks/use-toast";

interface InsightGeneratorProps {
  study: Study;
  onSelectInsight: (insight: string) => void;
  className?: string;
}

export default function InsightGenerator({
  study,
  onSelectInsight,
  className = "",
}: InsightGeneratorProps) {
  const { toast } = useToast();
  const [insights, setInsights] = useState<string[]>([]);
  const [customInsight, setCustomInsight] = useState("");
  const [selectedInsight, setSelectedInsight] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const generateInsights = async () => {
    try {
      setIsLoading(true);

      const response = await fetch("/api/insight-cards/generate-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studyId: study.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate insights");
      }

      const data = await response.json();

      // Convert the insights array to a Set and back to remove any duplicates
      const uniqueInsights = [...new Set(data.insights || [])];
      setInsights(uniqueInsights);

      if (uniqueInsights.length > 0) {
        setSelectedInsight(uniqueInsights[0]);
        onSelectInsight(uniqueInsights[0]);
      }
    } catch (error) {
      console.error("Error generating insights:", error);
      toast({
        title: "Generation Failed",
        description: "Unable to generate insights. Please try again later.",
        variant: "destructive",
      });
      // Set some fallback insights
      const fallbackInsights = [
        `${study.title} provides evidence for hydrogen's health benefits.`,
        `This study demonstrates potential applications of hydrogen therapy.`,
        `Research shows hydrogen's effectiveness for improving health outcomes.`,
        `The findings indicate hydrogen's role in cellular protection.`,
        `This research has implications for clinical hydrogen applications.`,
      ];
      setInsights(fallbackInsights);
      setSelectedInsight(fallbackInsights[0]);
      onSelectInsight(fallbackInsights[0]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Generate insights when the component mounts
    generateInsights();
  }, [study.id]);

  const handleSelectInsight = (value: string) => {
    setSelectedInsight(value);
    onSelectInsight(value);
  };

  const handleCustomInsightChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setCustomInsight(e.target.value);
  };

  const handleUseCustomInsight = () => {
    if (!customInsight.trim()) {
      toast({
        title: "Empty Insight",
        description: "Please enter a custom insight first",
        variant: "destructive",
      });
      return;
    }

    setSelectedInsight(customInsight);
    onSelectInsight(customInsight);

    // Add to insights array if not already present
    if (!insights.includes(customInsight)) {
      setInsights([...insights, customInsight]);
    }

    toast({
      title: "Custom Insight Selected",
      description: "Your insight has been applied to the card",
    });
  };

  const handleRefreshInsights = () => {
    generateInsights();
  };

  return (
    <div className={`w-full ${className}`}>
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Research Insights</h3>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : (
            <>
              <div className="mb-6">
                <RadioGroup
                  value={selectedInsight}
                  onValueChange={handleSelectInsight}
                  className="space-y-3"
                >
                  {insights.map((insight, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 rounded-md border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <RadioGroupItem
                        value={insight}
                        id={`insight-${index}`}
                        className="mt-1"
                      />
                      <Label
                        htmlFor={`insight-${index}`}
                        className="font-normal text-sm leading-5 cursor-pointer"
                      >
                        {insight}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-4">
                <div>
                  <Label
                    htmlFor="custom-insight"
                    className="mb-2 flex items-center gap-1.5"
                  >
                    <Lightbulb className="h-4 w-4" />
                    <span>Write Your Own Insight</span>
                  </Label>
                  <Textarea
                    id="custom-insight"
                    value={customInsight}
                    onChange={handleCustomInsightChange}
                    placeholder="Enter a custom insight about this study..."
                    className="resize-none min-h-[80px]"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUseCustomInsight}
                    disabled={!customInsight}
                  >
                    Use Custom Insight
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshInsights}
                    disabled={isLoading}
                  >
                    <Wand2 className="h-4 w-4 mr-1.5" />
                    Generate New Insights
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
