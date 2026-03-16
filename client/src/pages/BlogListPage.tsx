import React, { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Calendar,
  User,
  Tag,
  Clock,
  TrendingUp,
  ChevronRight,
  Search,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import PageBreadcrumb from "@/components/seo/PageBreadcrumb";

export default function BlogListPage() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("all");
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterSubmitted, setNewsletterSubmitted] = useState(false);

  const newsletterMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "blog_page" }),
      });
      if (!res.ok) throw new Error("Failed to subscribe");
      return res.json();
    },
    onSuccess: () => {
      setNewsletterSubmitted(true);
      setNewsletterEmail("");
    },
  });

  // Fetch blog articles from database
  const { data: response, isLoading } = useQuery({
    queryKey: ["/api/blogs", { search: searchTerm, filterType: selectedCategory }],
    queryFn: async () => {
        const params = new URLSearchParams();
        if (searchTerm) params.append("search", searchTerm);
        if (selectedCategory && selectedCategory !== "all") params.append("filterType", selectedCategory);
        
        const res = await fetch(`/api/blogs?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch blogs");
        return res.json();
    }
  });

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "research-insights", label: "Research Insights" },
    { value: "health-benefits", label: "Health Benefits" },
    { value: "product-applications", label: "Product Applications" },
    { value: "company-news", label: "Company News" },
    { value: "expert-interviews", label: "Expert Interviews" },
    { value: "case-studies", label: "Case Studies" },
  ];

  const articles: any[] = response?.data || [];
  const filteredArticles = articles;

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>Hydrogen Health Blog - Latest Articles &amp; Research Insights</title>
        <meta name="description" content="Read the latest articles on hydrogen therapy research, health benefits, and scientific discoveries from our expert team." />
        <meta property="og:title" content="Hydrogen Health Blog - Latest Articles & Research Insights" />
        <meta property="og:description" content="Read the latest articles on hydrogen therapy research, health benefits, and scientific discoveries from our expert team." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hydrogenstudies.com/blog" />
        <meta name="twitter:card" content="summary" />
        <link rel="canonical" href="https://hydrogenstudies.com/blog" />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <PageBreadcrumb items={[
            { label: "Home", href: "/" },
            { label: "Blog" },
          ]} />
        </div>
        {/* Hero Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <TrendingUp className="h-16 w-16 text-teal-600 mx-auto mb-6" />
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              Research
              <span className="bg-gradient-to-r from-teal-600 to-purple-600 bg-clip-text text-transparent">
                {" "}
                Blog
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Insights, analysis, and the latest developments in hydrogen health
              research
            </p>
            <Badge className="bg-teal-100 text-teal-800 px-4 py-2">
              Editorial content by experts and researchers
            </Badge>
          </div>
        </section>

        {/* Search and Filter */}
        <section className="py-8 px-4 sm:px-6 lg:px-8 bg-white border-y">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search articles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center space-x-4">
                <Select
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Article */}
        {filteredArticles.find((article) => article.featured) && (
          <section className="py-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-8">
                Featured Article
              </h2>
              {filteredArticles
                .filter((article) => article.featured)
                .slice(0, 1)
                .map((article) => (
                  <Link key={article.id} href={`/blog/${article.id}`}>
                    <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden">
                      <div className="md:flex">
                        <div className="md:w-1/2">
                          <img
                            src={article.imageUrl || "/images/fallback-study-image.svg"}
                            alt={article.imageAlt || `${article.title} - Hydrogen therapy research`}
                            className="w-full h-64 md:h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="md:w-1/2 p-8">
                          <div className="flex items-center space-x-4 mb-4">
                            <Badge className="bg-teal-100 text-teal-800">
                              {article.category}
                            </Badge>
                            <Badge variant="outline">Featured</Badge>
                          </div>
                          <h3 className="text-2xl font-bold text-gray-900 mb-4 line-clamp-2">
                            {article.title}
                          </h3>
                          <p className="text-gray-600 mb-6 line-clamp-3">
                            {article.summary}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <div className="flex items-center">
                                <User className="h-4 w-4 mr-1" />
                                {article.author}
                              </div>
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                {formatDate(article.publishDate)}
                              </div>
                              <div className="flex items-center">
                                <Clock className="h-4 w-4 mr-1" />
                                {article.readTime}
                              </div>
                            </div>
                            <div className="flex items-center text-teal-600 font-medium">
                              Read more{" "}
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
            </div>
          </section>
        )}

        {/* Article Grid */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-gray-900">
                Latest Articles
              </h2>
              <p className="text-gray-600">
                {filteredArticles.length} articles found
              </p>
            </div>

            {filteredArticles.length === 0 ? (
              <div className="text-center py-12">
                <TrendingUp className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No articles found
                </h3>
                <p className="text-gray-600">
                  Try adjusting your search or filter criteria
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredArticles
                  .filter((article: any) => !article.featured)
                  .map((article: any) => (
                    <Link key={article.id} href={`/blog/${article.slug || article.id}`}>
                      <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                        <div className="aspect-video">
                          <img
                            src={article.imageUrl || "/images/fallback-study-image.svg"}
                            alt={article.imageAlt || `${article.title} - Hydrogen therapy research`}
                            className="w-full h-full object-cover rounded-t-lg"
                            loading="lazy"
                          />
                        </div>
                        <CardHeader>
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="secondary">
                              {article.articleType || article.category || "Article"}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              {article.readingLevel || "General"}
                            </span>
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
                              {formatDate(article.createdAt || article.publishDate)}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {(article.semanticKeywords || article.tags || []).slice(0, 2).map((tag: string, index: number) => (
                              <Badge
                                key={index}
                                variant="outline"
                                className="text-xs"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
              </div>
            )}
          </div>
        </section>

        {/* Newsletter CTA */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-teal-50">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Stay Updated
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Get the latest hydrogen research insights delivered to your inbox
            </p>
            {newsletterSubmitted ? (
              <p className="text-teal-700 font-medium text-lg">
                Thank you for subscribing! You'll receive our latest hydrogen research updates.
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newsletterEmail.trim()) {
                    newsletterMutation.mutate(newsletterEmail.trim());
                  }
                }}
                className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto"
              >
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  className="flex-1"
                  required
                />
                <Button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-700"
                  disabled={newsletterMutation.isPending}
                >
                  {newsletterMutation.isPending ? "Subscribing..." : "Subscribe"}
                </Button>
              </form>
            )}
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}
