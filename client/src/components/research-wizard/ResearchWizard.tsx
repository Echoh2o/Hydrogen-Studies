import { useState } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import WizardResults from "./WizardResults";
import WizardStep1 from "./WizardStep1";
import WizardStep2 from "./WizardStep2";
import WizardStep3 from "./WizardStep3";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

const ResearchWizard = () => {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [selections, setSelections] = useState({
    interests: [],
    healthConditions: [],
    demographicGroup: "",
    researchType: "any",
    deliveryMethod: [],
    timeFrame: "any",
    focusArea: "both"
  });
  const [results, setResults] = useState(null);

  const handleNextStep = () => {
    const canProceed = validateCurrentStep();
    if (canProceed) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const validateCurrentStep = () => {
    // Basic validation for each step
    if (currentStep === 1) {
      if (selections.interests.length === 0) {
        toast({
          title: "Please select at least one interest",
          description: "Selecting interests helps us provide relevant research suggestions",
          variant: "destructive"
        });
        return false;
      }
    } else if (currentStep === 2) {
      if (!selections.demographicGroup) {
        toast({
          title: "Please select a demographic group",
          description: "This helps us find studies relevant to your target population",
          variant: "destructive"
        });
        return false;
      }
    }
    return true;
  };

  const handleSelectionChange = (category, value) => {
    setSelections(prev => {
      // Handle array-based selections
      if (["interests", "healthConditions", "deliveryMethod"].includes(category)) {
        // If the item exists, remove it; otherwise, add it
        if (Array.isArray(prev[category])) {
          const isSelected = prev[category].includes(value);
          return {
            ...prev,
            [category]: isSelected
              ? prev[category].filter(item => item !== value)
              : [...prev[category], value]
          };
        }
        // Initialize as array if not already an array
        return {
          ...prev,
          [category]: [value]
        };
      }
      
      // Handle single-value selections
      return {
        ...prev,
        [category]: value
      };
    });
  };

  const handleSubmit = async () => {
    try {
      setIsLoading(true);
      
      const response = await apiRequest({
        url: "/api/research-suggestions",
        method: "POST",
        data: selections
      });
      
      if (response.success) {
        setResults(response.data);
        // Move to results view
        setCurrentStep(4);
      } else {
        toast({
          title: "Error generating suggestions",
          description: response.message || "Please try again with different selections",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error submitting research wizard selections:", error);
      toast({
        title: "Failed to generate suggestions",
        description: "There was an error processing your request. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSelections({
      interests: [],
      healthConditions: [],
      demographicGroup: "",
      researchType: "any",
      deliveryMethod: [],
      timeFrame: "any",
      focusArea: "both"
    });
    setResults(null);
    setCurrentStep(1);
  };

  if (currentStep === 4 && results) {
    return <WizardResults results={results} onReset={handleReset} selections={selections} />;
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Research Suggestion Wizard</CardTitle>
        <CardDescription>
          Step {currentStep} of 3: {currentStep === 1 ? "Research Interests" : currentStep === 2 ? "Target Demographics" : "Delivery Methods"}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {currentStep === 1 && (
          <WizardStep1 
            selections={selections} 
            onSelectionChange={handleSelectionChange} 
          />
        )}
        
        {currentStep === 2 && (
          <WizardStep2 
            selections={selections} 
            onSelectionChange={handleSelectionChange} 
          />
        )}
        
        {currentStep === 3 && (
          <WizardStep3 
            selections={selections} 
            onSelectionChange={handleSelectionChange} 
          />
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between border-t p-4">
        <Button
          variant="outline"
          onClick={currentStep === 1 ? handleReset : handlePrevStep}
          disabled={isLoading}
        >
          {currentStep === 1 ? "Reset" : "Back"}
        </Button>
        
        <Button
          onClick={currentStep === 3 ? handleSubmit : handleNextStep}
          disabled={isLoading}
          className={cn(currentStep === 3 ? "bg-primary" : "")}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
              {currentStep === 3 ? "Generating Suggestions..." : "Next..."}
            </>
          ) : (
            currentStep === 3 ? "Get Research Suggestions" : "Next"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ResearchWizard;