import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  CheckCircle,
  Brain,
  TrendingUp,
  Star,
  Flag,
  FileText,
  Users,
  Calendar,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BookOpen,
  Target,
  Shield,
  AlertCircle,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StudyPreviewProps {
  study: {
    id: number;
    title: string;
    authors: string;
    journal: string;
    publishDate: string;
    category: string;
    scores: {
      overall: number;
      methodology: number;
      impact: number;
      relevance: number;
      redFlags: string[];
      redFlagCount: number;
    } | null;
    recommendations: {
      priority: "high" | "medium" | "low";
      suggestedActions: string[];
      keyFindings: string[];
      suggestedCategories: string[];
    } | null;
  };
}

const StudyPreviewAssistant: React.FC<StudyPreviewProps> = ({ study }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(
    "summary",
  );
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch detailed recommendations if not already loaded
  const { data: recommendations } = useQuery({
    queryKey: ["/api/review-assistant/recommendations", study.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/review-assistant/recommendations/${study.id}`);
      return await res.json() as any;
    },
    enabled: !study.recommendations,
  });

  // Fetch similar studies
  const { data: similarStudies } = useQuery({
    queryKey: ["/api/review-assistant/similar-studies", study.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/review-assistant/similar-studies/${study.id}?limit=5`);
      return await res.json() as any;
    },
  });

  const fullRecommendations: any =
    study.recommendations || recommendations?.recommendations;

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Poor";
  };

  const renderScoreBar = (
    label: string,
    score: number,
    icon: React.ReactNode,
  ) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1">
          {icon}
          <span className="font-medium">{label}</span>
        </div>
        <span className={cn("font-bold", getScoreColor(score))}>
          {score} - {getScoreLabel(score)}
        </span>
      </div>
      <Progress value={score} className="h-2" />
    </div>
  );

  return (
    <Card className="h-[calc(100vh-250px)] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Study Preview Assistant</CardTitle>
        <p className="text-sm text-muted-foreground">
          Automated analysis and recommendations
        </p>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="h-full flex flex-col"
        >
          <TabsList className="grid w-full grid-cols-3 mx-4 max-w-[calc(100%-2rem)]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="related">Related</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-4">
            <TabsContent value="overview" className="space-y-4 pb-4">
              {/* Quick Summary */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Quick Summary
                </h3>
                <div className="bg-accent/50 rounded-lg p-3">
                  <h4 className="font-medium text-sm mb-2 line-clamp-2">
                    {study.title}
                  </h4>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span className="line-clamp-1">
                        {study.authors.split(",").slice(0, 3).join(", ")}
                        {study.authors.split(",").length > 3 && " et al."}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      <span>{study.journal}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {new Date(study.publishDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quality Scores */}
              {study.scores && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Quality Scores
                  </h3>
                  <div className="space-y-3">
                    <div className="bg-primary/5 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">Overall Score</span>
                        <span
                          className={cn(
                            "text-lg font-bold",
                            getScoreColor(study.scores.overall),
                          )}
                        >
                          {study.scores.overall}/100
                        </span>
                      </div>
                      <Progress value={study.scores.overall} className="h-3" />
                    </div>

                    {renderScoreBar(
                      "Methodology",
                      study.scores.methodology,
                      <Brain className="h-3 w-3" />,
                    )}
                    {renderScoreBar(
                      "Impact",
                      study.scores.impact,
                      <TrendingUp className="h-3 w-3" />,
                    )}
                    {renderScoreBar(
                      "Relevance",
                      study.scores.relevance,
                      <Star className="h-3 w-3" />,
                    )}
                  </div>
                </div>
              )}

              {/* Red Flags */}
              {study.scores?.redFlags && study.scores.redFlags.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>
                      {study.scores.redFlags.length} Red Flags Detected:
                    </strong>
                    <ul className="mt-2 list-disc list-inside text-xs">
                      {study.scores.redFlags.map((flag, idx) => (
                        <li key={idx}>{flag}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Suggested Actions */}
              {fullRecommendations?.suggestedActions && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Suggested Actions
                  </h3>
                  <div className="space-y-2">
                    {fullRecommendations.suggestedActions.map((action: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span className="text-sm">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="analysis" className="space-y-4 pb-4">
              {/* Key Findings */}
              {fullRecommendations?.keyFindings &&
                fullRecommendations.keyFindings.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Key Findings
                    </h3>
                    <div className="space-y-2">
                      {fullRecommendations.keyFindings.map((finding: string, idx: number) => (
                        <div
                          key={idx}
                          className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3"
                        >
                          <p className="text-sm">{finding}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Strengths */}
              {fullRecommendations?.strengthsIdentified &&
                fullRecommendations.strengthsIdentified.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <ThumbsUp className="h-4 w-4" />
                      Strengths Identified
                    </h3>
                    <div className="space-y-2">
                      {fullRecommendations.strengthsIdentified.map(
                        (strength: string, idx: number) => (
                          <div key={idx} className="flex items-start gap-2">
                            <Shield className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
                            <span className="text-sm">{strength}</span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

              {/* Potential Issues */}
              {fullRecommendations?.potentialIssues &&
                fullRecommendations.potentialIssues.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Potential Issues
                    </h3>
                    <div className="space-y-2">
                      {fullRecommendations.potentialIssues.map((issue: string, idx: number) => (
                        <div
                          key={idx}
                          className="bg-yellow-50 dark:bg-yellow-950/30 rounded-lg p-3"
                        >
                          <p className="text-sm">{issue}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Auto-Categorization */}
              {fullRecommendations && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Flag className="h-4 w-4" />
                    Auto-Categorization
                  </h3>
                  <div className="space-y-2">
                    {fullRecommendations.suggestedCategories &&
                      fullRecommendations.suggestedCategories.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-1">
                            Suggested Categories:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {fullRecommendations.suggestedCategories.map(
                              (cat: string, idx: number) => (
                                <Badge
                                  key={idx}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {cat}
                                </Badge>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                    {fullRecommendations.suggestedTags &&
                      fullRecommendations.suggestedTags.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-1">
                            Suggested Tags:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {fullRecommendations.suggestedTags.map(
                              (tag: string, idx: number) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {tag}
                                </Badge>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                    {fullRecommendations.healthConditions &&
                      fullRecommendations.healthConditions.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-1">
                            Health Conditions:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {fullRecommendations.healthConditions.map(
                              (condition: string, idx: number) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {condition}
                                </Badge>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                    {fullRecommendations.deliveryMethods &&
                      fullRecommendations.deliveryMethods.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-1">
                            Delivery Methods:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {fullRecommendations.deliveryMethods.map(
                              (method: string, idx: number) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {method}
                                </Badge>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              )}

              {/* Blog Topics */}
              {fullRecommendations?.suggestedBlogTopics &&
                fullRecommendations.suggestedBlogTopics.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Suggested Blog Topics
                    </h3>
                    <div className="space-y-2">
                      {fullRecommendations.suggestedBlogTopics.map(
                        (topic: string, idx: number) => (
                          <div
                            key={idx}
                            className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3"
                          >
                            <p className="text-sm">{topic}</p>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}
            </TabsContent>

            <TabsContent value="related" className="space-y-4 pb-4">
              {/* Study Classification */}
              {fullRecommendations && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Study Classification
                  </h3>
                  <div className="bg-accent/50 rounded-lg p-3 space-y-2">
                    {fullRecommendations.studyTypeClassification && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Study Type:
                        </span>
                        <Badge>
                          {fullRecommendations.studyTypeClassification}
                        </Badge>
                      </div>
                    )}
                    {fullRecommendations.isFollowUp && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Follow-up Study:
                        </span>
                        <Badge variant="secondary">Yes</Badge>
                      </div>
                    )}
                    {fullRecommendations.isReplication && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Replication Study:
                        </span>
                        <Badge variant="secondary">Yes</Badge>
                      </div>
                    )}
                    {fullRecommendations.confidenceScore !== undefined && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          AI Confidence:
                        </span>
                        <span
                          className={cn(
                            "font-bold",
                            getScoreColor(fullRecommendations.confidenceScore),
                          )}
                        >
                          {fullRecommendations.confidenceScore}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Similar Studies */}
              {similarStudies?.similarStudies &&
                similarStudies.similarStudies.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      Similar Studies
                    </h3>
                    <div className="space-y-2">
                      {similarStudies.similarStudies.map(
                        (similar: any, idx: number) => (
                          <div
                            key={idx}
                            className="bg-accent/50 rounded-lg p-3"
                          >
                            <h4 className="text-sm font-medium mb-1 line-clamp-2">
                              {similar.title}
                            </h4>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {similar.journal} •{" "}
                                {new Date(similar.publishDate).getFullYear()}
                              </span>
                              {similar.overallScore && (
                                <Badge variant="outline" className="text-xs">
                                  Score: {similar.overallScore}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

              {/* Research Team Info */}
              {fullRecommendations?.researchTeamId && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Research Team
                  </h3>
                  <div className="bg-accent/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      Team ID:
                    </p>
                    <code className="text-xs bg-background px-1 py-0.5 rounded">
                      {fullRecommendations.researchTeamId}
                    </code>
                    {fullRecommendations.studyGroupId && (
                      <>
                        <p className="text-xs text-muted-foreground mb-1 mt-2">
                          Study Group:
                        </p>
                        <code className="text-xs bg-background px-1 py-0.5 rounded">
                          {fullRecommendations.studyGroupId}
                        </code>
                      </>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>

      {/* Quick Actions Footer */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" variant="default">
            <CheckCircle className="h-4 w-4 mr-1" />
            Approve
          </Button>
          <Button size="sm" className="flex-1" variant="outline">
            <Copy className="h-4 w-4 mr-1" />
            Duplicate Check
          </Button>
          <Button size="sm" variant="ghost">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default StudyPreviewAssistant;
