import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Brain, Zap, Shield, Activity, Users } from "lucide-react";

interface HealthOutcome {
  condition: string;
  studyCount: number;
  positiveOutcomes: number;
  bodySystem: string;
  effectSize: "small" | "medium" | "large";
  commonBenefits: string[];
}

interface BodySystemData {
  system: string;
  icon: any;
  color: string;
  studies: number;
  outcomes: HealthOutcome[];
}

export default function HealthOutcomesMap() {
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);

  // Fetch health outcomes data from your database
  const { data: outcomesData, isLoading } = useQuery({
    queryKey: ["/api/studies/health-outcomes"],
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Health Outcomes Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">
              Loading health outcomes...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const bodySystems: BodySystemData[] = [
    {
      system: "Cardiovascular",
      icon: Heart,
      color: "text-red-500",
      studies: outcomesData?.cardiovascular?.studies || 0,
      outcomes: outcomesData?.cardiovascular?.outcomes || [],
    },
    {
      system: "Nervous",
      icon: Brain,
      color: "text-purple-500",
      studies: outcomesData?.nervous?.studies || 0,
      outcomes: outcomesData?.nervous?.outcomes || [],
    },
    {
      system: "Metabolic",
      icon: Zap,
      color: "text-yellow-500",
      studies: outcomesData?.metabolic?.studies || 0,
      outcomes: outcomesData?.metabolic?.outcomes || [],
    },
    {
      system: "Immune",
      icon: Shield,
      color: "text-green-500",
      studies: outcomesData?.immune?.studies || 0,
      outcomes: outcomesData?.immune?.outcomes || [],
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Health Outcomes by Body System
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Explore how hydrogen research shows benefits across different body
          systems
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Body Systems Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {bodySystems.map((system) => {
            const Icon = system.icon;
            const isSelected = selectedSystem === system.system;

            return (
              <Button
                key={system.system}
                variant={isSelected ? "default" : "outline"}
                className="h-24 flex flex-col items-center gap-2 p-4"
                onClick={() =>
                  setSelectedSystem(isSelected ? null : system.system)
                }
              >
                <Icon
                  className={`w-6 h-6 ${isSelected ? "text-white" : system.color}`}
                />
                <div className="text-center">
                  <div className="font-medium text-sm">{system.system}</div>
                  <div className="text-xs opacity-70">
                    {system.studies} studies
                  </div>
                </div>
              </Button>
            );
          })}
        </div>

        {/* Selected System Details */}
        {selectedSystem && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              {(() => {
                const system = bodySystems.find(
                  (s) => s.system === selectedSystem,
                );
                if (!system) return null;
                const Icon = system.icon;
                return (
                  <>
                    <Icon className={`w-5 h-5 ${system.color}`} />
                    {selectedSystem} System Research
                  </>
                );
              })()}
            </h3>

            <div className="grid gap-4">
              {bodySystems
                .find((s) => s.system === selectedSystem)
                ?.outcomes.map((outcome, index) => (
                  <Card key={index} className="border-l-4 border-l-primary">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="font-medium mb-2">
                            {outcome.condition}
                          </h4>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {outcome.studyCount} studies
                            </span>
                            <span>
                              {Math.round(
                                (outcome.positiveOutcomes /
                                  outcome.studyCount) *
                                  100,
                              )}
                              % positive outcomes
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {outcome.commonBenefits.map((benefit, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="text-xs"
                              >
                                {benefit}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={
                              outcome.effectSize === "large"
                                ? "default"
                                : outcome.effectSize === "medium"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {outcome.effectSize} effect
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        )}

        {!selectedSystem && (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>
              Select a body system above to explore specific health outcomes
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
