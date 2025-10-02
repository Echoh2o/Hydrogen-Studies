import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Star, TrendingUp, Clock, Users, BookOpen, Target } from "lucide-react";

interface RecommendedStudy {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate: string;
  relevanceScore: number;
  recommendationReason: string;
  tags: Array<{
    id: number;
    name: string;
    category: string;
  }>;
  viewCount: number;
}

interface PersonalizedRecommendations {
  trending: RecommendedStudy[];
  recentlyViewed: RecommendedStudy[];
  similarToViewed: RecommendedStudy[];
  topRated: RecommendedStudy[];
  forYou: RecommendedStudy[];
}

interface UserInterests {
  tags: Array<{
    name: string;
    weight: number;
    category: string;
  }>;
  categories: Array<{
    name: string;
    percentage: number;
  }>;
  recentActivity: Array<{
    studyId: number;
    title: string;
    viewedAt: string;
  }>;
}

export default function RecommendationsPage() {
  const [activeTab, setActiveTab] = useState("for-you");

  // Get personalized recommendations based on user behavior and tagging
  const { data: recommendations, isLoading: recommendationsLoading } =
    useQuery<PersonalizedRecommendations>({
      queryKey: ["/api/recommendations/personalized"],
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

  // Get user interests profile
  const { data: userInterests } = useQuery<UserInterests>({
    queryKey: ["/api/recommendations/user-interests"],
  });

  // Get curated collections based on tags
  const { data: collections } = useQuery({
    queryKey: ["/api/recommendations/collections"],
  });

  const getRecommendationReasonColor = (reason: string) => {
    switch (reason.toLowerCase()) {
      case "trending":
        return "bg-orange-100 text-orange-800";
      case "similar tags":
        return "bg-blue-100 text-blue-800";
      case "high rated":
        return "bg-green-100 text-green-800";
      case "recent research":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const renderStudyCard = (study: RecommendedStudy, showReason = true) => (
    <Card key={study.id} className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-lg leading-tight flex-1">
              {study.title}
            </h3>
            {showReason && (
              <Badge
                variant="outline"
                className={`ml-2 text-xs ${getRecommendationReasonColor(study.recommendationReason)}`}
              >
                {study.recommendationReason}
              </Badge>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            <span className="font-medium">{study.authors}</span>
            {" • "}
            <span>{study.journal}</span>
            {" • "}
            <span>{study.publishDate}</span>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2">
            {study.abstract}
          </p>

          <div className="flex flex-wrap gap-1">
            {study.tags.slice(0, 5).map((tag) => (
              <Badge key={tag.id} variant="outline" className="text-xs">
                {tag.name}
              </Badge>
            ))}
            {study.tags.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{study.tags.length - 5} more
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
              <span className="flex items-center">
                <Users className="h-3 w-3 mr-1" />
                {study.viewCount} views
              </span>
              <span className="flex items-center">
                <Star className="h-3 w-3 mr-1" />
                {Math.round(study.relevanceScore * 100)}% match
              </span>
            </div>
            <Button variant="outline" size="sm">
              View Study
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Recommended for You
        </h1>
        <p className="text-muted-foreground">
          Personalized study recommendations based on your interests and
          research patterns
        </p>
      </div>

      {/* User Interest Profile */}
      {userInterests && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <span>Your Research Interests</span>
            </CardTitle>
            <CardDescription>
              Based on your viewing history and interaction patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">Top Interest Categories</h4>
                <div className="space-y-2">
                  {userInterests.categories
                    .slice(0, 5)
                    .map((category, index) => (
                      <div key={category.name} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize">
                            {category.name.replace(/_/g, " ")}
                          </span>
                          <span>{category.percentage}%</span>
                        </div>
                        <Progress value={category.percentage} className="h-2" />
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Frequently Viewed Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {userInterests.tags.slice(0, 10).map((tag, index) => (
                    <Badge
                      key={tag.name}
                      variant="secondary"
                      className="text-xs"
                      style={{ opacity: Math.max(0.5, tag.weight) }}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendation Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="for-you" className="flex items-center space-x-1">
            <Target className="h-4 w-4" />
            <span>For You</span>
          </TabsTrigger>
          <TabsTrigger value="trending" className="flex items-center space-x-1">
            <TrendingUp className="h-4 w-4" />
            <span>Trending</span>
          </TabsTrigger>
          <TabsTrigger value="recent" className="flex items-center space-x-1">
            <Clock className="h-4 w-4" />
            <span>Recent</span>
          </TabsTrigger>
          <TabsTrigger
            value="top-rated"
            className="flex items-center space-x-1"
          >
            <Star className="h-4 w-4" />
            <span>Top Rated</span>
          </TabsTrigger>
          <TabsTrigger
            value="collections"
            className="flex items-center space-x-1"
          >
            <BookOpen className="h-4 w-4" />
            <span>Collections</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="for-you" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Personalized Recommendations
            </h2>
            <Badge variant="outline">AI-Powered</Badge>
          </div>

          {recommendationsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
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
          ) : recommendations?.forYou ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.forYou.map((study) => renderStudyCard(study))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  Building your profile
                </h3>
                <p className="text-muted-foreground">
                  Browse some studies to get personalized recommendations
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="trending" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Trending Research</h2>
            <Badge variant="outline">Popular This Week</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations?.trending?.map((study) =>
              renderStudyCard(study),
            ) ||
              [...Array(6)].map((_, i) => (
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
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recently Published</h2>
            <Badge variant="outline">Latest Research</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations?.recentlyViewed?.map((study) =>
              renderStudyCard(study),
            ) ||
              [...Array(6)].map((_, i) => (
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
        </TabsContent>

        <TabsContent value="top-rated" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Highly Rated Studies</h2>
            <Badge variant="outline">Community Favorites</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations?.topRated?.map((study) =>
              renderStudyCard(study),
            ) ||
              [...Array(6)].map((_, i) => (
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
        </TabsContent>

        <TabsContent value="collections" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Curated Collections</h2>
            <Badge variant="outline">Expert Selected</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                title: "Cardiovascular Health",
                description: "Studies on heart health and circulation benefits",
                studyCount: 18,
                tags: [
                  "Cardiovascular Disease",
                  "Heart Health",
                  "Blood Pressure",
                ],
              },
              {
                title: "Brain & Cognitive Function",
                description:
                  "Neuroprotection and cognitive enhancement research",
                studyCount: 24,
                tags: ["Neuroprotection", "Cognitive Function", "Brain Health"],
              },
              {
                title: "Athletic Performance",
                description: "Sports medicine and performance optimization",
                studyCount: 12,
                tags: ["Athletic Performance", "Recovery", "Exercise"],
              },
              {
                title: "Anti-Aging Research",
                description: "Longevity and cellular health studies",
                studyCount: 16,
                tags: ["Anti-Aging", "Oxidative Stress", "Cellular Health"],
              },
              {
                title: "Metabolic Health",
                description: "Diabetes, metabolism, and weight management",
                studyCount: 21,
                tags: ["Diabetes", "Metabolism", "Weight Management"],
              },
              {
                title: "Inflammatory Conditions",
                description: "Anti-inflammatory effects and immune support",
                studyCount: 19,
                tags: ["Anti-inflammatory", "Immune System", "Inflammation"],
              },
            ].map((collection, index) => (
              <Card
                key={index}
                className="cursor-pointer hover:shadow-md transition-shadow"
              >
                <CardHeader>
                  <CardTitle className="text-lg">{collection.title}</CardTitle>
                  <CardDescription>{collection.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {collection.studyCount} studies
                      </span>
                      <Button variant="outline" size="sm">
                        Explore
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {collection.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
