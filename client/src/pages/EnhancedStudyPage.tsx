import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Users, 
  BookOpen, 
  Sparkles, 
  Heart, 
  Brain, 
  Shield,
  Download,
  ExternalLink,
  Share2,
  Eye,
  ThumbsUp
} from "lucide-react";
import { Helmet } from "react-helmet";

interface Study {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate: string;
  category: string;
  doi?: string;
  methods?: string;
  results?: string;
  conclusion?: string;
  healthCondition?: string;
  intervention?: string;
  population?: string;
  imageUrl?: string;
  simplifiedExplanation?: string;
  tags?: string[];
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
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  viewCount?: number;
}

export default function EnhancedStudyPage() {
  const { id } = useParams();
  
  const { data: study, isLoading, error } = useQuery({
    queryKey: [`/api/studies/${id}`],
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/5"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !study) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Card className="p-8 text-center">
          <CardContent>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Study Not Found</h2>
            <p className="text-gray-600 mb-6">
              The study you're looking for could not be found.
            </p>
            <Link href="/studies">
              <Button>Browse All Studies</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getReadingLevelColor = (level?: string) => {
    const colors: Record<string, string> = {
      'beginner': 'bg-green-100 text-green-800 border-green-200',
      'intermediate': 'bg-blue-100 text-blue-800 border-blue-200',
      'advanced': 'bg-orange-100 text-orange-800 border-orange-200',
      'expert': 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[level || ''] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getHealthBenefitIcon = (benefit: string) => {
    if (benefit.toLowerCase().includes('heart') || benefit.toLowerCase().includes('cardio')) {
      return <Heart className="h-4 w-4" />;
    }
    if (benefit.toLowerCase().includes('brain') || benefit.toLowerCase().includes('neuro')) {
      return <Brain className="h-4 w-4" />;
    }
    return <Shield className="h-4 w-4" />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>{study.seoTitle || study.title} | Hydrogen Studies</title>
        <meta name="description" content={study.seoDescription || study.abstract.substring(0, 160)} />
        {study.seoKeywords && <meta name="keywords" content={study.seoKeywords.join(', ')} />}
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/studies">
            <Button variant="ghost" className="mb-4 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Studies
            </Button>
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2">
              <Card className="border-none shadow-lg">
                <CardHeader className="pb-6">
                  {/* AI Enhancement Badge */}
                  {study.enhancedWithAI && (
                    <div className="flex items-center gap-2 mb-4">
                      <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                        <Sparkles className="h-4 w-4 mr-2" />
                        AI Enhanced Content
                      </Badge>
                      {study.readingLevel && (
                        <Badge className={getReadingLevelColor(study.readingLevel)}>
                          {study.readingLevel} reading level
                        </Badge>
                      )}
                    </div>
                  )}

                  <CardTitle className="text-3xl font-bold text-gray-900 leading-tight mb-4">
                    {study.title}
                  </CardTitle>

                  {/* Meta Information */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(study.publishDate)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      <span>{study.journal}</span>
                    </div>
                    {study.estimatedReadTime && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>{study.estimatedReadTime} min read</span>
                      </div>
                    )}
                    {study.viewCount && (
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        <span>{study.viewCount.toLocaleString()} views</span>
                      </div>
                    )}
                  </div>

                  <Separator className="my-4" />

                  <div className="text-sm text-gray-600">
                    <strong>Authors:</strong> {study.authors}
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Study Image */}
                  {study.imageUrl && (
                    <div className="mb-8 relative">
                      <img
                        src={study.imageUrl}
                        alt={`Study visualization: ${study.title}`}
                        className="w-full rounded-lg shadow-md max-h-96 object-cover"
                      />
                      {study.enhancedWithAI && (
                        <div className="absolute top-4 right-4 bg-purple-500 text-white rounded-full p-2 shadow-lg">
                          <Sparkles className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Simplified Explanation */}
                  {study.simplifiedExplanation && (
                    <Card className="mb-8 border-l-4 border-l-blue-500 bg-blue-50">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg text-blue-900 flex items-center gap-2">
                          <Sparkles className="h-5 w-5" />
                          Plain Language Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-blue-800 leading-relaxed text-lg">
                          {study.simplifiedExplanation}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Tabs for Study Content */}
                  <Tabs defaultValue="overview" className="mb-8">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="methods">Methods</TabsTrigger>
                      <TabsTrigger value="results">Results</TabsTrigger>
                      <TabsTrigger value="details">Details</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="mt-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Abstract</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-gray-700 leading-relaxed">
                            {study.abstract}
                          </p>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="methods" className="mt-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Methods</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-gray-700 leading-relaxed">
                            {study.methods || "Method details not available for this study."}
                          </p>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="results" className="mt-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Results</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-gray-700 leading-relaxed">
                            {study.results || "Result details not available for this study."}
                          </p>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="details" className="mt-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Study Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {study.population && (
                            <div>
                              <strong className="text-gray-900">Population:</strong>
                              <p className="text-gray-700">{study.population}</p>
                            </div>
                          )}
                          {study.intervention && (
                            <div>
                              <strong className="text-gray-900">Intervention:</strong>
                              <p className="text-gray-700">{study.intervention}</p>
                            </div>
                          )}
                          {study.conclusion && (
                            <div>
                              <strong className="text-gray-900">Conclusion:</strong>
                              <p className="text-gray-700">{study.conclusion}</p>
                            </div>
                          )}
                          {study.doi && (
                            <div>
                              <strong className="text-gray-900">DOI:</strong>
                              <p className="text-gray-700">{study.doi}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-8 space-y-6">
                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button className="w-full" variant="outline">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share Study
                    </Button>
                    <Button className="w-full" variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                    {study.doi && (
                      <Button className="w-full" variant="outline" asChild>
                        <a href={`https://doi.org/${study.doi}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Original
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Health Benefits */}
                {study.healthBenefits && study.healthBenefits.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Health Benefits</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {study.healthBenefits.map((benefit) => (
                          <Badge key={benefit} className="w-full justify-start bg-green-100 text-green-800 border-green-200">
                            {getHealthBenefitIcon(benefit)}
                            <span className="ml-2">{benefit}</span>
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Health Conditions */}
                {study.healthConditions && study.healthConditions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Health Conditions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {study.healthConditions.map((condition) => (
                          <Badge key={condition} variant="outline" className="w-full justify-start border-amber-200 text-amber-800">
                            {condition}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Body Systems */}
                {study.bodySystems && study.bodySystems.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Body Systems</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {study.bodySystems.map((system) => (
                          <Badge key={system} variant="outline" className="w-full justify-start border-purple-200 text-purple-700">
                            {system}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Study Classification */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Study Classification</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Category:</span>
                      <Badge variant="secondary" className="ml-2">{study.category}</Badge>
                    </div>
                    
                    {study.studyTypes && study.studyTypes.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-700">Study Type:</span>
                        <div className="mt-1 space-y-1">
                          {study.studyTypes.map((type) => (
                            <Badge key={type} variant="outline" className="block w-full justify-start">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {study.lifeStages && study.lifeStages.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-700">Life Stage:</span>
                        <div className="mt-1 space-y-1">
                          {study.lifeStages.map((stage) => (
                            <Badge key={stage} variant="secondary" className="block w-full justify-start">
                              {stage}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Mechanisms */}
                {study.mechanisms && study.mechanisms.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Mechanisms</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {study.mechanisms.map((mechanism) => (
                          <Badge key={mechanism} variant="outline" className="w-full justify-start text-xs">
                            {mechanism}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}