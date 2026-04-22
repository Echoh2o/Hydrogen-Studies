import { useState } from "react";
import { useLocation } from "wouter";
import { formatAuthors } from "@/lib/utils";
import { Helmet } from "react-helmet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import AdminLayout from "@/components/admin/AdminLayout";
import { AdminBreadcrumbs } from "@/components/admin/AdminBreadcrumbs";
import {
  ArrowLeft,
  Search,
  FileText,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Study } from "@/types";
import {
  BLOG_ARTICLE_TYPES,
  DEFAULT_ARTICLE_TYPE_IDS,
  type ReadingLevel,
} from "@shared/blog-article-types";

export default function BlogGeneratePage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudyId, setSelectedStudyId] = useState<number | null>(null);
  const [forceRegeneration, setForceRegeneration] = useState(false);

  // Selected article types — start with whichever types the registry marks
  // as defaultEnabled. Adding/removing types in shared/blog-article-types.ts
  // automatically flows into the UI here.
  const [selectedTypeIds, setSelectedTypeIds] = useState<Set<string>>(
    new Set(DEFAULT_ARTICLE_TYPE_IDS),
  );

  // Reading level override. Empty string means "use each article type's
  // default reading level" — usually the right call. Admins can still force
  // a consistent level across all types for a campaign if they want.
  const [readingLevelOverride, setReadingLevelOverride] = useState<string>("");

  // Get the 20 most recent studies
  const { data: recentStudies, isLoading: loadingStudies } = useQuery<any>({
    queryKey: ["/api/studies/latest", { limit: 20 }],
    retry: false,
  });

  // Search studies
  const { data: searchResults, isLoading: searchLoading } = useQuery<any>({
    queryKey: ["/api/studies/search", { query: searchQuery }],
    enabled: !!searchQuery.trim(),
    retry: false,
  });

  // If a study is selected, get more details
  const {
    data: selectedStudy,
    isLoading: loadingSelectedStudy,
    error: studyError,
  } = useQuery<any>({
    queryKey: [`/api/studies/${selectedStudyId}`],
    enabled: !!selectedStudyId && !isNaN(selectedStudyId),
    retry: false,
  });

  // Track generation progress states
  const [generationProgress, setGenerationProgress] = useState({
    step: "",
    completed: false,
    blogCount: 0,
    totalSteps: 0,
    currentStep: 0,
  });

  // Generate blog posts mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStudyId) {
        throw new Error("No study selected");
      }
      const articleTypes = Array.from(selectedTypeIds);
      if (articleTypes.length === 0) {
        throw new Error("Select at least one article type");
      }

      // Reset progress
      setGenerationProgress({
        step: "Starting generation...",
        completed: false,
        blogCount: 0,
        totalSteps: articleTypes.length + 1,
        currentStep: 1,
      });

      // Wait briefly to show initial step
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Update progress
      setGenerationProgress((prev) => ({
        ...prev,
        step: `Generating ${articleTypes.length} article${articleTypes.length > 1 ? "s" : ""}...`,
        currentStep: 2,
      }));

      // Call API - don't throw on non-2xx responses so we can handle them in the error handler
      try {
        const response = await apiRequest(
          "POST",
          `/api/studies/${selectedStudyId}/generate-blogs`,
          {
            count: articleTypes.length,
            articleTypes,
            readingLevel: readingLevelOverride || undefined,
            force: forceRegeneration,
          },
          false,
        ); // false = don't throw on error responses

        // If we got a 409 Conflict (blogs already exist), provide helpful message
        if (response.status === 409) {
          const data = await response.json();
          throw {
            response,
            message: "Blog articles already exist for this study",
          };
        }

        // For any other non-2xx response, throw a generic error
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        throw error; // Re-throw for the error handler
      }
    },
    onSuccess: (data) => {
      // Update the progress state with the final count
      setGenerationProgress((prev) => ({
        ...prev,
        step: "Blog generation complete!",
        completed: true,
        blogCount: data.articles?.length || 0,
        currentStep: prev.totalSteps,
      }));

      toast({
        title: "Blog articles generated successfully",
        description: `Created ${data.articles?.length || 0} blog posts based on the selected study.`,
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["/api/blogs"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/studies", selectedStudyId, "blogs"],
      });

      // Wait briefly to show completion, then navigate
      setTimeout(() => {
        navigate("/admin/blogs");
      }, 2000); // Give user a bit more time to see the success state
    },
    onError: async (error: any) => {
      setGenerationProgress((prev) => ({
        ...prev,
        step: "Error generating articles",
        completed: false,
      }));

      // Check if this is a 409 conflict (blogs exist) error
      if (error.response && error.response.status === 409) {
        try {
          // Parse the error response to get existing blogs
          const data = await error.response.json();

          // Update progress with the count of existing blogs
          setGenerationProgress((prev) => ({
            ...prev,
            step: "Blog articles already exist for this study",
            completed: false,
            blogCount: data.blogs?.length || 0,
          }));

          toast({
            title: "Blog articles already exist",
            description:
              'This study already has blog posts. Enable "Force regeneration" to replace them.',
            variant: "destructive",
          });

          // Show the "force regeneration" option more prominently
          setForceRegeneration(true);

          return;
        } catch (parseError) {
          // If we can't parse the response, fall through to general error
        }
      }

      toast({
        title: "Failed to generate blog posts",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle study selection
  const handleSelectStudy = (study: Study) => {
    setSelectedStudyId(study.id);
  };

  // Handle search
  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // The actual search is triggered by the useQuery with searchQuery dependency
  };

  // Handle generate blogs
  const handleGenerateBlogs = () => {
    generateMutation.mutate();
  };

  return (
    <AdminLayout
      title="Generate Blog Posts"
      description="Create AI-generated blog content from research studies"
    >
      <Helmet>
        <title>Generate Blog Posts | HydrogenStudies Admin</title>
      </Helmet>

      <div className="space-y-6">
        <AdminBreadcrumbs
          items={[
            { label: "Blogs", href: "/admin/blogs" },
            { label: "Generate" },
          ]}
        />
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">
            Generate Blog Posts
          </h1>
          <Button variant="outline" onClick={() => navigate("/admin/blogs")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Blogs
          </Button>
        </div>

        <Tabs defaultValue="search" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search">Search for a Study</TabsTrigger>
            <TabsTrigger value="recent">Recent Studies</TabsTrigger>
          </TabsList>

          {/* Search tab */}
          <TabsContent value="search" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Search for a Research Study</CardTitle>
                <CardDescription>
                  Find a study to generate blog posts from
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Search by title, author, or keywords..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="submit"
                      disabled={!searchQuery.trim() || searchLoading}
                    >
                      {searchLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                      <span className="ml-2">Search</span>
                    </Button>
                  </div>
                </form>

                {searchQuery.trim() && searchResults && (
                  <div className="mt-6 space-y-4">
                    <h3 className="text-sm font-medium">Search Results</h3>

                    {searchResults.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-6 text-center">
                        <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
                        <p className="mt-2 text-sm text-muted-foreground">
                          No studies found matching your search terms.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-md border divide-y">
                        {searchResults.map((study: Study) => (
                          <div key={study.id} className="p-4 hover:bg-muted/50">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <h4 className="font-medium">{study.title}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {formatAuthors(study.authors).split(",")[0]}{" "}
                                  et al. • {study.journal} •{" "}
                                  {new Date(study.publishDate).getFullYear()}
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSelectStudy(study)}
                              >
                                Select
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recent tab */}
          <TabsContent value="recent" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Studies</CardTitle>
                <CardDescription>
                  Select from recently added research studies
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingStudies ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : !recentStudies || recentStudies.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No studies found in the database.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border divide-y">
                    {recentStudies.map((study: Study) => (
                      <div key={study.id} className="p-4 hover:bg-muted/50">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h4 className="font-medium">{study.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {formatAuthors(study.authors).split(",")[0]} et
                              al. • {study.journal} •{" "}
                              {new Date(study.publishDate).getFullYear()}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSelectStudy(study)}
                          >
                            Select
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Selected study card */}
        {selectedStudyId && (
          <Card>
            <CardHeader>
              <CardTitle>Selected Study</CardTitle>
              <CardDescription>
                The following study will be used to generate blog posts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSelectedStudy ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : selectedStudy ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium">
                      {selectedStudy?.title || "No title available"}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedStudy?.authors
                        ? formatAuthors(selectedStudy.authors)
                        : "Unknown authors"}
                      {selectedStudy?.journal
                        ? ` • ${selectedStudy.journal}`
                        : ""}
                      {selectedStudy?.publishDate
                        ? ` • ${new Date(selectedStudy.publishDate).getFullYear()}`
                        : ""}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Abstract</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedStudy?.abstract || "No abstract available"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <div>
                      <span className="text-xs font-medium">Category:</span>
                      <span className="text-xs ml-1">
                        {selectedStudy?.category || "Uncategorized"}
                      </span>
                    </div>

                    {selectedStudy?.peerReviewed && (
                      <div>
                        <span className="text-xs font-medium">
                          Peer-reviewed
                        </span>
                      </div>
                    )}

                    {selectedStudy?.methods && (
                      <div>
                        <span className="text-xs font-medium">Methods:</span>
                        <span className="text-xs ml-1">
                          {selectedStudy.methods}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    Could not load study details. Please try selecting another
                    study.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Blog generation options — article types pulled from shared registry */}
        {selectedStudyId && (
          <Card>
            <CardHeader>
              <CardTitle>Article Types</CardTitle>
              <CardDescription>
                Pick the article formats to generate from this study. Each type
                targets a different search intent and has its own ideal
                reading level. Images, SEO metadata, and saving to the database
                all happen automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Article type grid — all types from the shared registry */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {BLOG_ARTICLE_TYPES.map((type) => {
                  const checked = selectedTypeIds.has(type.id);
                  return (
                    <label
                      key={type.id}
                      className={`border rounded-md p-3 cursor-pointer transition-colors ${
                        checked
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`type-${type.id}`}
                          checked={checked}
                          onCheckedChange={(isChecked) => {
                            setSelectedTypeIds((prev) => {
                              const next = new Set(prev);
                              if (isChecked) next.add(type.id);
                              else next.delete(type.id);
                              return next;
                            });
                          }}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">
                              {type.label}
                            </span>
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground border rounded px-1 py-0.5">
                              {type.defaultReadingLevel} grade
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              ~{type.targetWordCount} words
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {type.description}
                          </p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Reading level override — optional, applies to all types */}
              <div>
                <Label htmlFor="readingLevelOverride" className="text-sm">
                  Reading Level Override{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional — otherwise each type uses its default)
                  </span>
                </Label>
                <Select
                  value={readingLevelOverride || "default"}
                  onValueChange={(v) =>
                    setReadingLevelOverride(v === "default" ? "" : v)
                  }
                >
                  <SelectTrigger id="readingLevelOverride" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">
                      Use each article type's default
                    </SelectItem>
                    <SelectItem value="6th">6th Grade (Ages 11–12)</SelectItem>
                    <SelectItem value="8th">8th Grade (Ages 13–14)</SelectItem>
                    <SelectItem value="10th">10th Grade (Ages 15–16)</SelectItem>
                    <SelectItem value="12th">12th Grade (Ages 17–18)</SelectItem>
                    <SelectItem value="college">College Level</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Force regeneration — kept; the only legacy toggle that matters */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="forceRegeneration"
                  checked={forceRegeneration}
                  onCheckedChange={(checked) => setForceRegeneration(!!checked)}
                />
                <Label htmlFor="forceRegeneration" className="text-sm">
                  Force regeneration (replace existing articles of these types)
                </Label>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between">
              <Button
                variant="outline"
                onClick={() => setSelectedStudyId(null)}
              >
                Select Different Study
              </Button>
              {generateMutation.isPending ? (
                <div className="flex-1 md:max-w-md space-y-2">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm font-medium">
                      {generationProgress.step}
                    </span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-300"
                      style={{
                        width: `${
                          (generationProgress.currentStep /
                            Math.max(generationProgress.totalSteps, 1)) *
                          100
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={handleGenerateBlogs}
                  disabled={
                    generateMutation.isPending || selectedTypeIds.size === 0
                  }
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Generate {selectedTypeIds.size || "—"} Article
                  {selectedTypeIds.size !== 1 && "s"}
                </Button>
              )}
            </CardFooter>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
