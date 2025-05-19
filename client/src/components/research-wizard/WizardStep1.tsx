import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface WizardStep1Props {
  selections: {
    interests: string[];
    healthConditions: string[];
    [key: string]: any;
  };
  onSelectionChange: (category: string, value: string) => void;
}

const WizardStep1 = ({ selections, onSelectionChange }: WizardStep1Props) => {
  const { toast } = useToast();
  const [options, setOptions] = useState<{
    interests: string[];
    healthConditions: string[];
  }>({
    interests: [],
    healthConditions: []
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setIsLoading(true);
        const response = await apiRequest("GET", "/api/research-suggestions/options");
        
        const data = await response.json();
        if (data.success && data.data) {
          setOptions({
            interests: data.data.interests || [],
            healthConditions: data.data.healthConditions || []
          });
        } else {
          toast({
            title: "Failed to load options",
            description: "Using default options instead",
            variant: "destructive"
          });
          // Set default options
          setOptions({
            interests: [
              "Athletic Performance",
              "Anti-aging",
              "Brain Health",
              "Cardiovascular Health",
              "Digestive Health",
              "Energy Levels",
              "Immune Function",
              "Metabolic Health"
            ],
            healthConditions: [
              "Alzheimer's Disease",
              "Arthritis",
              "Cancer",
              "Diabetes",
              "Heart Disease",
              "Hypertension",
              "Inflammation",
              "Obesity"
            ]
          });
        }
      } catch (error) {
        console.error("Error fetching wizard options:", error);
        toast({
          title: "Failed to load options",
          description: "Please try refreshing the page",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchOptions();
  }, [toast]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-3">Health Interests</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select one or more health areas you're interested in researching
        </p>
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="flex items-center space-x-2 animate-pulse">
                <div className="h-4 w-4 bg-muted rounded" />
                <div className="h-4 w-32 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {options.interests.map((interest) => (
              <div key={interest} className="flex items-center space-x-2">
                <Checkbox 
                  id={`interest-${interest}`} 
                  checked={selections.interests.includes(interest)}
                  onCheckedChange={() => onSelectionChange("interests", interest)}
                />
                <Label 
                  htmlFor={`interest-${interest}`}
                  className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {interest}
                </Label>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-3">Health Conditions</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select one or more health conditions you'd like to research
        </p>
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="flex items-center space-x-2 animate-pulse">
                <div className="h-4 w-4 bg-muted rounded" />
                <div className="h-4 w-32 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {options.healthConditions.map((condition) => (
              <div key={condition} className="flex items-center space-x-2">
                <Checkbox 
                  id={`condition-${condition}`} 
                  checked={selections.healthConditions.includes(condition)}
                  onCheckedChange={() => onSelectionChange("healthConditions", condition)}
                />
                <Label 
                  htmlFor={`condition-${condition}`}
                  className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {condition}
                </Label>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WizardStep1;