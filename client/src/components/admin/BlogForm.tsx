import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Save } from "lucide-react";
import { MediaUpload } from "@/components/common/MediaUpload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Blog form schema
const blogSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  summary: z.string().min(10, "Summary must be at least 10 characters"),
  content: z.string().min(50, "Content must be at least 50 characters"),
  studyId: z.number().min(1, "Please select a study"),
  readingLevel: z.string().default("general"),
  slug: z.string().min(3, "Slug must be at least 3 characters")
    .regex(/^[a-z0-9]+([a-z0-9-]*[a-z0-9]+)*$/, "Slug must start and end with letters/numbers, and only contain lowercase letters, numbers, and hyphens"),
  isPublished: z.boolean().default(false),
  editorNotes: z.string().optional(),
  articleType: z.string().optional()
});

type BlogFormValues = z.infer<typeof blogSchema>;

interface BlogFormProps {
  blogId?: number;
  onSuccess?: () => void;
}

export default function BlogForm({ blogId, onSuccess }: BlogFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdBlogId, setCreatedBlogId] = useState<number | undefined>(blogId);
  
  // Fetch studies for dropdown
  const { data: studies = [] } = useQuery({
    queryKey: ['/api/studies'],
    staleTime: 300000, // 5 minutes
  });
  
  // If editing, fetch blog data
  const { data: blogData } = useQuery({
    queryKey: [`/api/blogs/${blogId}`],
    enabled: !!blogId,
  });
  
  // Initialize form with default values or existing blog data
  const form = useForm<BlogFormValues>({
    resolver: zodResolver(blogSchema),
    defaultValues: {
      title: blogData?.title || "",
      summary: blogData?.summary || "",
      content: blogData?.content || "",
      studyId: blogData?.studyId || 0,
      readingLevel: blogData?.readingLevel || "general",
      slug: blogData?.slug || "",
      isPublished: blogData?.isPublished || false,
      editorNotes: blogData?.editorNotes || "",
      articleType: blogData?.articleType || ""
    },
    values: blogData
  });
  
  // Create slug from title
  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Remove duplicate hyphens
      .trim();
  };
  
  // Update slug when title changes
  const watchTitle = form.watch("title");
  useState(() => {
    // Only update slug if it's empty or hasn't been manually edited
    if (!form.getValues("slug") || form.getValues("slug") === generateSlug(form.getValues("title").slice(0, -1))) {
      form.setValue("slug", generateSlug(watchTitle));
    }
  });
  
  // Create/Update blog mutation
  const blogMutation = useMutation({
    mutationFn: async (data: BlogFormValues) => {
      if (blogId) {
        // Update existing blog
        const response = await apiRequest("PUT", `/api/blogs/${blogId}`, data);
        return response.json();
      } else {
        // Create new blog
        const response = await apiRequest("POST", "/api/blogs", data);
        return response.json();
      }
    },
    onSuccess: (data) => {
      toast({
        title: blogId ? "Blog updated" : "Blog created",
        description: blogId 
          ? "The blog article was successfully updated" 
          : "The blog article was successfully created",
      });
      
      // Save the created blog ID for the media upload section
      if (!blogId && data && data.id) {
        setCreatedBlogId(data.id);
      }
      
      // Invalidate blogs queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/blogs'] });
      
      // Reset form if creating new blog
      if (!blogId) {
        form.reset({
          title: "",
          summary: "",
          content: "",
          studyId: 0,
          readingLevel: "general",
          slug: "",
          isPublished: false,
          editorNotes: "",
          articleType: ""
        });
      }
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save blog article",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    }
  });
  
  // Form submission handler
  const onSubmit = (values: BlogFormValues) => {
    setIsSubmitting(true);
    blogMutation.mutate(values);
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Title */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Blog Title</FormLabel>
                <FormControl>
                  <Input placeholder="Enter blog title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Slug */}
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>URL Slug</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="url-friendly-slug" 
                    {...field} 
                    value={field.value || ""}
                  />
                </FormControl>
                <FormDescription>
                  The URL-friendly version of the title. Automatically generated but you can edit it.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Related Study */}
          <FormField
            control={form.control}
            name="studyId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Related Study</FormLabel>
                <Select 
                  onValueChange={(value) => field.onChange(parseInt(value))} 
                  value={field.value ? field.value.toString() : ""}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select related study" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {studies.map((study: any) => (
                      <SelectItem key={study.id} value={study.id.toString()}>
                        {study.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Reading Level */}
          <FormField
            control={form.control}
            name="readingLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reading Level</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select reading level" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="elementary">Elementary (Grades 1-5)</SelectItem>
                    <SelectItem value="middle">Middle School (Grades 6-8)</SelectItem>
                    <SelectItem value="high">High School (Grades 9-12)</SelectItem>
                    <SelectItem value="general">General Audience</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="academic">Academic</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Summary */}
          <FormField
            control={form.control}
            name="summary"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Summary</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Brief summary of the blog article" 
                    className="min-h-[100px]" 
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Content */}
          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Content</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Main content of the blog article" 
                    className="min-h-[300px]" 
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Article Type */}
          <FormField
            control={form.control}
            name="articleType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Article Type</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select article type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="overview">Overview</SelectItem>
                    <SelectItem value="practical_application">Practical Application</SelectItem>
                    <SelectItem value="comparison">Comparison</SelectItem>
                    <SelectItem value="elon_simple">Elon-Style Overview</SelectItem>
                    <SelectItem value="elon_benefits">Elon-Style Benefits</SelectItem>
                    <SelectItem value="elon_future">Elon-Style Future Impact</SelectItem>
                    <SelectItem value="elon_faq">Elon-Style FAQ</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  The type of article helps define its focus and style
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Editor Notes */}
          <FormField
            control={form.control}
            name="editorNotes"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Editor Notes</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Notes for editors about this article" 
                    className="min-h-[100px]" 
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Private notes about the article that won't be displayed publicly
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Published Status */}
          <FormField
            control={form.control}
            name="isPublished"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>
                    Published
                  </FormLabel>
                  <FormDescription>
                    When checked, this article will be visible to the public
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        </div>
        
        {/* Submit Button */}
        <Button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full md:w-auto"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {blogId ? "Updating..." : "Creating..."}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {blogId ? "Update Blog" : "Create Blog"}
            </>
          )}
        </Button>
      </form>
      
      {/* Media Upload Section - Only shown after blog is created or when editing */}
      {createdBlogId && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Featured Image</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Upload a featured image for this blog article. This image will be displayed at the top of the article and in article listings.
            </p>
            
            <MediaUpload 
              entityId={createdBlogId} 
              entityType="blog"
              onSuccess={(mediaUrl) => {
                toast({
                  title: "Image uploaded",
                  description: "The image has been successfully uploaded and set as the featured image for this blog article."
                });
                queryClient.invalidateQueries({ queryKey: [`/api/blogs/${createdBlogId}`] });
              }}
            />
          </CardContent>
        </Card>
      )}
    </Form>
  );
}