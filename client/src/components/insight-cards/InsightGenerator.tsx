import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, Lightbulb, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { Study } from '@/types';
import { cn } from '@/lib/utils';

interface InsightGeneratorProps {
  study: Study;
  onSelectInsight: (insight: string) => void;
  className?: string;
}

// Pre-defined insight templates based on study aspects
const INSIGHT_TEMPLATES = [
  (study: Study) => `${study.title.split(':')[0] || study.title.substring(0, 80)}`,
  (study: Study) => `This study shows potential benefits of hydrogen for ${study.category.toLowerCase()} applications.`,
  (study: Study) => `Research by ${study.authors.split(',')[0]} demonstrates hydrogen's effects on ${study.category.toLowerCase()}.`,
  (study: Study) => `Hydrogen therapy may provide benefits for ${study.category.toLowerCase()} according to this research.`,
  (study: Study) => `Key finding: ${study.title.substring(0, 100)}...`,
];

// Extract key topics from a study
function extractKeyTopics(study: Study): string[] {
  const topics: string[] = [];
  
  // Extract from title
  const titleWords = study.title.toLowerCase().split(' ');
  const keyTitleWords = titleWords.filter(word => 
    word.length > 4 && 
    !['study', 'research', 'analysis', 'review', 'effects', 'effect'].includes(word)
  );
  
  if (keyTitleWords.length > 0) {
    topics.push(keyTitleWords[0]);
    if (keyTitleWords.length > 3) topics.push(keyTitleWords[2]);
  }
  
  // Add category
  topics.push(study.category.toLowerCase());
  
  // Add generic hydrogen-related terms
  topics.push('hydrogen therapy');
  topics.push('molecular hydrogen');
  
  return [...new Set(topics)]; // Remove duplicates
}

export default function InsightGenerator({ study, onSelectInsight, className }: InsightGeneratorProps) {
  const [insights, setInsights] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<string | null>(null);
  
  // Generate insights based on the study data
  const generateInsights = async () => {
    setIsLoading(true);
    
    try {
      // First try to get AI-generated insights if an OpenAI API key is available
      try {
        const response = await fetch('/api/generate-insights', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ study }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.insights && data.insights.length > 0) {
            setInsights(data.insights);
            setIsLoading(false);
            return;
          }
        }
      } catch (error) {
        console.log('Could not get AI-generated insights, using templates instead');
      }
      
      // Fallback to template-based insights
      const generatedInsights = INSIGHT_TEMPLATES.map(template => template(study));
      
      // Add some additional insights based on study data
      const topics = extractKeyTopics(study);
      
      const additionalInsights = [
        `This research explores hydrogen's potential for ${topics[0] || 'health'}.`,
        `${study.journal} published this important study on ${topics[1] || 'hydrogen therapy'}.`,
        `Promising research on ${topics[2] || 'molecular hydrogen'} for health applications.`,
      ];
      
      setInsights([...generatedInsights, ...additionalInsights]);
    } catch (error) {
      console.error('Error generating insights:', error);
      // Set some generic insights as fallback
      setInsights([
        `Key finding from "${study.title.substring(0, 60)}..."`,
        `Research on hydrogen applications for ${study.category.toLowerCase()}.`,
        `Study by ${study.authors.split(',')[0]} et al. on hydrogen therapy.`,
      ]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Select an insight and pass it to the parent component
  const handleSelectInsight = (insight: string) => {
    setSelectedInsight(insight);
    onSelectInsight(insight);
  };
  
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          Insight Generator
        </CardTitle>
        <CardDescription>
          Select or generate a shareable insight from this study
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {insights.length === 0 && !isLoading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Generate insights to help share this research
            </p>
            <Button onClick={generateInsights}>
              Generate Insights
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <div
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer hover:border-primary hover:bg-primary/5 transition-all",
                    selectedInsight === insight ? "border-primary bg-primary/10" : "border-gray-200"
                  )}
                  onClick={() => handleSelectInsight(insight)}
                >
                  <p className="text-sm">{insight}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
      
      {insights.length > 0 && !isLoading && (
        <CardFooter className="flex justify-between">
          <Button 
            variant="outline" 
            size="sm"
            onClick={generateInsights}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Regenerate
          </Button>
          
          {selectedInsight && (
            <Button
              size="sm"
              onClick={() => onSelectInsight(selectedInsight)}
            >
              Use Selected Insight
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}