import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import WYSIWYGEditor from "./WYSIWYGEditor";
import {
  insertBlogArticleSchema,
  type InsertBlogArticle,
} from "@shared/schema";
import { z } from "zod";
import {
  Save,
  Eye,
  Globe,
  FileText,
  Target,
  Image as ImageIcon,
  Link as LinkIcon,
  Calendar,
  Users,
  BookOpen,
  Sparkles,
  Heart,
  Zap,
  Loader2,
  Search,
  Plus,
} from "lucide-react";

// Extended schema for the blog form
// Note: Using 'as any' due to drizzle-zod generating Zod v3 types while zod@3.25+ uses v4 internals
const blogFormSchema = (insertBlogArticleSchema as any).extend({
  studyTitle: z.string().optional(),
});

type BlogFormData = Record<string, any>;

interface BlogEditorProps {
  blogId?: number;
  initialData?: Partial<BlogFormData>;
  onSave?: (blog: any) => void;
  onCancel?: () => void;
  mode?: "create" | "edit";
  preselectedStudyId?: number;
}

const BlogEditor: React.FC<BlogEditorProps> = ({
  blogId,
  initialData,
  onSave,
  onCancel,
  mode = "create",
  preselectedStudyId,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previewMode, setPreviewMode] = useState(false);
  const [activeTab, setActiveTab] = useState("content");
  const [studySearchQuery, setStudySearchQuery] = useState("");

  // Fetch studies for linking
  const { data: studies = [] } = useQuery({
    queryKey: ["/api/studies"],
    select: (data: any[]) =>
      data.map((study) => ({
        id: study.id,
        title: study.title,
        category: study.category,
        authors: study.authors,
      })),
  });

  const form = useForm<BlogFormData>({
    resolver: zodResolver(blogFormSchema as any),
    defaultValues: {
      studyId: preselectedStudyId || 0,
      title: "",
      slug: "",
      summary: "",
      content: "",
      quickInsights: "",
      imageUrl: "",
      imageAlt: "",
      readingLevel: "general",
      articleType: "general",
      isPublished: false,
      editorNotes: "",
      ...initialData,
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: BlogFormData) => {
      const endpoint = blogId
        ? `/api/blogs/${blogId}`
        : "/api/blogs";
      const method = blogId ? "PUT" : "POST";
      return apiRequest(method, endpoint, data);
    },
    onSuccess: (data) => {
      toast({
        title: `Blog ${mode === "create" ? "created" : "updated"} successfully`,
        description: `The blog post has been ${mode === "create" ? "created" : "updated"} and saved.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/blogs"] });
      onSave?.(data);
    },
    onError: (error: any) => {
      toast({
        title: `Failed to ${mode === "create" ? "create" : "update"} blog`,
        description:
          error.message || "An error occurred while saving the blog post.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: BlogFormData) => {
    saveMutation.mutate(data);
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  };

  const handleTitleChange = (title: string) => {
    form.setValue("title", title);
    if (!form.getValues("slug")) {
      form.setValue("slug", generateSlug(title));
    }
  };

  const filteredStudies = studies.filter(
    (study) =>
      study.title.toLowerCase().includes(studySearchQuery.toLowerCase()) ||
      study.category.toLowerCase().includes(studySearchQuery.toLowerCase()) ||
      study.authors.toLowerCase().includes(studySearchQuery.toLowerCase()),
  );

  const selectedStudy = studies.find(
    (study) => study.id === form.watch("studyId"),
  );

  const readingLevels = [
    { value: "beginner", label: "Beginner" },
    { value: "general", label: "General" },
    { value: "intermediate", label: "Intermediate" },
    { value: "advanced", label: "Advanced" },
    { value: "expert", label: "Expert" },
  ];

  const articleTypes = [
    { value: "general", label: "General Article" },
    { value: "research_summary", label: "Research Summary" },
    { value: "case_study", label: "Case Study" },
    { value: "how_to", label: "How-To Guide" },
    { value: "comparison", label: "Comparison" },
    { value: "news", label: "News" },
    { value: "opinion", label: "Opinion" },
    { value: "interview", label: "Interview" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {mode === "create" ? "Create New Blog Post" : "Edit Blog Post"}
          </h1>
          <p className="text-gray-600 mt-1">
            {mode === "create"
              ? "Write and publish a new blog article"
              : "Modify the blog post content and settings"}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPreviewMode(!previewMode)}
            className="flex items-center"
          >
            <Eye className="h-4 w-4 mr-2" />
            {previewMode ? "Edit" : "Preview"}
          </Button>

          <Button
            type="button"
            onClick={() => handleSubmit(form.getValues())}
            disabled={saveMutation.isPending}
            className="flex items-center"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {mode === "create" ? "Create Blog" : "Save Changes"}
          </Button>

          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Globe className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Status:</span>
                <Badge
                  variant={form.watch("isPublished") ? "default" : "secondary"}
                >
                  {form.watch("isPublished") ? "Published" : "Draft"}
                </Badge>
              </div>

              <div className="flex items-center space-x-2">
                <BookOpen className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Reading Level:</span>
                <Badge variant="outline">
                  {readingLevels.find(
                    (level) => level.value === form.watch("readingLevel"),
                  )?.label || "General"}
                </Badge>
              </div>

              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Type:</span>
                <Badge variant="outline">
                  {articleTypes.find(
                    (type) => type.value === form.watch("articleType"),
                  )?.label || "General Article"}
                </Badge>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Switch
                checked={form.watch("isPublished") ?? false}
                onCheckedChange={(checked) =>
                  form.setValue("isPublished", checked)
                }
              />
              <Label className="text-sm">Published</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Editor */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="content" className="flex items-center">
            <FileText className="h-4 w-4 mr-2" />
            Content
          </TabsTrigger>
          <TabsTrigger value="study" className="flex items-center">
            <LinkIcon className="h-4 w-4 mr-2" />
            Linked Study
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center">
            <Sparkles className="h-4 w-4 mr-2" />
            Insights
          </TabsTrigger>
          <TabsTrigger value="seo" className="flex items-center">
            <Target className="h-4 w-4 mr-2" />
            SEO
          </TabsTrigger>
          <TabsTrigger value="media" className="flex items-center">
            <ImageIcon className="h-4 w-4 mr-2" />
            Media
          </TabsTrigger>
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Blog Content
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Blog Title *</Label>
                  <Input
                    id="title"
                    placeholder="Enter an engaging blog title"
                    value={form.watch("title")}
                    onChange={(e) => handleTitleChange(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">URL Slug</Label>
                  <Input
                    id="slug"
                    placeholder="url-friendly-slug"
                    value={form.watch("slug")}
                    onChange={(e) => form.setValue("slug", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="readingLevel">Reading Level</Label>
                  <Select
                    value={form.watch("readingLevel") ?? undefined}
                    onValueChange={(value) =>
                      form.setValue("readingLevel", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select reading level" />
                    </SelectTrigger>
                    <SelectContent>
                      {readingLevels.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="articleType">Article Type</Label>
                  <Select
                    value={form.watch("articleType") ?? undefined}
                    onValueChange={(value) =>
                      form.setValue("articleType", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select article type" />
                    </SelectTrigger>
                    <SelectContent>
                      {articleTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">Summary *</Label>
                <Textarea
                  id="summary"
                  placeholder="Write a compelling summary of the blog post..."
                  value={form.watch("summary")}
                  onChange={(e) => form.setValue("summary", e.target.value)}
                  rows={4}
                />
              </div>

              <WYSIWYGEditor
                label="Blog Content *"
                value={form.watch("content")}
                onChange={(value) => form.setValue("content", value)}
                placeholder="Start writing your blog post..."
                height="400px"
              />

              <div className="space-y-2">
                <Label htmlFor="editorNotes">Editor Notes</Label>
                <Textarea
                  id="editorNotes"
                  placeholder="Internal notes for editors (not visible to readers)"
                  value={form.watch("editorNotes") || ""}
                  onChange={(e) => form.setValue("editorNotes", e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Study Tab */}
        <TabsContent value="study" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <LinkIcon className="h-5 w-5 mr-2" />
                Linked Research Study
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="studySearch">Search for Study</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="studySearch"
                    placeholder="Search by title, category, or authors..."
                    value={studySearchQuery}
                    onChange={(e) => setStudySearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {studySearchQuery && (
                <div className="max-h-60 overflow-y-auto border rounded-md">
                  {filteredStudies.length > 0 ? (
                    <div className="p-2 space-y-2">
                      {filteredStudies.slice(0, 10).map((study) => (
                        <div
                          key={study.id}
                          className={`p-3 rounded-md cursor-pointer transition-colors ${
                            form.watch("studyId") === study.id
                              ? "bg-teal-50 border-teal-200 border"
                              : "bg-gray-50 hover:bg-gray-100"
                          }`}
                          onClick={() => {
                            form.setValue("studyId", study.id);
                            setStudySearchQuery("");
                          }}
                        >
                          <div className="font-medium text-sm">
                            {study.title}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {study.category} • {study.authors}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-gray-500">
                      No studies found matching your search
                    </div>
                  )}
                </div>
              )}

              {selectedStudy && (
                <Card className="bg-teal-50 border-teal-200">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm text-teal-900">
                        Selected Study
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => form.setValue("studyId", 0)}
                        className="text-teal-700 hover:text-teal-900"
                      >
                        Remove
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-sm font-medium text-teal-900">
                      {selectedStudy.title}
                    </div>
                    <div className="text-xs text-teal-700 mt-1">
                      {selectedStudy.category} • {selectedStudy.authors}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Sparkles className="h-5 w-5 mr-2" />
                Quick Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WYSIWYGEditor
                label="Quick Insights"
                value={form.watch("quickInsights") || ""}
                onChange={(value) => form.setValue("quickInsights", value)}
                placeholder="Add quick takeaways or key insights from the blog post..."
                height="300px"
                toolbar="basic"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEO Tab */}
        <TabsContent value="seo" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="h-5 w-5 mr-2" />
                SEO Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="seoTitle">SEO Title</Label>
                <Input
                  id="seoTitle"
                  placeholder="Optimized title for search engines"
                  value={form.watch("title")}
                  onChange={(e) => form.setValue("title", e.target.value)}
                />
                <p className="text-xs text-gray-600">
                  Recommended length: 50-60 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seoDescription">Meta Description</Label>
                <Textarea
                  id="seoDescription"
                  placeholder="Brief description for search results (150-160 characters)"
                  value={form.watch("summary")}
                  onChange={(e) => form.setValue("summary", e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-gray-600">
                  Current length: {form.watch("summary").length} characters
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Media Tab */}
        <TabsContent value="media" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ImageIcon className="h-5 w-5 mr-2" />
                Featured Image
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="imageUrl">Image URL</Label>
                  <Input
                    id="imageUrl"
                    placeholder="https://example.com/image.jpg"
                    value={form.watch("imageUrl") || ""}
                    onChange={(e) => form.setValue("imageUrl", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="imageAlt">Image Alt Text</Label>
                  <Input
                    id="imageAlt"
                    placeholder="Descriptive text for the image"
                    value={form.watch("imageAlt") || ""}
                    onChange={(e) => form.setValue("imageAlt", e.target.value)}
                  />
                </div>
              </div>

              {form.watch("imageUrl") && (
                <div className="mt-4">
                  <Label>Image Preview</Label>
                  <div className="mt-2 border rounded-md overflow-hidden">
                    <img
                      src={form.watch("imageUrl") || ""}
                      alt={form.watch("imageAlt") || "Preview"}
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BlogEditor;
