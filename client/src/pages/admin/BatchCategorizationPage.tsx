import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";

interface Study {
  id: number;
  title: string;
  abstract: string;
  consumer_categories?: {
    condition?: string[];
    body_system?: string[];
    life_stage?: string[];
  };
}

interface BatchResult {
  success: boolean;
  total: number;
  successful: number;
  failed: number;
  errors: { studyId: number; error: string }[];
}

const BatchCategorizationPage = () => {
  const [processingLimit, setProcessingLimit] = useState<number>(10);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedStudyId, setSelectedStudyId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch studies that need categorization
  const { data: studies, isLoading: studiesLoading } = useQuery<any>({
    queryKey: ["/api/studies", { filter: "uncategorized", limit: 100 }],
    enabled: !isProcessing,
  });

  // Mutation for batch categorization
  const batchMutation = useMutation({
    mutationFn: async (limit: number) => {
      const response = await fetch(
        "/api/consumer-categories/batch-categorize",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to start batch categorization");
      }

      return response.json();
    },
    onSuccess: (data: BatchResult) => {
      toast({
        title: "Batch categorization completed",
        description: `Processed ${data.total} studies: ${data.successful} successful, ${data.failed} failed.`,
        variant: data.failed > 0 ? "destructive" : "default",
      });
      setIsProcessing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to run batch categorization: ${error.message}`,
        variant: "destructive",
      });
      setIsProcessing(false);
    },
  });

  // Mutation for single study categorization
  const singleStudyMutation = useMutation({
    mutationFn: async (studyId: number) => {
      const response = await fetch(
        `/api/consumer-categories/categorize/${studyId}`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to categorize study");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Study categorized",
        description: "The study was successfully categorized",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to categorize study: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleBatchProcess = () => {
    setIsProcessing(true);
    batchMutation.mutate(processingLimit);
  };

  const handleSingleProcess = (studyId: number) => {
    setSelectedStudyId(studyId);
    singleStudyMutation.mutate(studyId);
  };

  // Get uncategorized studies
  const uncategorizedStudies =
    studies?.data?.filter(
      (study: Study) =>
        !study.consumer_categories ||
        !study.consumer_categories.condition ||
        study.consumer_categories.condition.length === 0,
    ) || [];

  // Get categorized studies
  const categorizedStudies =
    studies?.data?.filter(
      (study: Study) =>
        study.consumer_categories &&
        study.consumer_categories.condition &&
        study.consumer_categories.condition.length > 0,
    ) || [];

  return (
    <AdminLayout title="Batch Categorization">
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-neutral-800 mb-6">
          Consumer-Friendly Categorization
        </h1>

        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Total Studies</CardTitle>
              <CardDescription>All studies in database</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {studiesLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
                ) : (
                  studies?.data?.length || 0
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Uncategorized</CardTitle>
              <CardDescription>Studies needing categorization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {studiesLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
                ) : (
                  uncategorizedStudies.length
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Categorized</CardTitle>
              <CardDescription>
                Studies with condition categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {studiesLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
                ) : (
                  categorizedStudies.length
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {!studiesLoading && studies?.data && (
          <div className="mb-6">
            <Progress
              value={
                (categorizedStudies.length / (studies.data.length || 1)) * 100
              }
              className="h-2 w-full"
            />
            <div className="text-xs text-neutral-500 mt-1">
              {Math.round(
                (categorizedStudies.length / (studies.data.length || 1)) * 100,
              )}
              % of studies categorized
            </div>
          </div>
        )}

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Batch Categorization</CardTitle>
            <CardDescription>
              Process multiple studies at once using AI to detect and categorize
              by health conditions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-full max-w-xs">
                <label className="text-sm font-medium text-neutral-700 mb-1 block">
                  Number of studies to process:
                </label>
                <Input
                  type="number"
                  value={processingLimit}
                  onChange={(e) =>
                    setProcessingLimit(parseInt(e.target.value) || 10)
                  }
                  min={1}
                  max={100}
                  className="w-full"
                />
              </div>
              <Button
                className="mt-5"
                onClick={handleBatchProcess}
                disabled={
                  isProcessing ||
                  batchMutation.isPending ||
                  uncategorizedStudies.length === 0
                }
              >
                {isProcessing || batchMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Start Batch Process"
                )}
              </Button>
            </div>

            {batchMutation.data && (
              <div className="mt-4 p-4 bg-neutral-50 rounded-md">
                <h4 className="font-medium mb-2">Last Batch Results:</h4>
                <div className="text-sm text-neutral-600">
                  <div>Total Processed: {batchMutation.data.total}</div>
                  <div className="text-green-600">
                    Successful: {batchMutation.data.successful}
                  </div>
                  <div className="text-destructive">
                    Failed: {batchMutation.data.failed}
                  </div>
                </div>

                {batchMutation.data.errors &&
                  batchMutation.data.errors.length > 0 && (
                    <div className="mt-2">
                      <h5 className="text-sm font-medium mb-1">Errors:</h5>
                      <ul className="text-xs text-destructive">
                        {batchMutation.data.errors
                          .slice(0, 5)
                          .map((error, index) => (
                            <li key={index}>
                              Study #{error.studyId}: {error.error}
                            </li>
                          ))}
                        {batchMutation.data.errors.length > 5 && (
                          <li>
                            ... and {batchMutation.data.errors.length - 5} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="uncategorized" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="uncategorized">
              Uncategorized Studies ({uncategorizedStudies.length})
            </TabsTrigger>
            <TabsTrigger value="categorized">
              Categorized Studies ({categorizedStudies.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="uncategorized">
            {studiesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : uncategorizedStudies.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                All studies have been categorized! 🎉
              </div>
            ) : (
              <div className="space-y-4">
                {uncategorizedStudies.slice(0, 10).map((study: Study) => (
                  <Card key={study.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{study.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-neutral-600 line-clamp-2">
                        {study.abstract || "No abstract available"}
                      </p>
                    </CardContent>
                    <CardFooter className="justify-between border-t pt-4">
                      <div className="text-sm text-neutral-500">
                        ID: {study.id}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleSingleProcess(study.id)}
                        disabled={
                          singleStudyMutation.isPending &&
                          selectedStudyId === study.id
                        }
                      >
                        {singleStudyMutation.isPending &&
                        selectedStudyId === study.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          "Categorize"
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}

                {uncategorizedStudies.length > 10 && (
                  <div className="text-center py-4 text-neutral-500 text-sm">
                    Showing 10 of {uncategorizedStudies.length} studies
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="categorized">
            {studiesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : categorizedStudies.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                No studies have been categorized yet
              </div>
            ) : (
              <div className="space-y-4">
                {categorizedStudies.slice(0, 10).map((study: Study) => (
                  <Card key={study.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{study.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {study.consumer_categories?.condition?.map(
                          (category, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs"
                            >
                              {category}
                            </span>
                          ),
                        )}
                      </div>
                      <p className="text-sm text-neutral-600 line-clamp-2">
                        {study.abstract || "No abstract available"}
                      </p>
                    </CardContent>
                    <CardFooter className="justify-between border-t pt-4">
                      <div className="text-sm text-neutral-500 flex items-center gap-1">
                        <Check className="h-4 w-4 text-green-500" />
                        Categorized
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSingleProcess(study.id)}
                        disabled={
                          singleStudyMutation.isPending &&
                          selectedStudyId === study.id
                        }
                      >
                        {singleStudyMutation.isPending &&
                        selectedStudyId === study.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          "Re-categorize"
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}

                {categorizedStudies.length > 10 && (
                  <div className="text-center py-4 text-neutral-500 text-sm">
                    Showing 10 of {categorizedStudies.length} studies
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default BatchCategorizationPage;
