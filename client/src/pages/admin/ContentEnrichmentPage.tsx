import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  BarChart,
  BookOpen,
  CheckCircle,
  FileText,
  Image,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Study } from "@/types/study";
import { formatDate } from "@/lib/utils";

export default function ContentEnrichmentPage({ embedded }: { embedded?: boolean } = {}) {
  const [activeTab, setActiveTab] = useState("candidates");
  const [processingStatus, setProcessingStatus] = useState<{
    message: string;
    type: "info" | "success" | "error";
    visible: boolean;
  }>({ message: "", type: "info", visible: false });

  // Fetch candidates for content enrichment
  const candidatesQuery = useQuery({
    queryKey: ["/api/content-enrichment/candidates"],
    enabled: activeTab === "candidates",
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Fetch recently enriched studies
  const recentlyEnrichedQuery = useQuery({
    queryKey: ["/api/content-enrichment/recent"],
    enabled: activeTab === "recent",
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  // Mutation for enhancing a single study
  const enhanceStudyMutation = useMutation({
    mutationFn: async (studyId: number) => {
      const response = await fetch(`/api/content-enrichment/study/${studyId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to enhance study");
      return response.json();
    },
    onSuccess: (data) => {
      // Show success message
      setProcessingStatus({
        message: `Successfully enhanced study #${data.studyId}. 
          ${data.updates?.abstract ? "Abstract ✓ " : ""}
          ${data.updates?.methods ? "Methods ✓ " : ""}
          ${data.updates?.results ? "Results ✓ " : ""}
          ${data.updates?.conclusion ? "Conclusion ✓ " : ""}
          ${data.updates?.images ? "Images ✓ " : ""}`,
        type: "success",
        visible: true,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: ["/api/content-enrichment/candidates"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/content-enrichment/recent"],
      });
    },
    onError: (error) => {
      setProcessingStatus({
        message: `Error: ${error.message}`,
        type: "error",
        visible: true,
      });
    },
  });

  // Mutation for batch enrichment
  const batchEnrichMutation = useMutation({
    mutationFn: async (count: number) => {
      const response = await fetch(`/api/content-enrichment/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ count }),
      });

      if (!response.ok) throw new Error("Failed to process batch");
      return response.json();
    },
    onSuccess: (data) => {
      setProcessingStatus({
        message: `Batch process complete: ${data.processed} studies processed, 
          ${data.success} improved, ${data.failed} failed`,
        type: "success",
        visible: true,
      });

      if (data.success / data.processed > 0.8) {
        setProcessingStatus({
          message: `Success rate is high (${Math.round((data.success / data.processed) * 100)}%). 
            Batch processing is working well.`,
          type: "success",
          visible: true,
        });
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: ["/api/content-enrichment/candidates"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/content-enrichment/recent"],
      });
    },
    onError: (error) => {
      setProcessingStatus({
        message: `Error: ${error.message}`,
        type: "error",
        visible: true,
      });
    },
  });

  // Helper function to render study fields
  const renderStudyEnhancementStatus = (study: Study) => {
    const abstractStatus =
      !study.abstract || study.abstract.length < 100
        ? "missing"
        : study.abstract.length < 500
          ? "partial"
          : "complete";

    const methodsStatus =
      !study.methods || study.methods.length < 50
        ? "missing"
        : study.methods.length < 200
          ? "partial"
          : "complete";

    const resultsStatus =
      !study.results || study.results.length < 50
        ? "missing"
        : study.results.length < 200
          ? "partial"
          : "complete";

    const conclusionStatus =
      !study.conclusion || study.conclusion.length < 50
        ? "missing"
        : study.conclusion.length < 200
          ? "partial"
          : "complete";

    const imageStatus = !study.imageUrl ? "missing" : "complete";

    const getStatusColor = (status: string) => {
      switch (status) {
        case "missing":
          return "text-destructive";
        case "partial":
          return "text-amber-500";
        case "complete":
          return "text-green-500";
        default:
          return "";
      }
    };

    return (
      <div className="grid grid-cols-2 gap-2 text-sm mt-2">
        <div className="flex items-center gap-1">
          <BookOpen className="h-4 w-4" />
          <span>Abstract:</span>
          <span className={getStatusColor(abstractStatus)}>
            {abstractStatus}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <FileText className="h-4 w-4" />
          <span>Methods:</span>
          <span className={getStatusColor(methodsStatus)}>{methodsStatus}</span>
        </div>
        <div className="flex items-center gap-1">
          <BarChart className="h-4 w-4" />
          <span>Results:</span>
          <span className={getStatusColor(resultsStatus)}>{resultsStatus}</span>
        </div>
        <div className="flex items-center gap-1">
          <CheckCircle className="h-4 w-4" />
          <span>Conclusion:</span>
          <span className={getStatusColor(conclusionStatus)}>
            {conclusionStatus}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Image className="h-4 w-4" />
          <span>Image:</span>
          <span className={getStatusColor(imageStatus)}>{imageStatus}</span>
        </div>
      </div>
    );
  };

  // Render the candidate studies list
  const renderCandidatesList = () => {
    if (candidatesQuery.isLoading) {
      return (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading candidate studies...</span>
        </div>
      );
    }

    if (candidatesQuery.isError) {
      return (
        <Alert variant="destructive" className="my-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load candidate studies. Please try again.
          </AlertDescription>
        </Alert>
      );
    }

    const candidates = Array.isArray(candidatesQuery.data)
      ? candidatesQuery.data
      : [];

    if (!candidates || candidates.length === 0) {
      return (
        <Alert className="my-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Candidates</AlertTitle>
          <AlertDescription>
            No studies found that need content enrichment. All studies may
            already have complete content.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-4">
        {candidates.map((study: Study) => (
          <Card key={study.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex justify-between">
                <CardTitle className="text-lg">{study.title}</CardTitle>
                <Badge>{study.category}</Badge>
              </div>
              <CardDescription>
                {study.authors} ({formatDate(study.publishDate)})
                {study.doi && (
                  <span className="ml-2">
                    DOI:{" "}
                    <a
                      href={`https://doi.org/${study.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {study.doi}
                    </a>
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderStudyEnhancementStatus(study)}
              {study.abstract && (
                <div className="mt-2 text-sm text-muted-foreground">
                  <p className="line-clamp-2">{study.abstract}</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-muted/50 flex justify-end">
              <Button
                onClick={() => enhanceStudyMutation.mutate(study.id)}
                disabled={enhanceStudyMutation.isPending}
                size="sm"
              >
                {enhanceStudyMutation.isPending &&
                enhanceStudyMutation.variables === study.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enriching...
                  </>
                ) : (
                  <>
                    Enrich Content
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  };

  // Render the recently enriched studies list
  const renderRecentlyEnrichedList = () => {
    if (recentlyEnrichedQuery.isLoading) {
      return (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading recently enriched studies...</span>
        </div>
      );
    }

    if (recentlyEnrichedQuery.isError) {
      return (
        <Alert variant="destructive" className="my-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load recently enriched studies. Please try again.
          </AlertDescription>
        </Alert>
      );
    }

    const recentlyEnriched = Array.isArray(recentlyEnrichedQuery.data)
      ? recentlyEnrichedQuery.data
      : [];

    if (recentlyEnriched.length === 0) {
      return (
        <Alert className="my-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Recent Activity</AlertTitle>
          <AlertDescription>
            No studies have been recently enriched.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-4">
        {recentlyEnriched.map((study: any) => (
          <Card key={study.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex justify-between">
                <CardTitle className="text-lg">{study.title}</CardTitle>
                <Badge
                  variant="outline"
                  className="bg-green-100 text-green-800"
                >
                  Enriched
                </Badge>
              </div>
              <CardDescription>
                {study.authors} ({formatDate(study.publishDate)})
                {study.doi && (
                  <span className="ml-2">
                    DOI:{" "}
                    <a
                      href={`https://doi.org/${study.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {study.doi}
                    </a>
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderStudyEnhancementStatus(study)}

              <div className="mt-3">
                <h4 className="text-sm font-medium">Enhanced Fields:</h4>
                <div className="flex flex-wrap gap-2 mt-1">
                  {study.enhancedFields?.map((field: string) => (
                    <Badge
                      key={field}
                      variant="outline"
                      className="bg-blue-50 text-blue-700"
                    >
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>

              {study.abstract && (
                <div className="mt-2 text-sm text-muted-foreground">
                  <p className="line-clamp-3">{study.abstract}</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-muted/50 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/studies/${study.id}`, "_blank")}
              >
                View Study
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  };

  const content = (
    <>
      {processingStatus.visible && (
        <Alert
          variant={
            processingStatus.type === "error" ? "destructive" : undefined
          }
          className="mb-6"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {processingStatus.type === "success"
              ? "Success"
              : processingStatus.type === "error"
                ? "Error"
                : "Info"}
          </AlertTitle>
          <AlertDescription>{processingStatus.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end mb-6 gap-2">
        <Button
          variant="outline"
          onClick={() => batchEnrichMutation.mutate(5)}
          disabled={batchEnrichMutation.isPending}
        >
          {batchEnrichMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Process 5 Studies"
          )}
        </Button>
        <Button
          onClick={() => batchEnrichMutation.mutate(20)}
          disabled={batchEnrichMutation.isPending}
        >
          {batchEnrichMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Batch Process 20 Studies"
          )}
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          setProcessingStatus({ ...processingStatus, visible: false });
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="candidates">
            Candidates for Enrichment
          </TabsTrigger>
          <TabsTrigger value="recent">Recently Enriched</TabsTrigger>
        </TabsList>
        <TabsContent value="candidates" className="mt-6">
          {renderCandidatesList()}
        </TabsContent>
        <TabsContent value="recent" className="mt-6">
          {renderRecentlyEnrichedList()}
        </TabsContent>
      </Tabs>
    </>
  );

  if (embedded) return content;

  return (
    <AdminLayout
      title="Content Enrichment"
      description="Enhance study content by fetching full abstracts, methods, results, and more from DOI sources."
    >
      {content}
    </AdminLayout>
  );
}
