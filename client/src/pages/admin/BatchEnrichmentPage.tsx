import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet";
import { AlertCircle, CheckCircle, RefreshCcw, Database } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";

interface BatchProcessingStats {
  totalToProcess: number;
  processed: number;
  failed: number;
  inProgress: boolean;
  startTime?: string;
  estimatedCompletion?: string | null;
}

interface EnhancementResult {
  success: boolean;
  message: string;
  updates?: {
    abstract?: boolean;
    fullText?: boolean;
    images?: boolean;
    methods?: boolean;
    results?: boolean;
    conclusion?: boolean;
    tags?: boolean;
    simplifiedExplanation?: boolean;
  };
  studyId?: number;
}

export default function BatchEnrichmentPage() {
  const [batchSize, setBatchSize] = useState(10);
  const [maxStudies, setMaxStudies] = useState(100);
  const [singleStudyId, setSingleStudyId] = useState("");
  const { toast } = useToast();

  // Query to fetch the current batch status
  const {
    data: batchStatus,
    isLoading: isLoadingStatus,
    error: statusError,
    refetch: refetchStatus,
  } = useQuery<{ success: boolean; status: BatchProcessingStats | null }>({
    queryKey: ["/api/enrichment/batch/status"],
    refetchInterval: 5000, // Poll every 5 seconds
  });

  // Mutation to start a batch process
  const { mutate: startBatch, isPending: isStartingBatch } = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/enrichment/batch/start", {
        batchSize,
        maxStudies,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Batch Process Started",
        description: `Started batch enrichment of ${data.status.totalToProcess} studies.`,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/enrichment/batch/status"],
      });
    },
    onError: (error) => {
      toast({
        title: "Error Starting Batch Process",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Mutation to enrich a single study
  const { mutate: enrichSingleStudy, isPending: isEnrichingSingle } =
    useMutation({
      mutationFn: async (studyId: number) => {
        const response = await apiRequest(
          "POST",
          `/api/enrichment/batch/enrichStudy/${studyId}`,
        );
        return await response.json();
      },
      onSuccess: (data: EnhancementResult) => {
        toast({
          title: data.success
            ? "Study Enriched Successfully"
            : "Enrichment Failed",
          description: data.message,
          variant: data.success ? "default" : "destructive",
        });

        // Clear input field on success
        if (data.success) {
          setSingleStudyId("");
        }
      },
      onError: (error) => {
        toast({
          title: "Error Enriching Study",
          description:
            error instanceof Error
              ? error.message
              : "An unknown error occurred",
          variant: "destructive",
        });
      },
    });

  // Calculate progress percentage
  const calculateProgress = () => {
    if (!batchStatus?.status) return 0;
    const { totalToProcess, processed } = batchStatus.status;
    return totalToProcess > 0
      ? Math.round((processed / totalToProcess) * 100)
      : 0;
  };

  // Handle form submissions
  const handleStartBatch = (e: React.FormEvent) => {
    e.preventDefault();
    startBatch();
  };

  const handleEnrichSingle = (e: React.FormEvent) => {
    e.preventDefault();
    const studyId = parseInt(singleStudyId);
    if (isNaN(studyId) || studyId <= 0) {
      toast({
        title: "Invalid Study ID",
        description: "Please enter a valid positive integer study ID",
        variant: "destructive",
      });
      return;
    }

    enrichSingleStudy(studyId);
  };

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  return (
    <AdminLayout
      title="Batch Content Enrichment"
      description="Enrich study content with external data from research databases"
    >
      <Helmet>
        <title>Batch Content Enrichment | Admin Dashboard</title>
      </Helmet>

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Content Enrichment Dashboard
        </h1>
        <Button
          variant="outline"
          onClick={() => refetchStatus()}
          disabled={isLoadingStatus}
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh Status
        </Button>
      </div>

      <p className="text-muted-foreground max-w-3xl">
        This dashboard allows you to enrich study content with external data
        from research databases, AI-generated tags, and simplified explanations.
        You can process studies in batch or individually.
      </p>

      <Tabs defaultValue="batch" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="batch">Batch Processing</TabsTrigger>
          <TabsTrigger value="single">Single Study</TabsTrigger>
          <TabsTrigger value="status">Process Status</TabsTrigger>
        </TabsList>

        <TabsContent value="batch">
          <Card>
            <CardHeader>
              <CardTitle>Start Batch Enrichment Process</CardTitle>
              <CardDescription>
                Process multiple studies to enhance their content with
                abstracts, full text, AI-generated tags, and simplified
                explanations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleStartBatch} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="batchSize">Batch Size</Label>
                    <Input
                      id="batchSize"
                      type="number"
                      min="1"
                      max="50"
                      value={batchSize}
                      onChange={(e) => setBatchSize(parseInt(e.target.value))}
                      placeholder="Number of studies to process at once"
                    />
                    <p className="text-sm text-muted-foreground">
                      How many studies to process in each batch (1-50)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxStudies">Maximum Studies</Label>
                    <Input
                      id="maxStudies"
                      type="number"
                      min="1"
                      max="1000"
                      value={maxStudies}
                      onChange={(e) => setMaxStudies(parseInt(e.target.value))}
                      placeholder="Maximum number of studies to process"
                    />
                    <p className="text-sm text-muted-foreground">
                      Maximum number of studies to process in total (1-1000)
                    </p>
                  </div>
                </div>

                <Alert className="bg-amber-50 border-amber-200">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <AlertTitle className="text-amber-800">Important</AlertTitle>
                  <AlertDescription className="text-amber-700">
                    Batch processing may take a significant amount of time
                    depending on the number of studies. The process runs in the
                    background and you can check its status in the Process
                    Status tab.
                  </AlertDescription>
                </Alert>
              </form>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setBatchSize(10);
                  setMaxStudies(100);
                }}
              >
                Reset
              </Button>
              <Button
                onClick={handleStartBatch}
                disabled={
                  isStartingBatch || (batchStatus?.status?.inProgress ?? false)
                }
              >
                {isStartingBatch ? (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Start Batch Process
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle>Enrich Single Study</CardTitle>
              <CardDescription>
                Process a single study by ID to enhance its content with
                abstracts, full text, AI-generated tags, and simplified
                explanations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEnrichSingle} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="studyId">Study ID</Label>
                  <Input
                    id="studyId"
                    type="number"
                    min="1"
                    value={singleStudyId}
                    onChange={(e) => setSingleStudyId(e.target.value)}
                    placeholder="Enter the study ID to process"
                  />
                  <p className="text-sm text-muted-foreground">
                    Enter the numeric ID of the study you want to process
                  </p>
                </div>
              </form>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button
                onClick={handleEnrichSingle}
                disabled={isEnrichingSingle || !singleStudyId}
              >
                {isEnrichingSingle ? (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Enrich Study
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="status">
          <Card>
            <CardHeader>
              <CardTitle>Batch Processing Status</CardTitle>
              <CardDescription>
                Check the current status of the batch enrichment process.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStatus ? (
                <div className="py-8 flex justify-center">
                  <RefreshCcw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : statusError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error loading status</AlertTitle>
                  <AlertDescription>
                    Failed to load the current batch processing status.
                  </AlertDescription>
                </Alert>
              ) : !batchStatus?.status ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No process has been started</AlertTitle>
                  <AlertDescription>
                    No batch enrichment process has been started. Start a new
                    process in the Batch Processing tab.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">
                        Processing Progress
                      </span>
                      <span className="text-sm font-medium">
                        {calculateProgress()}%
                      </span>
                    </div>
                    <Progress value={calculateProgress()} className="h-2" />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <div className="text-sm text-muted-foreground">
                        Total Studies
                      </div>
                      <div className="text-2xl font-bold">
                        {batchStatus.status.totalToProcess}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <div className="text-sm text-muted-foreground">
                        Processed
                      </div>
                      <div className="text-2xl font-bold">
                        {batchStatus.status.processed}
                      </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-sm text-green-600">Successful</div>
                      <div className="text-2xl font-bold text-green-700">
                        {batchStatus.status.processed -
                          batchStatus.status.failed}
                      </div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg">
                      <div className="text-sm text-red-600">Failed</div>
                      <div className="text-2xl font-bold text-red-700">
                        {batchStatus.status.failed}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-x-4">
                      <div className="text-sm font-medium">Started:</div>
                      <div className="text-sm">
                        {formatDate(batchStatus.status.startTime)}
                      </div>
                    </div>
                    {batchStatus.status.estimatedCompletion && (
                      <div className="flex gap-x-4">
                        <div className="text-sm font-medium">
                          Estimated Completion:
                        </div>
                        <div className="text-sm">
                          {formatDate(batchStatus.status.estimatedCompletion)}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-x-4">
                      <div className="text-sm font-medium">Status:</div>
                      <div className="text-sm flex items-center">
                        {batchStatus.status.inProgress ? (
                          <>
                            <RefreshCcw className="mr-1 h-3 w-3 animate-spin text-amber-600" />
                            <span className="text-amber-600 font-medium">
                              In Progress
                            </span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="mr-1 h-3 w-3 text-green-600" />
                            <span className="text-green-600 font-medium">
                              Completed
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {batchStatus.status.failed > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-md font-medium">
                        Processing Issues ({batchStatus.status.failed})
                      </h3>
                      <div className="max-h-60 overflow-y-auto border rounded-md p-2">
                        <div className="py-2 text-sm text-muted-foreground">
                          {batchStatus.status.failed} studies failed to process.
                          Check server logs for detailed error information.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            {batchStatus?.status && (
              <CardFooter className="justify-center">
                <Button
                  variant="outline"
                  onClick={() => refetchStatus()}
                  disabled={isLoadingStatus}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Refresh Status
                </Button>
              </CardFooter>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
