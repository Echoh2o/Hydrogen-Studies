import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import RelatedContent from "@/components/seo/RelatedContent";
import PageBreadcrumb from "@/components/seo/PageBreadcrumb";
import { StudyContextChart } from "@/components/blog/StudyContextChart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDate, formatAuthors } from "@/lib/utils";
import { ArrowLeft, Calendar, Eye, Share, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import React, { Component, type ReactNode } from "react";
import Markdown from "react-markdown";

// Error boundary for the entire blog page
class BlogErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error?: Error }> {
  state: { hasError: boolean; error?: Error } = { hasError: false };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <>
          <SiteHeader />
          <div className="max-w-4xl mx-auto px-4 py-8">
            <Alert variant="destructive">
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>
                This article couldn't be displayed. Please try refreshing the page.
                {this.state.error && (
                  <details className="mt-2 text-xs">
                    <summary>Error details</summary>
                    <pre className="mt-1 whitespace-pre-wrap">{this.state.error.message}</pre>
                  </details>
                )}
              </AlertDescription>
            </Alert>
            <div className="mt-4">
              <Link to="/blog">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Blog
                </Button>
              </Link>
            </div>
          </div>
          <Footer />
        </>
      );
    }
    return this.props.children;
  }
}

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
    semanticKeywords?: string[];
    /** Optional 11-char YouTube video ID. Renders an iframe below the hero. */
    youtubeEmbedId?: string | null;
}

function safeDateFormat(dateString: string | null | undefined): string {
  if (!dateString) return "";
  try {
    return formatDate(dateString);
  } catch {
    return "";
  }
}

function MarkdownContent({ content }: { content: string }) {
  try {
    return <Markdown>{content}</Markdown>;
  } catch {
    return (
      <div className="prose prose-neutral max-w-none whitespace-pre-wrap">
        {content}
      </div>
    );
  }
}

function BlogPageContent() {
  const params = useParams();
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
      <>
        <SiteHeader />
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
        <Footer />
      </>
    );
  }

  // Show error state
  if (error) {
    return (
      <>
        <SiteHeader />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Failed to load the article. Please try again later.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Link to="/blog">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Blog
              </Button>
            </Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // If blog not found
  if (!blog) {
    return (
      <>
        <SiteHeader />
        <div className="max-w-4xl mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Article Not Found</h1>
          <p className="text-neutral-600 mb-6">
            The article you're looking for doesn't exist or has been removed.
          </p>
          <Link to="/blog">
            <Button>Back to Blog</Button>
          </Link>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>{blog.title} | Hydrogen Studies Blog</title>
        <meta name="description" content={blog.summary} />
        <link rel="canonical" href={`https://hydrogenstudies.com/blog/${blog.slug || idOrSlug}`} />

        {/* Open Graph tags */}
        <meta property="og:title" content={blog.title} />
        <meta property="og:description" content={blog.summary} />
        {blog.imageUrl && <meta property="og:image" content={blog.imageUrl} />}
        <meta property="og:type" content="article" />
        {blog.createdAt && <meta property="article:published_time" content={blog.createdAt} />}

        {/* Twitter Card tags */}
        <meta name="twitter:card" content={blog.imageUrl ? "summary_large_image" : "summary"} />
        <meta name="twitter:title" content={blog.title} />
        <meta name="twitter:description" content={blog.summary} />
        {blog.imageUrl && <meta name="twitter:image" content={blog.imageUrl} />}

        {/* Keywords meta tag */}
        {blog.semanticKeywords?.length && <meta name="keywords" content={blog.semanticKeywords.join(", ")} />}

        {/* Schema.org markup for article */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: blog.title,
            description: blog.summary,
            image: blog.imageUrl || "",
            datePublished: blog.createdAt,
            dateModified: blog.createdAt,
            wordCount: Math.round((blog.content || "").split(/\s+/).length),
            ...(blog.semanticKeywords?.length ? { keywords: blog.semanticKeywords.join(", ") } : {}),
            articleSection: "Hydrogen Research",
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
              "@id": `https://hydrogenstudies.com/blog/${blog.slug || idOrSlug}`,
            },
          })}
        </script>

        {/* BreadcrumbList JSON-LD */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://hydrogenstudies.com/" },
              { "@type": "ListItem", position: 2, name: "Blog", item: "https://hydrogenstudies.com/blog" },
              { "@type": "ListItem", position: 3, name: blog.title },
            ],
          })}
        </script>
      </Helmet>

      <div className="bg-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Back button */}
          <div className="mb-6">
            <Link to={study ? (study.slug ? `/study/${study.slug}` : `/study/id/${study.id}`) : "/blog"}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {study ? "Back to Study" : "Back to Blog"}
              </Button>
            </Link>
          </div>

          <PageBreadcrumb items={[
            { label: "Home", href: "/" },
            { label: "Blog", href: "/blog" },
            { label: blog.title },
          ]} />

          {/* Category link */}
          {study?.category && (
            <div className="mb-4">
              <Link
                to={`/blog/category/${study.category.toLowerCase().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "")}`}
              >
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-teal-50 hover:border-teal-300 transition-colors"
                >
                  <Tag className="h-3 w-3 mr-1" />
                  {study.category}
                </Badge>
              </Link>
            </div>
          )}

          {/* Article header */}
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              {blog.title}
            </h1>
            <div className="flex items-center text-neutral-500 text-sm mb-6">
              {blog.createdAt && (
                <span className="flex items-center mr-4">
                  <Calendar className="h-4 w-4 mr-1" />
                  {safeDateFormat(blog.createdAt)}
                </span>
              )}
              <span className="flex items-center">
                <Eye className="h-4 w-4 mr-1" />
                {blog.viewCount || 0} views
              </span>
            </div>

            {/* Featured image */}
            <div className="mb-6">
              <img
                src={blog.imageUrl || "/images/fallback-study-image.svg"}
                alt={blog.imageAlt || "Article illustration"}
                className="w-full h-auto max-h-[400px] object-cover rounded-lg shadow-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/images/fallback-study-image.svg";
                }}
              />
            </div>

            {/* Article summary */}
            {blog.summary && (
              <div className="bg-neutral-50 p-4 rounded-md border border-neutral-200 mb-6">
                <p className="text-neutral-700 font-medium italic">
                  {blog.summary}
                </p>
              </div>
            )}
          </header>

          {/* Optional YouTube embed — sits between the header and the
              article body so it acts as visual depth without disrupting
              the reading flow. Only renders when an editor has curated
              one (Phase C deliberately rejects AI-generated video). */}
          {blog.youtubeEmbedId && /^[A-Za-z0-9_-]{11}$/.test(blog.youtubeEmbedId) && (
            <div className="mb-8 aspect-video w-full overflow-hidden rounded-lg border bg-neutral-100">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${blog.youtubeEmbedId}`}
                title={`Video: ${blog.title}`}
                loading="lazy"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          )}

          {/* Phase C visual depth — at-a-glance stats + category research
              velocity. Self-hides when the underlying data is missing. */}
          <StudyContextChart blogId={blog.id} />

          {/* Article content */}
          <article className="prose prose-neutral max-w-none mb-8">
            <MarkdownContent content={blog.content || ""} />
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
                {study.authors && (
                  <p className="text-sm text-neutral-600 mb-2">
                    <strong>Authors:</strong> {formatAuthors(study.authors)}
                  </p>
                )}
                {study.publishDate && (
                  <p className="text-sm text-neutral-600 mb-3">
                    <strong>Published:</strong> {safeDateFormat(study.publishDate)} in{" "}
                    {study.journal}
                  </p>
                )}
                <Link to={study.slug ? `/study/${study.slug}` : `/study/id/${study.id}`}>
                  <Button size="sm">View Original Research</Button>
                </Link>
              </div>
            </div>
          )}

          {/* Topic tags as links */}
          {blog.semanticKeywords && blog.semanticKeywords.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {blog.semanticKeywords.slice(0, 8).map((keyword: string) => {
                const tagSlug = keyword.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-");
                return (
                  <Link key={keyword} to={`/blog/category/${tagSlug}`}>
                    <span className="inline-block px-3 py-1 bg-neutral-100 hover:bg-teal-50 text-neutral-700 hover:text-teal-700 text-sm rounded-full border border-neutral-200 hover:border-teal-200 transition-colors cursor-pointer">
                      {keyword}
                    </span>
                  </Link>
                );
              })}
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

          {/* Echo Water cross-link CTA */}
          <div className="bg-teal-50 border border-teal-100 rounded-lg p-6 my-8">
            <p className="text-sm font-medium text-teal-900 mb-2">
              Interested in hydrogen water?
            </p>
            <p className="text-sm text-teal-700 mb-3">
              Browse research-backed hydrogen water products from Echo Water.
            </p>
            <div className="flex gap-3">
              <a href="https://echowater.com" target="_blank" rel="noopener">
                <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white">
                  Shop Echo Water
                </Button>
              </a>
              <Link to="/products">
                <Button variant="outline" size="sm">
                  Compare Products
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Related Content from Internal Linking Engine */}
        {blog?.id && (
          <div className="max-w-4xl mx-auto px-4 py-8">
            <RelatedContent contentType="blog" contentId={blog.id} />
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}

export default function BlogPage() {
  return (
    <BlogErrorBoundary>
      <BlogPageContent />
    </BlogErrorBoundary>
  );
}
