import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, ArrowLeft, Search, Lightbulb, BookOpen } from "lucide-react";
import { useLocation } from "wouter";
import WizardResults from "./WizardResults";

interface ResearchWizardProps {
  onComplete?: (results: any) => void;
  initialStep?: string;
}

interface WizardStep {
  id: string;
  title: string;
  description: string;
  options: {
    id: string;
    label: string;
    description?: string;
    category?: string;
  }[];
}

const ResearchWizard: React.FC<ResearchWizardProps> = ({ 
  onComplete,
  initialStep = "purpose" 
}) => {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Wizard state
  const [currentStepId, setCurrentStepId] = useState<string>(initialStep);
  const [selections, setSelections] = useState<Record<string, any>>({
    interests: [],
    healthConditions: [],
    demographicGroups: [],
    researchPurpose: "general_interest",
    preferredTopics: [],
    includeRecentOnly: true,
    preferPeerReviewed: true,
    suggestionType: "trending_topics"
  });
  
  const [isComplete, setIsComplete] = useState(false);
  
  // Fetch wizard steps from API
  const { data: wizardSteps, isLoading: isLoadingSteps } = useQuery<WizardStep[]>({
    queryKey: ['/api/research-suggestions/wizard-steps'],
    staleTime: 60 * 60 * 1000, // 1 hour
  });
  
  // Find current step
  const currentStep = wizardSteps?.find(step => step.id === currentStepId);
  
  // Calculate progress and navigation
  const stepIds = wizardSteps?.map(step => step.id) || [];
  const currentStepIndex = stepIds.indexOf(currentStepId);
  const totalSteps = stepIds.length;
  const progress = totalSteps > 0 ? ((currentStepIndex + 1) / totalSteps) * 100 : 0;
  
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;
  
  // Generate suggestions mutation
  const { mutate: generateSuggestions, isPending: isGenerating, data: results } = useMutation({
    mutationFn: async (params: any) => {
      const response = await fetch('/api/research-suggestions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate suggestions');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setIsComplete(true);
      if (onComplete) {
        onComplete(data);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error generating suggestions",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Handle option selection
  const handleOptionChange = (stepId: string, value: string | string[]) => {
    setSelections(prev => ({
      ...prev,
      [stepId]: value,
    }));
  };
  
  // Handle checkbox toggles for multi-select steps
  const handleCheckboxChange = (stepId: string, optionId: string, checked: boolean) => {
    setSelections(prev => {
      const current = prev[stepId] || [];
      
      if (checked) {
        return {
          ...prev,
          [stepId]: [...current, optionId]
        };
      } else {
        return {
          ...prev,
          [stepId]: current.filter((id: string) => id !== optionId)
        };
      }
    });
  };
  
  // Navigate to next step
  const handleNextStep = () => {
    if (isLastStep) {
      // Generate suggestions
      const params = {
        interests: selections.interests || [],
        healthConditions: selections.healthConditions || [],
        demographicGroups: selections.demographics || [],
        researchPurpose: selections.purpose,
        preferredTopics: selections.topics || [],
        includeRecentOnly: selections.preferences?.includes('recent_only'),
        preferPeerReviewed: selections.preferences?.includes('peer_reviewed'),
        suggestionType: getSelectedSuggestionType(),
      };
      
      generateSuggestions(params);
    } else {
      // Move to next step
      const nextIndex = currentStepIndex + 1;
      if (nextIndex < totalSteps) {
        setCurrentStepId(stepIds[nextIndex]);
      }
    }
  };
  
  // Navigate to previous step
  const handlePreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepId(stepIds[currentStepIndex - 1]);
    }
  };
  
  // Get the selected suggestion type based on purpose
  const getSelectedSuggestionType = () => {
    const purposeToType: Record<string, string> = {
      'personal_health': 'personal_health',
      'academic': 'research_gaps',
      'clinical': 'application_methods',
      'general_interest': 'trending_topics'
    };
    
    return purposeToType[selections.purpose] || 'trending_topics';
  };
  
  // Reset the wizard
  const handleReset = () => {
    setIsComplete(false);
    setCurrentStepId(initialStep);
    setSelections({
      interests: [],
      healthConditions: [],
      demographicGroups: [],
      researchPurpose: "general_interest",
      preferredTopics: [],
      includeRecentOnly: true,
      preferPeerReviewed: true,
      suggestionType: "trending_topics"
    });
  };
  
  // Render loading state
  if (isLoadingSteps) {
    return (
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-center">Research Suggestion Wizard</CardTitle>
          <CardDescription className="text-center">Loading wizard...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }
  
  // Render results if complete
  if (isComplete && results) {
    return (
      <WizardResults 
        results={results} 
        onReset={handleReset}
        selections={selections}
      />
    );
  }

  // Render loading state when generating suggestions
  if (isGenerating) {
    return (
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-center">Generating Research Suggestions</CardTitle>
          <CardDescription className="text-center">
            Our AI is analyzing thousands of studies to generate personalized suggestions...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center py-10 space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-center text-muted-foreground italic">
            This may take 10-15 seconds
          </p>
        </CardContent>
      </Card>
    );
  }
  
  // Render wizard steps
  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl text-center">
          Research Suggestion Wizard
        </CardTitle>
        <CardDescription className="text-center">
          Answer a few questions to get personalized hydrogen research suggestions
        </CardDescription>
        
        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-2 mt-4">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-300 ease-in-out" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Start</span>
          <span>Step {currentStepIndex + 1} of {totalSteps}</span>
        </div>
      </CardHeader>
      
      <CardContent>
        {currentStep && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">{currentStep.title}</h3>
              <p className="text-muted-foreground">{currentStep.description}</p>
            </div>
            
            {/* Step content based on type */}
            {currentStep.id === 'purpose' && (
              <RadioGroup 
                value={selections[currentStep.id] || 'general_interest'}
                onValueChange={(value) => handleOptionChange(currentStep.id, value)}
                className="space-y-3"
              >
                {currentStep.options.map((option) => (
                  <div key={option.id} className="flex items-start space-x-2">
                    <RadioGroupItem value={option.id} id={option.id} />
                    <div className="grid gap-1">
                      <Label 
                        htmlFor={option.id} 
                        className="font-medium"
                      >
                        {option.label}
                      </Label>
                      {option.description && (
                        <p className="text-sm text-muted-foreground">
                          {option.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </RadioGroup>
            )}
            
            {/* Multi-select steps (topics, health conditions, demographics) */}
            {(currentStep.id === 'topics' || 
              currentStep.id === 'health' || 
              currentStep.id === 'demographics') && (
              <div className="space-y-4">
                {/* Group by category if available */}
                {currentStep.id === 'topics' && (
                  <Tabs defaultValue="all">
                    <TabsList className="w-full flex mb-4">
                      <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
                      {Array.from(new Set(currentStep.options.map(o => o.category))).map(category => (
                        <TabsTrigger key={category} value={category || 'other'} className="flex-1">
                          {category}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    
                    <TabsContent value="all" className="mt-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {currentStep.options.map((option) => (
                          <div key={option.id} className="flex items-start space-x-2">
                            <Checkbox 
                              id={option.id} 
                              checked={(selections[currentStep.id] || []).includes(option.id)}
                              onCheckedChange={(checked) => 
                                handleCheckboxChange(currentStep.id, option.id, !!checked)
                              }
                            />
                            <div className="grid gap-1 leading-none">
                              <Label 
                                htmlFor={option.id} 
                                className="font-medium cursor-pointer"
                              >
                                {option.label}
                              </Label>
                              {option.description && (
                                <p className="text-xs text-muted-foreground">
                                  {option.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                    
                    {Array.from(new Set(currentStep.options.map(o => o.category))).map(category => (
                      <TabsContent key={category} value={category || 'other'} className="mt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {currentStep.options
                            .filter(o => o.category === category)
                            .map((option) => (
                              <div key={option.id} className="flex items-start space-x-2">
                                <Checkbox 
                                  id={option.id} 
                                  checked={(selections[currentStep.id] || []).includes(option.id)}
                                  onCheckedChange={(checked) => 
                                    handleCheckboxChange(currentStep.id, option.id, !!checked)
                                  }
                                />
                                <div className="grid gap-1 leading-none">
                                  <Label 
                                    htmlFor={option.id} 
                                    className="font-medium cursor-pointer"
                                  >
                                    {option.label}
                                  </Label>
                                  {option.description && (
                                    <p className="text-xs text-muted-foreground">
                                      {option.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                          ))}
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                )}
                
                {/* Regular checkbox list for non-tabbed content */}
                {(currentStep.id === 'health' || currentStep.id === 'demographics') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentStep.options.map((option) => (
                      <div key={option.id} className="flex items-start space-x-2">
                        <Checkbox 
                          id={option.id} 
                          checked={(selections[currentStep.id] || []).includes(option.id)}
                          onCheckedChange={(checked) => 
                            handleCheckboxChange(currentStep.id, option.id, !!checked)
                          }
                        />
                        <div className="grid gap-1 leading-none">
                          <Label 
                            htmlFor={option.id} 
                            className="font-medium cursor-pointer"
                          >
                            {option.label}
                          </Label>
                          {option.description && (
                            <p className="text-xs text-muted-foreground">
                              {option.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Preferences step */}
            {currentStep.id === 'preferences' && (
              <div className="space-y-4">
                {currentStep.options.map((option) => (
                  <div key={option.id} className="flex items-start space-x-2">
                    <Checkbox 
                      id={option.id} 
                      checked={(selections[currentStep.id] || []).includes(option.id)}
                      onCheckedChange={(checked) => 
                        handleCheckboxChange(currentStep.id, option.id, !!checked)
                      }
                    />
                    <div className="grid gap-1 leading-none">
                      <Label 
                        htmlFor={option.id} 
                        className="font-medium cursor-pointer"
                      >
                        {option.label}
                      </Label>
                      {option.description && (
                        <p className="text-xs text-muted-foreground">
                          {option.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePreviousStep}
          disabled={isFirstStep}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        
        <Button onClick={handleNextStep}>
          {isLastStep ? (
            <>
              Get Suggestions
              <Lightbulb className="ml-2 h-4 w-4" />
            </>
          ) : (
            <>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ResearchWizard;