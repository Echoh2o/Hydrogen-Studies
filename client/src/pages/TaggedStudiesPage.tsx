import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute, Link } from "wouter";
import { formatAuthors } from "@/lib/utils";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Filter,
  BookOpen,
  Users,
  FlaskConical,
  Heart,
} from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { Helmet } from "react-helmet";

interface Tag {
  id: number;
  name: string;
  slug: string;
  category: string;
  color?: string;
  usageCount: number;
}

interface TagCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  color?: string;
  tagCount: number;
}

interface StudyWithTags {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate: string;
  category: string;
  slug?: string;
  imageUrl?: string;
  viewCount: number;
  tags: Array<{
    id: number;
    name: string;
    category: string;
    color?: string;
    confidence: number;
    source: string;
  }>;
}

interface SearchResults {
  studies: StudyWithTags[];
  total: number;
  searchedTags: Tag[];
  matchType: string;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export default function TaggedStudiesPage() {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/studies/tags/:category?");

  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    params?.category || "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [matchType, setMatchType] = useState<"any" | "all">("any");

  // Fetch available tags
  const { data: tags, isLoading: tagsLoading } = useQuery<{ tags: Tag[] }>({
    queryKey: [
      "/api/tags",
      {
        category: selectedCategory === "all" ? undefined : selectedCategory,
        limit: 100,
      },
    ],
    enabled: true,
  });

  // Fetch tag categories
  const { data: categories } = useQuery<{ categories: TagCategory[] }>({
    queryKey: ["/api/tags/categories"],
  });

  // Fetch popular tags by category
  const { data: popularTags } = useQuery<{
    popularTagsByCategory: Array<{ category: string; tags: Tag[] }>;
  }>({
    queryKey: ["/api/tags/popular-by-category", { limit: 5 }],
  });

  // Search studies by selected tags
  const { data: searchResults, isLoading: searchLoading } =
    useQuery<SearchResults>({
      queryKey: [
        "/api/search/by-tags",
        {
          tagIds: selectedTags.length > 0 ? selectedTags : undefined,
          category: selectedCategory === "all" ? undefined : selectedCategory,
          matchType,
          limit: 20,
        },
      ],
      enabled: selectedTags.length > 0 || selectedCategory !== "all",
    });

  // Filter tags based on search query
  const filteredTags =
    tags?.tags.filter((tag) =>
      tag.name.toLowerCase().includes(searchQuery.toLowerCase()),
    ) || [];

  const handleTagSelect = (tagId: number) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setSelectedTags([]);
    setLocation(`/study/tags/${category}`);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "health_condition":
        return <Heart className="h-4 w-4" />;
      case "study_type":
        return <FlaskConical className="h-4 w-4" />;
      case "body_system":
        return <Users className="h-4 w-4" />;
      default:
        return <BookOpen className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "health_condition":
        return "bg-red-100 text-red-800";
      case "study_type":
        return "bg-teal-100 text-teal-800";
      case "body_system":
        return "bg-green-100 text-green-800";
      case "mechanism":
        return "bg-purple-100 text-purple-800";
      case "delivery_method":
        return "bg-orange-100 text-orange-800";
      case "outcome":
        return "bg-emerald-100 text-emerald-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>Tagged Studies - Hydrogen Studies Database</title>
        <meta name="description" content="Browse hydrogen research studies by tags and categories." />
      </Helmet>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Browse Studies by Tags
          </h1>
          <p className="text-muted-foreground">
            Discover hydrogen research organized by automated content analysis
          </p>
        </div>

        <Tabs defaultValue="browse" className="space-y-6">
          <TabsList>
            <TabsTrigger value="browse">Browse by Category</TabsTrigger>
            <TabsTrigger value="search">Search Tags</TabsTrigger>
            <TabsTrigger value="popular">Popular Tags</TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories?.categories.map((category) => (
                <Card
                  key={category.slug}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleCategorySelect(category.slug)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(category.slug)}
                      <CardTitle className="text-lg">{category.name}</CardTitle>
                    </div>
                    <CardDescription>{category.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary">
                      {category.tagCount} tags available
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="search" className="space-y-6">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Tag Selection Panel */}
              <div className="lg:w-1/3">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Filter className="h-5 w-5" />
                      <span>Filter Tags</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Search Tags</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search for tags..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Category</label>
                      <Select
                        value={selectedCategory}
                        onValueChange={setSelectedCategory}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All categories</SelectItem>
                          {categories?.categories.map((cat) => (
                            <SelectItem key={cat.slug} value={cat.slug}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Match Type</label>
                      <Select
                        value={matchType}
                        onValueChange={(value) =>
                          setMatchType(value as "any" | "all")
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any selected tags</SelectItem>
                          <SelectItem value="all">All selected tags</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedTags.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Selected Tags
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {selectedTags.map((tagId) => {
                            const tag = tags?.tags.find((t) => t.id === tagId);
                            return tag ? (
                              <Badge
                                key={tagId}
                                variant="default"
                                className="cursor-pointer"
                                onClick={() => handleTagSelect(tagId)}
                              >
                                {tag.name} ×
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Available Tags */}
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>Available Tags</CardTitle>
                    <CardDescription>
                      {filteredTags.length} tags found
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {tagsLoading ? (
                      <div className="space-y-2">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className="h-6 bg-gray-200 rounded animate-pulse"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-96 overflow-y-auto">
                        {filteredTags.map((tag) => (
                          <div
                            key={tag.id}
                            className="flex items-center justify-between p-2 rounded hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleTagSelect(tag.id)}
                          >
                            <div className="flex items-center space-x-2">
                              <span className="text-sm">{tag.name}</span>
                              <Badge
                                variant="outline"
                                className={`text-xs ${getCategoryColor(tag.category)}`}
                              >
                                {tag.category.replace(/_/g, " ")}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {tag.usageCount}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Search Results */}
              <div className="lg:w-2/3">
                {searchResults?.studies ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold">
                        {searchResults.total} Studies Found
                      </h2>
                      {searchResults.searchedTags.length > 0 && (
                        <div className="flex items-center space-x-1">
                          <span className="text-sm text-muted-foreground">
                            Filtered by:
                          </span>
                          {searchResults.searchedTags.map((tag) => (
                            <Badge key={tag.id} variant="secondary">
                              {tag.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {searchLoading ? (
                      <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                          <Card key={i}>
                            <CardContent className="p-6">
                              <div className="space-y-2">
                                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                                <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4" />
                                <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {searchResults.studies.map((study) => (
                          <Card
                            key={study.id}
                            className="hover:shadow-md transition-shadow"
                          >
                            <CardContent className="p-6">
                              <div className="space-y-3">
                                <h3 className="font-semibold text-lg leading-tight">
                                  {study.title}
                                </h3>

                                <div className="text-sm text-muted-foreground">
                                  <span className="font-medium">
                                    {formatAuthors(study.authors)}
                                  </span>
                                  {" • "}
                                  <span>{study.journal}</span>
                                  {" • "}
                                  <span>{study.publishDate}</span>
                                </div>

                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {study.abstract}
                                </p>

                                <div className="flex flex-wrap gap-1">
                                  {study.tags.map((tag) => (
                                    <Badge
                                      key={tag.id}
                                      variant="outline"
                                      className={`text-xs ${getCategoryColor(tag.category)}`}
                                    >
                                      {tag.name}
                                    </Badge>
                                  ))}
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                  <span className="text-xs text-muted-foreground">
                                    {study.viewCount} views
                                  </span>
                                  <Link href={study.slug ? `/study/${study.slug}` : `/study/id/${study.id}`}>
                                    <Button variant="outline" size="sm">
                                      View Study
                                    </Button>
                                  </Link>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">
                        Select tags to search
                      </h3>
                      <p className="text-muted-foreground">
                        Choose tags from the left panel to find relevant studies
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="popular" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {popularTags?.popularTagsByCategory.map((categoryGroup) => (
                <Card key={categoryGroup.category}>
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(categoryGroup.category)}
                      <CardTitle className="capitalize">
                        {categoryGroup.category.replace(/_/g, " ")}
                      </CardTitle>
                    </div>
                    <CardDescription>
                      Most popular tags in this category
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {categoryGroup.tags.map((tag) => (
                        <div
                          key={tag.id}
                          className="flex items-center justify-between p-2 rounded hover:bg-gray-50 cursor-pointer"
                          onClick={() => handleTagSelect(tag.id)}
                        >
                          <span className="text-sm font-medium">
                            {tag.name}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {tag.usageCount}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </>
  );
}
