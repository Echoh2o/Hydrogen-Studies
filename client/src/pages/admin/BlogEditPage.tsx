import { useParams } from "wouter";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminLayout from "@/components/admin/AdminLayout";
import { AdminBreadcrumbs } from "@/components/admin/AdminBreadcrumbs";
import { ArrowLeft, FileEdit, Image, Loader, TrendingUp, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { MediaUpload } from "@/components/common/MediaUpload";
import { BlogImageGenerator } from "@/components/admin/BlogImageGenerator";
import { BlogContentSuggestions } from "@/components/admin/BlogContentSuggestions";
import { WysiwygEditor } from "@/components/ui/wysiwyg-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function BlogEditPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const blogId = Number(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("content");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch blog data
  const {
    data: blog,
    isLoading: isBlogLoading,
    error: blogError,
  } = useQuery<any>({
    queryKey: [`/api/blogs/${blogId}`],
    enabled: !!blogId && !isNaN(blogId),
  });

  // Fetch related study data
  const { data: relatedStudy, isLoading: isStudyLoading } = useQuery<any>({
    queryKey: [`/api/studies/${blog?.studyId}`],
    enabled: !!blog?.studyId,
  });

  // Fetch all studies for dropdown
  const { data: studies = [] } = useQuery<any>({
    queryKey: ["/api/studies"],
    staleTime: 300000, // 5 minutes
  });

  // Pillar cluster cohort — only meaningful when blog.isPillar. Lazy-loaded
  // by setting `enabled` so non-pillar edits don't pay the round-trip.
  const { data: cluster } = useQuery<{
    pillar: { id: number; title: string; isPillar: boolean; promotedToPillarAt: string | null };
    clusters: Array<{
      id: number;
      title: string;
      slug: string;
      isPublished: boolean;
      publishedAt: string | null;
      scheduledFor: string | null;
      viewCount: number | null;
      articleType: string | null;
      createdAt: string;
    }>;
    counts: { total: number; published: number; draft: number; scheduled: number };
  }>({
    queryKey: [`/api/blogs/${blogId}/cluster`],
    enabled: !!blogId && !!blog?.isPillar,
  });

  // GSC performance for THIS blog over the last 30 days. Endpoint already
  // exists from Phase A — we just bind it to the editor side panel here.
  // Lazy: only loads after the blog has a slug, and only renders the card
  // when there's actual GSC data for it (most newly-published blogs will
  // have nothing for the first week or two).
  const { data: gscMetrics } = useQuery<{
    trend: Array<{ date: string; impressions: number; clicks: number; avg_position: number }>;
    topQueries: Array<{ query: string; impressions: number; clicks: number; avg_position: number }>;
  }>({
    queryKey: [`/api/admin/gsc/page`, blog?.slug],
    queryFn: async () => {
      const res = await fetch(`/api/admin/gsc/page?path=/blog/${blog?.slug}`);
      if (!res.ok) throw new Error("Failed to load GSC metrics");
      return res.json();
    },
    enabled: !!blog?.slug,
  });

  // Blog data state
  const [blogData, setBlogData] = useState({
    title: "",
    slug: "",
    summary: "",
    content: "",
    readingLevel: "",
    articleType: "",
    studyId: 0,
    editorNotes: "",
    isPublished: false,
  });

  // Update local state when blog data is fetched
  useEffect(() => {
    if (blog) {
      setBlogData({
        title: blog.title || "",
        slug: blog.slug || "",
        summary: blog.summary || "",
        content: blog.content || "",
        readingLevel: blog.readingLevel || "6th",
        articleType: blog.articleType || "manual",
        studyId: blog.studyId || 0,
        editorNotes: blog.editorNotes || "",
        isPublished: blog.isPublished || false,
      });
    }
  }, [blog]);

  // Function to generate slug from title
  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, "") // Remove special characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
      .trim();
  };

  // Handle input changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;

    // If title is being changed, update slug automatically (if slug hasn't been manually edited)
    if (name === "title") {
      setBlogData((prev) => ({
        ...prev,
        title: value,
        slug: generateSlug(value),
      }));
    } else {
      setBlogData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // Handle rich text editor changes
  const handleRichTextChange = (name: string, value: string) => {
    setBlogData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setBlogData((prev) => ({
      ...prev,
      [name]: name === "studyId" ? parseInt(value) : value,
    }));
  };

  // Handle checkbox/switch changes
  const handleToggleChange = (name: string, checked: boolean) => {
    setBlogData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  // Update blog mutation
  const updateBlogMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "PUT",
        `/api/blogs/${blogId}`,
        blogData,
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Blog article updated",
        description: "The blog post was successfully updated.",
      });

      // Invalidate blogs queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/blogs"] });
      queryClient.invalidateQueries({ queryKey: [`/api/blogs/${blogId}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update blog post",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    updateBlogMutation.mutate();
  };

  // Handle image upload success
  const handleImageUploadSuccess = (mediaUrl: string) => {
    toast({
      title: "Image uploaded",
      description: "The featured image has been successfully updated.",
    });

    // Refresh blog data
    queryClient.invalidateQueries({ queryKey: [`/api/blogs/${blogId}`] });
  };

  if (isBlogLoading) {
    return (
      <AdminLayout title="Edit Blog" description="Edit blog post">
        <div className="flex items-center justify-center h-64">
          <Loader className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading blog data...</span>
        </div>
      </AdminLayout>
    );
  }

  if (blogError || !blog) {
    return (
      <AdminLayout
        title="Blog Not Found"
        description="Could not find the requested blog post"
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">
              Blog Not Found
            </h1>
            <Button variant="outline" onClick={() => navigate("/admin/blogs")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Blogs
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Error</CardTitle>
              <CardDescription>
                The blog post you are looking for could not be found or there
                was an error loading it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Please check that the blog ID is correct and try again.</p>
              <Button className="mt-4" onClick={() => navigate("/admin/blogs")}>
                Return to Blogs
              </Button>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={`Edit Blog: ${blog.title}`}
      description="Edit blog post"
    >
      <div className="space-y-6">
        <AdminBreadcrumbs
          items={[
            { label: "Blogs", href: "/admin/blogs" },
            { label: "Edit" },
          ]}
        />
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Edit Blog</h1>
          <Button variant="outline" onClick={() => navigate("/admin/blogs")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Blogs
          </Button>
        </div>

        {/* Pillar cluster cohort panel — visible only when this blog is a
            promoted pillar. Surfaces all cluster posts that link back to it
            so the editor can monitor coverage and click through to edit them. */}
        {blog?.isPillar && cluster && (
          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500 text-white">
                      PILLAR
                    </span>
                    Topical-Authority Anchor
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {cluster.counts.total} cluster post{cluster.counts.total === 1 ? "" : "s"}
                    {" · "}
                    {cluster.counts.published} live, {cluster.counts.draft} draft, {cluster.counts.scheduled} scheduled
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {cluster.clusters.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No cluster posts yet. Click "Promote to Pillar" again from
                  the blog list to seed more cluster drafts based on related
                  studies in this category.
                </p>
              ) : (
                <ul className="divide-y -mx-2">
                  {cluster.clusters.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-3 py-2 px-2 text-sm hover:bg-amber-100/40 rounded"
                    >
                      <a
                        href={`/admin/blogs/edit/${c.id}`}
                        className="flex-1 min-w-0 truncate hover:underline"
                        title={c.title}
                      >
                        {c.title}
                      </a>
                      <div className="flex items-center gap-2 shrink-0">
                        {c.articleType && (
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground border rounded px-1 py-0.5">
                            {c.articleType}
                          </span>
                        )}
                        <span
                          className={`text-[11px] font-medium ${
                            c.isPublished
                              ? "text-green-700"
                              : c.scheduledFor
                              ? "text-blue-700"
                              : "text-muted-foreground"
                          }`}
                        >
                          {c.isPublished
                            ? "Published"
                            : c.scheduledFor
                            ? "Scheduled"
                            : "Draft"}
                        </span>
                        {typeof c.viewCount === "number" && c.viewCount > 0 && (
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {c.viewCount.toLocaleString()} view{c.viewCount === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {/* GSC performance card — collapses (renders nothing) when there's
            no GSC data for this URL yet, which is the common case for any
            blog less than ~2 weeks old. Once data arrives, shows 30-day
            totals + the top queries this page actually ranks for. */}
        {gscMetrics && (gscMetrics.trend?.length ?? 0) > 0 && (() => {
          const totals = gscMetrics.trend.reduce(
            (acc, r) => {
              acc.impressions += Number(r.impressions) || 0;
              acc.clicks += Number(r.clicks) || 0;
              acc.positionSum += Number(r.avg_position) || 0;
              acc.days += 1;
              return acc;
            },
            { impressions: 0, clicks: 0, positionSum: 0, days: 0 },
          );
          const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
          const avgPosition = totals.days > 0 ? totals.positionSum / totals.days : 0;
          return (
            <Card className="mb-6 border-emerald-200 bg-emerald-50/40">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-700" />
                  <CardTitle className="text-base">GSC performance — last 30 days</CardTitle>
                </div>
                <CardDescription>
                  Search Console data for <code className="font-mono text-xs">/blog/{blog?.slug}</code>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Impressions</div>
                    <div className="text-lg font-semibold tabular-nums">{totals.impressions.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Clicks</div>
                    <div className="text-lg font-semibold tabular-nums">{totals.clicks.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">CTR</div>
                    <div className="text-lg font-semibold tabular-nums">{(ctr * 100).toFixed(2)}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Avg position</div>
                    <div className="text-lg font-semibold tabular-nums">{avgPosition.toFixed(1)}</div>
                  </div>
                </div>
                {gscMetrics.topQueries && gscMetrics.topQueries.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Search className="h-3 w-3" />
                      Top queries
                    </div>
                    <ul className="space-y-1">
                      {gscMetrics.topQueries.slice(0, 5).map((q, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate flex-1" title={q.query}>{q.query}</span>
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                            {Number(q.impressions).toLocaleString()} impr · pos {Number(q.avg_position).toFixed(1)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Blog Details</CardTitle>
                <CardDescription>
                  Edit the basic information for your blog post
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* AI Content Suggestions Component */}
                <BlogContentSuggestions
                  blogId={blogId}
                  onSuggestionApply={(suggestion) => {
                    if (suggestion.length < 50) {
                      // Likely a title suggestion
                      setBlogData({
                        ...blogData,
                        title: suggestion,
                      });
                      toast({
                        title: "Title Updated",
                        description:
                          "The AI-suggested title has been applied to your blog.",
                      });
                    } else {
                      // Content suggestion
                      setBlogData({
                        ...blogData,
                        content: suggestion,
                      });
                      toast({
                        title: "Content Updated",
                        description:
                          "The AI-suggested content has been applied to your blog.",
                      });
                    }
                  }}
                />

                <div className="space-y-2">
                  <Label htmlFor="title">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    name="title"
                    value={blogData.title}
                    onChange={handleInputChange}
                    placeholder="Enter blog title"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">
                    URL Slug <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">
                      /blog/
                    </span>
                    <Input
                      id="slug"
                      name="slug"
                      value={blogData.slug}
                      onChange={handleInputChange}
                      placeholder="enter-url-slug"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This will be used in the URL of your blog post
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="summary">
                    Summary <span className="text-destructive">*</span>
                  </Label>
                  <WysiwygEditor
                    id="summary"
                    name="summary"
                    value={blogData.summary}
                    onChange={(value) => handleRichTextChange("summary", value)}
                    placeholder="Enter a brief summary of the blog post"
                    height="150px"
                    required
                    description="A short summary that will appear in blog lists and search results"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="articleType">Article Type</Label>
                    <Select
                      value={blogData.articleType}
                      onValueChange={(value) =>
                        handleSelectChange("articleType", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select article type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual Article</SelectItem>
                        <SelectItem value="summary">Summary</SelectItem>
                        <SelectItem value="explainer">Explainer</SelectItem>
                        <SelectItem value="implications">
                          Health Implications
                        </SelectItem>
                        <SelectItem value="timeline">
                          Historical Context
                        </SelectItem>
                        <SelectItem value="elon">Elon Musk Style</SelectItem>
                        <SelectItem value="elon_simple">
                          Elon-Style Overview
                        </SelectItem>
                        <SelectItem value="elon_benefits">
                          Elon-Style Benefits
                        </SelectItem>
                        <SelectItem value="elon_future">
                          Elon-Style Future Impact
                        </SelectItem>
                        <SelectItem value="elon_faq">Elon-Style FAQ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="readingLevel">Reading Level</Label>
                    <Select
                      value={blogData.readingLevel}
                      onValueChange={(value) =>
                        handleSelectChange("readingLevel", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select reading level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6th">
                          6th Grade (Ages 11-12)
                        </SelectItem>
                        <SelectItem value="8th">
                          8th Grade (Ages 13-14)
                        </SelectItem>
                        <SelectItem value="10th">
                          10th Grade (Ages 15-16)
                        </SelectItem>
                        <SelectItem value="12th">
                          12th Grade (Ages 17-18)
                        </SelectItem>
                        <SelectItem value="college">College</SelectItem>
                        <SelectItem value="general">
                          General audience
                        </SelectItem>
                        <SelectItem value="academic">Academic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="studyId">Related Study</Label>
                  <Select
                    value={blogData.studyId.toString()}
                    onValueChange={(value) =>
                      handleSelectChange("studyId", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select related study" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(studies) &&
                        studies.map((study: any) => (
                          <SelectItem
                            key={study.id}
                            value={study.id.toString()}
                          >
                            {study.title}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The study this blog post is related to
                  </p>
                </div>

                <div className="pt-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isPublished"
                      checked={blogData.isPublished}
                      onCheckedChange={(checked) =>
                        handleToggleChange("isPublished", checked)
                      }
                    />
                    <Label htmlFor="isPublished">Published</Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    When enabled, this blog post will be visible to the
                    public
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Blog Content</CardTitle>
                <CardDescription>
                  Edit the content for your blog post
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="content">Content</TabsTrigger>
                    <TabsTrigger value="notes">Editor Notes</TabsTrigger>
                  </TabsList>

                  <TabsContent value="content" className="space-y-4 pt-4">
                    <WysiwygEditor
                      id="content"
                      name="content"
                      label="Content"
                      value={blogData.content}
                      onChange={(value) =>
                        handleRichTextChange("content", value)
                      }
                      placeholder="Enter the full content of your blog post"
                      height="400px"
                      required
                      description="Use the toolbar above to format your content"
                    />
                  </TabsContent>

                  <TabsContent value="notes" className="space-y-4 pt-4">
                    <WysiwygEditor
                      id="editorNotes"
                      name="editorNotes"
                      label="Editor Notes"
                      value={blogData.editorNotes}
                      onChange={(value) =>
                        handleRichTextChange("editorNotes", value)
                      }
                      placeholder="Internal notes, sources, or review comments"
                      height="250px"
                      description="These notes are only visible to editors and not shown publicly"
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Featured Image</CardTitle>
                <CardDescription>
                  Update or generate a featured image for this blog post
                </CardDescription>
              </CardHeader>
              <CardContent>
                {blog.imageUrl ? (
                  <div className="mb-4">
                    <p className="text-sm mb-2">Current Featured Image:</p>
                    <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-lg border">
                      <img
                        src={blog.imageUrl}
                        alt={blog.imageAlt || blog.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {blog.imageAlt || "No alt text provided for this image"}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mb-4">
                    This blog post doesn't have a featured image yet. Upload
                    or generate one below.
                  </p>
                )}

                <Tabs defaultValue="upload" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upload">Upload Image</TabsTrigger>
                    <TabsTrigger value="generate">Generate with AI</TabsTrigger>
                  </TabsList>

                  <TabsContent value="upload" className="space-y-4 pt-4">
                    <MediaUpload
                      entityId={blogId}
                      entityType="blog"
                      onSuccess={handleImageUploadSuccess}
                    />
                  </TabsContent>

                  <TabsContent value="generate" className="space-y-4 pt-4">
                    <BlogImageGenerator
                      blogId={blogId}
                      onSuccess={(imageUrl, imageAlt) => {
                        toast({
                          title: "Image generated",
                          description:
                            "AI has created a featured image based on your blog content.",
                        });
                        // Refresh blog data
                        queryClient.invalidateQueries({
                          queryKey: [`/api/blogs/${blogId}`],
                        });
                      }}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/admin/blogs")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="px-6">
                {isSubmitting ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <FileEdit className="mr-2 h-4 w-4" />
                    Update Blog
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
