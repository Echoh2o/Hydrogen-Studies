import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { InteractiveButton } from "@/components/ui/interactive-button";
import { AnimatedContainer, StaggeredContainer, StaggeredItem } from "@/components/ui/animated-container";

// Import wizard step components
import WizardResults from "./WizardResults";
import WizardStep1 from "./WizardStep1";
import WizardStep2 from "./WizardStep2";
import WizardStep3 from "./WizardStep3";

const ResearchWizard = () => {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  
  // Wizard selections state
  interface WizardSelections {
    interests: string[];
    healthConditions: string[];
    demographicGroup: string;
    researchType: string;
    deliveryMethod: string[];
    timeFrame: string;
    focusArea: string;
    [key: string]: string | string[];
  }

  const [selections, setSelections] = useState<WizardSelections>({
    interests: [],
    healthConditions: [],
    demographicGroup: "any",
    researchType: "any",
    deliveryMethod: [],
    timeFrame: "any",
    focusArea: "both"
  });

  const totalSteps = 3;

  const handleNext = () => {
    if (currentStep === totalSteps) {
      handleSubmit();
      return;
    }
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleReset = () => {
    setCurrentStep(1);
    setSelections({
      interests: [],
      healthConditions: [],
      demographicGroup: "any",
      researchType: "any",
      deliveryMethod: [],
      timeFrame: "any",
      focusArea: "both"
    });
    setResults(null);
  };

  const handleSelectionChange = (category: string, value: string) => {
    if (Array.isArray(selections[category])) {
      // Handle array values (checkboxes)
      if (selections[category].includes(value)) {
        setSelections({
          ...selections,
          [category]: selections[category].filter(item => item !== value)
        });
      } else {
        setSelections({
          ...selections,
          [category]: [...selections[category], value]
        });
      }
    } else {
      // Handle single values (radio buttons, selects)
      setSelections({
        ...selections,
        [category]: value
      });
    }
  };

  const isStepComplete = (step: number): boolean => {
    switch (step) {
      case 1:
        // At least one interest or health condition should be selected
        return selections.interests.length > 0 || selections.healthConditions.length > 0;
      case 2:
        // All required fields are pre-populated with defaults
        return true;
      case 3:
        // At least one delivery method should be selected
        return selections.deliveryMethod.length > 0;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await apiRequest("POST", "/api/research-suggestions/generate", selections);
      
      const responseData = await response.json();
      
      if (responseData && responseData.success && responseData.data) {
        setResults(responseData.data);
        setCurrentStep(totalSteps + 1); // Move to results step
      } else {
        toast({
          title: "Error Generating Suggestions",
          description: (responseData && responseData.message) || "Failed to generate research suggestions. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error generating research suggestions:", error);
      toast({
        title: "Error",
        description: "Failed to connect to the server. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <WizardStep1 
                 selections={selections} 
                 onSelectionChange={handleSelectionChange} 
               />;
      case 2:
        return <WizardStep2 
                 selections={selections} 
                 onSelectionChange={handleSelectionChange} 
               />;
      case 3:
        return <WizardStep3 
                 selections={selections} 
                 onSelectionChange={handleSelectionChange} 
               />;
      case 4:
        return <WizardResults 
                 results={results} 
                 onReset={handleReset}
                 selections={selections}
               />;
      default:
        return null;
    }
  };

  // If we're on the results page, render just the results
  if (currentStep === totalSteps + 1 && results) {
    return (
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <WizardResults 
            results={results} 
            onReset={handleReset}
            selections={selections}
          />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card>
          <CardContent className="p-6">
            {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <StaggeredContainer>
                {Array.from({ length: totalSteps }, (_, i) => i + 1).map(step => (
                  <StaggeredItem key={step} className="flex flex-col items-center">
                    <motion.div 
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors duration-300
                        ${currentStep >= step 
                          ? 'border-primary bg-primary text-white' 
                          : 'border-gray-300 text-gray-400'
                        }`}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {step}
                    </motion.div>
                    <div className="text-xs mt-2 text-center">
                      {step === 1 && "Interests"}
                      {step === 2 && "Demographics"}
                      {step === 3 && "Methods"}
                    </div>
                  </StaggeredItem>
                ))}
              </StaggeredContainer>
            </div>
            
            {/* Progress Bar */}
            <div className="relative mt-4">
              <div className="absolute top-0 left-0 h-2 bg-gray-200 w-full rounded-full" />
              <motion.div 
                className="absolute top-0 left-0 h-2 bg-primary rounded-full"
                initial={{ width: `${(currentStep - 1) / (totalSteps - 1) * 100}%` }}
                animate={{ width: `${(currentStep - 1) / (totalSteps - 1) * 100}%` }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              />
            </div>
          </div>
          
          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="min-h-[400px]"
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
          
          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            {currentStep > 1 ? (
              <InteractiveButton 
                variant="outline" 
                onClick={handleBack}
                disabled={loading}
                hoverScale={1.05}
              >
                Back
              </InteractiveButton>
            ) : (
              <div></div>
            )}
            
            <InteractiveButton 
              onClick={handleNext}
              disabled={!isStepComplete(currentStep) || loading}
              hoverScale={1.05}
              hoverGlow={true}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                currentStep === totalSteps ? "Generate Suggestions" : "Next"
              )}
            </InteractiveButton>
          </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default ResearchWizard;