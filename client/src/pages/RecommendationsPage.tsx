import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RecommendationEngine from "@/components/RecommendationEngine";
import { Helmet } from "react-helmet";
import { 
  Sparkles, 
  Target, 
  TrendingUp, 
  Clock, 
  Heart,
  Brain,
  Activity,
  Zap,
  Shield,
  Eye
} from "lucide-react";

const healthFocusAreas = [
  {
    id: "cardiovascular",
    name: "Cardiovascular Health",
    icon: <Heart className="h-5 w-5 text-red-500" />,
    description: "Studies on heart health, blood pressure, and circulation",
    benefits: ["Heart Function", "Blood Circulation", "Cardiovascular Protection"]
  },
  {
    id: "neurological",
    name: "Brain & Cognitive Health",
    icon: <Brain className="h-5 w-5 text-blue-500" />,
    description: "Research on brain function, memory, and neuroprotection",
    benefits: ["Memory Enhancement", "Neuroprotection", "Cognitive Function"]
  },
  {
    id: "metabolic",
    name: "Metabolic Health",
    icon: <Activity className="h-5 w-5 text-green-500" />,
    description: "Studies on metabolism, diabetes, and energy production",
    benefits: ["Blood Sugar Control", "Metabolic Function", "Energy Production"]
  },
  {
    id: "athletic",
    name: "Athletic Performance",
    icon: <Zap className="h-5 w-5 text-orange-500" />,
    description: "Research on exercise performance and recovery",
    benefits: ["Exercise Performance", "Recovery Enhancement", "Endurance"]
  },
  {
    id: "inflammation",
    name: "Anti-Inflammatory",
    icon: <Shield className="h-5 w-5 text-purple-500" />,
    description: "Studies on reducing inflammation and oxidative stress",
    benefits: ["Inflammation Reduction", "Antioxidant Effects", "Cellular Protection"]
  },
  {
    id: "aging",
    name: "Healthy Aging",
    icon: <Eye className="h-5 w-5 text-indigo-500" />,
    description: "Research on longevity and age-related health",
    benefits: ["Longevity", "Age-Related Protection", "Cellular Health"]
  }
];

export default function RecommendationsPage() {
  const [selectedFocus, setSelectedFocus] = useState<string | null>(null);
  
  // In a real app, this would come from user authentication
  const userId = undefined; // Set to actual user ID when authenticated

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Helmet>
        <title>Personalized Study Recommendations | Hydrogen Studies</title>
        <meta name="description" content="Discover hydrogen research studies tailored to your health interests with our AI-powered recommendation engine" />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 flex items-center justify-center gap-3">
            <Sparkles className="h-10 w-10 text-purple-500" />
            Personalized Research Recommendations
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Discover hydrogen health studies tailored to your interests using our AI-powered recommendation engine
          </p>
        </div>

        {/* Health Focus Areas */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Target className="h-6 w-6 text-blue-500" />
              Explore by Health Focus
            </CardTitle>
            <p className="text-gray-600">
              Get targeted recommendations based on specific health areas
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {healthFocusAreas.map((area) => (
                <Card 
                  key={area.id}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-lg border-2 ${
                    selectedFocus === area.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedFocus(selectedFocus === area.id ? null : area.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      {area.icon}
                      <div>
                        <h3 className="font-semibold text-gray-900">{area.name}</h3>
                        <p className="text-sm text-gray-600">{area.description}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {area.benefits.map((benefit) => (
                        <Badge key={benefit} variant="secondary" className="text-xs">
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {selectedFocus && (
              <div className="mt-4 text-center">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedFocus(null)}
                  className="text-blue-600"
                >
                  Clear Selection
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Recommendations */}
        <div className="space-y-8">
          {selectedFocus ? (
            /* Health Focus Specific Recommendations */
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                  {healthFocusAreas.find(area => area.id === selectedFocus)?.icon}
                  {healthFocusAreas.find(area => area.id === selectedFocus)?.name} Studies
                </h2>
                <p className="text-gray-600">
                  Curated research focused on {healthFocusAreas.find(area => area.id === selectedFocus)?.name.toLowerCase()}
                </p>
              </div>
              <RecommendationEngine
                userId={userId}
                maxResults={12}
                showTabs={false}
                variant="full"
                healthFocus={selectedFocus}
              />
            </div>
          ) : (
            /* General Recommendations with Tabs */
            <Tabs defaultValue="personalized" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4 lg:grid-cols-5">
                <TabsTrigger value="personalized" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  <span className="hidden sm:inline">For You</span>
                </TabsTrigger>
                <TabsTrigger value="trending" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Trending</span>
                </TabsTrigger>
                <TabsTrigger value="recent" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">Recent</span>
                </TabsTrigger>
                <TabsTrigger value="discovery" className="flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  <span className="hidden sm:inline">Discover</span>
                </TabsTrigger>
                <TabsTrigger value="comprehensive" className="flex items-center gap-2 hidden lg:flex">
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">All</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="personalized">
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-blue-500" />
                      Personalized for You
                    </CardTitle>
                    <p className="text-gray-600">
                      Studies matched to your reading history and preferences
                    </p>
                  </CardHeader>
                </Card>
                <RecommendationEngine
                  userId={userId}
                  maxResults={12}
                  showTabs={false}
                  variant="full"
                />
              </TabsContent>

              <TabsContent value="trending">
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-orange-500" />
                      Trending Studies
                    </CardTitle>
                    <p className="text-gray-600">
                      Popular studies that are gaining attention in the hydrogen research community
                    </p>
                  </CardHeader>
                </Card>
                <RecommendationEngine
                  userId={userId}
                  maxResults={12}
                  showTabs={false}
                  variant="full"
                />
              </TabsContent>

              <TabsContent value="recent">
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-green-500" />
                      Recent Research
                    </CardTitle>
                    <p className="text-gray-600">
                      Latest hydrogen health studies from leading researchers worldwide
                    </p>
                  </CardHeader>
                </Card>
                <RecommendationEngine
                  userId={userId}
                  maxResults={12}
                  showTabs={false}
                  variant="full"
                />
              </TabsContent>

              <TabsContent value="discovery">
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Heart className="h-5 w-5 text-red-500" />
                      Health Discovery
                    </CardTitle>
                    <p className="text-gray-600">
                      Explore diverse areas of hydrogen health research to broaden your knowledge
                    </p>
                  </CardHeader>
                </Card>
                <RecommendationEngine
                  userId={userId}
                  maxResults={15}
                  showTabs={false}
                  variant="full"
                />
              </TabsContent>

              <TabsContent value="comprehensive" className="hidden lg:block">
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-500" />
                      Comprehensive Recommendations
                    </CardTitle>
                    <p className="text-gray-600">
                      A curated mix of personalized, trending, and recent studies for comprehensive discovery
                    </p>
                  </CardHeader>
                </Card>
                <RecommendationEngine
                  userId={userId}
                  maxResults={20}
                  showTabs={false}
                  variant="full"
                />
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* Information Banner */}
        <Card className="mt-12 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Sparkles className="h-8 w-8 text-purple-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  How Our Recommendation Engine Works
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Our AI-powered system analyzes your reading patterns, health interests, and study characteristics to provide 
                  personalized recommendations. The more you explore, the better our recommendations become. All recommendations 
                  are based on peer-reviewed hydrogen health research with AI-enhanced summaries for easier understanding.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}