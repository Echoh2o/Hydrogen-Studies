import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/ProtectedRoute";
import { Link, useLocation } from "wouter";
import { Helmet } from "react-helmet";
import {
  Bookmark,
  Clock,
  Search,
  Heart,
  TrendingUp,
  Settings,
  ChevronRight,
  Droplets,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Footer from "@/components/layout/Footer";
import SiteHeader from "@/components/layout/SiteHeader";

interface DashboardData {
  savedStudies: Array<{
    studyId: number;
    savedAt: string;
    studyTitle: string;
    studySlug: string;
    studyCategory: string;
    plainLanguageTitle: string;
    imageUrl: string | null;
  }>;
  recentViews: Array<{
    studyId: number;
    viewedAt: string;
    studyTitle: string;
    studySlug: string;
    studyCategory: string;
    plainLanguageTitle: string;
  }>;
  preferences: {
    healthConditions: string[];
    bodySystems: string[];
    lifeStages: string[];
    readingLevel: string;
    emailNotifications: boolean;
    notificationFrequency: string;
  } | null;
  recentSearches: string[];
  stats: {
    savedCount: number;
    viewedCount: number;
    searchCount: number;
  };
}

export default function MyDashboardPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: dashboard, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/me/dashboard"],
    enabled: !!user,
  });

  if (!user) {
    return (
      <>
      <SiteHeader />
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center space-y-4">
            <Droplets className="h-12 w-12 text-teal-500 mx-auto" />
            <h2 className="text-2xl font-bold">Sign in to access your dashboard</h2>
            <p className="text-muted-foreground">
              Save studies, track your reading, and get personalized recommendations.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => setLocation("/login")}>Sign In</Button>
              <Button variant="outline" onClick={() => setLocation("/register")}>
                Create Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      </>
    );
  }

  const firstName = user.username || "there";

  return (
    <>
    <SiteHeader />
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <Helmet>
        <title>My Dashboard | Hydrogen Studies</title>
      </Helmet>

      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          Welcome back, {firstName}
        </h1>
        <p className="text-muted-foreground mt-1">
          Your personal hydrogen research hub
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Bookmark className="h-8 w-8 text-teal-500" />
            <div>
              <p className="text-2xl font-bold">{dashboard?.stats.savedCount || 0}</p>
              <p className="text-sm text-muted-foreground">Saved Studies</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{dashboard?.stats.viewedCount || 0}</p>
              <p className="text-sm text-muted-foreground">Studies Read</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Search className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{dashboard?.stats.searchCount || 0}</p>
              <p className="text-sm text-muted-foreground">Searches</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Saved Studies */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2">
                <Bookmark className="h-5 w-5 text-teal-500" />
                Saved Studies
              </CardTitle>
              {(dashboard?.savedStudies?.length || 0) > 5 && (
                <Button variant="ghost" size="sm" onClick={() => setLocation("/studies")}>
                  View all <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground text-center py-8">Loading...</p>
              ) : !dashboard?.savedStudies?.length ? (
                <div className="text-center py-8 space-y-3">
                  <Heart className="h-10 w-10 text-muted-foreground mx-auto" />
                  <p className="text-muted-foreground">No saved studies yet</p>
                  <p className="text-sm text-muted-foreground">
                    Browse studies and click the bookmark icon to save them here.
                  </p>
                  <Button variant="outline" onClick={() => setLocation("/studies")}>
                    Browse Studies
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {dashboard?.savedStudies?.slice(0, 5)?.map((study) => (
                    <Link
                      key={study.studyId}
                      href={study.studySlug ? `/study/${study.studySlug}` : `/study/id/${study.studyId}`}
                      className="block p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <p className="font-medium text-sm line-clamp-2">
                        {study.plainLanguageTitle || study.studyTitle}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {study.studyCategory && (
                          <Badge variant="secondary" className="text-xs">
                            {study.studyCategory}
                          </Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recently Viewed */}
          <Card className="mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                Recently Viewed
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!dashboard?.recentViews?.length ? (
                <p className="text-muted-foreground text-center py-6 text-sm">
                  Studies you view will appear here.
                </p>
              ) : (
                <div className="space-y-2">
                  {dashboard?.recentViews?.slice(0, 8)?.map((view) => (
                    <Link
                      key={`${view.studyId}-${view.viewedAt}`}
                      href={view.studySlug ? `/study/${view.studySlug}` : `/study/id/${view.studyId}`}
                      className="block p-2 rounded hover:bg-muted transition-colors"
                    >
                      <p className="text-sm line-clamp-1">
                        {view.plainLanguageTitle || view.studyTitle}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {view.viewedAt ? new Date(view.viewedAt).toLocaleDateString() : ""}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                Explore
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={() => setLocation("/explore-by-condition")}>
                <Heart className="h-4 w-4 mr-2 text-red-500" />
                Browse by Condition
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => setLocation("/explore-by-body-system")}>
                <Droplets className="h-4 w-4 mr-2 text-blue-500" />
                Browse by Body System
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => setLocation("/recommendations")}>
                <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
                Recommendations
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => setLocation("/blog")}>
                <BookOpen className="h-4 w-4 mr-2 text-purple-500" />
                Research Blog
              </Button>
            </CardContent>
          </Card>

          {/* Recent Searches */}
          {(dashboard?.recentSearches?.length || 0) > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-purple-500" />
                  Recent Searches
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {dashboard?.recentSearches?.slice(0, 8)?.map((query, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => setLocation(`/search?q=${encodeURIComponent(query)}`)}
                    >
                      {query}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Health Interests */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                My Interests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!dashboard?.preferences?.healthConditions?.length ? (
                <div className="text-center space-y-3 py-4">
                  <p className="text-sm text-muted-foreground">
                    Tell us your health interests to get personalized recommendations.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setLocation("/explore-by-condition")}>
                    Set Interests
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {dashboard.preferences.healthConditions.map((condition, i) => (
                    <Badge key={i} variant="outline">{condition}</Badge>
                  ))}
                  {dashboard.preferences.bodySystems?.map((system, i) => (
                    <Badge key={`bs-${i}`} variant="outline">{system}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    <Footer />
    </>
  );
}
