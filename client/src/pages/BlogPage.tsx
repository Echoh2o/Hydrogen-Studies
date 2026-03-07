import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, Calendar, Eye, Share } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet";
import ReactMarkdown from "react-markdown";
import SiteHeader from "@/components/layout/SiteHeader";

interface BlogArticle {
    id: number;
    title: string;
    slug: string;
    summary: string;
    content: string;
    imageUrl?: string;
    imageAlt?: string;
    createdAt: string;
    viewCount?: number;
    studyId?: number;
}

export default function BlogPage() {
  const params = useParams();
  // Support both /blog/:id and /blog/:slug (via conditional logic or unifying route).
  // Wouter params might be { id: "slug-val" } if route is /blog/:id
  // But App.tsx has /blog/:id/:slug? and /blog/:id
  // Use a more robust check.
  
  const { toast } = useToast();
  const idOrSlug = params.id || params.slug;
  const isId = /^\d+$/.test(idOrSlug || "");

  // Fetch blog article
  const { data: blog, isLoading, error } = useQuery<BlogArticle>({
    queryKey: [`/api/blogs/${idOrSlug}`],
    queryFn: async () => {
        const endpoint = isId 
            ? `/api/blogs/${idOrSlug}` 
            : `/api/blogs/slug/${idOrSlug}`;
            
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error("Failed to fetch blog");
        return (await res.json()).data;
    },
    enabled: !!idOrSlug,
  });

  // Fetch related study
  const { data: study } = useQuery<any>({
    queryKey: [`/api/studies/${blog?.studyId}`],
    enabled: !!blog?.studyId,
  });

  // Show loading state
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Skeleton className="h-8 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2 mb-8" />
          <Skeleton className="h-64 w-full mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load the article. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // If blog not found
  if (!blog) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Article Not Found</h1>
        <p className="text-neutral-600 mb-6">
          The article you're looking for doesn't exist or has been removed.
        </p>
        <Link to="/">
          <Button>Return to Homepage</Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>{blog.title} | Hydrogen Studies Blog</title>
        <meta name="description" content={blog.summary} />

        {/* Schema.org markup for article */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: blog.title,
            description: blog.summary,
            image: blog.imageUrl || "",
            datePublished: blog.createdAt,
            author: {
              "@type": "Organization",
              name: "Hydrogen Studies Research",
            },
            publisher: {
              "@type": "Organization",
              name: "Hydrogen Studies Research",
              logo: {
                "@type": "ImageObject",
                url: "/logo.png",
              },
            },
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": window.location.href,
            },
          })}
        </script>
      </Helmet>

      <div className="bg-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Back button */}
          <div className="mb-6">
            <Link to={study ? (study.slug ? `/study/${study.slug}` : `/study/id/${study.id}`) : "/studies"}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {study ? "Back to Study" : "Back to Studies"}
              </Button>
            </Link>
          </div>

          {/* Article header */}
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              {blog.title}
            </h1>
            <div className="flex items-center text-neutral-500 text-sm mb-6">
              <span className="flex items-center mr-4">
                <Calendar className="h-4 w-4 mr-1" />
                {formatDate(blog.createdAt)}
              </span>
              <span className="flex items-center">
                <Eye className="h-4 w-4 mr-1" />
                {blog.viewCount || 0} views
              </span>
            </div>

            {/* Featured image */}
            {blog.imageUrl && (
              <div className="mb-6">
                <img
                  src={blog.imageUrl}
                  alt={blog.imageAlt || "Article illustration"}
                  className="w-full h-auto max-h-[400px] object-cover rounded-lg shadow-md"
                />
              </div>
            )}

            {/* Article summary */}
            <div className="bg-neutral-50 p-4 rounded-md border border-neutral-200 mb-6">
              <p className="text-neutral-700 font-medium italic">
                {blog.summary}
              </p>
            </div>
          </header>

          {/* Article content */}
          <article className="prose prose-neutral max-w-none mb-8">
            <ReactMarkdown>{blog.content}</ReactMarkdown>
          </article>

          {/* Related study box */}
          {study && (
            <div className="bg-teal-50 p-6 rounded-lg border border-teal-100 mb-8">
              <h3 className="text-xl font-semibold mb-2">
                Based on Scientific Research
              </h3>
              <p className="text-neutral-700 mb-4">
                This article is based on peer-reviewed scientific research:
              </p>
              <div className="bg-white p-4 rounded-md border border-teal-100">
                <h4 className="font-bold text-lg mb-1">{study.title}</h4>
                <p className="text-sm text-neutral-600 mb-2">
                  <strong>Authors:</strong> {study.authors}
                </p>
                <p className="text-sm text-neutral-600 mb-3">
                  <strong>Published:</strong> {formatDate(study.publishDate)} in{" "}
                  {study.journal}
                </p>
                <Link to={study.slug ? `/study/${study.slug}` : `/study/id/${study.id}`}>
                  <Button size="sm">View Original Research</Button>
                </Link>
              </div>
            </div>
          )}

          {/* Share section */}
          <div className="border-t border-b py-6 my-8">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Share this article</h3>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: blog.title,
                        text: blog.summary,
                        url: window.location.href,
                      });
                    } else {
                      navigator.clipboard.writeText(window.location.href);
                      toast({
                        title: "Link copied",
                        description: "Article link has been copied to your clipboard.",
                      });
                    }
                  }}
                >
                  <Share className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
