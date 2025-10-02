import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface WizardStep3Props {
  selections: {
    deliveryMethod: string[];
    timeFrame: string;
    [key: string]: any;
  };
  onSelectionChange: (category: string, value: string) => void;
}

const WizardStep3 = ({ selections, onSelectionChange }: WizardStep3Props) => {
  const { toast } = useToast();
  const [options, setOptions] = useState<{
    deliveryMethods: string[];
    timeFrames: string[];
  }>({
    deliveryMethods: [],
    timeFrames: [],
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
            deliveryMethods: data.data.deliveryMethods || [],
            timeFrames: data.data.timeFrames || [],
          });
        } else {
          toast({
            title: "Failed to load options",
            description: "Using default options instead",
            variant: "destructive",
          });
          // Set default options
          setOptions({
            deliveryMethods: [
              "Hydrogen-rich water",
              "Hydrogen gas inhalation",
              "Hydrogen-rich saline",
              "Hydrogen bathing",
              "Hydrogen tablets",
              "Topical hydrogen application",
              "Hydrogen-producing intestinal bacteria",
            ],
            timeFrames: ["short-term", "medium-term", "long-term", "any"],
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
        <h3 className="text-lg font-medium mb-3">Hydrogen Delivery Methods</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select one or more hydrogen delivery methods you're interested in
        </p>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="flex items-center space-x-2 animate-pulse"
              >
                <div className="h-4 w-4 bg-muted rounded" />
                <div className="h-4 w-32 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {options.deliveryMethods.map((method) => (
              <div key={method} className="flex items-center space-x-2">
                <Checkbox
                  id={`method-${method}`}
                  checked={selections.deliveryMethod.includes(method)}
                  onCheckedChange={() =>
                    onSelectionChange("deliveryMethod", method)
                  }
                />
                <Label
                  htmlFor={`method-${method}`}
                  className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {method}
                </Label>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-medium mb-3">Time Frame</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select the time frame for the research effects you're interested in
        </p>

        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
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
            value={selections.timeFrame}
            onValueChange={(value) => onSelectionChange("timeFrame", value)}
            className="space-y-3"
          >
            {options.timeFrames.map((timeFrame) => (
              <div key={timeFrame} className="flex items-center space-x-2">
                <RadioGroupItem
                  value={timeFrame}
                  id={`timeframe-${timeFrame}`}
                />
                <Label htmlFor={`timeframe-${timeFrame}`}>
                  {timeFrame === "short-term" &&
                    "Short-term (immediate effects)"}
                  {timeFrame === "medium-term" &&
                    "Medium-term (weeks to months)"}
                  {timeFrame === "long-term" && "Long-term (months to years)"}
                  {timeFrame === "any" && "Any time frame"}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}
      </div>
    </div>
  );
};

export default WizardStep3;
