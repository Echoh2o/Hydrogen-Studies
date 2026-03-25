import React from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import PageBreadcrumb from "@/components/seo/PageBreadcrumb";

/** Convert a slug like "anti-inflammatory" to "Anti Inflammatory" */
function slugToDisplayName(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Generate a short description based on category name */
function getCategoryDescription(name: string): string {
  const lower = name.toLowerCase();
  const descriptions: Record<string, string> = {
    cardiovascular:
      "Explore research articles on how molecular hydrogen may support heart health, blood pressure regulation, and cardiovascular function.",
    neurological:
      "Discover blog articles covering hydrogen therapy research related to brain health, neuroprotection, and neurological conditions.",
    "anti-inflammatory":
      "Read about the anti-inflammatory properties of molecular hydrogen and its potential applications in reducing chronic inflammation.",
    antioxidant:
      "Learn about hydrogen's role as a selective antioxidant, targeting harmful free radicals while preserving beneficial reactive oxygen species.",
    metabolic:
      "Articles on hydrogen therapy research related to metabolic health, diabetes, obesity, and energy metabolism.",
    respiratory:
      "Research insights on molecular hydrogen's effects on respiratory health and lung function.",
    gastrointestinal:
      "Explore studies on how hydrogen water and hydrogen therapy may benefit digestive health and gut function.",
    musculoskeletal:
      "Articles covering hydrogen research related to bone health, joint function, and muscle recovery.",
    dermatological:
      "Blog articles on hydrogen therapy research for skin health, wound healing, and dermatological conditions.",
    renal:
      "Research articles exploring molecular hydrogen's potential benefits for kidney health and renal function.",
    oncological:
      "Articles on hydrogen therapy research in the context of cancer treatment support and cell protection.",
    immunological:
      "Explore how molecular hydrogen may modulate immune function and support immune health.",
  };

  return (
    descriptions[lower] ||
    `Browse our collection of research-backed blog articles about molecular hydrogen and ${name.toLowerCase()} health. Each article is based on peer-reviewed scientific studies.`
  );
}

interface BlogArticle {
  id: number;
  title: string;
  slug: string;
  summary: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  articleType?: string | null;
  createdAt: string;
  viewCount?: number;
  semanticKeywords?: string[] | null;
  authorBio?: string | null;
  studyId?: number;
  studyCategory?: string;
}

interface BlogsByCategoryResponse {
  data: BlogArticle[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  category: string;
}

export default function BlogCategoryPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug || "";
  const [page, setPage] = React.useState(1);
  const limit = 20;

  const displayName = slugToDisplayName(slug);
  const description = getCategoryDescription(displayName);

  const { data: response, isLoading } = useQuery<BlogsByCategoryResponse>({
    queryKey: ["/api/blogs/by-category", slug, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      const res = await fetch(
        `/api/blogs/by-category/${encodeURIComponent(slug)}?${params.toString()}`
      );
      if (!res.ok) throw new Error("Failed to fetch blogs for category");
      return res.json();
    },
    enabled: !!slug,
  });

  const articles = response?.data || [];
  const total = response?.total || 0;
  const totalPages = response?.totalPages || 1;

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const canonicalUrl = `https://hydrogenstudies.com/blog/category/${slug}`;
  const pageTitle = `Hydrogen Research Blog: ${displayName}`;
  const metaDescription = description.substring(0, 160);

  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>{pageTitle} | Hydrogen Studies</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={metaDescription} />

        {/* JSON-LD CollectionPage schema */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: pageTitle,
            description: description,
            url: canonicalUrl,
            isPartOf: {
              "@type": "WebSite",
              name: "Hydrogen Studies",
              url: "https://hydrogenstudies.com",
            },
            breadcrumb: {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "Home",
                  item: "https://hydrogenstudies.com/",
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: "Blog",
                  item: "https://hydrogenstudies.com/blog",
                },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: displayName,
                },
              ],
            },
            numberOfItems: total,
            ...(articles.length > 0
              ? {
                  mainEntity: {
                    "@type": "ItemList",
                    numberOfItems: total,
                    itemListElement: articles.slice(0, 10).map((a, i) => ({
                      "@type": "ListItem",
                      position: i + 1,
                      url: `https://hydrogenstudies.com/blog/${a.slug || a.id}`,
                      name: a.title,
                    })),
                  },
                }
              : {}),
          })}
        </script>
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <PageBreadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Blog", href: "/blog" },
              { label: displayName },
            ]}
          />
        </div>

        {/* Hero Section */}
        <section className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <Link to="/blog">
              <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-teal-700 hover:text-teal-800">
                <ChevronLeft className="h-4 w-4 mr-1" />
                All Blog Articles
              </Button>
            </Link>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Hydrogen Research Blog:{" "}
              <span className="bg-gradient-to-r from-teal-600 to-purple-600 bg-clip-text text-transparent">
                {displayName}
              </span>
            </h1>
            <p className="text-lg text-gray-600 mb-4">{description}</p>
            <Badge className="bg-teal-100 text-teal-800 px-3 py-1">
              {total} {total === 1 ? "article" : "articles"} in this category
            </Badge>
          </div>
        </section>

        {/* Article Grid */}
        <section className="py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="h-full animate-pulse">
                    <div className="aspect-video bg-gray-200 rounded-t-lg" />
                    <CardHeader>
                      <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
                      <div className="h-5 bg-gray-200 rounded w-full mb-1" />
                      <div className="h-5 bg-gray-200 rounded w-3/4" />
                    </CardHeader>
                    <CardContent>
                      <div className="h-3 bg-gray-200 rounded w-full mb-2" />
                      <div className="h-3 bg-gray-200 rounded w-2/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : articles.length === 0 ? (
              <div className="text-center py-16">
                <TrendingUp className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No articles found
                </h3>
                <p className="text-gray-600 mb-6">
                  There are no published blog articles in the {displayName}{" "}
                  category yet.
                </p>
                <Link to="/blog">
                  <Button variant="outline">Browse All Articles</Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {articles.map((article) => (
                    <Link
                      key={article.id}
                      href={`/blog/${article.slug || article.id}`}
                    >
                      <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                        <div className="aspect-video bg-gradient-to-br from-teal-50 to-cyan-50">
                          <img
                            src={
                              article.imageUrl ||
                              "/images/fallback-study-image.svg"
                            }
                            alt={
                              article.imageAlt ||
                              `${article.title} - Hydrogen therapy research`
                            }
                            className="w-full h-full object-cover rounded-t-lg"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "/images/fallback-study-image.svg";
                            }}
                          />
                        </div>
                        <CardHeader>
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="secondary">
                              {(
                                article.articleType ||
                                "Article"
                              )
                                .replace(/_/g, " ")
                                .replace(/\b\w/g, (c: string) =>
                                  c.toUpperCase()
                                )}
                            </Badge>
                          </div>
                          <CardTitle className="text-lg line-clamp-2">
                            {article.title}
                          </CardTitle>
                          <CardDescription className="line-clamp-2">
                            {article.summary}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                            <div className="flex items-center">
                              <User className="h-3 w-3 mr-1" />
                              {article.authorBio ? "AI Researcher" : "Editor"}
                            </div>
                            <div className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              {formatDate(article.createdAt)}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {(
                              Array.isArray(article.semanticKeywords)
                                ? article.semanticKeywords
                                : []
                            )
                              .slice(0, 3)
                              .map((tag: string, index: number) => (
                                <Badge
                                  key={index}
                                  variant="outline"
                                  className="text-xs capitalize"
                                >
                                  {typeof tag === "string"
                                    ? tag.replace(/_/g, " ")
                                    : ""}
                                </Badge>
                              ))}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-12">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600 px-4">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}
