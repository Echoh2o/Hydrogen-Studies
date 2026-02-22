import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { WysiwygEditor } from "@/components/ui/wysiwyg-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  ArrowLeft,
  Loader2,
  FileText,
  ImagePlus,
  Tag,
  Calendar,
  Link2,
  ArrowUpRight,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { MediaUpload } from "@/components/common/MediaUpload";
import { BlogImageGenerator } from "@/components/admin/BlogImageGenerator";
import { BlogContentSuggestions } from "@/components/admin/BlogContentSuggestions";
import { BlogRecommendationSystem } from "@/components/admin/BlogRecommendationSystem";

export default function BlogAddPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [blogData, setBlogData] = useState({
    title: "",
    slug: "",
    summary: "",
    content: "",
    readingLevel: "6th",
    articleType: "manual",
    studyId: 1, // Default to first study
    editorNotes: "",
    isPublished: false,
  });

  const [activeTab, setActiveTab] = useState("content");
  const [createdBlogId, setCreatedBlogId] = useState<number | null>(null);

  // Fetch studies for dropdown
  const { data: studies = [] } = useQuery({
    queryKey: ["/api/studies"],
    staleTime: 300000, // 5 minutes
  });

  // Function to generate slug from title
  const generateSlug = (title: string): string => {
    if (!title) return "";

    return (
      title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "") // Remove special characters except word chars, spaces, hyphens
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
        .replace(/[^a-z0-9-]/g, "") || // Ensure only lowercase letters, numbers, and hyphens
      "untitled-blog"
    ); // Fallback if empty
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

  // Handle select changes
  const handleSelectChange = (name: string, value: string | number) => {
    setBlogData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle checkbox/switch changes
  const handleToggleChange = (name: string, checked: boolean) => {
    setBlogData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  // Create blog mutation
  const createBlogMutation = useMutation({
    mutationFn: async () => {
      // Validate blog data before sending
      if (!blogData.title || blogData.title.length < 3) {
        throw new Error("Title must be at least 3 characters");
      }
      if (!blogData.slug || blogData.slug.length < 3) {
        throw new Error("Slug must be at least 3 characters");
      }
      if (!blogData.summary || blogData.summary.length < 10) {
        throw new Error("Summary must be at least 10 characters");
      }
      if (!blogData.content || blogData.content.length < 50) {
        throw new Error("Content must be at least 50 characters");
      }
      if (!blogData.studyId || blogData.studyId < 1) {
        throw new Error("Please select a study");
      }

      // Test slug pattern
      const slugPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
      if (!slugPattern.test(blogData.slug)) {
        throw new Error(
          "Slug must contain only lowercase letters, numbers, and hyphens (no leading/trailing hyphens)",
        );
      }

      const response = await apiRequest("POST", "/api/blogs", blogData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Blog article created",
        description:
          "The blog article was successfully created. You can now add a featured image.",
      });

      // Store the created blog ID to enable image upload section
      setCreatedBlogId(data.id);

      // Invalidate blogs queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/blogs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create blog article",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createBlogMutation.mutate();
  };

  return (
    <AdminLayout
      title="Add Manual Blog"
      description="Create a new blog article"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Add Manual Blog</h1>
          <Button variant="outline" onClick={() => navigate("/admin/blogs")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Blogs
          </Button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Blog Details</CardTitle>
                <CardDescription>
                  Enter the basic information for your blog article
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">
                    Title <span className="text-red-500">*</span>
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
                    URL Slug <span className="text-red-500">*</span>
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
                    This will be used in the URL of your blog article
                  </p>
                </div>

                {/* AI Blog Recommendation System */}
                <Card className="border-dashed border-2 border-primary/50 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      AI Blog Recommendations
                    </CardTitle>
                    <CardDescription>
                      Get AI-powered recommendations for high-impact blog
                      articles
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BlogRecommendationSystem />
                  </CardContent>
                </Card>

                <WysiwygEditor
                  id="summary"
                  name="summary"
                  label="Summary"
                  value={blogData.summary}
                  onChange={(value) =>
                    handleInputChange({
                      target: { name: "summary", value },
                    } as React.ChangeEvent<HTMLTextAreaElement>)
                  }
                  placeholder="Enter a brief summary of the blog article"
                  height="150px"
                  required
                  description="A short summary that will appear in blog lists and search results"
                />

                <div className="space-y-2">
                  <Label htmlFor="studyId">
                    Related Study <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={blogData.studyId.toString()}
                    onValueChange={(value) =>
                      handleSelectChange("studyId", parseInt(value))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a study" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(studies) &&
                        studies?.slice(0, 50)?.map((study: any) => (
                          <SelectItem
                            key={study.id}
                            value={study.id.toString()}
                          >
                            {study.title?.length > 60
                              ? `${study.title.substring(0, 60)}...`
                              : study.title}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose the study this blog article will be about
                  </p>
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
                        <SelectItem value="college">College Level</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                    <Label htmlFor="isPublished">Publish immediately</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Blog Content</CardTitle>
                <CardDescription>
                  Write the content for your blog article
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
                    {/* Content AI Suggestions */}
                    <Card className="border-dashed border-2 border-primary/50 bg-primary/5 mb-4">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          AI Content Generation
                        </CardTitle>
                        <CardDescription>
                          Use AI to generate or enhance your blog content
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          <Button
                            variant="outline"
                            className="flex justify-start items-center gap-2 text-sm"
                            disabled={!blogData.title}
                            onClick={async () => {
                              if (!blogData.title) {
                                toast({
                                  title: "Title Required",
                                  description:
                                    "Please add a title before generating content.",
                                  variant: "destructive",
                                });
                                return;
                              }
                              toast({
                                title: "Generating content...",
                                description:
                                  "AI is creating blog content based on your title.",
                              });
                              try {
                                const res = await apiRequest(
                                  "POST",
                                  "/api/blogs/generate-content",
                                  {
                                    title: blogData.title,
                                    studyId: blogData.studyId,
                                    articleType: blogData.articleType,
                                    readingLevel: blogData.readingLevel,
                                  },
                                );
                                const data = await res.json();
                                if (data.success) {
                                  setBlogData((prev) => ({
                                    ...prev,
                                    content: data.content,
                                    summary: data.summary || prev.summary,
                                  }));
                                  toast({
                                    title: "Content Generated",
                                    description:
                                      "AI has created content based on your blog title.",
                                  });
                                } else {
                                  throw new Error(data.error || "Generation failed");
                                }
                              } catch (err: any) {
                                toast({
                                  title: "Generation Failed",
                                  description:
                                    err.message || "Failed to generate content.",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            Generate Full Article
                          </Button>

                          <Button
                            variant="outline"
                            className="flex justify-start items-center gap-2 text-sm"
                            disabled={!blogData.content}
                            onClick={async () => {
                              if (!blogData.content) {
                                toast({
                                  title: "Content Required",
                                  description:
                                    "Please add some content before requesting improvements.",
                                  variant: "destructive",
                                });
                                return;
                              }
                              toast({
                                title: "Improving content...",
                                description: "AI is enhancing your content.",
                              });
                              try {
                                const res = await apiRequest(
                                  "POST",
                                  "/api/blogs/generate-content",
                                  {
                                    title: `Improve: ${blogData.title}`,
                                    studyId: blogData.studyId,
                                    articleType: blogData.articleType,
                                    readingLevel: blogData.readingLevel,
                                  },
                                );
                                const data = await res.json();
                                if (data.success) {
                                  setBlogData((prev) => ({
                                    ...prev,
                                    content: data.content,
                                  }));
                                  toast({
                                    title: "Content Improved",
                                    description:
                                      "AI has enhanced your existing content.",
                                  });
                                } else {
                                  throw new Error(data.error || "Improvement failed");
                                }
                              } catch (err: any) {
                                toast({
                                  title: "Improvement Failed",
                                  description:
                                    err.message || "Failed to improve content.",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            Improve Existing Content
                          </Button>

                          <Button
                            variant="outline"
                            className="flex justify-start items-center gap-2 text-sm"
                            disabled={!blogData.content}
                            onClick={async () => {
                              if (!blogData.content) {
                                toast({
                                  title: "Content Required",
                                  description:
                                    "Please add some content before simplifying.",
                                  variant: "destructive",
                                });
                                return;
                              }
                              toast({
                                title: "Simplifying content...",
                                description:
                                  "AI is making your content easier to understand.",
                              });
                              try {
                                const res = await apiRequest(
                                  "POST",
                                  "/api/blogs/generate-content",
                                  {
                                    title: blogData.title,
                                    studyId: blogData.studyId,
                                    articleType: blogData.articleType,
                                    readingLevel: "6th",
                                  },
                                );
                                const data = await res.json();
                                if (data.success) {
                                  setBlogData((prev) => ({
                                    ...prev,
                                    content: data.content,
                                    readingLevel: "6th",
                                  }));
                                  toast({
                                    title: "Reading Level Adjusted",
                                    description:
                                      "Content has been simplified to a 6th grade reading level.",
                                  });
                                } else {
                                  throw new Error(data.error || "Simplification failed");
                                }
                              } catch (err: any) {
                                toast({
                                  title: "Simplification Failed",
                                  description:
                                    err.message || "Failed to simplify content.",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            Simplify to 6th Grade Level
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <WysiwygEditor
                      id="content"
                      name="content"
                      label="Content"
                      value={blogData.content}
                      onChange={(value) =>
                        handleInputChange({
                          target: { name: "content", value },
                        } as React.ChangeEvent<HTMLTextAreaElement>)
                      }
                      placeholder="Enter the full content of your blog article"
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
                      value={blogData.editorNotes || ""}
                      onChange={(value) =>
                        handleInputChange({
                          target: { name: "editorNotes", value },
                        } as React.ChangeEvent<HTMLTextAreaElement>)
                      }
                      placeholder="Internal notes, sources, or review comments"
                      height="250px"
                      description="These notes are only visible to editors and not shown publicly"
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {createdBlogId && (
              <Card>
                <CardHeader>
                  <CardTitle>Featured Image</CardTitle>
                  <CardDescription>
                    Upload or generate a featured image for your blog article
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="upload" className="w-full mb-6">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="upload">Upload Image</TabsTrigger>
                      <TabsTrigger value="generate">
                        Generate with AI
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="upload" className="space-y-4 pt-4">
                      <MediaUpload
                        entityId={createdBlogId}
                        entityType="blog"
                        onSuccess={(mediaUrl) => {
                          toast({
                            title: "Image uploaded",
                            description:
                              "Featured image has been successfully uploaded.",
                          });
                          // Refresh data
                          queryClient.invalidateQueries({
                            queryKey: [`/api/blogs/${createdBlogId}`],
                          });
                        }}
                      />
                    </TabsContent>

                    <TabsContent value="generate" className="space-y-4 pt-4">
                      <BlogImageGenerator
                        blogId={createdBlogId}
                        onSuccess={(imageUrl, imageAlt) => {
                          toast({
                            title: "Image generated",
                            description:
                              "AI has created a featured image based on your blog content.",
                          });
                          // Refresh data
                          queryClient.invalidateQueries({
                            queryKey: [`/api/blogs/${createdBlogId}`],
                          });
                        }}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Save Blog Article</CardTitle>
                <CardDescription>
                  Save your blog article as a draft or publish it immediately
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  {createdBlogId
                    ? "Your blog has been created. You can now upload a featured image."
                    : "Images can be added after the blog article is created."}
                </p>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/admin/blogs")}
                >
                  Cancel
                </Button>
                <div className="flex space-x-2">
                  <Button type="submit" disabled={createBlogMutation.isPending}>
                    {createBlogMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Save Blog Article
                      </>
                    )}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
