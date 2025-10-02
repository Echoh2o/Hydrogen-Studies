import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Database,
  FileText,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Component for enhancing study data quality using DOI information
 */
export function DoiEnhancer() {
  const [activeTab, setActiveTab] = useState<string>("studies-to-enhance");
  const [enhancingInProgress, setEnhancingInProgress] =
    useState<boolean>(false);
  const [requireDoi, setRequireDoi] = useState<boolean>(true);
  const [limit, setLimit] = useState<number>(50);

  // Fetch studies that need enhancement
  const {
    data: studiesNeedingEnhancement,
    isLoading: isLoadingStudies,
    isError: isErrorStudies,
    refetch: refetchStudies,
  } = useQuery({
    queryKey: ["/api/doi/find-needing-enhancement"],
    enabled: activeTab === "studies-to-enhance",
    queryFn: async () => {
      const response = await fetch("/api/doi/find-needing-enhancement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          limit,
          requireDoi,
          minQualityScore: 0,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch studies needing enhancement");
      }

      return response.json();
    },
  });

  // Fetch enhanceable fields
  const { data: enhanceableFields, isLoading: isLoadingFields } = useQuery({
    queryKey: ["/api/doi/enhanceable-fields"],
    queryFn: async () => {
      const response = await fetch("/api/doi/enhanceable-fields");

      if (!response.ok) {
        throw new Error("Failed to fetch enhanceable fields");
      }

      return response.json();
    },
  });

  // Mutation for batch enhancing studies
  const batchEnhanceMutation = useMutation({
    mutationFn: async () => {
      setEnhancingInProgress(true);

      const response = await fetch("/api/doi/enhance/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          limit,
          requireDoi,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to batch enhance studies");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({
        queryKey: ["/api/doi/find-needing-enhancement"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      setActiveTab("enhancement-results");
      setEnhancingInProgress(false);
    },
    onError: () => {
      setEnhancingInProgress(false);
    },
  });

  // Mutation for enhancing a single study
  const enhanceSingleStudyMutation = useMutation({
    mutationFn: async (studyId: number) => {
      const response = await fetch("/api/doi/enhance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studyId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to enhance study ID ${studyId}`);
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({
        queryKey: ["/api/doi/find-needing-enhancement"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
    },
  });

  // Field quality score calculation
  const getFieldQualityScore = (study: any) => {
    let score = 0;
    let total = 0;

    if (!enhanceableFields?.fields) return 0;

    enhanceableFields.fields.forEach((field: string) => {
      total++;
      if (field === "keywords") {
        if (study.keywords && study.keywords.length > 0) score++;
      } else if (field === "peerReviewed") {
        if (study.peerReviewed !== null && study.peerReviewed !== undefined)
          score++;
      } else {
        if (study[field] && study[field].trim() !== "") score++;
      }
    });

    return Math.floor((score / total) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            DOI-Based Data Enhancement
          </h2>
          <p className="text-muted-foreground mt-2">
            Improve study data quality by normalizing and completing missing
            fields using DOI information
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetchStudies()}
          disabled={isLoadingStudies}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="flex items-center space-x-2 mt-4">
        <Switch
          id="require-doi"
          checked={requireDoi}
          onCheckedChange={setRequireDoi}
        />
        <Label htmlFor="require-doi">Only include studies with DOI</Label>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="studies-to-enhance">
            Studies to Enhance
          </TabsTrigger>
          <TabsTrigger value="enhancement-results">
            Enhancement Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="studies-to-enhance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="mr-2 h-5 w-5" />
                Studies with Incomplete Data
              </CardTitle>
              <CardDescription>
                These studies have incomplete information that can be enhanced
                using DOI lookup
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStudies ? (
                <div className="flex justify-center p-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : isErrorStudies ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    Failed to load studies needing enhancement. Please try
                    again.
                  </AlertDescription>
                </Alert>
              ) : studiesNeedingEnhancement?.studies?.length === 0 ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>No Studies Need Enhancement</AlertTitle>
                  <AlertDescription>
                    All studies in the database have complete information.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="overflow-auto max-h-[600px]">
                  <Table>
                    <TableCaption>
                      Found {studiesNeedingEnhancement?.count || 0} studies that
                      need data enhancement
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Missing Fields</TableHead>
                        <TableHead>Data Quality</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studiesNeedingEnhancement?.studies?.map((study: any) => {
                        const qualityScore =
                          study.qualityScore || getFieldQualityScore(study);
                        const missingFields = enhanceableFields?.fields.filter(
                          (field: string) => {
                            if (field === "keywords") {
                              return (
                                !study.keywords || study.keywords.length === 0
                              );
                            } else if (field === "peerReviewed") {
                              return (
                                study.peerReviewed === null ||
                                study.peerReviewed === undefined
                              );
                            } else {
                              return (
                                !study[field] || study[field].trim() === ""
                              );
                            }
                          },
                        );

                        return (
                          <TableRow key={study.id}>
                            <TableCell>{study.id}</TableCell>
                            <TableCell>
                              <div className="font-medium">{study.title}</div>
                              <div className="text-xs text-muted-foreground">
                                DOI: {study.doi || "None"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {missingFields?.map((field: string) => (
                                  <Badge key={field} variant="outline">
                                    {field}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={qualityScore}
                                  className="w-20"
                                />
                                <span>{qualityScore}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                onClick={() =>
                                  enhanceSingleStudyMutation.mutate(study.id)
                                }
                                disabled={enhanceSingleStudyMutation.isPending}
                              >
                                Enhance
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="limit">Process Limit:</Label>
                <select
                  id="limit"
                  className="w-20 rounded-md border border-input bg-background px-3 py-1"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value))}
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
              <Button
                onClick={() => batchEnhanceMutation.mutate()}
                disabled={
                  isLoadingStudies ||
                  batchEnhanceMutation.isPending ||
                  enhancingInProgress ||
                  studiesNeedingEnhancement?.count === 0
                }
              >
                {batchEnhanceMutation.isPending || enhancingInProgress ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Batch Enhance {studiesNeedingEnhancement?.count || 0}{" "}
                    Studies
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="enhancement-results" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Enhancement Results
              </CardTitle>
              <CardDescription>
                Summary of the latest data enhancement results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {batchEnhanceMutation.data ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-lg border p-3">
                      <div className="text-sm font-medium text-muted-foreground">
                        Total Processed
                      </div>
                      <div className="text-2xl font-bold">
                        {batchEnhanceMutation.data.result.total}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-sm font-medium text-muted-foreground">
                        Successfully Enhanced
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        {batchEnhanceMutation.data.result.enhanced}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-sm font-medium text-muted-foreground">
                        Failed to Enhance
                      </div>
                      <div className="text-2xl font-bold text-red-600">
                        {batchEnhanceMutation.data.result.failed}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="text-lg font-medium mb-2">
                      Detailed Results
                    </h3>
                    <div className="overflow-auto max-h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Study ID</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Message</TableHead>
                            <TableHead>Enhanced Fields</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batchEnhanceMutation.data.result.details.map(
                            (detail: any) => (
                              <TableRow key={detail.studyId}>
                                <TableCell>{detail.studyId}</TableCell>
                                <TableCell>
                                  {detail.success ? (
                                    <Badge
                                      variant="outline"
                                      className="bg-green-50 text-green-700 border-green-200"
                                    >
                                      Success
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="bg-red-50 text-red-700 border-red-200"
                                    >
                                      Failed
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>{detail.message}</TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {detail.enhancedFields &&
                                      detail.enhancedFields.map(
                                        (field: string) => (
                                          <Badge
                                            key={field}
                                            variant="secondary"
                                          >
                                            {field}
                                          </Badge>
                                        ),
                                      )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ),
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              ) : enhancingInProgress ? (
                <div className="flex flex-col items-center justify-center p-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                  <p>Processing studies...</p>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No Enhancement Results</AlertTitle>
                  <AlertDescription>
                    Start a batch enhancement process to see results here.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter>
              <Button
                variant="secondary"
                onClick={() => setActiveTab("studies-to-enhance")}
              >
                Back to Studies
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
