import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, truncateText } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Newspaper, FileText, ArrowRight, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/components/auth/ProtectedRoute";

interface RelatedBlogsProps {
  studyId: number;
}

export default function RelatedBlogs({ studyId }: RelatedBlogsProps) {
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch blog articles for the study
  const {
    data: blogs = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: [`/api/studies/${studyId}/blogs`],
    enabled: !!studyId,
  });

  // Mutation to generate blog articles
  const generateMutation = useMutation({
    mutationFn: () => {
      return apiRequest("POST", `/api/studies/${studyId}/generate-blogs`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/studies/${studyId}/blogs`],
      });
    },
  });

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Related Articles</h2>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load related articles. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  // If no blogs exist yet, show generate button for admin only
  if (!blogs || !Array.isArray(blogs) || blogs.length === 0) {
    if (!isAdmin) return null;
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Related Articles</CardTitle>
          <CardDescription>
            Generate scientific articles explaining this research in simple
            terms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <Newspaper className="h-16 w-16 text-neutral-300 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Articles Yet</h3>
            <p className="text-neutral-500 mb-6 max-w-md">
              Our AI can generate multiple articles about this study, explaining
              the research in simple, readable language.
            </p>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Articles...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Articles
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group blogs by type
  const blogsByType = Array.isArray(blogs)
    ? blogs.reduce((acc: Record<string, any>, blog: any) => {
        const type = blog.readingLevel || "general";
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(blog);
        return acc;
      }, {})
    : {};

  return (
    <div className="mb-8 space-y-4">
      <h2 className="text-2xl font-bold flex items-center">
        <Newspaper className="h-5 w-5 mr-2" />
        Related Articles
      </h2>

      {Array.isArray(blogs) && blogs.length > 0 && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            {blogs.map((blog: any) => (
              <TabsTrigger
                key={blog.id}
                value={blog.slug?.split("-")[0] || "tab"}
              >
                {blog.title?.split(":")[0] || "Article"}
              </TabsTrigger>
            ))}
          </TabsList>

          {blogs.map((blog: any) => (
            <TabsContent
              key={blog.id}
              value={blog.slug?.split("-")[0] || "tab"}
            >
              <Card>
                <CardHeader>
                  <CardTitle>{blog.title || "Untitled Article"}</CardTitle>
                  <CardDescription>
                    Posted{" "}
                    {blog.createdAt ? formatDate(blog.createdAt) : "recently"} •{" "}
                    {blog.viewCount || 0} views
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row gap-6">
                    {blog.imageUrl && (
                      <div className="md:w-1/3">
                        <img
                          src={blog.imageUrl}
                          alt={blog.imageAlt || "Blog illustration"}
                          loading="lazy"
                          decoding="async"
                          className="rounded-md w-full h-auto object-cover max-h-64"
                        />
                      </div>
                    )}
                    <div className={blog.imageUrl ? "md:w-2/3" : "w-full"}>
                      <p className="text-neutral-700 font-medium mb-2">
                        {blog.summary ||
                          "A scientific explanation of this hydrogen study."}
                      </p>
                      <div className="text-neutral-600 mb-4">
                        {blog.content
                          ? truncateText(
                              blog.content.replace(/#|_|\*/g, ""),
                              300,
                            ) + "..."
                          : "Read this article to learn more about the study and its implications for hydrogen research."}
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Link to={`/blog/${blog.id}/${blog.slug || "article"}`}>
                    <Button variant="outline">
                      Read Full Article
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
