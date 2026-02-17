import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import {
  ArrowLeft,
  Calendar,
  User,
  BookOpen,
  ExternalLink,
  Share2,
  Download,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import SiteHeader from "@/components/layout/SiteHeader";
import { StudyCard } from "@/components/studies/StudyCard";
import { PlainLanguageView } from "@/components/studies/PlainLanguageView";
import { ScientificView } from "@/components/studies/ScientificView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { motion } from "framer-motion";

interface Study {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate: string;
  category: string;
  doi: string;
  imageUrl?: string;
  slug: string;
  plainLanguageTitle?: string;
  plainLanguageSummary?: string;
  keyFindings?: string;
  studyType?: string;
  participantCount?: number;
  duration?: string;
  dosage?: string;
  deliveryMethod?: string;
  healthBenefits?: string;
  targetDemographic?: string;
  safetyNotes?: string;
}

export default function StudyDetailsPage() {
  const [match, params] = useRoute("/study/:slug");
  const [study, setStudy] = useState<Study | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!match || !params?.slug) return;

    const fetchStudy = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/studies/slug/${params.slug}`);

        if (!response.ok) {
          throw new Error("Study not found");
        }

        const data = await response.json();
        setStudy(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load study");
      } finally {
        setLoading(false);
      }
    };

    fetchStudy();
  }, [match, params?.slug]);

  if (loading) {
    return (
      <>
        <SiteHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </>
    );
  }

  if (error || !study) {
    return (
      <>
        <SiteHeader />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-8 text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                Study Not Found
              </h1>
              <p className="text-gray-600 mb-6">
                {error || "The requested study could not be found."}
              </p>
              <Link href="/search">
                <Button>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Search
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: study.plainLanguageTitle || study.title,
          text:
            study.plainLanguageSummary ||
            study.abstract.substring(0, 200) + "...",
          url: window.location.href,
        });
      } catch (err) {
        console.log("Error sharing:", err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <>
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm transition-all duration-300">
         <SiteHeader />
      </div>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Breadcrumbs */}
        <div className="mb-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/search">Search</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-semibold text-gray-900 truncate max-w-[200px] md:max-w-md">
                  {study.plainLanguageTitle || study.title}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Study Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row gap-6">
            {study.imageUrl && (
              <div className="md:w-1/3">
                <img
                  src={study.imageUrl}
                  alt={study.plainLanguageTitle || study.title}
                  className="w-full h-48 md:h-64 object-cover rounded-lg shadow-md"
                />
              </div>
            )}
            <div className={study.imageUrl ? "md:w-2/3" : "w-full"}>
              <div className="flex flex-wrap gap-2 mb-3">
                {study.category && (
                  <Badge variant="secondary">{study.category}</Badge>
                )}
                {study.studyType && (
                  <Badge variant="outline">{study.studyType}</Badge>
                )}
              </div>

              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {study.plainLanguageTitle || study.title}
              </h1>

              <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
                {study.authors && (
                  <div className="flex items-center">
                    <User className="mr-1 h-4 w-4" />
                    {study.authors}
                  </div>
                )}
                {study.journal && (
                  <div className="flex items-center">
                    <BookOpen className="mr-1 h-4 w-4" />
                    {study.journal}
                  </div>
                )}
                {study.publishDate && (
                  <div className="flex items-center">
                    <Calendar className="mr-1 h-4 w-4" />
                    {new Date(study.publishDate).getFullYear()}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={handleShare} variant="outline" size="sm">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
                {study.doi && (
                  <a
                    href={`https://doi.org/${study.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Original
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Study Content */}
        <div className="space-y-6">
          {/* Tabbed Interface */}
          <Tabs defaultValue="plain" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 p-1 bg-gray-100/80 rounded-xl h-auto">
              <TabsTrigger 
                value="plain" 
                className="rounded-lg py-3 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-teal-700 data-[state=active]:shadow-sm transition-all"
              >
                Plain Language
              </TabsTrigger>
              <TabsTrigger 
                value="scientific"
                className="rounded-lg py-3 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-teal-700 data-[state=active]:shadow-sm transition-all"
              >
                Scientific Details
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="plain" className="animate-in fade-in-50 duration-500">
                <PlainLanguageView study={study} />
            </TabsContent>
            
            <TabsContent value="scientific" className="animate-in fade-in-50 duration-500">
                <ScientificView study={study} />
            </TabsContent>
          </Tabs>

          {/* Recommendations Section */}
          <RecommendationsSection studyId={study.id} />
        </div>
      </div>
    </>
  );
}

function RecommendationsSection({ studyId }: { studyId: number }) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const response = await fetch(`/api/studies/${studyId}/recommendations`);
        if (response.ok) {
          const data = await response.json();
          setRecommendations(data || []);
        }
      } catch (error) {
        console.error("Failed to load recommendations", error);
      } finally {
        setLoading(false);
      }
    };

    if (studyId) {
      fetchRecommendations();
    }
  }, [studyId]);

  if (loading) return null;
  if (recommendations.length === 0) return null;

  return (
    <div className="mt-12 pt-8 border-t border-gray-200">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Similar Research</h2>
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, staggerChildren: 0.1 }}
      >
        {recommendations.map((rec, index) => (
          <motion.div
            key={rec.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <StudyCard 
                id={rec.id}
                title={rec.title}
                category={rec.category}
                authors={rec.authors}
                publishDate={rec.publishDate}
                imageUrl={rec.imageUrl}
                reason={rec.reason || rec.recommendationReason}
                relevanceScore={rec.score || rec.relevanceScore}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function InsightsSection({ studyId }: { studyId: number }) {
  const [insights, setInsights] = useState<any>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const response = await fetch(`/api/studies/${studyId}/insights`);
        if (response.ok) {
          const data = await response.json();
          // Only set if we actually have data
          if (Object.keys(data).length > 0) {
             setInsights(data);
          }
        }
      } catch (error) {
        console.error("Failed to load insights", error);
      }
    };

    if (studyId) fetchInsights();
  }, [studyId]);

  if (!insights) return null;

  return (
    <div className="mt-8 mb-8 p-6 bg-gradient-to-r from-teal-50 to-indigo-50 rounded-xl border border-teal-100">
       <h3 className="text-lg font-semibold text-teal-900 mb-4 flex items-center">
         <span className="mr-2">✨</span> AI Study Insights
       </h3>
       
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {insights.aiOptimizationScore && (
             <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="text-sm text-gray-500 mb-1">Quality Score</div>
                <div className="text-2xl font-bold text-teal-600">
                   {insights.aiOptimizationScore}/100
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                   <div 
                      className="bg-teal-600 h-2 rounded-full" 
                      style={{ width: `${insights.aiOptimizationScore}%` }}
                   ></div>
                </div>
             </div>
          )}
          
          {insights.topicalRelevance && (
             <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="text-sm text-gray-500 mb-1">Topical Authority</div>
                <div className="text-2xl font-bold text-purple-600">
                   {insights.topicalRelevance}/100
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                   <div 
                      className="bg-purple-600 h-2 rounded-full" 
                      style={{ width: `${insights.topicalRelevance}%` }}
                   ></div>
                </div>
             </div>
          )}

          {insights.sentimentAnalysis && (
              <div className="bg-white p-4 rounded-lg shadow-sm">
                 <div className="text-sm text-gray-500 mb-1">Sentiment</div>
                 <div className="text-lg font-medium text-gray-800 capitalize">
                    {/* Parse JSON if needed, or just display if simple string */}
                    {typeof insights.sentimentAnalysis === 'string' 
                        ? insights.sentimentAnalysis 
                        : JSON.stringify(insights.sentimentAnalysis).slice(0, 20) + "..."
                    }
                 </div>
              </div>
          )}
       </div>
    </div>
  );
}
