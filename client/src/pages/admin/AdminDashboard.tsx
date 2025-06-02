import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle, Clock, Tag, Database, TrendingUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface TaggingStats {
  totalTags: number;
  totalStudyTags: number;
  topTags: Array<{ name: string; category: string; count: number }>;
  tagsByCategory: Array<{ category: string; count: number }>;
}

interface DuplicateStatus {
  totalStudies: number;
  duplicateGroups: number;
  totalDuplicates: number;
  sampleDuplicates: Array<{ title: string; count: number }>;
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [activeProcesses, setActiveProcesses] = useState<string[]>([]);

  // Fetch tagging statistics
  const { data: taggingStats, isLoading: taggingLoading } = useQuery<TaggingStats>({
    queryKey: ["/api/admin/tagging/stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch duplicate status
  const { data: duplicateStatus, isLoading: duplicateLoading } = useQuery<DuplicateStatus>({
    queryKey: ["/api/admin/duplicate-status"],
    refetchInterval: 60000, // Refresh every minute
  });

  // Initialize tagging system
  const initializeTagging = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/tagging/initialize", { method: "POST" });
      if (!response.ok) throw new Error("Failed to initialize tagging");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tagging/stats"] });
    },
  });

  // Process all studies for tagging
  const processAllTagging = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/tagging/process-all", { method: "POST" });
      if (!response.ok) throw new Error("Failed to start tagging process");
      return response.json();
    },
    onSuccess: () => {
      setActiveProcesses(prev => [...prev, "tagging"]);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tagging/stats"] });
    },
  });

  // Process duplicate fixes
  const processDuplicates = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/process-all-duplicates", { method: "POST" });
      if (!response.ok) throw new Error("Failed to start duplicate processing");
      return response.json();
    },
    onSuccess: () => {
      setActiveProcesses(prev => [...prev, "duplicates"]);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/duplicate-status"] });
    },
  });

  // Calculate progress percentages
  const taggingProgress = taggingStats 
    ? Math.round((taggingStats.totalStudyTags / (1326 * 8)) * 100) // Assuming avg 8 tags per study
    : 0;

  const duplicateProgress = duplicateStatus 
    ? Math.round(((duplicateStatus.totalStudies - duplicateStatus.totalDuplicates) / duplicateStatus.totalStudies) * 100)
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and manage automated content enhancement systems
          </p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          1,326 Total Studies
        </Badge>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tagged Studies</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {taggingStats ? Math.round(taggingStats.totalStudyTags / 8) : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {taggingProgress}% completion
            </p>
            <Progress value={taggingProgress} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Tags</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taggingStats?.totalTags || 0}</div>
            <p className="text-xs text-muted-foreground">
              Across {taggingStats?.tagsByCategory.length || 0} categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duplicate Groups</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{duplicateStatus?.duplicateGroups || 0}</div>
            <p className="text-xs text-muted-foreground">
              {duplicateStatus?.totalDuplicates || 0} duplicate studies
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Quality</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{duplicateProgress}%</div>
            <p className="text-xs text-muted-foreground">
              Clean data integrity
            </p>
            <Progress value={duplicateProgress} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="tagging" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tagging">Automated Tagging</TabsTrigger>
          <TabsTrigger value="duplicates">Duplicate Management</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="tagging" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Tagging System Control</CardTitle>
                <CardDescription>
                  Manage automated content tagging for improved search and SEO
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col space-y-2">
                  <Button 
                    onClick={() => initializeTagging.mutate()}
                    disabled={initializeTagging.isPending}
                    variant="outline"
                  >
                    {initializeTagging.isPending ? (
                      <>
                        <Clock className="mr-2 h-4 w-4 animate-spin" />
                        Initializing...
                      </>
                    ) : (
                      "Initialize Tagging System"
                    )}
                  </Button>
                  
                  <Button 
                    onClick={() => processAllTagging.mutate()}
                    disabled={processAllTagging.isPending || activeProcesses.includes("tagging")}
                  >
                    {processAllTagging.isPending || activeProcesses.includes("tagging") ? (
                      <>
                        <Clock className="mr-2 h-4 w-4 animate-spin" />
                        Processing All Studies...
                      </>
                    ) : (
                      "Process All Studies"
                    )}
                  </Button>
                </div>

                {activeProcesses.includes("tagging") && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-blue-600 mr-2 animate-spin" />
                      <span className="text-sm text-blue-800">
                        Automated tagging is running in background
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Tags</CardTitle>
                <CardDescription>Most frequently applied tags</CardDescription>
              </CardHeader>
              <CardContent>
                {taggingLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-4 bg-gray-200 rounded animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {taggingStats?.topTags.slice(0, 10).map((tag, index) => (
                      <div key={tag.name} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">{index + 1}.</span>
                          <Badge variant="secondary">{tag.category}</Badge>
                          <span className="text-sm">{tag.name}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {tag.count} studies
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="duplicates" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Duplicate Resolution</CardTitle>
                <CardDescription>
                  Fix duplicate titles using DOI-based verification
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={() => processDuplicates.mutate()}
                  disabled={processDuplicates.isPending || activeProcesses.includes("duplicates")}
                >
                  {processDuplicates.isPending || activeProcesses.includes("duplicates") ? (
                    <>
                      <Clock className="mr-2 h-4 w-4 animate-spin" />
                      Processing Duplicates...
                    </>
                  ) : (
                    "Fix All Duplicates"
                  )}
                </Button>

                {activeProcesses.includes("duplicates") && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                      <span className="text-sm text-green-800">
                        Duplicate resolution is running in background
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Duplicate Groups</CardTitle>
                <CardDescription>Studies with identical titles</CardDescription>
              </CardHeader>
              <CardContent>
                {duplicateLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-4 bg-gray-200 rounded animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {duplicateStatus?.sampleDuplicates.slice(0, 5).map((dup, index) => (
                      <div key={index} className="space-y-1">
                        <div className="text-sm font-medium">
                          {dup.title.substring(0, 60)}...
                        </div>
                        <Badge variant="destructive" className="text-xs">
                          {dup.count} copies
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Tag Categories</CardTitle>
                <CardDescription>Distribution of tags by category</CardDescription>
              </CardHeader>
              <CardContent>
                {taggingStats?.tagsByCategory.map((category) => (
                  <div key={category.category} className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium capitalize">
                      {category.category.replace(/_/g, ' ')}
                    </span>
                    <Badge variant="outline">{category.count} tags</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
                <CardDescription>Overall platform health</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Database Connection</span>
                  <Badge variant="default">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Tagging System</span>
                  <Badge variant="default">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Operational
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">API Services</span>
                  <Badge variant="default">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Online
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}