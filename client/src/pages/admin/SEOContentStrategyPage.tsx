/**
 * SEO Content Strategy Page
 * Keyword-centric pillar/cluster content generation for Echo Water marketing
 */
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Target,
  Zap,
  TrendingUp,
  Shield,
  Play,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";

interface ClusterKeyword {
  keyword: string;
  title: string;
  slug: string;
  articleType: string;
  searchIntent: string;
}

interface ContentCluster {
  id: number;
  pillarKeyword: string;
  pillarTitle: string;
  slug: string;
  category: string;
  targetAudience: string;
  searchIntent: string;
  priority: number;
  estimatedSearchVolume: number | null;
  hasPillar: boolean;
  pillarArticleId: number | null;
  totalClusterPosts: number;
  generatedClusterPosts: number;
  clusterKeywords: ClusterKeyword[];
  includeProductCTA: boolean;
}

interface StrategyOverview {
  totalClusters: number;
  productClusters: number;
  researchClusters: number;
  competitorClusters: number;
  totalArticlesPlanned: number;
  totalArticlesGenerated: number;
  completionPercent: number;
  clusters: ContentCluster[];
}

interface ActiveJob {
  clusterId: number;
  kind: "pillar" | "full";
  startedAt: string;
}

export default function SEOContentStrategyPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedCluster, setExpandedCluster] = useState<number | null>(null);

  // Poll the server for in-flight generation jobs. Generation now runs
  // async on the backend (pillar + full-cluster both take longer than the
  // 30s request timeout), so the button press kicks off a job and we watch
  // here for its completion instead of awaiting the API call.
  const jobsQuery = useQuery<{ jobs: ActiveJob[] }>({
    queryKey: ["/api/seo/keyword-strategy/jobs"],
    refetchInterval: 5000,
  });
  const activeJobs = jobsQuery.data?.jobs ?? [];
  const hasActiveJob = activeJobs.length > 0;
  const jobFor = (clusterId: number) =>
    activeJobs.find((j) => j.clusterId === clusterId);

  // Re-poll overview often while anything is running, so the progress
  // bars update as individual cluster posts finish.
  const overviewQuery = useQuery<StrategyOverview>({
    queryKey: ["/api/seo/keyword-strategy/overview"],
    refetchInterval: hasActiveJob ? 5000 : false,
  });

  // When a job disappears from the active list, its cluster just finished.
  // Force an overview refresh so the progress bar snaps to its final value.
  const prevActiveIds = useRef<Set<number>>(new Set());
  useEffect(() => {
    const currentIds = new Set(activeJobs.map((j) => j.clusterId));
    const justFinished: number[] = [];
    prevActiveIds.current.forEach((id) => {
      if (!currentIds.has(id)) justFinished.push(id);
    });
    if (justFinished.length > 0) {
      queryClient.invalidateQueries({ queryKey: ["/api/seo/keyword-strategy/overview"] });
      justFinished.forEach((id) =>
        toast({
          title: "Generation finished",
          description: `Cluster ${id} completed — check progress below.`,
        }),
      );
    }
    prevActiveIds.current = currentIds;
  }, [activeJobs, queryClient, toast]);

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/seo/keyword-strategy/seed"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/seo/keyword-strategy/overview"] });
      toast({
        title: "Clusters Seeded",
        description: `Created ${data.created} new clusters (${data.existing} already existed)`,
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to seed clusters", variant: "destructive" });
    },
  });

  const generatePillarMutation = useMutation({
    mutationFn: (clusterId: number) =>
      apiRequest("POST", `/api/seo/keyword-strategy/generate-pillar/${clusterId}`),
    onSuccess: () => {
      // Server returns 202 — actual generation continues in background.
      queryClient.invalidateQueries({ queryKey: ["/api/seo/keyword-strategy/jobs"] });
      toast({
        title: "Pillar generation started",
        description: "This runs in the background — progress will update below.",
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start pillar generation", variant: "destructive" });
    },
  });

  const generateClusterPostMutation = useMutation({
    mutationFn: ({ clusterId, keywordIndex }: { clusterId: number; keywordIndex: number }) =>
      apiRequest("POST", `/api/seo/keyword-strategy/generate-cluster-post/${clusterId}`, { keywordIndex }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/seo/keyword-strategy/overview"] });
      toast({ title: "Post Generated", description: data.message });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate post", variant: "destructive" });
    },
  });

  const generateFullClusterMutation = useMutation({
    mutationFn: (clusterId: number) =>
      apiRequest("POST", `/api/seo/keyword-strategy/generate-full-cluster/${clusterId}`, { delayMs: 3000 }),
    onSuccess: () => {
      // Server returns 202 — generation runs in background; watch /jobs for completion.
      queryClient.invalidateQueries({ queryKey: ["/api/seo/keyword-strategy/jobs"] });
      toast({
        title: "Cluster generation started",
        description: "Pillar + all posts running in the background. Progress will update every few seconds.",
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start cluster generation", variant: "destructive" });
    },
  });

  const overview = overviewQuery.data;
  const isLoading = overviewQuery.isLoading;

  const categoryIcon = (category: string) => {
    switch (category) {
      case "product": return <Target className="h-4 w-4 text-blue-500" />;
      case "research": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "competitor": return <Shield className="h-4 w-4 text-orange-500" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  const categoryColor = (category: string) => {
    switch (category) {
      case "product": return "bg-primary/10 text-primary";
      case "research": return "bg-green-100 text-green-800";
      case "competitor": return "bg-orange-100 text-orange-800";
      default: return "bg-muted text-foreground";
    }
  };

  const renderClusterCard = (cluster: ContentCluster) => {
    const isExpanded = expandedCluster === cluster.id;
    const progress = cluster.totalClusterPosts > 0
      ? Math.round(((cluster.generatedClusterPosts + (cluster.hasPillar ? 1 : 0)) / (cluster.totalClusterPosts + 1)) * 100)
      : 0;
    const activeJob = jobFor(cluster.id);
    const isGeneratingPillar = activeJob?.kind === "pillar";
    const isGeneratingFull = activeJob?.kind === "full";
    const isGenerating = !!activeJob;

    return (
      <Card key={cluster.id} className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {categoryIcon(cluster.category)}
              <div>
                <CardTitle className="text-lg">{cluster.pillarKeyword}</CardTitle>
                <CardDescription className="mt-1">{cluster.pillarTitle}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={categoryColor(cluster.category)}>
                {cluster.category}
              </Badge>
              <Badge variant="outline">
                P{cluster.priority}
              </Badge>
              {cluster.estimatedSearchVolume && (
                <Badge variant="secondary">
                  {(cluster.estimatedSearchVolume / 1000).toFixed(0)}k vol
                </Badge>
              )}
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">
                {cluster.generatedClusterPosts + (cluster.hasPillar ? 1 : 0)} / {cluster.totalClusterPosts + 1} articles
              </span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {!cluster.hasPillar ? (
              <Button
                size="sm"
                onClick={() => generatePillarMutation.mutate(cluster.id)}
                disabled={isGenerating}
              >
                {isGeneratingPillar ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-1" />
                )}
                {isGeneratingPillar ? "Generating..." : "Generate Pillar Page"}
              </Button>
            ) : (
              <Badge variant="outline" className="bg-green-50">
                <CheckCircle className="h-3 w-3 mr-1" /> Pillar Done
              </Badge>
            )}

            <Button
              size="sm"
              variant={isGeneratingFull ? "secondary" : "default"}
              onClick={() => generateFullClusterMutation.mutate(cluster.id)}
              disabled={isGenerating || generateFullClusterMutation.isPending}
            >
              {isGeneratingFull ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Generating in background…
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-1" />
                  Generate All ({cluster.totalClusterPosts + 1} articles)
                </>
              )}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpandedCluster(isExpanded ? null : cluster.id)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {cluster.clusterKeywords.length} keywords
            </Button>
          </div>

          {isExpanded && (
            <div className="mt-4 border-t pt-4">
              <div className="grid gap-2">
                {cluster.clusterKeywords.map((ckw, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ckw.title}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{ckw.keyword}</span>
                        {" "}
                        <Badge variant="outline" className="text-xs ml-1">{ckw.articleType}</Badge>
                        <Badge variant="outline" className="text-xs ml-1">{ckw.searchIntent}</Badge>
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-2 shrink-0"
                      onClick={() => generateClusterPostMutation.mutate({ clusterId: cluster.id, keywordIndex: idx })}
                      disabled={generateClusterPostMutation.isPending || isGenerating}
                    >
                      {generateClusterPostMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <AdminLayout title="SEO Content Strategy" description="Keyword-centric pillar/cluster content generation">
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : !overview || overview.totalClusters === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Initialize SEO Content Strategy</CardTitle>
            <CardDescription>
              Seed the keyword clusters for Echo Water product marketing, hydrogen research credibility,
              and competitor differentiation. This creates 6 pillar topics with 60+ supporting articles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              {seedMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Seeding...</>
              ) : (
                <><Zap className="h-4 w-4 mr-2" /> Seed Keyword Clusters</>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{overview.totalArticlesGenerated}</div>
                <p className="text-xs text-muted-foreground">of {overview.totalArticlesPlanned} articles generated</p>
                <Progress value={overview.completionPercent} className="h-1 mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-500" />
                  <div className="text-2xl font-bold">{overview.productClusters}</div>
                </div>
                <p className="text-xs text-muted-foreground">Product Clusters</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <div className="text-2xl font-bold">{overview.researchClusters}</div>
                </div>
                <p className="text-xs text-muted-foreground">Research Clusters</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-orange-500" />
                  <div className="text-2xl font-bold">{overview.competitorClusters}</div>
                </div>
                <p className="text-xs text-muted-foreground">Competitor Clusters</p>
              </CardContent>
            </Card>
          </div>

          {/* Re-seed button */}
          <div className="mb-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              {seedMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
              Seed New Clusters
            </Button>
          </div>

          {/* Cluster Tabs */}
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All ({overview.totalClusters})</TabsTrigger>
              <TabsTrigger value="product">Product ({overview.productClusters})</TabsTrigger>
              <TabsTrigger value="research">Research ({overview.researchClusters})</TabsTrigger>
              <TabsTrigger value="competitor">Competitor ({overview.competitorClusters})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              {overview.clusters.map(renderClusterCard)}
            </TabsContent>
            <TabsContent value="product" className="mt-4">
              {overview.clusters.filter(c => c.category === "product").map(renderClusterCard)}
            </TabsContent>
            <TabsContent value="research" className="mt-4">
              {overview.clusters.filter(c => c.category === "research").map(renderClusterCard)}
            </TabsContent>
            <TabsContent value="competitor" className="mt-4">
              {overview.clusters.filter(c => c.category === "competitor").map(renderClusterCard)}
            </TabsContent>
          </Tabs>
        </>
      )}
    </AdminLayout>
  );
}
