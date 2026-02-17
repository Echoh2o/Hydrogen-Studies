import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  TrendingUp,
  Brain,
  Flag,
  Star,
  Users,
  Calendar,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import StudyPreviewAssistant from "./StudyPreviewAssistant";

interface QualityScore {
  overall: number;
  methodology: number;
  impact: number;
  relevance: number;
  redFlags: string[];
  redFlagCount: number;
}

interface Recommendation {
  priority: "high" | "medium" | "low";
  suggestedActions: string[];
  keyFindings: string[];
  suggestedCategories: string[];
}

interface StudyQueueItem {
  id: number;
  title: string;
  authors: string;
  journal: string;
  publishDate: string;
  category: string;
  scores: QualityScore | null;
  recommendations: Recommendation | null;
}

const SmartReviewQueue = () => {
  const [selectedStudy, setSelectedStudy] = useState<StudyQueueItem | null>(
    null,
  );
  const [statusFilter, setStatusFilter] = useState("pending");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedStudies, setSelectedStudies] = useState<Set<number>>(
    new Set(),
  );
  const [refreshingId, setRefreshingId] = useState<number | null>(null);

  // Fetch review queue
  const {
    data: queueData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/review-assistant/queue", statusFilter, priorityFilter],
    queryFn: () =>
      apiRequest(
        `/api/review-assistant/queue?status=${statusFilter}&priority=${priorityFilter}&limit=50`,
      ),
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch red-flagged studies
  const { data: redFlaggedStudies } = useQuery({
    queryKey: ["/api/review-assistant/red-flags"],
    queryFn: () =>
      apiRequest("/api/review-assistant/red-flags?minRedFlags=1&limit=10"),
  });

  // Score single study mutation
  const scoreStudyMutation = useMutation({
    mutationFn: (studyId: number) =>
      apiRequest(`/api/review-assistant/score/${studyId}`, "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/review-assistant/queue"],
      });
    },
  });

  // Batch score mutation
  const batchScoreMutation = useMutation({
    mutationFn: (studyIds: number[]) =>
      apiRequest("/api/review-assistant/batch-score", "POST", { studyIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/review-assistant/queue"],
      });
      setSelectedStudies(new Set());
    },
  });

  // Refresh study scores
  const refreshScores = async (studyId: number) => {
    setRefreshingId(studyId);
    try {
      await apiRequest(`/api/review-assistant/refresh/${studyId}`, "PUT");
      await refetch();
    } finally {
      setRefreshingId(null);
    }
  };

  // Batch operations
  const handleBatchScore = () => {
    if (selectedStudies.size > 0) {
      batchScoreMutation.mutate(Array.from(selectedStudies));
    }
  };

  const toggleStudySelection = (studyId: number) => {
    const newSelected = new Set(selectedStudies);
    if (newSelected.has(studyId)) {
      newSelected.delete(studyId);
    } else {
      newSelected.add(studyId);
    }
    setSelectedStudies(newSelected);
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-teal-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-gray-500";
      default:
        return "bg-gray-400";
    }
  };

  const renderScoreBadges = (scores: QualityScore) => (
    <div className="flex gap-2 flex-wrap">
      <Badge className={cn("text-white", getScoreBadgeColor(scores.overall))}>
        Overall: {scores.overall}
      </Badge>
      <Badge variant="outline" className="text-xs">
        <Brain className="h-3 w-3 mr-1" />
        Method: {scores.methodology}
      </Badge>
      <Badge variant="outline" className="text-xs">
        <TrendingUp className="h-3 w-3 mr-1" />
        Impact: {scores.impact}
      </Badge>
      <Badge variant="outline" className="text-xs">
        <Star className="h-3 w-3 mr-1" />
        Relevance: {scores.relevance}
      </Badge>
      {scores.redFlagCount > 0 && (
        <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {scores.redFlagCount} Red Flag{scores.redFlagCount !== 1 ? "s" : ""}
        </Badge>
      )}
    </div>
  );

  const renderStudyCard = (study: StudyQueueItem) => (
    <Card
      key={study.id}
      className={cn(
        "cursor-pointer transition-all hover:shadow-lg",
        selectedStudy?.id === study.id && "ring-2 ring-primary",
        selectedStudies.has(study.id) && "bg-accent/50",
      )}
      onClick={() => setSelectedStudy(study)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={selectedStudies.has(study.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleStudySelection(study.id);
                }}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4"
              />
              <CardTitle className="text-sm font-medium line-clamp-2">
                {study.title}
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              {study.authors.split(",").slice(0, 3).join(", ")}
              {study.authors.split(",").length > 3 && " et al."}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{study.journal}</span>
              <span>•</span>
              <Calendar className="h-3 w-3" />
              <span>{new Date(study.publishDate).getFullYear()}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end">
            {study.recommendations && (
              <Badge
                className={cn(
                  "text-white",
                  getPriorityBadgeColor(study.recommendations.priority),
                )}
              >
                {study.recommendations.priority.toUpperCase()} Priority
              </Badge>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                refreshScores(study.id);
              }}
              disabled={refreshingId === study.id}
            >
              <RefreshCw
                className={cn(
                  "h-3 w-3",
                  refreshingId === study.id && "animate-spin",
                )}
              />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {study.scores ? (
          renderScoreBadges(study.scores)
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              scoreStudyMutation.mutate(study.id);
            }}
            disabled={scoreStudyMutation.isPending}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Generate Score
          </Button>
        )}
        {study.recommendations &&
          study.recommendations.keyFindings.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs font-medium mb-1">Key Findings:</p>
              <ul className="text-xs text-muted-foreground list-disc list-inside">
                {study.recommendations.keyFindings
                  .slice(0, 2)
                  .map((finding, idx) => (
                    <li key={idx} className="line-clamp-1">
                      {finding}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        {study.recommendations &&
          study.recommendations.suggestedActions.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs font-medium mb-1">Suggested Actions:</p>
              <div className="flex flex-wrap gap-1">
                {study.recommendations.suggestedActions
                  .slice(0, 3)
                  .map((action, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {action}
                    </Badge>
                  ))}
              </div>
            </div>
          )}
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Smart Review Queue</h1>
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Studies</SelectItem>
              <SelectItem value="pending">Pending Review</SelectItem>
              <SelectItem value="scored">Already Scored</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High Priority</SelectItem>
              <SelectItem value="medium">Medium Priority</SelectItem>
              <SelectItem value="low">Low Priority</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Red flags alert */}
      {redFlaggedStudies?.studies?.length > 0 && (
        <Alert className="mb-4 border-destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{redFlaggedStudies.studies.length} studies</strong> have red
            flags that need immediate attention.
            <Button
              variant="link"
              className="ml-2 p-0 h-auto"
              onClick={() => setStatusFilter("scored")}
            >
              View flagged studies
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Batch operations */}
      {selectedStudies.size > 0 && (
        <div className="mb-4 p-4 bg-accent rounded-lg flex items-center justify-between">
          <span className="text-sm">
            {selectedStudies.size}{" "}
            {selectedStudies.size === 1 ? "study" : "studies"} selected
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleBatchScore}
              disabled={batchScoreMutation.isPending}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Batch Score
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedStudies(new Set())}
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Study queue list */}
        <div className="lg:col-span-2">
          <ScrollArea className="h-[calc(100vh-250px)]">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : queueData?.queue?.length > 0 ? (
              <div className="space-y-4">
                {queueData.queue.map((study: StudyQueueItem) =>
                  renderStudyCard(study),
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-8">
                  <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    No studies in the review queue
                  </p>
                </CardContent>
              </Card>
            )}
          </ScrollArea>
        </div>

        {/* Study preview panel */}
        <div className="lg:col-span-1">
          {selectedStudy ? (
            <StudyPreviewAssistant study={selectedStudy} />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  Select a study to see detailed preview
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Queue stats */}
      {queueData?.pagination && (
        <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {queueData.queue.length} of {queueData.pagination.total}{" "}
            studies
          </span>
          {queueData.pagination.hasMore && (
            <Button variant="outline" size="sm">
              Load More
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default SmartReviewQueue;
