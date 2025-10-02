import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface WizardStep2Props {
  selections: {
    demographicGroup: string;
    researchType: string;
    [key: string]: any;
  };
  onSelectionChange: (category: string, value: string) => void;
}

const WizardStep2 = ({ selections, onSelectionChange }: WizardStep2Props) => {
  const { toast } = useToast();
  const [options, setOptions] = useState<{
    demographicGroups: string[];
    researchTypes: string[];
  }>({
    demographicGroups: [],
    researchTypes: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setIsLoading(true);
        const response = await apiRequest(
          "GET",
          "/api/research-suggestions/options",
        );

        const data = await response.json();
        if (data.success && data.data) {
          setOptions({
            demographicGroups: data.data.demographicGroups || [],
            researchTypes: data.data.researchTypes || [],
          });
        } else {
          toast({
            title: "Failed to load options",
            description: "Using default options instead",
            variant: "destructive",
          });
          // Set default options
          setOptions({
            demographicGroups: [
              "Children",
              "Adolescents",
              "Adults",
              "Elderly",
              "Athletes",
              "Pregnant women",
              "People with chronic conditions",
            ],
            researchTypes: [
              "clinical",
              "experimental",
              "review",
              "case-study",
              "any",
            ],
          });
        }
      } catch (error) {
        console.error("Error fetching wizard options:", error);
        toast({
          title: "Failed to load options",
          description: "Please try refreshing the page",
          variant: "destructive",
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
        <h3 className="text-lg font-medium mb-3">Target Demographic Group</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select the demographic group you're interested in studying
        </p>

        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start space-x-2">
                <div className="h-4 w-4 rounded-full bg-muted mt-0.5" />
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="h-3 w-48 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <RadioGroup
            value={selections.demographicGroup}
            onValueChange={(value) =>
              onSelectionChange("demographicGroup", value)
            }
            className="space-y-3"
          >
            {options.demographicGroups.map((group) => (
              <div key={group} className="flex items-center space-x-2">
                <RadioGroupItem value={group} id={`demographic-${group}`} />
                <Label htmlFor={`demographic-${group}`}>{group}</Label>
              </div>
            ))}
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="any" id="demographic-any" />
              <Label htmlFor="demographic-any">Any demographic group</Label>
            </div>
          </RadioGroup>
        )}
      </div>

      <div>
        <h3 className="text-lg font-medium mb-3">Research Type</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select the type of research you're interested in
        </p>

        {isLoading ? (
          <div className="h-10 w-full bg-muted rounded animate-pulse" />
        ) : (
          <Select
            value={selections.researchType}
            onValueChange={(value) => onSelectionChange("researchType", value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select research type" />
            </SelectTrigger>
            <SelectContent>
              {options.researchTypes.map((type) => (
                <SelectItem key={type} value={type || "empty"}>
                  {type === "clinical"
                    ? "Clinical Trials"
                    : type === "experimental"
                      ? "Experimental Studies"
                      : type === "review"
                        ? "Literature Reviews"
                        : type === "case-study"
                          ? "Case Studies"
                          : type === "any"
                            ? "Any Research Type"
                            : type || "Unknown Type"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div>
        <h3 className="text-lg font-medium mb-3">Focus Area</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select the primary focus of your research interest
        </p>

        <RadioGroup
          value={selections.focusArea}
          onValueChange={(value) => onSelectionChange("focusArea", value)}
          className="space-y-3"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="physical" id="focus-physical" />
            <Label htmlFor="focus-physical">Physical Health</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="mental" id="focus-mental" />
            <Label htmlFor="focus-mental">Mental Health</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="both" id="focus-both" />
            <Label htmlFor="focus-both">Both Physical and Mental Health</Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
};

export default WizardStep2;
