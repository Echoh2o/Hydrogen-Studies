import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { WysiwygEditor as WYSIWYGEditor } from "@/components/ui/wysiwyg-editor";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";
import { insertStudySchema, type InsertStudy } from "@shared/schema";
import { z } from "zod";
import {
  Save,
  Eye,
  FileText,
  Tags,
  Image as ImageIcon,
  Link,
  Calendar,
  Users,
  BookOpen,
  Target,
  Activity,
  Heart,
  Zap,
  Loader2,
} from "lucide-react";

// Extended schema for the form with all fields
// Note: Using 'as any' due to drizzle-zod generating Zod v3 types while zod@3.25+ uses v4 internals
const studyFormSchema = (insertStudySchema as any).extend({
  keywords: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  healthBenefits: z.array(z.string()).optional(),
  healthConditions: z.array(z.string()).optional(),
  bodySystems: z.array(z.string()).optional(),
  lifeStages: z.array(z.string()).optional(),
});

type StudyFormData = Record<string, any>;

interface StudyEditorProps {
  studyId?: number;
  initialData?: Partial<StudyFormData>;
  onSave?: (study: any) => void;
  onCancel?: () => void;
  mode?: "create" | "edit";
}

const StudyEditor: React.FC<StudyEditorProps> = ({
  studyId,
  initialData,
  onSave,
  onCancel,
  mode = "create",
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previewMode, setPreviewMode] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");

  const form = useForm<StudyFormData>({
    resolver: zodResolver(studyFormSchema as any),
    defaultValues: {
      title: "",
      abstract: "",
      authors: "",
      journal: "",
      publishDate: new Date().toISOString().split("T")[0],
      category: "",
      methods: "",
      results: "",
      conclusion: "",
      doi: "",
      url: "",
      pdfUrl: "",
      citationUrl: "",
      imageUrl: "",
      imageAlt: "",
      plainLanguageTitle: "",
      methodsShort: "",
      resultsShort: "",
      conclusionShort: "",
      metaTitle: "",
      metaDescription: "",
      slug: "",
      keywords: [],
      tags: [],
      healthBenefits: [],
      healthConditions: [],
      bodySystems: [],
      lifeStages: [],
      peerReviewed: true,
      ...initialData,
    },
  });

  // Warn before tab-close / reload if the user has unsaved edits.
  useUnsavedChangesWarning(form.formState.isDirty);

  const saveMutation = useMutation({
    mutationFn: async (data: StudyFormData) => {
      const endpoint = studyId ? `/api/studies/${studyId}` : "/api/studies";
      const method = studyId ? "PUT" : "POST";
      return apiRequest(method, endpoint, data);
    },
    onSuccess: (data) => {
      toast({
        title: `Study ${mode === "create" ? "created" : "updated"} successfully`,
        description: `The study has been ${mode === "create" ? "created" : "updated"} and saved.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      onSave?.(data);
    },
    onError: (error: any) => {
      toast({
        title: `Failed to ${mode === "create" ? "create" : "update"} study`,
        description:
          error.message || "An error occurred while saving the study.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: StudyFormData) => {
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
    if (!form.getValues("metaTitle")) {
      form.setValue("metaTitle", title);
    }
  };

  const keywordString = (form.watch("keywords") as string[] | undefined)?.join(", ") || "";
  const tagString = (form.watch("tags") as string[] | undefined)?.join(", ") || "";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {mode === "create" ? "Create New Study" : "Edit Study"}
          </h1>
          <p className="text-gray-600 mt-1">
            {mode === "create"
              ? "Add a new research study to the database"
              : "Modify the study details and content"}
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
            {mode === "create" ? "Create Study" : "Save Changes"}
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
              {form.watch("peerReviewed") && (
                <Badge
                  variant="outline"
                  className="border-green-200 text-green-800"
                >
                  Peer Reviewed
                </Badge>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <Switch
                checked={form.watch("peerReviewed") ?? true}
                onCheckedChange={(checked) =>
                  form.setValue("peerReviewed", checked)
                }
              />
              <Label className="text-sm">Peer Reviewed</Label>
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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="basic" className="flex items-center">
            <FileText className="h-4 w-4 mr-2" />
            Basic Info
          </TabsTrigger>
          <TabsTrigger value="content" className="flex items-center">
            <BookOpen className="h-4 w-4 mr-2" />
            Content
          </TabsTrigger>
          <TabsTrigger value="consumer" className="flex items-center">
            <Heart className="h-4 w-4 mr-2" />
            Consumer
          </TabsTrigger>
          <TabsTrigger value="categorization" className="flex items-center">
            <Tags className="h-4 w-4 mr-2" />
            Categories
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

        {/* Basic Information Tab */}
        <TabsContent value="basic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Basic Study Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Study Title *</Label>
                  <Input
                    id="title"
                    placeholder="Enter the study title"
                    value={form.watch("title")}
                    onChange={(e) => handleTitleChange(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Input
                    id="category"
                    placeholder="e.g., Clinical Trial, Research Study"
                    value={form.watch("category")}
                    onChange={(e) => form.setValue("category", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="authors">Authors *</Label>
                <Input
                  id="authors"
                  placeholder="Enter author names separated by commas"
                  value={form.watch("authors")}
                  onChange={(e) => form.setValue("authors", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="journal">Journal *</Label>
                  <Input
                    id="journal"
                    placeholder="Journal name"
                    value={form.watch("journal")}
                    onChange={(e) => form.setValue("journal", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="publishDate">Publish Date</Label>
                  <Input
                    id="publishDate"
                    type="date"
                    value={form.watch("publishDate")}
                    onChange={(e) =>
                      form.setValue("publishDate", e.target.value)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="doi">DOI</Label>
                  <Input
                    id="doi"
                    placeholder="10.1000/xyz123"
                    value={form.watch("doi") || ""}
                    onChange={(e) => form.setValue("doi", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <WYSIWYGEditor
                  label="Abstract *"
                  value={form.watch("abstract")}
                  onChange={(value) => form.setValue("abstract", value)}
                  placeholder="Enter the study abstract..."
                  height="200px"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BookOpen className="h-5 w-5 mr-2" />
                Study Content Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <WYSIWYGEditor
                label="Methods"
                value={form.watch("methods") || ""}
                onChange={(value) => form.setValue("methods", value)}
                placeholder="Describe the study methodology..."
                height="250px"
              />

              <WYSIWYGEditor
                label="Results"
                value={form.watch("results") || ""}
                onChange={(value) => form.setValue("results", value)}
                placeholder="Describe the study results..."
                height="250px"
              />

              <WYSIWYGEditor
                label="Conclusion"
                value={form.watch("conclusion") || ""}
                onChange={(value) => form.setValue("conclusion", value)}
                placeholder="Describe the study conclusion..."
                height="200px"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Consumer-Friendly Tab */}
        <TabsContent value="consumer" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Heart className="h-5 w-5 mr-2" />
                Consumer-Friendly Content
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="plainLanguageTitle">Plain Language Title</Label>
                <Input
                  id="plainLanguageTitle"
                  placeholder="A simplified version of the study title"
                  value={form.watch("plainLanguageTitle") || ""}
                  onChange={(e) =>
                    form.setValue("plainLanguageTitle", e.target.value)
                  }
                />
              </div>

              <WYSIWYGEditor
                label="Methods Summary"
                value={form.watch("methodsShort") || ""}
                onChange={(value) =>
                  form.setValue("methodsShort", value)
                }
                placeholder="Explain the study methods in simple terms..."
                height="200px"
              />

              <WYSIWYGEditor
                label="Results Summary"
                value={form.watch("resultsShort") || ""}
                onChange={(value) =>
                  form.setValue("resultsShort", value)
                }
                placeholder="Explain the study results in simple terms..."
                height="200px"
              />

              <WYSIWYGEditor
                label="Conclusion Summary"
                value={form.watch("conclusionShort") || ""}
                onChange={(value) =>
                  form.setValue("conclusionShort", value)
                }
                placeholder="Explain the study conclusion in simple terms..."
                height="200px"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categorization Tab */}
        <TabsContent value="categorization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Tags className="h-5 w-5 mr-2" />
                Study Categorization
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="keywords">Keywords</Label>
                  <Textarea
                    id="keywords"
                    placeholder="Enter keywords separated by commas"
                    value={keywordString}
                    onChange={(e) =>
                      form.setValue(
                        "keywords",
                        e.target.value
                          .split(",")
                          .map((k) => k.trim())
                          .filter((k) => k),
                      )
                    }
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">Tags</Label>
                  <Textarea
                    id="tags"
                    placeholder="Enter tags separated by commas"
                    value={tagString}
                    onChange={(e) =>
                      form.setValue(
                        "tags",
                        e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter((t) => t),
                      )
                    }
                    rows={3}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="healthBenefits">Health Benefits</Label>
                  <Textarea
                    id="healthBenefits"
                    placeholder="Enter health benefits separated by commas"
                    value={form.watch("healthBenefits")?.join(", ") || ""}
                    onChange={(e) =>
                      form.setValue(
                        "healthBenefits",
                        e.target.value
                          .split(",")
                          .map((b) => b.trim())
                          .filter((b) => b),
                      )
                    }
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="healthConditions">Health Conditions</Label>
                  <Textarea
                    id="healthConditions"
                    placeholder="Enter health conditions separated by commas"
                    value={form.watch("healthConditions")?.join(", ") || ""}
                    onChange={(e) =>
                      form.setValue(
                        "healthConditions",
                        e.target.value
                          .split(",")
                          .map((c) => c.trim())
                          .filter((c) => c),
                      )
                    }
                    rows={2}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEO Tab */}
        <TabsContent value="seo" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="h-5 w-5 mr-2" />
                SEO Optimization
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  placeholder="url-friendly-slug"
                  value={form.watch("slug") || ""}
                  onChange={(e) => form.setValue("slug", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="metaTitle">SEO Title</Label>
                <Input
                  id="metaTitle"
                  placeholder="Optimized title for search engines"
                  value={form.watch("metaTitle") || ""}
                  onChange={(e) => form.setValue("metaTitle", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="metaDescription">SEO Description</Label>
                <Textarea
                  id="metaDescription"
                  placeholder="Brief description for search results (150-160 characters)"
                  value={form.watch("metaDescription") || ""}
                  onChange={(e) =>
                    form.setValue("metaDescription", e.target.value)
                  }
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="semanticKeywords">SEO Keywords</Label>
                <Textarea
                  id="semanticKeywords"
                  placeholder="Enter SEO keywords separated by commas"
                  value={form.watch("semanticKeywords")?.join(", ") || ""}
                  onChange={(e) => form.setValue("semanticKeywords", e.target.value.split(",").map((k: string) => k.trim()).filter(Boolean))}
                  rows={2}
                />
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
                Media & Links
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

              <div className="space-y-2">
                <Label htmlFor="videoUrl">Video URL</Label>
                <Input
                  id="videoUrl"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={form.watch("videoUrl") || ""}
                  onChange={(e) => form.setValue("videoUrl", e.target.value)}
                />
                <p className="text-xs text-gray-500">YouTube or video link related to this study</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="url">Study URL</Label>
                  <Input
                    id="url"
                    placeholder="https://example.com/study"
                    value={form.watch("url") || ""}
                    onChange={(e) => form.setValue("url", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pdfUrl">PDF URL</Label>
                  <Input
                    id="pdfUrl"
                    placeholder="https://example.com/study.pdf"
                    value={form.watch("pdfUrl") || ""}
                    onChange={(e) => form.setValue("pdfUrl", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="citationUrl">Citation URL</Label>
                  <Input
                    id="citationUrl"
                    placeholder="https://example.com/citation"
                    value={form.watch("citationUrl") || ""}
                    onChange={(e) =>
                      form.setValue("citationUrl", e.target.value)
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudyEditor;
