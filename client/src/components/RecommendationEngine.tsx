import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EnhancedStudyCard } from "@/components/EnhancedStudyCard";
import { 
  Sparkles, 
  TrendingUp, 
  Clock, 
  Target,
  Heart,
  Brain,
  Shield,
  RefreshCw,
  ArrowRight
} from "lucide-react";
import { Link } from "wouter";

interface Study {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate: string;
  category: string;
  imageUrl?: string;
  simplifiedExplanation?: string;
  healthBenefits?: string[];
  healthConditions?: string[];
  bodySystems?: string[];
  lifeStages?: string[];
  studyTypes?: string[];
  mechanisms?: string[];
  enhancedWithAI?: boolean;
  readingLevel?: string;
  estimatedReadTime?: number;
  popularityScore?: number;
  relevanceScore: number;
  recommendationReason: string;
  tags?: string[];
}

interface RecommendationData {
  recommendations: Study[];
  totalFound: number;
  recommendationType: string;
  recommendationReasons: string[];
}

interface RecommendationEngineProps {
  userId?: number;
  targetStudyId?: number;
  maxResults?: number;
  showTabs?: boolean;
  variant?: 'full' | 'compact' | 'sidebar';
  healthFocus?: string;
}

export default function RecommendationEngine({
  userId,
  targetStudyId,
  maxResults = 8,
  showTabs = true,
  variant = 'full',
  healthFocus
}: RecommendationEngineProps) {
  const [activeTab, setActiveTab] = useState('personalized');
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch recommendations based on active tab
  const { data: recommendations, isLoading, refetch } = useQuery({
    queryKey: ['/api/recommendations', activeTab, userId, targetStudyId, maxResults, refreshKey],
    queryFn: async (): Promise<RecommendationData> => {
      let endpoint = '/api/recommendations';
      const params = new URLSearchParams();
      
      if (userId) params.set('userId', userId.toString());
      if (maxResults) params.set('maxResults', maxResults.toString());
      if (healthFocus) params.set('healthFocus', healthFocus);

      switch (activeTab) {
        case 'similar':
          if (targetStudyId) {
            endpoint = `/api/recommendations/similar/${targetStudyId}`;
          }
          break;
        case 'trending':
          endpoint = '/api/recommendations/trending';
          break;
        case 'recent':
          endpoint = '/api/recommendations/recent';
          break;
        case 'discovery':
          endpoint = '/api/recommendations/health-discovery';
          break;
        default:
          params.set('recommendationType', 'personalized');
      }

      const response = await fetch(`${endpoint}?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch recommendations');
      const result = await response.json();
      return result.data;
    },
  });

  // Record interaction when user views a study
  const recordInteraction = async (studyId: number, interactionType: 'view' | 'like' | 'share') => {
    if (!userId) return;

    try {
      await fetch('/api/recommendations/interaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          studyId,
          interactionType
        })
      });
    } catch (error) {
      console.error('Failed to record interaction:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'personalized': return <Target className="h-4 w-4" />;
      case 'similar': return <Sparkles className="h-4 w-4" />;
      case 'trending': return <TrendingUp className="h-4 w-4" />;
      case 'recent': return <Clock className="h-4 w-4" />;
      case 'discovery': return <Heart className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const getRecommendationIcon = (reason: string) => {
    if (reason.includes('heart') || reason.includes('cardio')) return <Heart className="h-4 w-4 text-red-500" />;
    if (reason.includes('brain') || reason.includes('neuro')) return <Brain className="h-4 w-4 text-blue-500" />;
    return <Shield className="h-4 w-4 text-green-500" />;
  };

  if (variant === 'compact') {
    return (
      <Card className="w-full">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Recommended for You
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-20 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : recommendations?.recommendations.length ? (
            <div className="space-y-3">
              {recommendations.recommendations.slice(0, 3).map((study) => (
                <Link 
                  key={study.id} 
                  href={`/enhanced-study/${study.id}`}
                  onClick={() => recordInteraction(study.id, 'view')}
                >
                  <EnhancedStudyCard study={study} variant="compact" />
                </Link>
              ))}
              <Link href="/enhanced-search">
                <Button variant="outline" className="w-full mt-3">
                  View All Recommendations
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No recommendations available</p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              Trending Studies
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="animate-pulse h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {recommendations?.recommendations.slice(0, 2).map((study) => (
                  <Link 
                    key={study.id} 
                    href={`/enhanced-study/${study.id}`}
                    onClick={() => recordInteraction(study.id, 'view')}
                  >
                    <EnhancedStudyCard study={study} variant="compact" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recommendation Reasons */}
        {recommendations?.recommendationReasons && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Why These Studies?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recommendations.recommendationReasons.slice(0, 3).map((reason, index) => (
                  <div key={index} className="flex items-start gap-2 text-xs text-gray-600">
                    {getRecommendationIcon(reason)}
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-500" />
            Personalized Study Recommendations
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
        {recommendations?.totalFound && (
          <p className="text-gray-600">
            Found {recommendations.totalFound} studies tailored to your interests
          </p>
        )}
      </CardHeader>

      <CardContent>
        {showTabs ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="personalized" className="flex items-center gap-2">
                {getTabIcon('personalized')}
                For You
              </TabsTrigger>
              {targetStudyId && (
                <TabsTrigger value="similar" className="flex items-center gap-2">
                  {getTabIcon('similar')}
                  Similar
                </TabsTrigger>
              )}
              <TabsTrigger value="trending" className="flex items-center gap-2">
                {getTabIcon('trending')}
                Trending
              </TabsTrigger>
              <TabsTrigger value="recent" className="flex items-center gap-2">
                {getTabIcon('recent')}
                Recent
              </TabsTrigger>
              <TabsTrigger value="discovery" className="flex items-center gap-2">
                {getTabIcon('discovery')}
                Discover
              </TabsTrigger>
            </TabsList>

            {['personalized', 'similar', 'trending', 'recent', 'discovery'].map((tab) => (
              <TabsContent key={tab} value={tab} className="space-y-4">
                {isLoading ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-48 bg-gray-200 rounded-lg"></div>
                      </div>
                    ))}
                  </div>
                ) : recommendations?.recommendations.length ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    {recommendations.recommendations.map((study, index) => (
                      <Link 
                        key={study.id} 
                        href={`/enhanced-study/${study.id}`}
                        onClick={() => recordInteraction(study.id, 'view')}
                      >
                        <EnhancedStudyCard 
                          study={study} 
                          variant={index === 0 ? "featured" : "default"}
                        />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Card className="p-8 text-center">
                    <CardContent>
                      <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        No recommendations yet
                      </h3>
                      <p className="text-gray-600 mb-4">
                        Start reading studies to get personalized recommendations
                      </p>
                      <Link href="/enhanced-search">
                        <Button>
                          Explore Studies
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="space-y-4">
            {isLoading ? (
              <div className="grid gap-6 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-48 bg-gray-200 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : recommendations?.recommendations.length ? (
              <div className="grid gap-6 md:grid-cols-2">
                {recommendations.recommendations.map((study, index) => (
                  <Link 
                    key={study.id} 
                    href={`/enhanced-study/${study.id}`}
                    onClick={() => recordInteraction(study.id, 'view')}
                  >
                    <EnhancedStudyCard 
                      study={study} 
                      variant={index === 0 ? "featured" : "default"}
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <CardContent>
                  <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No recommendations available
                  </h3>
                  <p className="text-gray-600">
                    Try adjusting your preferences or explore our study catalog
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}